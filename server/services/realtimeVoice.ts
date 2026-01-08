/**
 * Real-time Voice Service for TherapyFlow
 *
 * Provides:
 * 1. Text-to-Speech (TTS) using OpenAI
 * 2. WebSocket server for bidirectional real-time communication
 * 3. OpenAI Realtime API integration for barge-in mode
 */

import OpenAI from 'openai';
import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage, Server as HttpServer } from 'http';
import { EventEmitter } from 'events';

// Voice options for TTS
export const VOICE_OPTIONS = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced', premium: false },
  { id: 'echo', name: 'Echo', description: 'Warm and conversational', premium: false },
  { id: 'fable', name: 'Fable', description: 'Expressive and dynamic', premium: false },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative', premium: false },
  { id: 'nova', name: 'Nova', description: 'Friendly and upbeat', premium: false },
  { id: 'shimmer', name: 'Shimmer', description: 'Clear and professional', premium: false },
] as const;

export type VoiceId = typeof VOICE_OPTIONS[number]['id'];

interface RealtimeConfig {
  openaiApiKey: string;
  anthropicApiKey?: string;
  defaultVoice?: VoiceId;
}

interface VoiceSession {
  id: string;
  ws: WebSocket;
  realtimeWs?: WebSocket;
  isBargeInEnabled: boolean;
  currentVoice: VoiceId;
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
export class RealtimeVoiceService extends EventEmitter {
  private openai: OpenAI | null = null;
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, VoiceSession> = new Map();
  private config: RealtimeConfig;
  private isInitialized = false;

  constructor(config: RealtimeConfig) {
    super();
    this.config = config;

    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
      this.isInitialized = true;
      console.log('[RealtimeVoice] Service initialized with OpenAI');
    } else {
      console.warn('[RealtimeVoice] OpenAI API key not provided - TTS disabled');
    }
  }

  /**
   * Generate audio from text using OpenAI TTS
   */
  async generateSpeech(text: string, voiceId: VoiceId = 'nova'): Promise<Buffer | null> {
    if (!this.openai) {
      console.error('[RealtimeVoice] OpenAI not initialized');
      return null;
    }

    try {
      console.log(`[RealtimeVoice] Generating speech with voice: ${voiceId}`);

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: voiceId,
        input: text,
        response_format: 'mp3',
      });

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`[RealtimeVoice] Generated ${buffer.length} bytes of audio`);
      return buffer;
    } catch (error) {
      console.error('[RealtimeVoice] TTS generation failed:', error);
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
        isPlaying: false,
        therapistId: 'dr-jonathan-procter', // Default for single-therapist mode
      };

      this.sessions.set(sessionId, session);

      // Send welcome message with session config
      this.sendToClient(ws, {
        type: 'connected',
        sessionId,
        config: {
          voices: VOICE_OPTIONS,
          currentVoice: session.currentVoice,
          bargeInEnabled: session.isBargeInEnabled,
        },
      });

      ws.on('message', async (data: Buffer) => {
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

    console.log('[RealtimeVoice] WebSocket server initialized on /ws/voice');
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
        bargeInEnabled: session.isBargeInEnabled,
      },
    });
  }

  /**
   * Handle speak request - generate TTS and send audio
   */
  private async handleSpeak(session: VoiceSession, message: any): Promise<void> {
    const { text, voice } = message;

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
    const audioBuffer = await this.generateSpeech(text, voiceId);

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
      this.sessions.delete(sessionId);
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
