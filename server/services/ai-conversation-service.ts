/**
 * AI Conversation Service
 * Handles AI model interactions with context awareness and ElevenLabs voice integration
 */

import { ElevenLabsClient } from 'elevenlabs';
import { aiContextManager, type ConversationContext } from './ai-context-manager.js';
import { logger } from './loggerService.js';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatOptions {
  conversationId?: string;
  clientId?: string;
  includeContext?: boolean;
  model?: 'gpt-4' | 'gpt-4-turbo' | 'claude-3-opus' | 'claude-3-sonnet';
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface VoiceOptions {
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

export class AIConversationService {
  private openaiApiKey: string | undefined;
  private anthropicApiKey: string | undefined;
  private elevenLabsClient: ElevenLabsClient | null = null;
  private defaultVoiceId: string = 'EXAVITQu4vr4xnSDxMaL'; // Default ElevenLabs voice

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    // Initialize ElevenLabs if API key is available
    if (process.env.ELEVENLABS_API_KEY) {
      this.elevenLabsClient = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY
      });
      logger.info('ElevenLabs client initialized', 'AIConversation');
    } else {
      logger.warn('ElevenLabs API key not found - voice features disabled', 'AIConversation');
    }
  }

  /**
   * Chat with AI assistant (text-based)
   */
  async chat(
    message: string,
    therapistId: string,
    options: ChatOptions = {}
  ): Promise<{ response: string; conversationId: string; context?: any }> {
    const startTime = Date.now();
    const conversationId = options.conversationId || uuidv4();

    try {
      // Get or create conversation context
      let conversation = await aiContextManager.getConversationHistory(conversationId);

      if (!conversation) {
        conversation = {
          conversationId,
          therapistId,
          clientId: options.clientId,
          messages: [],
          context: {
            referencedClients: [],
            referencedSessions: [],
            referencedDocuments: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // Build context if needed
      let contextData: any = null;
      if (options.includeContext && options.clientId) {
        contextData = await aiContextManager.getClientContext(
          options.clientId,
          therapistId,
          {
            includeNotes: true,
            includeInsights: true,
            includeTreatmentPlan: true,
            includeDocuments: false
          }
        );
      }

      // Prepare messages for AI
      const messages = this.prepareMessages(conversation, contextData);

      // Get AI response
      const model = options.model || 'gpt-4-turbo';
      let response: string;

      if (model.startsWith('claude')) {
        response = await this.callClaude(messages, options);
      } else {
        response = await this.callOpenAI(messages, options);
      }

      // Add assistant response
      conversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      conversation.updatedAt = new Date();

      // Save conversation
      await aiContextManager.saveConversationHistory(conversation);

      const duration = Date.now() - startTime;
      logger.ai(model, 'chat', duration, {
        conversationId,
        therapistId,
        clientId: options.clientId,
        messageLength: message.length,
        responseLength: response.length
      });

      return {
        response,
        conversationId,
        context: contextData ? { summary: contextData.summary } : undefined
      };
    } catch (error) {
      logger.error('AI chat failed', error as Error, 'AIConversation', {
        conversationId,
        therapistId,
        model: options.model
      });
      throw error;
    }
  }

  /**
   * Convert text to speech using ElevenLabs
   */
  async textToSpeech(
    text: string,
    options: VoiceOptions = {}
  ): Promise<Buffer> {
    if (!this.elevenLabsClient) {
      throw new Error('ElevenLabs not configured');
    }

    const startTime = Date.now();

    try {
      const voiceId = options.voiceId || this.defaultVoiceId;

      const audio = await this.elevenLabsClient.generate({
        voice: voiceId,
        text,
        model_id: options.model || 'eleven_monolingual_v1',
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarityBoost || 0.75
        }
      });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      const duration = Date.now() - startTime;
      logger.ai('ElevenLabs', 'text-to-speech', duration, {
        textLength: text.length,
        audioSize: buffer.length,
        voiceId
      });

      return buffer;
    } catch (error) {
      logger.error('Text-to-speech failed', error as Error, 'AIConversation');
      throw error;
    }
  }

  /**
   * Convert speech to text using ElevenLabs (or fallback to OpenAI Whisper)
   */
  async speechToText(audioBuffer: Buffer): Promise<string> {
    const startTime = Date.now();

    try {
      // Use OpenAI Whisper for speech-to-text
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Speech-to-text failed: ${response.statusText}`);
      }

      const result = await response.json();
      const text = result.text;

      const duration = Date.now() - startTime;
      logger.ai('OpenAI Whisper', 'speech-to-text', duration, {
        audioSize: audioBuffer.length,
        textLength: text.length
      });

      return text;
    } catch (error) {
      logger.error('Speech-to-text failed', error as Error, 'AIConversation');
      throw error;
    }
  }

  /**
   * Streaming voice conversation
   */
  async *streamVoiceConversation(
    audioStream: AsyncIterable<Buffer>,
    therapistId: string,
    options: ChatOptions & VoiceOptions = {}
  ): AsyncGenerator<{ type: 'transcription' | 'text' | 'audio'; data: string | Buffer }> {
    try {
      // Collect audio chunks
      const audioChunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        audioChunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(audioChunks);

      // Transcribe audio
      yield { type: 'transcription', data: 'Processing audio...' };
      const transcription = await this.speechToText(audioBuffer);
      yield { type: 'transcription', data: transcription };

      // Get AI response
      const chatResponse = await this.chat(transcription, therapistId, options);
      yield { type: 'text', data: chatResponse.response };

      // Convert response to speech
      const audioResponse = await this.textToSpeech(chatResponse.response, options);
      yield { type: 'audio', data: audioResponse };
    } catch (error) {
      logger.error('Voice conversation stream failed', error as Error, 'AIConversation');
      throw error;
    }
  }

  /**
   * Prepare messages with system prompt and context
   */
  private prepareMessages(
    conversation: ConversationContext,
    contextData?: any
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System prompt
    const systemPrompt = this.buildSystemPrompt(contextData);
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    // Add conversation history (last 10 messages)
    const recentMessages = conversation.messages.slice(-10);
    messages.push(...recentMessages);

    return messages;
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(contextData?: any): string {
    let prompt = `You are an AI assistant for TherapyFlow, a mental health practice management system. You help therapists by providing insights about their clients, answering questions about sessions and progress notes, and assisting with clinical documentation.

Your capabilities include:
- Accessing client information, session notes, and therapeutic insights
- Analyzing patterns and trends in client progress
- Suggesting therapeutic interventions based on evidence-based practices
- Drafting progress notes and treatment plan updates
- Answering questions about specific clients or general therapeutic topics

Guidelines:
- Always maintain client confidentiality and HIPAA compliance
- Provide evidence-based recommendations when possible
- Be clear when you're making suggestions vs stating facts
- Ask clarifying questions when needed
- Use professional, empathetic language
- Reference specific data points when available

Therapeutic frameworks you're familiar with:
- Acceptance and Commitment Therapy (ACT)
- Dialectical Behavior Therapy (DBT)
- Cognitive Behavioral Therapy (CBT)
- Narrative Therapy
- Existential Therapy
- Psychodynamic approaches`;

    if (contextData) {
      prompt += `\n\nCurrent Client Context:\n${contextData.summary}`;

      if (contextData.treatmentPlan) {
        prompt += `\n\nActive Treatment Goals:\n`;
        contextData.treatmentPlan.goals?.forEach((goal: any, index: number) => {
          prompt += `${index + 1}. ${goal.description} (Status: ${goal.status})\n`;
        });
      }

      if (contextData.therapeuticInsights && contextData.therapeuticInsights.length > 0) {
        prompt += `\n\nRecent Insights:\n`;
        contextData.therapeuticInsights.slice(0, 3).forEach((insight: any) => {
          prompt += `- ${insight.insight}\n`;
        });
      }
    }

    return prompt;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<string> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4-turbo-preview',
        messages,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Call Anthropic Claude API
   */
  private async callClaude(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<string> {
    if (!this.anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model === 'claude-3-opus' ? 'claude-3-opus-20240229' : 'claude-3-sonnet-20240229',
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
        system: systemMessage,
        messages: conversationMessages
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getAvailableVoices(): Promise<any[]> {
    if (!this.elevenLabsClient) {
      throw new Error('ElevenLabs not configured');
    }

    try {
      const voices = await this.elevenLabsClient.voices.getAll();
      return voices.voices || [];
    } catch (error) {
      logger.error('Failed to get available voices', error as Error, 'AIConversation');
      throw error;
    }
  }

  /**
   * Set default voice
   */
  setDefaultVoice(voiceId: string): void {
    this.defaultVoiceId = voiceId;
    logger.info('Default voice updated', 'AIConversation', { voiceId });
  }
}

export const aiConversationService = new AIConversationService();
