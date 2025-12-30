/**
 * ElevenLabs Voice AI Service
 * Provides text-to-speech and conversational AI capabilities
 * with full access to application data for comprehensive insights
 */

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

interface TTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_22050';
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationContext {
  messages: ConversationMessage[];
  clientId?: string;
  sessionId?: string;
  pageContext?: string;
  therapistId?: string;
}

interface ApplicationData {
  clients: any[];
  recentNotes: any[];
  upcomingSessions: any[];
  treatmentPlans: any[];
  clientDetails?: any;
  sessionDetails?: any;
}

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" - professional female voice
  private defaultModelId = 'eleven_multilingual_v2'; // Better quality model
  private selectedVoiceId: string | null = null;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[ElevenLabs] No API key found. Voice features will be disabled.');
    }
  }

  /**
   * Check if ElevenLabs is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Set the preferred voice for responses
   */
  setVoice(voiceId: string): void {
    this.selectedVoiceId = voiceId;
    console.log(`[ElevenLabs] Voice set to: ${voiceId}`);
  }

  /**
   * Get currently selected voice
   */
  getCurrentVoice(): string {
    return this.selectedVoiceId || this.defaultVoiceId;
  }

  /**
   * Get ALL available voices from ElevenLabs (including premium)
   */
  async getVoices(): Promise<Voice[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('[ElevenLabs] Failed to fetch voices:', error);
      return [];
    }
  }

  /**
   * Get premium/professional voices suitable for therapy context
   */
  async getPremiumVoices(): Promise<Voice[]> {
    const allVoices = await this.getVoices();

    // Filter for high-quality voices suitable for professional use
    return allVoices.filter(voice => {
      const category = voice.category?.toLowerCase() || '';
      const labels = voice.labels || {};

      // Include premade professional voices and cloned voices
      return category === 'premade' ||
             category === 'professional' ||
             category === 'high_quality' ||
             labels['use case']?.includes('narration') ||
             labels['use case']?.includes('conversational');
    });
  }

  /**
   * Convert text to speech with selected voice
   */
  async textToSpeech(options: TTSOptions): Promise<Buffer | null> {
    if (!this.isAvailable()) {
      console.warn('[ElevenLabs] Service not available');
      return null;
    }

    const {
      text,
      voiceId = this.selectedVoiceId || this.defaultVoiceId,
      modelId = this.defaultModelId,
      outputFormat = 'mp3_44100_128'
    } = options;

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 0.5,
              use_speaker_boost: true
            }
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS error: ${response.status} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('[ElevenLabs] TTS failed:', error);
      return null;
    }
  }

  /**
   * Stream text to speech (for real-time playback)
   */
  async streamTextToSpeech(options: TTSOptions): Promise<ReadableStream | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const {
      text,
      voiceId = this.selectedVoiceId || this.defaultVoiceId,
      modelId = this.defaultModelId,
    } = options;

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs stream error: ${response.status}`);
      }

      return response.body;
    } catch (error) {
      console.error('[ElevenLabs] Stream TTS failed:', error);
      return null;
    }
  }

  /**
   * Fetch comprehensive application data for context
   */
  async getApplicationData(therapistId: string, clientId?: string): Promise<ApplicationData> {
    const { storage } = await import('../storage');

    try {
      // Fetch all relevant data in parallel
      const [clients, upcomingSessions, recentNotes] = await Promise.all([
        storage.getClients(therapistId),
        storage.getUpcomingSessions(therapistId, new Date()),
        this.getRecentProgressNotes(therapistId)
      ]);

      let clientDetails = null;
      let treatmentPlans: any[] = [];

      // If viewing a specific client, get their details
      if (clientId) {
        try {
          clientDetails = await storage.getClient(clientId);
          const clientNotes = await storage.getProgressNotes(clientId);
          treatmentPlans = await storage.getTreatmentPlans(clientId);
        } catch (e) {
          console.warn(`Could not fetch client details for ${clientId}`);
        }
      }

      return {
        clients,
        recentNotes,
        upcomingSessions,
        treatmentPlans,
        clientDetails
      };
    } catch (error) {
      console.error('[ElevenLabs] Failed to fetch application data:', error);
      return {
        clients: [],
        recentNotes: [],
        upcomingSessions: [],
        treatmentPlans: []
      };
    }
  }

  /**
   * Get recent progress notes across all clients
   */
  private async getRecentProgressNotes(therapistId: string): Promise<any[]> {
    const { storage } = await import('../storage');

    try {
      const clients = await storage.getClients(therapistId);
      const allNotes: any[] = [];

      // Get notes from each client (limit to recent)
      for (const client of clients.slice(0, 20)) {
        try {
          const notes = await storage.getProgressNotes(client.id);
          const recentNotes = notes.slice(0, 3).map(note => ({
            ...note,
            clientName: client.name
          }));
          allNotes.push(...recentNotes);
        } catch (e) {
          // Skip clients with no notes
        }
      }

      // Sort by date and return most recent
      return allNotes
        .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
        .slice(0, 10);
    } catch (error) {
      console.error('[ElevenLabs] Failed to fetch recent notes:', error);
      return [];
    }
  }

  /**
   * Generate a contextual AI response with full application access
   */
  async generateVoiceResponse(
    query: string,
    context: ConversationContext,
    voiceId?: string
  ): Promise<{ text: string; audio: Buffer | null }> {
    const { aiService } = await import('./aiService');
    const therapistId = context.therapistId || 'dr-jonathan-procter';

    // Fetch comprehensive application data
    const appData = await this.getApplicationData(therapistId, context.clientId);

    // Build rich context for AI
    const enrichedContext = this.buildEnrichedContext(context, appData);

    // Generate text response using existing AI
    const systemPrompt = `You are a highly knowledgeable clinical assistant for a licensed mental health counselor named Dr. Jonathan Procter.
You have access to the entire practice management system including:
- All client records and histories
- Progress notes and treatment documentation
- Upcoming sessions and scheduling
- Treatment plans and therapeutic goals

${enrichedContext}

Guidelines for voice responses:
- Keep responses conversational and natural for voice output
- Be concise but thorough - typically 2-4 sentences
- Speak as if you're a trusted colleague providing clinical consultation
- Use specific client names and details when relevant to the query
- If discussing clinical content, maintain appropriate professional tone
- You can reference specific sessions, notes, and client information`;

    try {
      const response = await aiService.processTherapyDocument(
        query,
        `${systemPrompt}\n\nUser query: ${query}\n\nProvide a helpful, informed response:`
      );

      // Parse and clean response
      let textResponse = this.parseAIResponse(response);
      textResponse = this.cleanTextForVoice(textResponse);

      // Generate audio with selected voice
      const audio = await this.textToSpeech({
        text: textResponse,
        voiceId: voiceId || this.selectedVoiceId || this.defaultVoiceId
      });

      return { text: textResponse, audio };
    } catch (error) {
      console.error('[ElevenLabs] Voice response generation failed:', error);
      const fallbackText = "I apologize, but I'm having trouble accessing that information right now. Could you try rephrasing your question?";
      const audio = await this.textToSpeech({ text: fallbackText });
      return { text: fallbackText, audio };
    }
  }

  /**
   * Build enriched context with application data
   */
  private buildEnrichedContext(context: ConversationContext, appData: ApplicationData): string {
    const sections: string[] = [];

    // Current page context
    if (context.pageContext) {
      sections.push(`Current page: ${context.pageContext}`);
    }

    // Client information
    if (appData.clientDetails) {
      sections.push(`\nCurrently viewing client: ${appData.clientDetails.name}
Status: ${appData.clientDetails.status}
Tags: ${appData.clientDetails.tags?.join(', ') || 'None'}`);
    }

    // Active clients summary
    if (appData.clients.length > 0) {
      const activeClients = appData.clients.filter(c => c.status === 'active');
      sections.push(`\nActive clients: ${activeClients.length} total`);
      sections.push(`Client names: ${activeClients.slice(0, 10).map(c => c.name).join(', ')}${activeClients.length > 10 ? '...' : ''}`);
    }

    // Upcoming sessions
    if (appData.upcomingSessions.length > 0) {
      const upcoming = appData.upcomingSessions.slice(0, 5);
      sections.push(`\nUpcoming sessions:`);
      for (const session of upcoming) {
        const date = new Date(session.scheduledAt).toLocaleDateString();
        const time = new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        sections.push(`- ${date} ${time}: Session scheduled`);
      }
    }

    // Recent progress notes
    if (appData.recentNotes.length > 0) {
      sections.push(`\nRecent progress notes:`);
      for (const note of appData.recentNotes.slice(0, 5)) {
        const date = new Date(note.sessionDate).toLocaleDateString();
        const summary = note.content?.substring(0, 100) || 'No content';
        sections.push(`- ${date} (${note.clientName}): ${summary}...`);
      }
    }

    // Treatment plans
    if (appData.treatmentPlans.length > 0) {
      sections.push(`\nActive treatment plans: ${appData.treatmentPlans.length}`);
      for (const plan of appData.treatmentPlans.slice(0, 3)) {
        sections.push(`- Goals: ${plan.goals?.slice(0, 2).join(', ') || 'Not specified'}`);
      }
    }

    // Conversation history
    if (context.messages.length > 0) {
      sections.push(`\nRecent conversation:`);
      for (const msg of context.messages.slice(-5)) {
        sections.push(`${msg.role}: ${msg.content.substring(0, 100)}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(response: string): string {
    try {
      const parsed = JSON.parse(response);
      return parsed.response || parsed.answer || parsed.text || parsed.content || response;
    } catch {
      return response;
    }
  }

  /**
   * Clean text for voice synthesis
   */
  private cleanTextForVoice(text: string): string {
    return text
      // Remove markdown
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      // Remove bullet points for natural speech
      .replace(/^[\-\*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, 'a link')
      // Clean up excessive punctuation
      .replace(/\.{2,}/g, '.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get recommended voices for therapy context
   */
  getRecommendedVoices(): { id: string; name: string; description: string; premium: boolean }[] {
    return [
      {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Sarah',
        description: 'Professional, warm female voice - ideal for clinical settings',
        premium: true
      },
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        description: 'Calm, soothing female voice',
        premium: true
      },
      {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        description: 'Deep, professional male voice',
        premium: true
      },
      {
        id: 'onwK4e9ZLuTAKqWW03F9',
        name: 'Daniel',
        description: 'British, authoritative male voice',
        premium: true
      },
      {
        id: 'XB0fDUnXU5powFXDhCwa',
        name: 'Charlotte',
        description: 'Swedish, warm and professional female voice',
        premium: true
      },
      {
        id: 'TX3LPaxmHKxFdv7VOQHJ',
        name: 'Liam',
        description: 'Young, friendly male voice',
        premium: true
      },
      {
        id: 'XrExE9yKIg1WjnnlVkGX',
        name: 'Matilda',
        description: 'Warm, nurturing female voice',
        premium: true
      },
      {
        id: 'pFZP5JQG7iQjIQuC4Bku',
        name: 'Lily',
        description: 'British, gentle female voice',
        premium: true
      },
      {
        id: 'bIHbv24MWmeRgasZH58o',
        name: 'Will',
        description: 'Friendly, approachable male voice',
        premium: true
      },
      {
        id: 'cgSgspJ2msm6clMCkdW9',
        name: 'Jessica',
        description: 'Expressive, conversational female voice',
        premium: true
      }
    ];
  }

  /**
   * Quick client lookup by name
   */
  async findClient(name: string, therapistId: string): Promise<any | null> {
    const { storage } = await import('../storage');

    try {
      const clients = await storage.getClients(therapistId);
      const searchName = name.toLowerCase();

      return clients.find(c =>
        c.name.toLowerCase().includes(searchName) ||
        searchName.includes(c.name.toLowerCase())
      ) || null;
    } catch (error) {
      console.error('[ElevenLabs] Client lookup failed:', error);
      return null;
    }
  }

  /**
   * Get client summary for voice response
   */
  async getClientSummary(clientId: string): Promise<string> {
    const { storage } = await import('../storage');

    try {
      const client = await storage.getClient(clientId);
      if (!client) return "Client not found.";

      const notes = await storage.getProgressNotes(clientId);
      const recentNote = notes[0];

      let summary = `${client.name} is currently ${client.status}. `;

      if (notes.length > 0) {
        summary += `They have ${notes.length} progress notes on file. `;
        if (recentNote) {
          const lastDate = new Date(recentNote.sessionDate).toLocaleDateString();
          summary += `Their most recent session was on ${lastDate}.`;
        }
      } else {
        summary += "No progress notes have been documented yet.";
      }

      return summary;
    } catch (error) {
      console.error('[ElevenLabs] Client summary failed:', error);
      return "Unable to retrieve client information.";
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;
