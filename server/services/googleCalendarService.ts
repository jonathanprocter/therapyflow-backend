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
      // Refresh token if needed
      await this.oauth2Client.getAccessToken();

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500, // Google Calendar API limit
      });

      const events = response.data.items || [];
      
      // Filter for therapy appointments (SimplePractice integration patterns)
      const therapyEvents = events.filter((event: any) => {
        const summary = event.summary || '';
        const description = event.description || '';
        
        // Look for SimplePractice patterns or therapy-related keywords
        return (
          summary.toLowerCase().includes('therapy') ||
          summary.toLowerCase().includes('session') ||
          summary.toLowerCase().includes('appointment') ||
          summary.toLowerCase().includes('simplepractice') ||
          description.toLowerCase().includes('simplepractice') ||
          description.toLowerCase().includes('therapy')
        );
      });

      // Convert Google Calendar events to Session format
      const sessions: Session[] = therapyEvents.map((event: any, index: number) => {
        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        
        // Calculate duration in minutes
        const duration = startTime && endTime 
          ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60))
          : 50; // Default 50-minute session

        // Extract client name from event summary
        const clientName = this.extractClientName(event.summary || '');

        return {
          id: `google-${event.id}`,
          clientId: `sync-client-${index}`, // Will need proper client matching
          therapistId,
          scheduledAt: new Date(startTime),
          duration,
          sessionType: 'individual',
          status: 'scheduled',
          notes: event.description || '',
          googleEventId: event.id,
          // @ts-ignore - Temporary field for client matching
          clientName,
        };
      });

      return sessions;
    } catch (error) {
      console.error('Error syncing Google Calendar:', error);
      throw new Error('Failed to sync calendar events');
    }
  }

  private extractClientName(summary: string): string {
    // SimplePractice typically formats events as "Client Name - Therapy Session"
    // or "Session with Client Name"
    
    if (summary.includes(' - ')) {
      return summary.split(' - ')[0].trim();
    }
    
    if (summary.toLowerCase().includes('session with ')) {
      return summary.toLowerCase().replace('session with ', '').trim();
    }
    
    if (summary.toLowerCase().includes('therapy ')) {
      return summary.toLowerCase().replace('therapy', '').trim();
    }
    
    return summary.trim();
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
      throw new Error('Failed to fetch calendar list');
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();