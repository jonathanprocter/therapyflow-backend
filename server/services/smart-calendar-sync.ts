/**
 * Smart Calendar Sync Service
 * Enhanced calendar synchronization with AI-powered client matching, circuit breaker,
 * and intelligent scheduling features ported from TherapyGenius
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { storage } from '../storage';
import { aiRouter } from './ai-router';

// Only log in development
const IS_DEV = process.env.NODE_ENV !== 'production';
const devLog = (...args: any[]) => IS_DEV && console.log(...args);

// Types
interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  status?: string;
  created?: string;
  updated?: string;
}

interface SyncStatus {
  isAuthenticated: boolean;
  lastSync?: Date;
  eventsProcessed: number;
  matchesFound: number;
  errors: string[];
  nextSync?: Date;
  syncType: 'full' | 'incremental';
  syncToken?: string;
  rateLimitRemaining?: number;
  quotaUsed?: number;
}

interface ClientMatch {
  clientId: string;
  confidence: number;
  matchReason: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

interface SyncResult {
  success: boolean;
  syncHistoryId: string;
  processingTimeMs: number;
  eventsTotal: number;
  eventsMatched: number;
  eventsRejected: number;
  eventsError: number;
  sessionsCreated: number;
  sessionsUpdated: number;
  errors: string[];
  syncDetails: any;
}

export type TriggerSource = 'user_manual' | 'scheduled' | 'system_scheduled' | 'api_webhook';

/**
 * Background Sync Scheduler
 * Manages automatic sync scheduling with configurable intervals
 */
class CalendarSyncScheduler {
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly SCHEDULER_CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes
  private readonly MAX_CONCURRENT_SYNCS = 3;
  private activeSyncs = new Set<string>();

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    devLog('[Calendar Scheduler] Started - checking every 2 minutes');

    this.checkAndExecuteScheduledSyncs();

    this.schedulerInterval = setInterval(() => {
      this.checkAndExecuteScheduledSyncs();
    }, this.SCHEDULER_CHECK_INTERVAL);
  }

  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.isRunning = false;
    devLog('[Calendar Scheduler] Stopped');
  }

  private async checkAndExecuteScheduledSyncs() {
    try {
      // For now, scheduled syncs are triggered manually per-therapist
      // Future enhancement: track last sync time and auto-sync periodically
      devLog('[Calendar Scheduler] Scheduled sync check - manual trigger required');
    } catch (error) {
      console.error('[Calendar Scheduler] Error in scheduled sync:', error);
    }
  }

  private async executeScheduledSync(therapistId: string) {
    this.activeSyncs.add(therapistId);

    try {
      devLog(`[Calendar Scheduler] Starting sync for ${therapistId}`);
      const result = await smartCalendarSync.syncWithDetailedTracking(
        therapistId,
        'system_scheduled',
        false
      );

      if (result.success) {
        devLog(`[Calendar Scheduler] Completed for ${therapistId} - ${result.eventsTotal} events`);
      } else {
        devLog(`[Calendar Scheduler] Failed for ${therapistId}: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error(`[Calendar Scheduler] Error for ${therapistId}:`, error);
    } finally {
      this.activeSyncs.delete(therapistId);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.SCHEDULER_CHECK_INTERVAL,
      activeSyncs: Array.from(this.activeSyncs),
      maxConcurrentSyncs: this.MAX_CONCURRENT_SYNCS,
    };
  }
}

export const syncScheduler = new CalendarSyncScheduler();

/**
 * Smart Calendar Sync Service
 * Production-ready calendar synchronization with AI matching and circuit breaker
 */
class SmartCalendarSyncService {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  private readonly SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

  // Configuration
  private readonly MAX_EVENTS_PER_SYNC = parseInt(process.env.MAX_EVENTS_PER_SYNC || '1000');
  private readonly SYNC_RATE_LIMIT_MS = parseInt(process.env.SYNC_RATE_LIMIT_MS || '100');
  private readonly CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  // State
  private circuitBreakerState = new Map<string, {
    failures: number;
    lastFailure?: Date;
    isOpen: boolean
  }>();
  private rateLimitCounters = new Map<string, {
    requests: number;
    resetTime: Date
  }>();

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    ) as any;

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(therapistEmail?: string): string {
    const authConfig: any = {
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent'
    };

    if (therapistEmail) {
      authConfig.login_hint = therapistEmail;
    }

    return this.oauth2Client.generateAuthUrl(authConfig);
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, therapistId: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('Failed to obtain access token');
      }

      await storage.storeOAuthTokens?.({
        therapistId,
        provider: 'google',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        tokenType: tokens.token_type ?? undefined,
        scope: tokens.scope ?? undefined
      });
      this.oauth2Client.setCredentials(tokens);

      devLog(`[Smart Calendar] OAuth tokens stored for ${therapistId}`);
    } catch (error) {
      console.error('[Smart Calendar] Error exchanging tokens:', error);
      throw new Error('Failed to authenticate with Google Calendar');
    }
  }

  /**
   * Load stored tokens and refresh if needed
   */
  async loadTokens(therapistId: string): Promise<boolean> {
    try {
      const tokens = await storage.getOAuthTokens?.(therapistId);

      if (!tokens) {
        devLog('[Smart Calendar] No stored tokens found');
        return false;
      }

      this.oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken ?? undefined,
        expiry_date: tokens.expiresAt?.getTime() ?? undefined,
        token_type: tokens.tokenType ?? undefined,
        scope: tokens.scope ?? undefined
      });

      // Proactive refresh 10 minutes before expiry
      const now = Date.now();
      const refreshBuffer = 10 * 60 * 1000;
      const expiresAtMs = tokens.expiresAt?.getTime();
      const shouldRefresh = expiresAtMs && expiresAtMs <= (now + refreshBuffer);

      if (shouldRefresh) {
        devLog('[Smart Calendar] Proactively refreshing tokens');
        await this.refreshTokens(therapistId);
      }

      return true;
    } catch (error) {
      console.error('[Smart Calendar] Error loading tokens:', error);
      return false;
    }
  }

  private async refreshTokens(therapistId: string): Promise<void> {
    try {
      const currentTokens = await storage.getOAuthTokens?.(therapistId);
      if (!currentTokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      await storage.storeOAuthTokens?.({
        therapistId,
        provider: 'google',
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token ?? currentTokens.refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        tokenType: credentials.token_type ?? undefined,
        scope: credentials.scope ?? currentTokens.scope ?? undefined
      });

      this.oauth2Client.setCredentials(credentials);
      devLog('[Smart Calendar] Tokens refreshed successfully');
    } catch (error) {
      console.error('[Smart Calendar] Token refresh failed:', error);
      throw new Error('Failed to refresh OAuth tokens');
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(therapistId: string): Promise<SyncStatus> {
    try {
      const isAuthenticated = await this.loadTokens(therapistId);
      const stats = await storage.getCalendarSyncStats?.(therapistId) || {
        eventsProcessed: 0,
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSyncAt: null
      };

      return {
        isAuthenticated,
        eventsProcessed: stats.eventsProcessed || 0,
        matchesFound: stats.successfulSyncs || 0,
        errors: [],
        syncType: 'full'
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        eventsProcessed: 0,
        matchesFound: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        syncType: 'full'
      };
    }
  }

  /**
   * Enhanced sync with detailed tracking
   */
  async syncWithDetailedTracking(
    therapistId: string,
    triggerSource: TriggerSource = 'user_manual',
    forceFullSync: boolean = false
  ): Promise<SyncResult> {
    const startTime = new Date();
    let syncHistoryId = '';

    // Create initial sync history record
    const syncHistory = await storage.createCalendarSyncHistory?.({
      therapistId,
      syncType: forceFullSync ? 'full' : 'incremental',
      status: 'running',
      startTime,
      triggerSource,
      eventsTotal: 0,
      eventsMatched: 0,
      eventsRejected: 0,
      eventsError: 0,
      sessionsCreated: 0,
      sessionsUpdated: 0,
      errors: [],
      syncDetails: { forceFullSync, startedBy: triggerSource },
      apiCalls: 0
    });

    syncHistoryId = syncHistory?.id || `sync_${Date.now()}`;

    try {
      const syncResult = await this.performSync(therapistId, forceFullSync);

      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - startTime.getTime();

      const syncDetails = {
        forceFullSync,
        startedBy: triggerSource,
        syncType: syncResult.syncType,
        completedAt: endTime.toISOString()
      };

      await storage.updateCalendarSyncHistory?.(syncHistoryId, {
        status: 'completed',
        endTime,
        processingTimeMs,
        eventsTotal: syncResult.eventsProcessed,
        eventsMatched: syncResult.matchesFound,
        eventsRejected: syncResult.eventsProcessed - syncResult.matchesFound,
        eventsError: 0,
        errors: syncResult.errors,
        syncDetails
      });

      return {
        success: true,
        syncHistoryId,
        processingTimeMs,
        eventsTotal: syncResult.eventsProcessed,
        eventsMatched: syncResult.matchesFound,
        eventsRejected: syncResult.eventsProcessed - syncResult.matchesFound,
        eventsError: 0,
        sessionsCreated: 0,
        sessionsUpdated: 0,
        errors: syncResult.errors,
        syncDetails
      };
    } catch (error) {
      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      await storage.updateCalendarSyncHistory?.(syncHistoryId, {
        status: 'failed',
        endTime,
        processingTimeMs,
        errors: [errorMessage],
        syncDetails: { error: errorMessage }
      });

      return {
        success: false,
        syncHistoryId,
        processingTimeMs,
        eventsTotal: 0,
        eventsMatched: 0,
        eventsRejected: 0,
        eventsError: 1,
        sessionsCreated: 0,
        sessionsUpdated: 0,
        errors: [errorMessage],
        syncDetails: { error: errorMessage }
      };
    }
  }

  /**
   * Perform the actual calendar sync
   */
  private async performSync(therapistId: string, forceFullSync: boolean): Promise<SyncStatus> {
    let eventsProcessed = 0;
    let matchesFound = 0;
    const errors: string[] = [];
    let syncType: 'full' | 'incremental' = 'full';

    try {
      // Circuit breaker check
      if (this.isCircuitBreakerOpen(therapistId)) {
        throw new Error('Circuit breaker is open - too many recent failures');
      }

      // Rate limiting check
      if (!this.checkRateLimit(therapistId)) {
        throw new Error('Rate limit exceeded');
      }

      const isAuthenticated = await this.loadTokens(therapistId);
      if (!isAuthenticated) {
        throw new Error('Not authenticated with Google Calendar');
      }

      devLog('[Smart Calendar] Starting sync...');

      // Fetch events
      const events = await this.fetchCalendarEvents(therapistId);
      eventsProcessed = events.length;

      // Process each event
      const clients = await storage.getClients?.(therapistId) || [];

      for (const event of events) {
        try {
          const match = await this.matchEventToClient(event, clients, therapistId);
          if (match) {
            matchesFound++;
            await this.processMatchedEvent(event, match, therapistId);
          }

          // Rate limiting delay
          await this.delay(this.SYNC_RATE_LIMIT_MS);
        } catch (error) {
          errors.push(`Event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Reset circuit breaker on success
      this.resetCircuitBreaker(therapistId);

      return {
        isAuthenticated: true,
        eventsProcessed,
        matchesFound,
        errors,
        syncType
      };
    } catch (error) {
      this.recordCircuitBreakerFailure(therapistId);
      throw error;
    }
  }

  /**
   * Fetch calendar events with pagination
   */
  private async fetchCalendarEvents(therapistId: string): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];
    let pageToken: string | undefined;

    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 6); // 6 months back

    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 3); // 3 months forward

    do {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken
      });

      if (response.data.items) {
        allEvents.push(...response.data.items);
      }

      pageToken = response.data.nextPageToken;

      if (allEvents.length >= this.MAX_EVENTS_PER_SYNC) {
        devLog(`[Smart Calendar] Reached max events limit: ${this.MAX_EVENTS_PER_SYNC}`);
        break;
      }
    } while (pageToken);

    return allEvents;
  }

  /**
   * Multi-strategy client matching
   */
  private async matchEventToClient(
    event: CalendarEvent,
    clients: any[],
    therapistId: string
  ): Promise<ClientMatch | null> {
    if (clients.length === 0) return null;

    const eventTitle = event.summary || '';

    // Step 1: Check saved aliases first
    const aliasMatch = await this.checkAliases(eventTitle, therapistId, clients);
    if (aliasMatch) return aliasMatch;

    const eventInfo = {
      title: eventTitle,
      description: event.description || '',
      attendees: event.attendees?.map(a => ({
        email: a.email,
        name: a.displayName
      })) || [],
      location: event.location || ''
    };

    // Step 2: Direct name matching
    const directMatch = this.findDirectMatch(eventInfo, clients);
    if (directMatch) return directMatch;

    // Step 3: Fuzzy name matching
    const fuzzyMatch = this.findFuzzyNameMatch(eventInfo, clients);
    if (fuzzyMatch) return fuzzyMatch;

    // Step 4: AI-powered matching (if enabled)
    if (process.env.HIPAA_SAFE_AI === 'true') {
      const aiMatch = await this.findAIMatch(eventInfo, clients, therapistId);
      if (aiMatch) return aiMatch;
    }

    return null;
  }

  /**
   * Check saved event aliases
   */
  private async checkAliases(
    eventTitle: string,
    therapistId: string,
    clients: any[]
  ): Promise<ClientMatch | null> {
    try {
      const aliases = await storage.getEventAliases?.(therapistId) || [];

      for (const aliasEntry of aliases) {
        // Simple contains check for alias matching
        if (eventTitle.toLowerCase().includes(aliasEntry.alias.toLowerCase())) {
          const client = clients.find(c => c.id === aliasEntry.clientId);
          if (client) {
            return {
              clientId: client.id,
              confidence: 1.0,
              matchReason: `Saved alias: "${aliasEntry.alias}"`,
              client: {
                id: client.id,
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email
              }
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[Smart Calendar] Error checking aliases:', error);
      return null;
    }
  }

  private testAliasPattern(eventTitle: string, pattern: string, matchType: string): boolean {
    const title = eventTitle.toLowerCase().trim();
    const testPattern = pattern.toLowerCase().trim();

    switch (matchType) {
      case 'exact': return title === testPattern;
      case 'contains': return title.includes(testPattern);
      case 'starts_with': return title.startsWith(testPattern);
      case 'ends_with': return title.endsWith(testPattern);
      case 'regex':
        try {
          return new RegExp(pattern, 'i').test(title);
        } catch {
          return false;
        }
      default: return false;
    }
  }

  /**
   * Direct name matching
   */
  private findDirectMatch(eventInfo: any, clients: any[]): ClientMatch | null {
    const eventTitle = eventInfo.title.toLowerCase();

    for (const client of clients) {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const firstName = client.firstName.toLowerCase();
      const lastName = client.lastName.toLowerCase();

      // Prevent over-matching on very short names
      const MIN_NAME_LENGTH = 2;
      const isAmbiguousName = firstName.length <= MIN_NAME_LENGTH || lastName.length <= MIN_NAME_LENGTH;

      if (isAmbiguousName) {
        // Require exact full name match for ambiguous names
        const fullNamePattern = new RegExp(
          `\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i'
        );

        if (fullNamePattern.test(eventTitle)) {
          return {
            clientId: client.id,
            confidence: 0.9,
            matchReason: 'Exact name pattern match',
            client
          };
        }
      } else {
        // Standard matching for longer names
        if (eventTitle.includes(firstName) && eventTitle.includes(lastName)) {
          return {
            clientId: client.id,
            confidence: 0.9,
            matchReason: 'Direct name match in event title',
            client
          };
        }
      }

      // SimplePractice format: "My Bookable Calendar w/ [Name]"
      const simplePracticeMatch = eventTitle.match(/my bookable calendar w\/ (.+)/i);
      if (simplePracticeMatch) {
        const extractedName = simplePracticeMatch[1].trim().toLowerCase();
        if (extractedName === fullName) {
          return {
            clientId: client.id,
            confidence: 0.9,
            matchReason: 'SimplePractice calendar format match',
            client
          };
        }
      }
    }

    return null;
  }

  /**
   * Fuzzy name matching with nickname and variation handling
   */
  private findFuzzyNameMatch(eventInfo: any, clients: any[]): ClientMatch | null {
    const eventTitle = eventInfo.title.toLowerCase();

    // Common nickname mappings
    const nicknames: Record<string, string[]> = {
      'william': ['will', 'bill', 'billy', 'willy'],
      'robert': ['rob', 'bob', 'bobby', 'robbie'],
      'richard': ['rick', 'dick', 'richie', 'ricky'],
      'michael': ['mike', 'mikey', 'mick'],
      'james': ['jim', 'jimmy', 'jamie'],
      'joseph': ['joe', 'joey'],
      'david': ['dave', 'davey'],
      'thomas': ['tom', 'tommy'],
      'christopher': ['chris', 'kit'],
      'matthew': ['matt', 'matty'],
      'daniel': ['dan', 'danny'],
      'anthony': ['tony', 'ant'],
      'elizabeth': ['liz', 'lizzy', 'beth', 'betty', 'eliza'],
      'jennifer': ['jen', 'jenny'],
      'jessica': ['jess', 'jessie'],
      'katherine': ['kate', 'kathy', 'katie', 'kat'],
      'margaret': ['maggie', 'meg', 'peggy', 'marge'],
      'patricia': ['pat', 'patty', 'trish'],
      'rebecca': ['becky', 'becca'],
      'stephanie': ['steph', 'stephie'],
      'nicholas': ['nick', 'nicky'],
      'jonathan': ['jon', 'jonny']
    };

    for (const client of clients) {
      const firstName = client.firstName.toLowerCase();
      const lastName = client.lastName.toLowerCase();

      // Check for nickname matches
      const possibleNicknames = nicknames[firstName] || [];
      for (const nickname of possibleNicknames) {
        if (eventTitle.includes(nickname) && eventTitle.includes(lastName)) {
          return {
            clientId: client.id,
            confidence: 0.85,
            matchReason: `Nickname match: ${nickname} for ${firstName}`,
            client
          };
        }
      }

      // Check reverse (nickname in database, full name in event)
      for (const [fullName, nicks] of Object.entries(nicknames)) {
        if (nicks.includes(firstName)) {
          if (eventTitle.includes(fullName) && eventTitle.includes(lastName)) {
            return {
              clientId: client.id,
              confidence: 0.85,
              matchReason: `Full name match for nickname: ${firstName}`,
              client
            };
          }
        }
      }

      // Initial matching (e.g., "J. Smith" or "J Smith")
      const initialPattern = new RegExp(
        `\\b${firstName.charAt(0)}\\.?\\s*${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i'
      );
      if (initialPattern.test(eventTitle) && lastName.length > 3) {
        return {
          clientId: client.id,
          confidence: 0.8,
          matchReason: `Initial + last name match`,
          client
        };
      }
    }

    return null;
  }

  /**
   * AI-powered matching using the AI router
   */
  private async findAIMatch(
    eventInfo: any,
    clients: any[],
    therapistId: string
  ): Promise<ClientMatch | null> {
    try {
      const clientList = clients.map(c => `${c.firstName} ${c.lastName}`).join(', ');

      const prompt = `You are matching a calendar event to a client.
Event title: "${eventInfo.title}"
Event description: "${eventInfo.description}"

Available clients: ${clientList}

If the event clearly refers to one of these clients, respond with ONLY their exact name as listed.
If there is no clear match, respond with "NO_MATCH".
Do not include any other text or explanation.`;

      const response = await aiRouter.chat([
        { role: 'system', content: 'You are a calendar-to-client matcher. Respond only with the client name or NO_MATCH.' },
        { role: 'user', content: prompt }
      ]);

      const matchedName = response.content?.trim();

      if (matchedName && matchedName !== 'NO_MATCH') {
        const matchedClient = clients.find(c =>
          `${c.firstName} ${c.lastName}`.toLowerCase() === matchedName.toLowerCase()
        );

        if (matchedClient) {
          return {
            clientId: matchedClient.id,
            confidence: 0.75,
            matchReason: `AI-matched: ${matchedName}`,
            client: matchedClient
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[Smart Calendar] AI matching error:', error);
      return null;
    }
  }

  /**
   * Process a matched event - create/update session
   */
  private async processMatchedEvent(
    event: CalendarEvent,
    match: ClientMatch,
    therapistId: string
  ): Promise<void> {
    try {
      const startTime = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : null;

      if (!startTime) return;

      const endTime = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date)
          : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour

      // Check if session already exists
      const existingSession = await storage.getSessionByGoogleEventId?.(event.id);

      if (existingSession) {
        // Update existing session if times changed
        if (existingSession.scheduledAt?.getTime() !== startTime.getTime()) {
          await storage.updateSession?.(existingSession.id, {
            scheduledAt: startTime,
            duration: Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000))
          });
          devLog(`[Smart Calendar] Updated session ${existingSession.id}`);
        }
      } else {
        // Create new session
        await storage.createSession?.({
          clientId: match.clientId,
          therapistId,
          scheduledAt: startTime,
          duration: Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000)),
          status: startTime < new Date() ? 'completed' : 'scheduled',
          sessionType: 'individual',
          googleEventId: event.id,
          calendarMatchMethod: match.matchReason,
          calendarMatchConfidence: match.confidence
        });
        devLog(`[Smart Calendar] Created session for ${match.client.firstName} ${match.client.lastName}`);
      }
    } catch (error) {
      console.error('[Smart Calendar] Error processing matched event:', error);
    }
  }

  // Circuit breaker methods
  private isCircuitBreakerOpen(therapistId: string): boolean {
    const state = this.circuitBreakerState.get(therapistId);
    if (!state || !state.isOpen) return false;

    // Check if timeout has passed
    if (state.lastFailure) {
      const elapsed = Date.now() - state.lastFailure.getTime();
      if (elapsed >= this.CIRCUIT_BREAKER_TIMEOUT_MS) {
        state.isOpen = false;
        state.failures = 0;
        return false;
      }
    }

    return true;
  }

  private recordCircuitBreakerFailure(therapistId: string): void {
    const state = this.circuitBreakerState.get(therapistId) || { failures: 0, isOpen: false };
    state.failures++;
    state.lastFailure = new Date();

    if (state.failures >= this.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      state.isOpen = true;
      devLog(`[Smart Calendar] Circuit breaker opened for ${therapistId}`);
    }

    this.circuitBreakerState.set(therapistId, state);
  }

  private resetCircuitBreaker(therapistId: string): void {
    this.circuitBreakerState.delete(therapistId);
  }

  // Rate limiting
  private checkRateLimit(therapistId: string): boolean {
    const now = new Date();
    const counter = this.rateLimitCounters.get(therapistId);

    if (!counter || counter.resetTime < now) {
      this.rateLimitCounters.set(therapistId, {
        requests: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour window
      });
      return true;
    }

    if (counter.requests >= 100) { // Max 100 syncs per hour
      return false;
    }

    counter.requests++;
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an event alias for future matching
   */
  async createEventAlias(
    therapistId: string,
    clientId: string,
    pattern: string,
    matchType: 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex' = 'contains'
  ): Promise<void> {
    await storage.createEventAlias?.({
      therapistId,
      clientId,
      pattern,
      matchType,
      createdAt: new Date()
    });
    devLog(`[Smart Calendar] Created alias: "${pattern}" -> ${clientId}`);
  }

  /**
   * Get sync history for a therapist
   */
  async getSyncHistory(therapistId: string, limit: number = 10): Promise<any[]> {
    return await storage.getCalendarSyncHistory?.(therapistId, limit) || [];
  }
}

export const smartCalendarSync = new SmartCalendarSyncService();
