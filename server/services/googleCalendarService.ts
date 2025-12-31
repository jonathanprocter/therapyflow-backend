import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { Session } from '@shared/schema';

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor() {
    // Support multiple deployment environments
    const redirectUri = this.getRedirectUri();
      
    console.log('Using OAuth2 redirect URI:', redirectUri);
      
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Set the refresh token if available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
      
      // Automatically refresh the access token when needed
      this.oauth2Client.on('tokens', (tokens) => {
        console.log('Received new tokens:', tokens.access_token ? 'Access token refreshed' : 'No access token');
        if (tokens.refresh_token) {
          console.log('New refresh token received');
        }
      });
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Get the appropriate redirect URI based on the deployment environment
   */
  private getRedirectUri(): string {
    // Render.com deployment
    if (process.env.RENDER_EXTERNAL_URL) {
      return `${process.env.RENDER_EXTERNAL_URL}/api/calendar/callback`;
    }
    
    // Replit deployment
    if (process.env.REPLIT_DOMAINS) {
      return `https://${process.env.REPLIT_DOMAINS}/api/calendar/callback`;
    }
    
    // Local development
    return 'http://localhost:5000/api/calendar/callback';
  }

  async getAuthUrl(): Promise<string> {
    try {
      console.log('Google OAuth2 Configuration Check:');
      console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'MISSING');
      console.log('- Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Present' : 'MISSING');
      console.log('- Redirect URI:', this.getRedirectUri());
      
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Missing Google OAuth credentials. Please check your Secrets configuration.');
      }

      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ];

      const url = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent', // Force consent screen to ensure refresh token
      });

      console.log('Generated auth URL successfully');
      return url;
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw error;
    }
  }

  async exchangeCodeForTokens(code: string): Promise<any> {
    try {
      console.log('Attempting to exchange authorization code for tokens...');
      const { tokens } = await this.oauth2Client.getToken(code);
      
      console.log('Token exchange successful:');
      console.log('- Access token:', tokens.access_token ? 'Received' : 'Missing');
      console.log('- Refresh token:', tokens.refresh_token ? 'Received' : 'Missing');
      console.log('- Token type:', tokens.token_type);
      console.log('- Expires in:', tokens.expiry_date ? new Date(tokens.expiry_date) : 'No expiry');
      
      this.oauth2Client.setCredentials(tokens);
      
      // Store the refresh token in environment for future use
      if (tokens.refresh_token) {
        console.log('💡 IMPORTANT: Save this refresh token to your Secrets as GOOGLE_REFRESH_TOKEN:');
        console.log(tokens.refresh_token);
      }
      
      return tokens;
    } catch (error) {
      console.error('Error exchanging authorization code:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      // Provide more specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('redirect_uri_mismatch')) {
          throw new Error(
            `OAuth redirect URI mismatch. Expected: ${this.getRedirectUri()}. ` +
            `Please ensure this URI is added to your Google Cloud Console OAuth credentials.`
          );
        }
        if (error.message.includes('invalid_grant')) {
          throw new Error(
            'Invalid authorization code. The code may have expired or already been used. ' +
            'Please restart the OAuth flow.'
          );
        }
      }
      
      throw new Error(`Failed to exchange authorization code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async syncCalendarEvents(therapistId: string, startDate = '2010-01-01', endDate = '2030-12-31'): Promise<Session[]> {
    try {
      // Check if we have any credentials
      const currentCredentials = this.oauth2Client.credentials;
      console.log('Current credentials status:', {
        hasAccessToken: !!currentCredentials.access_token,
        hasRefreshToken: !!currentCredentials.refresh_token,
        envRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
        accessTokenPreview: currentCredentials.access_token ? `${currentCredentials.access_token.substring(0, 20)}...` : 'none',
        refreshTokenPreview: currentCredentials.refresh_token ? `${currentCredentials.refresh_token.substring(0, 20)}...` : 'none'
      });

      // If no current credentials, try using environment refresh token (new or old)
      if (!currentCredentials.access_token && !currentCredentials.refresh_token) {
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN_NEW || process.env.GOOGLE_REFRESH_TOKEN;
        if (!refreshToken) {
          throw new Error('No authentication available. Please authenticate with Google Calendar first.');
        }
        
        this.oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });
      }

      // Get a fresh access token if needed
      try {
        if (!this.oauth2Client.credentials.access_token) {
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          this.oauth2Client.setCredentials(credentials);
          console.log('Successfully refreshed access token');
        }
      } catch (error) {
        console.error('Error refreshing access token:', error);
        throw new Error('Failed to refresh authentication token. Please re-authenticate with Google Calendar.');
      }

      console.log(`Starting comprehensive calendar sync for ${startDate} to ${endDate}`);
      
      // Strategy: Fetch in smaller chunks to avoid API limitations
      const yearlyChunks = this.createDateChunks(startDate, endDate, 'yearly');
      const allEvents: any[] = [];
      
      for (const chunk of yearlyChunks) {
        console.log(`Syncing chunk: ${chunk.start} to ${chunk.end}`);
        
        let pageToken: string | undefined;
        let chunkEvents = 0;

        // Fetch from ALL calendars, not just primary
        try {
          const calendars = await this.getCalendarList();
          console.log(`  Found ${calendars.length} calendars to sync`);
          
          for (const calendar of calendars) {
            try {
              let calendarPageToken: string | undefined;
              do {
                const response = await this.calendar.events.list({
                  calendarId: calendar.id,
                  timeMin: new Date(chunk.start).toISOString(),
                  timeMax: new Date(chunk.end).toISOString(),
                  singleEvents: true, // Expands recurring events
                  orderBy: 'startTime',
                  maxResults: 2500,
                  pageToken: calendarPageToken,
                  showDeleted: false,
                  showHiddenInvitations: false,
                });
                
                const events = response.data.items || [];
                // Add calendar info to each event for filtering
                const eventsWithCalendar = events.map((event: any) => ({
                  ...event,
                  sourceCalendarName: calendar.summary,
                  sourceCalendarId: calendar.id
                }));
                allEvents.push(...eventsWithCalendar);
                chunkEvents += events.length;
                calendarPageToken = response.data.nextPageToken;
                
                console.log(`  Calendar "${calendar.summary}": fetched ${events.length} events`);
              } while (calendarPageToken);
              
            } catch (calendarError: any) {
              console.log(`  Skipping calendar "${calendar.summary}": ${calendarError.message}`);
            }
          }
        } catch (calendarListError: any) {
          // Fallback to primary calendar only
          console.log(`  Falling back to primary calendar only: ${calendarListError.message}`);
          
          do {
            const response = await this.calendar.events.list({
              calendarId: 'primary',
              timeMin: new Date(chunk.start).toISOString(),
              timeMax: new Date(chunk.end).toISOString(),
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 2500,
              pageToken: pageToken,
            });

            const events = response.data.items || [];
            allEvents.push(...events);
            chunkEvents += events.length;
            pageToken = response.data.nextPageToken;
          } while (pageToken);
        }
        
        console.log(`Completed chunk ${chunk.start}: ${chunkEvents} events`);
      }

      console.log(`Total events fetched from Google Calendar: ${allEvents.length}`);
      
      // Filter for SimplePractice events with improved detection
      const relevantEvents = allEvents.filter((event: any) => {
        if (!event.start || !(event.start.dateTime || event.start.date)) {
          return false;
        }

        const summary = (event.summary || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const organizerEmail = (event.organizer?.email || '').toLowerCase();
        const calendarName = (event.organizer?.displayName || '').toLowerCase();
        const sourceCalendar = (event.sourceCalendarName || '').toLowerCase();

        // Check if event is from SimplePractice calendar
        const isSimplePracticeEvent =
          sourceCalendar.includes('simple practice') ||
          sourceCalendar.includes('simplepractice') ||
          organizerEmail.includes('simplepractice') ||
          organizerEmail.includes('simple-practice') ||
          calendarName.includes('simplepractice') ||
          calendarName.includes('simple practice') ||
          summary.includes('simplepractice') ||
          description.includes('simplepractice') ||
          description.includes('simple practice');

        // Exclusion list - definitely not appointments
        const excludePatterns = ['birthday', 'holiday', 'vacation', 'break', 'lunch',
          'staff meeting', 'team meeting', 'office closed', 'pto', 'out of office'];
        const isExcluded = excludePatterns.some(pattern => summary.includes(pattern));

        // For SimplePractice events, include ANY event that looks like a client appointment
        // SimplePractice typically formats as: "Client Name Appointment" or "🔒 Client Name Appointment"
        if (isSimplePracticeEvent && !isExcluded) {
          console.log(`Found SimplePractice appointment: "${event.summary}" from calendar "${event.sourceCalendarName}"`);
          return true;
        }

        // Also check for common SimplePractice appointment formats even if source isn't detected
        // This catches cases where SimplePractice calendar might have different naming
        const hasLockEmoji = event.summary?.includes('🔒');
        const hasAppointmentKeyword = summary.includes('appointment');
        const looksLikeClientName = /^(🔒\s*)?[a-z]+ [a-z]+(\s+[a-z]+)?\s*(appointment)?$/i.test((event.summary || '').trim());

        if ((hasLockEmoji || hasAppointmentKeyword || looksLikeClientName) && !isExcluded) {
          // Log potential SimplePractice appointment found by format
          console.log(`Potential client appointment by format: "${event.summary}" from "${event.sourceCalendarName || 'unknown'}"`);
          return true;
        }

        // Debug: Log some sample filtered out events
        if (Math.random() < 0.05) { // Log 5% of filtered events for debugging
          console.log(`Filtered out: "${event.summary}" | Source: ${event.sourceCalendarName || 'unknown'} | Organizer: ${organizerEmail || 'unknown'}`);
        }

        return false;
      });

      console.log(`Filtered to ${relevantEvents.length} relevant events`);

      // Convert Google Calendar events to Session format
      const sessions: Session[] = relevantEvents.map((event: any, index: number) => {
        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        
        // Calculate duration in minutes
        const duration = startTime && endTime 
          ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60))
          : 50; // Default 50-minute session

        // Extract client name from event summary
        const clientName = this.extractClientName(event.summary || '');
        
        // Detect SimplePractice events (pass calendar name for better detection)
        const isSimplePractice = this.isSimplePracticeEvent(event, event.sourceCalendarName);

        // Parse the date and ensure it's interpreted as EDT/EST
        const eventDate = new Date(startTime);
        
        // If the event doesn't have timezone info, assume it's in EDT
        // Google Calendar API returns times in the calendar's timezone
        const scheduledAtEDT = eventDate;

        return {
          id: `google-${event.id}`,
          clientId: 'calendar-sync-client', // Use default client for calendar sync
          therapistId,
          scheduledAt: scheduledAtEDT,
          duration,
          sessionType: 'individual' as const,
          status: 'scheduled' as const,
          notes: event.description || null,
          googleEventId: event.id,
          hasProgressNotePlaceholder: false,
          progressNoteStatus: 'pending' as const,
          isSimplePracticeEvent: isSimplePractice,
          createdAt: new Date(),
          updatedAt: new Date(),
          // @ts-ignore - Temporary field for client matching
          clientName,
        };
      });

      console.log(`Converted ${sessions.length} events to sessions`);
      return sessions;
    } catch (error) {
      console.error('Error syncing Google Calendar:', error);
      console.error('Full error details:', error instanceof Error ? error.message : String(error));
      throw error; // Re-throw the original error for better debugging
    }
  }

  private async ensureAuthenticated() {
    const currentCredentials = this.oauth2Client.credentials;
    if (!currentCredentials.access_token && !currentCredentials.refresh_token) {
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN_NEW || process.env.GOOGLE_REFRESH_TOKEN;
      if (!refreshToken) {
        throw new Error('No authentication available. Please authenticate with Google Calendar first.');
      }
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    }

    if (!this.oauth2Client.credentials.access_token) {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
    }
  }

  async listEventsInRange(startDate: Date, endDate: Date): Promise<any[]> {
    await this.ensureAuthenticated();

    const events: any[] = [];
    let pageToken: string | undefined;

    try {
      const calendars = await this.getCalendarList();
      for (const calendar of calendars) {
        let calendarPageToken: string | undefined;
        do {
          const response = await this.calendar.events.list({
            calendarId: calendar.id,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 2500,
            pageToken: calendarPageToken,
            showDeleted: false,
          });

          const items = response.data.items || [];
          const annotated = items.map((event: any) => ({
            ...event,
            sourceCalendarId: calendar.id,
            sourceCalendarName: calendar.summary,
          }));
          events.push(...annotated);
          calendarPageToken = response.data.nextPageToken;
        } while (calendarPageToken);
      }
    } catch (error) {
      // Fallback to primary calendar only
      do {
        const response = await this.calendar.events.list({
          calendarId: 'primary',
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 2500,
          pageToken: pageToken,
        });
        events.push(...(response.data.items || []));
        pageToken = response.data.nextPageToken;
      } while (pageToken);
    }

    return events;
  }

  private createDateChunks(startDate: string, endDate: string, chunkType: 'yearly' | 'monthly'): Array<{ start: string; end: string }> {
    const chunks: Array<{ start: string; end: string }> = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let current = new Date(start);
    
    while (current < end) {
      const chunkStart = new Date(current);
      let chunkEnd: Date;
      
      if (chunkType === 'yearly') {
        chunkEnd = new Date(current.getFullYear() + 1, 0, 1);
      } else {
        chunkEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
      
      // Don't go beyond the specified end date
      if (chunkEnd > end) chunkEnd = end;
      
      chunks.push({
        start: chunkStart.toISOString().split('T')[0],
        end: chunkEnd.toISOString().split('T')[0]
      });
      
      current = chunkEnd;
    }
    
    return chunks;
  }

  private isBusinessHours(dateTimeStr: string): boolean {
    const date = new Date(dateTimeStr);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Monday-Friday, 8 AM to 6 PM
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 18;
  }

  private calculateEventDuration(event: any): number {
    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;
    
    if (!startTime || !endTime) return 50; // Default therapy session duration
    
    return Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60));
  }

  private extractClientName(summary: string): string {
    // SimplePractice formats events as "Client Name Appointment" or "🔒 Client Name Appointment"
    // The 🔒 emoji indicates a completed progress note in SimplePractice
    // Examples: "🔒 Chris Balabanick Appointment", "Brian Kolsch Appointment"
    
    // Remove the lock emoji (indicates completed progress note)
    let clientName = summary.replace(/🔒\s*/, '').trim();
    
    // Handle specific client name cleaning for Nick Dabreu
    if (clientName.includes('Nick Dabreu')) {
      clientName = clientName.replace(/🔒\s*/, '').replace(/Nick Dabreu/, 'Nick Dabreu').trim();
    }
    
    // Remove "Appointment" from the end if present
    clientName = clientName.replace(/\s+Appointment\s*$/i, '').trim();
    
    // Remove other common session indicators
    clientName = clientName
      .replace(/\s+(Session|Therapy|Consultation|Meeting)\s*$/i, '')
      .replace(/^(Session|Therapy|Meeting)\s+with\s+/i, '')
      .trim();
    
    // Handle "- " separators
    if (clientName.includes(' - ')) {
      const parts = clientName.split(' - ');
      clientName = parts[0].trim();
    }
    
    // Validate it looks like a person's name (2-4 words, capitalized)
    const words = clientName.split(' ').filter(word => word.length > 0);
    if (words.length >= 2 && words.length <= 4) {
      const hasCapitalizedWords = words.every(word => 
        word.charAt(0) === word.charAt(0).toUpperCase() && 
        !['appointment', 'session', 'therapy', 'consultation', 'meeting'].includes(word.toLowerCase())
      );
      if (hasCapitalizedWords) {
        return clientName;
      }
    }
    
    // If we can't parse a good name, return the original summary for manual review
    return summary.trim();
  }

  private isSimplePracticeEvent(event: any, calendarDisplayName?: string): boolean {
    const summary = (event.summary || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    const organizerEmail = event.organizer?.email || '';
    const calendarName = (event.organizer?.displayName || '').toLowerCase();
    const sourceCalendar = (calendarDisplayName || '').toLowerCase();
    
    // Check if event is from SimplePractice calendar or has SimplePractice indicators
    return sourceCalendar.includes('simple practice') ||
           sourceCalendar.includes('simplepractice') ||
           organizerEmail.includes('simplepractice') ||
           organizerEmail.includes('simple-practice') ||
           calendarName.includes('simplepractice') ||
           calendarName.includes('simple practice') ||
           summary.includes('simplepractice') ||
           description.includes('simplepractice') ||
           description.includes('simple practice');
  }

  async createCalendarEvent(session: Session, clientName: string): Promise<string> {
    try {
      const event = {
        summary: `${clientName} - Therapy Session`,
        description: `Therapy session with ${clientName}\n\nSession Type: ${session.sessionType}\nNotes: ${session.notes || 'No notes'}`,
        start: {
          dateTime: session.scheduledAt.toISOString(),
          timeZone: 'America/New_York', // EDT timezone
        },
        end: {
          dateTime: new Date(session.scheduledAt.getTime() + session.duration * 60000).toISOString(),
          timeZone: 'America/New_York',
        },
        location: 'Office',
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 15 }, // 15 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      return response.data.id;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  async updateCalendarEvent(googleEventId: string, session: Session, clientName: string): Promise<void> {
    try {
      const event = {
        summary: `${clientName} - Therapy Session`,
        description: `Therapy session with ${clientName}\n\nSession Type: ${session.sessionType}\nNotes: ${session.notes || 'No notes'}`,
        start: {
          dateTime: session.scheduledAt.toISOString(),
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: new Date(session.scheduledAt.getTime() + session.duration * 60000).toISOString(),
          timeZone: 'America/New_York',
        },
        location: 'Office',
      };

      await this.calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        resource: event,
      });
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  async deleteCalendarEvent(googleEventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  async getCalendarList(): Promise<any[]> {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      console.error('Calendar list error details:', error instanceof Error ? error.message : String(error));
      throw error; // Re-throw original error for better debugging
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
