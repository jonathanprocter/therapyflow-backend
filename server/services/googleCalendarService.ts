import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { Session } from '@shared/schema';

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor() {
    // Always use Replit domain for consistency
    const redirectUri = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS}/api/calendar/callback`
      : 'http://localhost:5000/api/calendar/callback';
      
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
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async getAuthUrl(): Promise<string> {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });

    return url;
  }

  async exchangeCodeForTokens(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  async syncCalendarEvents(therapistId: string, startDate = '2015-01-01', endDate = '2030-12-31'): Promise<Session[]> {
    try {
      // Check if we have valid credentials
      const credentials = this.oauth2Client.credentials;
      if (!credentials || !credentials.access_token) {
        throw new Error('No valid authentication tokens. Please re-authenticate with Google Calendar.');
      }

      // Try to refresh token if needed
      try {
        await this.oauth2Client.getAccessToken();
      } catch (error) {
        console.error('Error refreshing access token:', error);
        throw new Error('Authentication tokens expired. Please re-authenticate with Google Calendar.');
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
                allEvents.push(...events);
                chunkEvents += events.length;
                calendarPageToken = response.data.nextPageToken;
                
                console.log(`  Calendar "${calendar.summary}": fetched ${events.length} events`);
              } while (calendarPageToken);
              
            } catch (calendarError) {
              console.log(`  Skipping calendar "${calendar.summary}": ${calendarError.message}`);
            }
          }
        } catch (calendarListError) {
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
      
      // Filter ONLY for SimplePractice events
      const relevantEvents = allEvents.filter((event: any) => {
        if (!event.start || !(event.start.dateTime || event.start.date)) {
          return false;
        }

        const summary = (event.summary || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const organizerEmail = event.organizer?.email || '';
        const calendarName = event.organizer?.displayName || '';
        
        // ONLY include SimplePractice events
        const isSimplePracticeEvent = 
          organizerEmail.includes('simplepractice') ||
          organizerEmail.includes('simple-practice') ||
          calendarName.includes('simplepractice') ||
          calendarName.includes('simple practice') ||
          summary.includes('simplepractice') ||
          description.includes('simplepractice') ||
          description.includes('simple practice');
        
        if (isSimplePracticeEvent) {
          console.log(`Found SimplePractice event: "${event.summary}" from ${organizerEmail || calendarName}`);
          return true;
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
        
        // Detect SimplePractice events
        const isSimplePractice = this.isSimplePracticeEvent(event);

        return {
          id: `google-${event.id}`,
          clientId: 'calendar-sync-client', // Use default client for calendar sync
          therapistId,
          scheduledAt: new Date(startTime),
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
    // SimplePractice typically formats events as "Client Name - Therapy Session"
    // or "Session with Client Name"
    
    if (summary.includes(' - ')) {
      const clientName = summary.split(' - ')[0].trim();
      // Avoid extracting therapy-related words as client names
      if (!['therapy', 'session', 'appointment', 'consultation'].includes(clientName.toLowerCase())) {
        return clientName;
      }
    }
    
    if (summary.toLowerCase().includes('session with ')) {
      return summary.toLowerCase().replace('session with ', '').trim();
    }
    
    if (summary.toLowerCase().includes('therapy with ')) {
      return summary.toLowerCase().replace('therapy with ', '').trim();
    }
    
    // For events that might contain client names, try to extract meaningful names
    const words = summary.trim().split(' ');
    if (words.length >= 2 && words.length <= 4) {
      // If it looks like a person's name (2-4 words, capitalized)
      const hasCapitalizedWords = words.every(word => 
        word.charAt(0) === word.charAt(0).toUpperCase()
      );
      if (hasCapitalizedWords) {
        return summary.trim();
      }
    }
    
    return 'Unidentified Client';
  }

  private isSimplePracticeEvent(event: any): boolean {
    const summary = (event.summary || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    const organizerEmail = event.organizer?.email || '';
    const calendarName = event.organizer?.displayName || '';
    
    // Only check for explicit SimplePractice indicators
    return organizerEmail.includes('simplepractice') ||
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
          timeZone: 'America/New_York', // Adjust timezone as needed
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