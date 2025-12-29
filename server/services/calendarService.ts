import { google } from 'googleapis';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
}

export class CalendarService {
  private calendar;
  private oauth2Client;

  constructor() {
    // Note: In a real implementation, you would need to handle OAuth2 flow
    // and store refresh tokens securely. For now, this is a basic setup.
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials - in production, you'd get these from secure storage
    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async createEvent(event: CalendarEvent): Promise<string | null> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          attendees: event.attendees,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 }, // 24 hours
              { method: 'popup', minutes: 15 }, // 15 minutes
            ],
          },
        },
      });

      return response.data.id || null;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return null;
    }
  }

  async updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<boolean> {
    try {
      await this.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: {
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          attendees: event.attendees,
        },
      });

      return true;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      return false;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      return false;
    }
  }

  async getEvents(timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin?.toISOString(),
        timeMax: timeMax?.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items?.map(item => ({
        id: item.id || undefined,
        summary: item.summary || '',
        description: item.description || undefined,
        start: {
          dateTime: item.start?.dateTime || '',
          timeZone: item.start?.timeZone || undefined,
        },
        end: {
          dateTime: item.end?.dateTime || '',
          timeZone: item.end?.timeZone || undefined,
        },
        attendees: item.attendees?.map(attendee => ({
          email: attendee.email || '',
          displayName: attendee.displayName || undefined,
        })),
      })) || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  async syncSessionToCalendar(
    clientName: string,
    sessionType: string,
    startTime: Date,
    endTime: Date,
    clientEmail?: string
  ): Promise<string | null> {
    const event: CalendarEvent = {
      summary: `${sessionType} - ${clientName}`,
      description: `Therapy session with ${clientName}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/New_York', // Configure based on therapist's timezone
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/New_York',
      },
      attendees: clientEmail ? [{ email: clientEmail, displayName: clientName }] : undefined,
    };

    return await this.createEvent(event);
  }
}

export const calendarService = new CalendarService();
