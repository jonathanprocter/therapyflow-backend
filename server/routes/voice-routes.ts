/**
 * Voice API Routes for ElevenLabs Integration
 * Provides text-to-speech and voice assistant capabilities
 */

import type { Express, Request, Response } from 'express';
import { elevenLabsService } from '../services/elevenLabsService';

export function registerVoiceRoutes(app: Express) {
  /**
   * Check voice service health
   */
  app.get('/api/voice/health', async (req: Request, res: Response) => {
    try {
      const available = elevenLabsService.isAvailable();
      res.json({
        available,
        provider: 'elevenlabs',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Voice health check failed' });
    }
  });

  /**
   * Get available voices
   */
  app.get('/api/voice/voices', async (req: Request, res: Response) => {
    try {
      if (!elevenLabsService.isAvailable()) {
        return res.json({
          voices: elevenLabsService.getRecommendedVoices(),
          source: 'default'
        });
      }

      const voices = await elevenLabsService.getVoices();
      res.json({
        voices: voices.map(v => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
          preview_url: v.preview_url
        })),
        source: 'api'
      });
    } catch (error) {
      console.error('Error fetching voices:', error);
      res.status(500).json({ error: 'Failed to fetch voices' });
    }
  });

  /**
   * Get recommended voices for therapy
   */
  app.get('/api/voice/recommended', (req: Request, res: Response) => {
    res.json({
      voices: elevenLabsService.getRecommendedVoices(),
      currentVoice: elevenLabsService.getCurrentVoice()
    });
  });

  /**
   * Get premium voices from ElevenLabs account
   */
  app.get('/api/voice/premium', async (req: Request, res: Response) => {
    try {
      if (!elevenLabsService.isAvailable()) {
        return res.json({
          voices: elevenLabsService.getRecommendedVoices(),
          source: 'default',
          currentVoice: elevenLabsService.getCurrentVoice()
        });
      }

      const premiumVoices = await elevenLabsService.getPremiumVoices();
      res.json({
        voices: premiumVoices.map(v => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
          description: v.description,
          preview_url: v.preview_url,
          labels: v.labels
        })),
        source: 'api',
        currentVoice: elevenLabsService.getCurrentVoice()
      });
    } catch (error) {
      console.error('Error fetching premium voices:', error);
      res.status(500).json({ error: 'Failed to fetch premium voices' });
    }
  });

  /**
   * Set preferred voice
   */
  app.post('/api/voice/set-voice', (req: Request, res: Response) => {
    try {
      const { voiceId } = req.body;

      if (!voiceId) {
        return res.status(400).json({ error: 'Voice ID is required' });
      }

      elevenLabsService.setVoice(voiceId);
      res.json({
        success: true,
        currentVoice: elevenLabsService.getCurrentVoice()
      });
    } catch (error) {
      console.error('Error setting voice:', error);
      res.status(500).json({ error: 'Failed to set voice' });
    }
  });

  /**
   * Preview a voice with sample text
   */
  app.post('/api/voice/preview', async (req: Request, res: Response) => {
    try {
      const { voiceId, text } = req.body;

      if (!elevenLabsService.isAvailable()) {
        return res.status(503).json({ error: 'Voice service not available' });
      }

      const sampleText = text || "Hello, I'm your clinical assistant. How can I help you today?";

      const audio = await elevenLabsService.textToSpeech({
        text: sampleText,
        voiceId
      });

      if (!audio) {
        return res.status(500).json({ error: 'Failed to generate preview' });
      }

      res.json({
        audio: audio.toString('base64'),
        voiceId,
        text: sampleText
      });
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ error: 'Failed to preview voice' });
    }
  });

  /**
   * Text to speech conversion
   */
  app.post('/api/voice/synthesize', async (req: Request, res: Response) => {
    try {
      const { text, voiceId, format } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      if (!elevenLabsService.isAvailable()) {
        return res.status(503).json({
          error: 'Voice service not available',
          message: 'ElevenLabs API key not configured'
        });
      }

      const audioBuffer = await elevenLabsService.textToSpeech({
        text,
        voiceId,
        outputFormat: format
      });

      if (!audioBuffer) {
        return res.status(500).json({ error: 'Failed to synthesize audio' });
      }

      // Return audio as base64 for easy client handling
      res.json({
        audio: audioBuffer.toString('base64'),
        format: format || 'mp3_44100_128',
        text,
        voiceId: voiceId || 'default'
      });
    } catch (error) {
      console.error('Synthesize error:', error);
      res.status(500).json({ error: 'Speech synthesis failed' });
    }
  });

  /**
   * Stream text to speech (for real-time playback)
   */
  app.post('/api/voice/stream', async (req: Request, res: Response) => {
    try {
      const { text, voiceId } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      if (!elevenLabsService.isAvailable()) {
        return res.status(503).json({ error: 'Voice service not available' });
      }

      const stream = await elevenLabsService.streamTextToSpeech({
        text,
        voiceId
      });

      if (!stream) {
        return res.status(500).json({ error: 'Failed to create audio stream' });
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Pipe the stream to response
      const reader = stream.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        await pump();
      };

      await pump();
    } catch (error) {
      console.error('Stream error:', error);
      res.status(500).json({ error: 'Audio streaming failed' });
    }
  });

  /**
   * AI Voice Assistant - Ask a question and get voice response
   */
  app.post('/api/voice/assistant', async (req: any, res: Response) => {
    try {
      const { query, context, voiceId } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      console.log(`[Voice Assistant] Query: "${query.substring(0, 50)}..." | Voice: ${voiceId || 'default'}`);

      // Generate response with selected voice
      const response = await elevenLabsService.generateVoiceResponse(
        query,
        {
          messages: context?.messages || [],
          clientId: context?.clientId,
          sessionId: context?.sessionId,
          pageContext: context?.pageContext,
          therapistId: req.therapistId || 'dr-jonathan-procter'
        },
        voiceId
      );

      // If voice is available and requested, include audio
      const result: any = {
        text: response.text,
        hasAudio: !!response.audio
      };

      if (response.audio) {
        result.audio = response.audio.toString('base64');
        result.audioFormat = 'mp3';
      }

      res.json(result);
    } catch (error) {
      console.error('Voice assistant error:', error);
      res.status(500).json({
        error: 'Voice assistant failed',
        text: "I'm sorry, I couldn't process that request right now."
      });
    }
  });

  /**
   * Quick insights endpoint - get voice summary of current context
   */
  app.post('/api/voice/insights', async (req: any, res: Response) => {
    try {
      const { clientId, pageContext } = req.body;
      const therapistId = req.therapistId || 'dr-jonathan-procter';

      let insightText = '';

      if (clientId) {
        // Import storage to get client info
        const { storage } = await import('../storage');
        const client = await storage.getClient(clientId);
        const notes = await storage.getProgressNotes(clientId);
        const recentNotes = notes.slice(0, 3);

        if (client) {
          insightText = `Here's a quick summary for ${client.name}. `;
          insightText += `They have ${notes.length} progress notes on file. `;

          if (recentNotes.length > 0) {
            const latestNote = recentNotes[0];
            const noteDate = new Date(latestNote.sessionDate).toLocaleDateString();
            insightText += `The most recent session was on ${noteDate}. `;
          }
        }
      } else if (pageContext === 'dashboard') {
        insightText = "Welcome back to your dashboard. You can ask me about any client, upcoming sessions, or clinical insights.";
      } else if (pageContext === 'calendar') {
        insightText = "I can help you prepare for upcoming sessions. Just ask about a specific client or date.";
      } else {
        insightText = "How can I help you today? I can provide insights about clients, sessions, or clinical documentation.";
      }

      // Generate audio if available
      let audio: Buffer | null = null;
      if (elevenLabsService.isAvailable()) {
        audio = await elevenLabsService.textToSpeech({ text: insightText });
      }

      res.json({
        text: insightText,
        hasAudio: !!audio,
        audio: audio?.toString('base64')
      });
    } catch (error) {
      console.error('Insights error:', error);
      res.status(500).json({ error: 'Failed to generate insights' });
    }
  });

  console.log('[Voice Routes] Registered ElevenLabs voice API routes');
}
