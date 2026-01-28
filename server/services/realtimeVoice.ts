/**
 * Real-time Voice Service for TherapyFlow
 *
 * Provides:
 * 1. Text-to-Speech (TTS) using OpenAI or ElevenLabs
 * 2. WebSocket server for bidirectional real-time communication
 * 3. OpenAI Realtime API integration for barge-in mode
 */

import OpenAI from 'openai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage, Server as HttpServer } from 'http';
import { EventEmitter } from 'events';

// Only log in development
const IS_DEV = process.env.NODE_ENV !== 'production';
const devLog = (...args: any[]) => IS_DEV && console.log(...args);

// OpenAI Voice options for TTS
export const OPENAI_VOICE_OPTIONS = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced', premium: false, provider: 'openai' },
  { id: 'echo', name: 'Echo', description: 'Warm and conversational', premium: false, provider: 'openai' },
  { id: 'fable', name: 'Fable', description: 'Expressive and dynamic', premium: false, provider: 'openai' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative', premium: false, provider: 'openai' },
  { id: 'nova', name: 'Nova', description: 'Friendly and upbeat', premium: false, provider: 'openai' },
  { id: 'shimmer', name: 'Shimmer', description: 'Clear and professional', premium: false, provider: 'openai' },
] as const;

// ElevenLabs Voice options for TTS (premium voices)
export const ELEVENLABS_VOICE_OPTIONS = [
  { id: 'Rachel', name: 'Rachel', description: 'Calm and professional', premium: true, provider: 'elevenlabs', voiceId: '21m00Tcm4TlvDq8ikWAM' },
  { id: 'Domi', name: 'Domi', description: 'Strong and confident', premium: true, provider: 'elevenlabs', voiceId: 'AZnzlk1XvdvUeBnXmlld' },
  { id: 'Bella', name: 'Bella', description: 'Soft and gentle', premium: true, provider: 'elevenlabs', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
  { id: 'Antoni', name: 'Antoni', description: 'Warm and well-rounded', premium: true, provider: 'elevenlabs', voiceId: 'ErXwobaYiN019PkySvjV' },
  { id: 'Elli', name: 'Elli', description: 'Emotional and expressive', premium: true, provider: 'elevenlabs', voiceId: 'MF3mGyEYCl7XYWbV9V6O' },
  { id: 'Josh', name: 'Josh', description: 'Deep and narrative', premium: true, provider: 'elevenlabs', voiceId: 'TxGEqnHWrfWFTfGW9XjX' },
] as const;

// Combined voice options
export const VOICE_OPTIONS = [...OPENAI_VOICE_OPTIONS, ...ELEVENLABS_VOICE_OPTIONS];

export type VoiceId = typeof VOICE_OPTIONS[number]['id'];
export type TTSProvider = 'openai' | 'elevenlabs';

interface RealtimeConfig {
  openaiApiKey: string;
  anthropicApiKey?: string;
  elevenlabsApiKey?: string;
  defaultVoice?: VoiceId;
  defaultProvider?: TTSProvider;
}

interface VoiceSession {
  id: string;
  ws: WebSocket;
  realtimeWs?: WebSocket;
  isBargeInEnabled: boolean;
  currentVoice: VoiceId;
  currentProvider: TTSProvider;
  isPlaying: boolean;
  therapistId: string;
  clientContext?: {
    clientId?: string;
    sessionNotes?: string;
  };
}

/**
 * Real-time Voice Service
 * Handles TTS, WebSocket communication, and OpenAI Realtime API
 */
// Session timeout constants
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export class RealtimeVoiceService extends EventEmitter {
  private openai: OpenAI | null = null;
  private elevenlabs: ElevenLabsClient | null = null;
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, VoiceSession> = new Map();
  private sessionLastActivity: Map<string, number> = new Map();
  private config: RealtimeConfig;
  private isInitialized = false;
  private defaultProvider: TTSProvider = 'openai';
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RealtimeConfig) {
    super();
    this.config = config;

    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
      this.isInitialized = true;
      devLog('[RealtimeVoice] Service initialized with OpenAI');
    }

    if (config.elevenlabsApiKey) {
      this.elevenlabs = new ElevenLabsClient({ apiKey: config.elevenlabsApiKey });
      this.isInitialized = true;
      this.defaultProvider = config.defaultProvider || 'elevenlabs';
      devLog('[RealtimeVoice] Service initialized with ElevenLabs');
    }

    if (!this.isInitialized) {
      console.warn('[RealtimeVoice] No TTS API keys provided - TTS disabled');
    }
  }

  /**
   * Generate audio from text using OpenAI or ElevenLabs TTS
   */
  async generateSpeech(text: string, voiceId: VoiceId = 'nova', provider?: TTSProvider): Promise<Buffer | null> {
    // Determine which provider to use
    const voiceOption = VOICE_OPTIONS.find(v => v.id === voiceId);
    const useProvider = provider || (voiceOption?.provider as TTSProvider) || this.defaultProvider;

    if (useProvider === 'elevenlabs' && this.elevenlabs) {
      return this.generateElevenLabsSpeech(text, voiceId);
    } else if (this.openai) {
      return this.generateOpenAISpeech(text, voiceId);
    }

    console.error('[RealtimeVoice] No TTS provider available');
    return null;
  }

  /**
   * Generate audio using OpenAI TTS
   */
  private async generateOpenAISpeech(text: string, voiceId: VoiceId): Promise<Buffer | null> {
    if (!this.openai) {
      console.error('[RealtimeVoice] OpenAI not initialized');
      return null;
    }

    try {
      // Map to valid OpenAI voice or default to nova
      const openaiVoice = OPENAI_VOICE_OPTIONS.find(v => v.id === voiceId)?.id || 'nova';
      console.log(`[RealtimeVoice] Generating speech with OpenAI voice: ${openaiVoice}`);

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: openaiVoice as any,
        input: text,
        response_format: 'mp3',
      });

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`[RealtimeVoice] Generated ${buffer.length} bytes of audio (OpenAI)`);
      return buffer;
    } catch (error) {
      console.error('[RealtimeVoice] OpenAI TTS generation failed:', error);
      return null;
    }
  }

  /**
   * Generate audio using ElevenLabs TTS
   */
  private async generateElevenLabsSpeech(text: string, voiceId: VoiceId): Promise<Buffer | null> {
    if (!this.elevenlabs) {
      console.error('[RealtimeVoice] ElevenLabs not initialized');
      return null;
    }

    try {
      // Get ElevenLabs voice ID or use default Rachel
      const elevenLabsVoice = ELEVENLABS_VOICE_OPTIONS.find(v => v.id === voiceId);
      const voiceIdToUse = elevenLabsVoice?.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Rachel as default

      console.log(`[RealtimeVoice] Generating speech with ElevenLabs voice: ${voiceId} (${voiceIdToUse})`);

      const audioStream = await this.elevenlabs.textToSpeech.convert(voiceIdToUse, {
        text,
        modelId: 'eleven_monolingual_v1',
        outputFormat: 'mp3_44100_128',
      });

      // Collect all chunks from the stream
      const chunks: Uint8Array[] = [];
      const reader = audioStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));

      console.log(`[RealtimeVoice] Generated ${buffer.length} bytes of audio (ElevenLabs)`);
      return buffer;
    } catch (error) {
      console.error('[RealtimeVoice] ElevenLabs TTS generation failed:', error);
      // Fallback to OpenAI if ElevenLabs fails
      if (this.openai) {
        devLog('[RealtimeVoice] Falling back to OpenAI TTS');
        return this.generateOpenAISpeech(text, voiceId);
      }
      return null;
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string | null> {
    if (!this.openai) {
      console.error('[RealtimeVoice] OpenAI not initialized');
      return null;
    }

    try {
      // Create a file-like object from the buffer
      const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en',
      });

      console.log(`[RealtimeVoice] Transcribed: "${transcription.text.substring(0, 50)}..."`);
      return transcription.text;
    } catch (error) {
      console.error('[RealtimeVoice] Transcription failed:', error);
      return null;
    }
  }

  /**
   * Initialize WebSocket server for real-time communication
   */
  initializeWebSocket(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/voice',
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const sessionId = this.generateSessionId();
      console.log(`[RealtimeVoice] New WebSocket connection: ${sessionId}`);

      const session: VoiceSession = {
        id: sessionId,
        ws,
        isBargeInEnabled: false,
        currentVoice: this.config.defaultVoice || 'nova',
        currentProvider: this.defaultProvider,
        isPlaying: false,
        therapistId: 'dr-jonathan-procter', // Default for single-therapist mode
      };

      this.sessions.set(sessionId, session);
      this.sessionLastActivity.set(sessionId, Date.now());

      // Send welcome message with session config
      this.sendToClient(ws, {
        type: 'connected',
        sessionId,
        config: {
          voices: VOICE_OPTIONS,
          openaiVoices: OPENAI_VOICE_OPTIONS,
          elevenlabsVoices: ELEVENLABS_VOICE_OPTIONS,
          currentVoice: session.currentVoice,
          currentProvider: session.currentProvider,
          bargeInEnabled: session.isBargeInEnabled,
          elevenlabsAvailable: !!this.elevenlabs,
        },
      });

      ws.on('message', async (data: Buffer) => {
        // Update last activity timestamp
        this.sessionLastActivity.set(sessionId, Date.now());

        try {
          await this.handleClientMessage(session, data);
        } catch (error) {
          console.error('[RealtimeVoice] Error handling message:', error);
          this.sendToClient(ws, {
            type: 'error',
            message: 'Failed to process message',
          });
        }
      });

      ws.on('close', () => {
        console.log(`[RealtimeVoice] WebSocket disconnected: ${sessionId}`);
        this.cleanupSession(sessionId);
      });

      ws.on('error', (error) => {
        console.error(`[RealtimeVoice] WebSocket error for ${sessionId}:`, error);
        this.cleanupSession(sessionId);
      });
    });

    devLog('[RealtimeVoice] WebSocket server initialized on /ws/voice');

    // Start periodic cleanup of stale sessions
    this.startSessionCleanup();
  }

  /**
   * Start periodic cleanup of stale sessions
   */
  private startSessionCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleSessions: string[] = [];

      this.sessions.forEach((session, sessionId) => {
        const lastActivity = this.sessionLastActivity.get(sessionId) || 0;
        if (now - lastActivity > SESSION_TIMEOUT_MS) {
          staleSessions.push(sessionId);
        }
      });

      for (const sessionId of staleSessions) {
        console.log(`[RealtimeVoice] Cleaning up stale session: ${sessionId}`);
        this.cleanupSession(sessionId);
      }

      if (staleSessions.length > 0) {
        console.log(`[RealtimeVoice] Cleaned up ${staleSessions.length} stale sessions`);
      }
    }, CLEANUP_INTERVAL_MS);

    // Ensure cleanup interval doesn't prevent process exit
    this.cleanupInterval.unref();
  }

  /**
   * Handle incoming client messages
   */
  private async handleClientMessage(session: VoiceSession, data: Buffer): Promise<void> {
    // Check if data is JSON or binary audio
    let message: any;

    try {
      message = JSON.parse(data.toString());
    } catch {
      // Binary audio data for transcription
      await this.handleAudioData(session, data);
      return;
    }

    console.log(`[RealtimeVoice] Received message type: ${message.type}`);

    switch (message.type) {
      case 'configure':
        await this.handleConfigure(session, message);
        break;

      case 'speak':
        await this.handleSpeak(session, message);
        break;

      case 'interrupt':
        await this.handleInterrupt(session);
        break;

      case 'start_realtime':
        await this.startRealtimeSession(session, message);
        break;

      case 'stop_realtime':
        await this.stopRealtimeSession(session);
        break;

      case 'audio_append':
        // Base64 encoded audio for realtime API
        if (message.audio && session.realtimeWs) {
          this.forwardToRealtime(session, {
            type: 'input_audio_buffer.append',
            audio: message.audio,
          });
        }
        break;

      case 'commit_audio':
        if (session.realtimeWs) {
          this.forwardToRealtime(session, {
            type: 'input_audio_buffer.commit',
          });
        }
        break;

      default:
        console.warn(`[RealtimeVoice] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle audio data for transcription
   */
  private async handleAudioData(session: VoiceSession, audioBuffer: Buffer): Promise<void> {
    // If realtime session is active, forward to OpenAI Realtime API
    if (session.realtimeWs && session.realtimeWs.readyState === WebSocket.OPEN) {
      const base64Audio = audioBuffer.toString('base64');
      this.forwardToRealtime(session, {
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      });
      return;
    }

    // Otherwise, use Whisper for transcription
    const transcript = await this.transcribeAudio(audioBuffer);
    if (transcript) {
      this.sendToClient(session.ws, {
        type: 'transcription',
        text: transcript,
      });
    }
  }

  /**
   * Configure session settings
   */
  private async handleConfigure(session: VoiceSession, message: any): Promise<void> {
    if (message.voice && VOICE_OPTIONS.some(v => v.id === message.voice)) {
      session.currentVoice = message.voice;
    }
    if (message.provider && (message.provider === 'openai' || message.provider === 'elevenlabs')) {
      // Only allow elevenlabs if configured
      if (message.provider === 'elevenlabs' && this.elevenlabs) {
        session.currentProvider = message.provider;
      } else if (message.provider === 'openai') {
        session.currentProvider = message.provider;
      }
    }
    if (typeof message.bargeIn === 'boolean') {
      session.isBargeInEnabled = message.bargeIn;
    }
    if (message.clientContext) {
      session.clientContext = message.clientContext;
    }

    this.sendToClient(session.ws, {
      type: 'configured',
      config: {
        voice: session.currentVoice,
        provider: session.currentProvider,
        bargeInEnabled: session.isBargeInEnabled,
        elevenlabsAvailable: !!this.elevenlabs,
      },
    });
  }

  /**
   * Handle speak request - generate TTS and send audio
   */
  private async handleSpeak(session: VoiceSession, message: any): Promise<void> {
    const { text, voice, provider } = message;

    if (!text) {
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Text is required for speech',
      });
      return;
    }

    session.isPlaying = true;
    this.sendToClient(session.ws, { type: 'speaking_start' });

    const voiceId = voice || session.currentVoice;
    const useProvider = provider || session.currentProvider;
    const audioBuffer = await this.generateSpeech(text, voiceId, useProvider);

    if (audioBuffer) {
      // Send audio as base64
      this.sendToClient(session.ws, {
        type: 'audio',
        audio: audioBuffer.toString('base64'),
        format: 'mp3',
        text: text,
      });
    } else {
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Failed to generate speech',
      });
    }

    session.isPlaying = false;
    this.sendToClient(session.ws, { type: 'speaking_end' });
  }

  /**
   * Handle interrupt (barge-in)
   */
  private async handleInterrupt(session: VoiceSession): Promise<void> {
    if (!session.isBargeInEnabled) {
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Barge-in mode not enabled',
      });
      return;
    }

    session.isPlaying = false;

    // If realtime session active, send cancel
    if (session.realtimeWs && session.realtimeWs.readyState === WebSocket.OPEN) {
      this.forwardToRealtime(session, {
        type: 'response.cancel',
      });
    }

    this.sendToClient(session.ws, { type: 'interrupted' });
    console.log(`[RealtimeVoice] Session ${session.id} interrupted by user`);
  }

  /**
   * Start OpenAI Realtime API session for barge-in mode
   */
  private async startRealtimeSession(session: VoiceSession, message: any): Promise<void> {
    if (!this.config.openaiApiKey) {
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'OpenAI API key not configured',
      });
      return;
    }

    try {
      console.log(`[RealtimeVoice] Starting realtime session for ${session.id}`);

      // Connect to OpenAI Realtime API
      const realtimeUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

      session.realtimeWs = new WebSocket(realtimeUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      session.realtimeWs.on('open', () => {
        console.log(`[RealtimeVoice] Connected to OpenAI Realtime API for session ${session.id}`);

        // Configure the session
        this.forwardToRealtime(session, {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: this.getRealtimeInstructions(session),
            voice: session.currentVoice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        });

        session.isBargeInEnabled = true;
        this.sendToClient(session.ws, {
          type: 'realtime_started',
          message: 'Barge-in mode enabled',
        });
      });

      session.realtimeWs.on('message', (data: Buffer) => {
        this.handleRealtimeMessage(session, data);
      });

      session.realtimeWs.on('close', () => {
        console.log(`[RealtimeVoice] Realtime connection closed for session ${session.id}`);
        session.realtimeWs = undefined;
        session.isBargeInEnabled = false;
        this.sendToClient(session.ws, {
          type: 'realtime_stopped',
        });
      });

      session.realtimeWs.on('error', (error) => {
        console.error(`[RealtimeVoice] Realtime error for session ${session.id}:`, error);
        this.sendToClient(session.ws, {
          type: 'error',
          message: 'Realtime connection error',
        });
      });

    } catch (error) {
      console.error('[RealtimeVoice] Failed to start realtime session:', error);
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Failed to start realtime session',
      });
    }
  }

  /**
   * Stop OpenAI Realtime API session
   */
  private async stopRealtimeSession(session: VoiceSession): Promise<void> {
    if (session.realtimeWs) {
      session.realtimeWs.close();
      session.realtimeWs = undefined;
    }
    session.isBargeInEnabled = false;
    this.sendToClient(session.ws, { type: 'realtime_stopped' });
  }

  /**
   * Handle messages from OpenAI Realtime API
   */
  private handleRealtimeMessage(session: VoiceSession, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'session.created':
        case 'session.updated':
          console.log(`[RealtimeVoice] Session ${message.type}`);
          break;

        case 'input_audio_buffer.speech_started':
          // User started speaking - this enables barge-in
          session.isPlaying = false;
          this.sendToClient(session.ws, {
            type: 'user_speech_started',
          });
          break;

        case 'input_audio_buffer.speech_stopped':
          this.sendToClient(session.ws, {
            type: 'user_speech_stopped',
          });
          break;

        case 'conversation.item.input_audio_transcription.completed':
          this.sendToClient(session.ws, {
            type: 'transcription',
            text: message.transcript,
          });
          break;

        case 'response.audio.delta':
          // Forward audio delta to client
          this.sendToClient(session.ws, {
            type: 'audio_delta',
            audio: message.delta,
            format: 'pcm16',
          });
          break;

        case 'response.audio.done':
          this.sendToClient(session.ws, {
            type: 'audio_done',
          });
          break;

        case 'response.audio_transcript.delta':
          this.sendToClient(session.ws, {
            type: 'response_text_delta',
            delta: message.delta,
          });
          break;

        case 'response.audio_transcript.done':
          this.sendToClient(session.ws, {
            type: 'response_text_done',
            text: message.transcript,
          });
          break;

        case 'response.done':
          session.isPlaying = false;
          this.sendToClient(session.ws, {
            type: 'response_complete',
            response: message.response,
          });
          break;

        case 'error':
          console.error('[RealtimeVoice] OpenAI Realtime error:', message.error);
          this.sendToClient(session.ws, {
            type: 'error',
            message: message.error?.message || 'Realtime API error',
          });
          break;

        default:
          // Forward other messages for debugging
          console.log(`[RealtimeVoice] Realtime message: ${message.type}`);
      }
    } catch (error) {
      console.error('[RealtimeVoice] Error parsing realtime message:', error);
    }
  }

  /**
   * Forward message to OpenAI Realtime API
   */
  private forwardToRealtime(session: VoiceSession, message: any): void {
    if (session.realtimeWs && session.realtimeWs.readyState === WebSocket.OPEN) {
      session.realtimeWs.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to client
   */
  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get instructions for the realtime session
   */
  private getRealtimeInstructions(session: VoiceSession): string {
    let instructions = `You are a voice assistant for TherapyFlow, a mental health practice management application.

Your role is to help therapists with:
- Practice management questions
- Client insights and session preparation
- Clinical documentation assistance
- Scheduling and calendar management

Guidelines:
- Keep responses brief and conversational - suitable for spoken delivery
- Be warm, professional, and supportive
- If asked about specific clients, provide helpful clinical insights
- Respect confidentiality and clinical boundaries
- You can be interrupted at any time (barge-in is enabled)
`;

    if (session.clientContext?.clientId) {
      instructions += `\nCurrent context: Working with client ID ${session.clientContext.clientId}`;
    }

    if (session.clientContext?.sessionNotes) {
      instructions += `\nRecent session notes: ${session.clientContext.sessionNotes}`;
    }

    return instructions;
  }

  /**
   * Clean up session resources
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.realtimeWs) {
        session.realtimeWs.close();
      }
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.close(1000, 'Session timeout');
      }
      this.sessions.delete(sessionId);
    }
    this.sessionLastActivity.delete(sessionId);
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    activeSessions: number;
    realtimeSessions: number;
  } {
    let realtimeSessions = 0;
    this.sessions.forEach(session => {
      if (session.realtimeWs) realtimeSessions++;
    });

    return {
      initialized: this.isInitialized,
      activeSessions: this.sessions.size,
      realtimeSessions,
    };
  }

  /**
   * Get available voices
   */
  getVoices() {
    return VOICE_OPTIONS;
  }
}

// Singleton instance
let realtimeVoiceService: RealtimeVoiceService | null = null;

export function initializeRealtimeVoice(config: RealtimeConfig): RealtimeVoiceService {
  if (!realtimeVoiceService) {
    realtimeVoiceService = new RealtimeVoiceService(config);
  }
  return realtimeVoiceService;
}

export function getRealtimeVoiceService(): RealtimeVoiceService | null {
  return realtimeVoiceService;
}
