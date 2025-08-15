import { z } from 'zod';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// AI Response Schema for validation
const aiAnalysisSchema = z.object({
  insights: z.array(z.string()).min(1),
  tags: z.array(z.string()),
  riskFactors: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  summary: z.string().optional(),
  therapeuticGoals: z.array(z.string()).optional(),
});

export type AIAnalysisResult = z.infer<typeof aiAnalysisSchema>;

/**
 * Robust AI Service with comprehensive error handling and fallbacks
 * Ensures clinical data is never lost due to AI service failures
 */
export class ClinicalAIService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Analyze progress note with comprehensive error handling
   */
  async analyzeProgressNote(
    content: string,
    clientContext?: {
      previousSessions?: string[];
      therapeuticGoals?: string[];
      riskFactors?: string[];
    }
  ): Promise<{
    success: boolean;
    analysis?: AIAnalysisResult;
    error?: string;
    fallbackUsed?: boolean;
    processingMetadata: {
      provider: 'openai' | 'anthropic' | 'manual';
      retryCount: number;
      processingTime: number;
      timestamp: Date;
    };
  }> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: any;

    // Sanitize input to prevent prompt injection
    const sanitizedContent = this.sanitizeInput(content);
    
    while (retryCount < this.maxRetries) {
      try {
        // Try OpenAI first
        if (retryCount === 0 || retryCount === 2) {
          console.log(`[AI] Attempting OpenAI analysis (attempt ${retryCount + 1})`);
          
          const result = await this.analyzeWithOpenAI(sanitizedContent, clientContext);
          
          return {
            success: true,
            analysis: result,
            processingMetadata: {
              provider: 'openai',
              retryCount,
              processingTime: Date.now() - startTime,
              timestamp: new Date(),
            },
          };
        }
        
        // Try Anthropic as fallback
        if (retryCount === 1) {
          console.log(`[AI] Attempting Anthropic analysis (attempt ${retryCount + 1})`);
          
          const result = await this.analyzeWithAnthropic(sanitizedContent, clientContext);
          
          return {
            success: true,
            analysis: result,
            processingMetadata: {
              provider: 'anthropic',
              retryCount,
              processingTime: Date.now() - startTime,
              timestamp: new Date(),
            },
          };
        }

      } catch (error) {
        lastError = error;
        retryCount++;
        
        console.error(`[AI] Analysis attempt ${retryCount} failed:`, {
          error: error.message,
          provider: retryCount === 1 ? 'openai' : 'anthropic',
          contentLength: content.length,
        });

        if (retryCount < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, retryCount - 1);
          await this.sleep(delay);
        }
      }
    }

    // All AI services failed - use manual fallback
    console.error('[AI] All AI services failed, using manual fallback');
    
    const fallbackAnalysis = this.generateFallbackAnalysis(sanitizedContent);
    
    return {
      success: true,
      analysis: fallbackAnalysis,
      fallbackUsed: true,
      error: `AI services unavailable: ${lastError?.message}`,
      processingMetadata: {
        provider: 'manual',
        retryCount,
        processingTime: Date.now() - startTime,
        timestamp: new Date(),
      },
    };
  }

  /**
   * OpenAI analysis implementation
   */
  private async analyzeWithOpenAI(
    content: string, 
    context?: any
  ): Promise<AIAnalysisResult> {
    const systemPrompt = this.buildClinicalPrompt(context);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.3, // Lower temperature for consistent clinical analysis
      max_tokens: 1500,
      response_format: { type: 'json_object' }, // Ensure JSON response
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('Empty response from OpenAI');
    }

    const parsedResponse = JSON.parse(rawResponse);
    return this.validateAIResponse(parsedResponse);
  }

  /**
   * Anthropic analysis implementation
   */
  private async analyzeWithAnthropic(
    content: string,
    context?: any
  ): Promise<AIAnalysisResult> {
    const systemPrompt = this.buildClinicalPrompt(context);
    
    const message = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: 'user', content: content }
      ],
    });

    const rawResponse = message.content[0]?.text;
    if (!rawResponse) {
      throw new Error('Empty response from Anthropic');
    }

    // Extract JSON from response (Claude might include explanation text)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Anthropic response');
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);
    return this.validateAIResponse(parsedResponse);
  }

  /**
   * Validate AI response against schema
   */
  private validateAIResponse(response: any): AIAnalysisResult {
    try {
      return aiAnalysisSchema.parse(response);
    } catch (error) {
      console.error('[AI] Response validation failed:', error);
      throw new Error(`Invalid AI response structure: ${error.message}`);
    }
  }

  /**
   * Generate fallback analysis when AI services fail
   */
  private generateFallbackAnalysis(content: string): AIAnalysisResult {
    // Basic text analysis using built-in JavaScript
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    
    // Simple keyword detection for clinical insights
    const insights: string[] = [];
    const tags: string[] = [];
    
    // Mood indicators
    if (words.some(w => ['anxious', 'anxiety', 'worried', 'nervous'].includes(w))) {
      insights.push('Client expressed anxiety-related concerns');
      tags.push('anxiety');
    }
    
    if (words.some(w => ['depressed', 'sad', 'hopeless', 'down'].includes(w))) {
      insights.push('Client reported depressive symptoms');
      tags.push('depression');
    }
    
    if (words.some(w => ['progress', 'better', 'improved', 'positive'].includes(w))) {
      insights.push('Client reported positive progress');
      tags.push('progress');
    }

    // Session type detection
    if (words.some(w => ['homework', 'assignment', 'practice'].includes(w))) {
      tags.push('homework-assigned');
    }
    
    if (words.some(w => ['goal', 'objective', 'target'].includes(w))) {
      tags.push('goal-setting');
    }

    // Ensure we always have at least one insight
    if (insights.length === 0) {
      insights.push(`Clinical session documented (${wordCount} words)`);
    }

    if (tags.length === 0) {
      tags.push('general-session');
    }

    return {
      insights,
      tags,
      confidence: 0.5, // Lower confidence for manual analysis
      summary: `Manual analysis of ${wordCount}-word progress note. AI services were unavailable.`,
      riskFactors: [], // Conservative approach - don't auto-detect risk factors
      recommendations: ['Review this session manually when AI services are restored'],
    };
  }

  /**
   * Build clinical analysis prompt
   */
  private buildClinicalPrompt(context?: any): string {
    return `You are a clinical assistant analyzing therapy session notes. 

CONTEXT:
${context?.previousSessions ? `Previous sessions: ${context.previousSessions.slice(-3).join('; ')}` : ''}
${context?.therapeuticGoals ? `Therapeutic goals: ${context.therapeuticGoals.join(', ')}` : ''}
${context?.riskFactors ? `Known risk factors: ${context.riskFactors.join(', ')}` : ''}

INSTRUCTIONS:
1. Analyze the session content for clinical insights
2. Identify therapeutic themes and progress indicators
3. Tag the session with relevant clinical categories
4. Assess any risk factors mentioned
5. Suggest therapeutic recommendations

Respond ONLY with valid JSON matching this exact structure:
{
  "insights": ["insight 1", "insight 2"],
  "tags": ["tag1", "tag2"],
  "riskFactors": ["risk1"],
  "recommendations": ["rec1", "rec2"],
  "confidence": 0.85,
  "summary": "Brief session summary",
  "therapeuticGoals": ["goal1", "goal2"]
}

Be professional, accurate, and focus on therapeutic value.`;
  }

  /**
   * Sanitize input to prevent prompt injection
   */
  private sanitizeInput(content: string): string {
    // Remove potential prompt injection patterns
    return content
      .replace(/```[\s\S]*?```/g, '[code block removed]')
      .replace(/\[INST\][\s\S]*?\[\/INST\]/g, '[instruction removed]')
      .replace(/System:|Assistant:|Human:/gi, '[role prefix removed]')
      .trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}