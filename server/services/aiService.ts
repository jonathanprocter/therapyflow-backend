import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import { anthropicService } from "./anthropicService";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface ClinicalTag {
  name: string;
  category: string;
  confidence: number;
}

export interface ClinicalInsight {
  type: "pattern_recognition" | "progress_milestone" | "risk_alert" | "resource_match";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, any>;
}

export interface SessionPreparation {
  keyTopics: string[];
  therapeuticQuestions: string[];
  riskAssessment: string;
  interventionSuggestions: string[];
  goals: string[];
}

export class AIService {

  /**
   * Process therapy documents with AI analysis
   */
  async processTherapyDocument(text: string, prompt: string): Promise<string> {
    try {
      console.log('Processing therapy document with AI...');
      
      // Try OpenAI first
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "system", 
              content: "You are a clinical AI assistant specialized in analyzing therapy progress notes. Always return valid JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        const result = response.choices[0]?.message?.content;
        if (result) {
          console.log('OpenAI analysis completed successfully');
          return result;
        }
      } catch (openaiError) {
        console.warn('OpenAI failed, falling back to Anthropic:', openaiError);
      }

      // Fallback to Anthropic
      const anthropicResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514", // The newest Anthropic model is "claude-sonnet-4-20250514"
        max_tokens: 1500,
        temperature: 0.3,
        system: "You are a clinical AI assistant specialized in analyzing therapy progress notes. Always return valid JSON.",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const content = anthropicResponse.content[0];
      if (content && 'text' in content) {
        console.log('Anthropic analysis completed successfully');
        return content.text;
      }

      throw new Error('No valid response from AI providers');
    } catch (error) {
      console.error('AI document processing failed:', error);
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  async generateClinicalTags(content: string): Promise<ClinicalTag[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        max_tokens: 4096, // Maximum tokens for comprehensive analysis
        temperature: 0.3, // Lower temperature for more consistent clinical analysis
        messages: [
          {
            role: "system",
            content: `You are a clinical AI assistant specialized in analyzing therapy progress notes. 
            Generate relevant clinical tags for the provided content. Focus on:
            - Mental health conditions and symptoms
            - Therapeutic modalities and interventions
            - Progress indicators and treatment goals
            - Risk factors and protective factors
            - Behavioral patterns and coping strategies
            
            Return a JSON array of tags with format: [{"name": "tag_name", "category": "category", "confidence": 0.8}]
            Categories should be: symptom, intervention, progress, risk, goal, behavior, emotion`
          },
          {
            role: "user",
            content: content
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.tags || [];
    } catch (error) {
      console.error("OpenAI error generating clinical tags, trying Anthropic fallback:", error);
      try {
        const anthropicTags = await anthropicService.generateClinicalTags(content);
        return anthropicTags.map(tag => ({
          name: tag.name,
          category: "general",
          confidence: tag.confidence
        }));
      } catch (anthropicError) {
        console.error("Anthropic fallback also failed:", anthropicError);
        return [];
      }
    }
  }

  async generateClinicalInsights(
    clientHistory: string,
    recentNotes: string[],
    clientId?: string
  ): Promise<ClinicalInsight[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        max_tokens: 4096, // Maximum tokens for comprehensive insights
        temperature: 0.2, // Low temperature for clinical consistency
        messages: [
          {
            role: "system",
            content: `You are a clinical AI assistant that analyzes therapeutic progress and generates insights.
            Based on the client history and recent notes, identify:
            1. Pattern Recognition: Recurring themes, behaviors, or symptoms
            2. Progress Milestones: Significant improvements or goal achievements
            3. Risk Alerts: Potential safety concerns or regression indicators
            4. Resource Matches: Suggested interventions, worksheets, or therapeutic approaches
            
            Return JSON with format: {"insights": [{"type": "pattern_recognition", "title": "...", "description": "...", "priority": "medium", "metadata": {}}]}`
          },
          {
            role: "user",
            content: `Client History: ${clientHistory}\n\nRecent Notes:\n${recentNotes.join('\n---\n')}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.insights || [];
    } catch (error) {
      console.error("OpenAI error generating clinical insights, trying Anthropic fallback:", error);
      try {
        const anthropicInsight = await anthropicService.generateClinicalInsight(recentNotes.join('\n\n'), clientHistory);
        return [{
          type: "pattern_recognition",
          title: "Clinical Analysis",
          description: anthropicInsight.insight,
          priority: anthropicInsight.riskLevel === 'high' ? 'high' : anthropicInsight.riskLevel === 'medium' ? 'medium' : 'low',
          metadata: {
            recommendations: anthropicInsight.recommendations,
            patterns: anthropicInsight.patterns,
            source: 'anthropic'
          }
        }];
      } catch (anthropicError) {
        console.error("Anthropic fallback also failed:", anthropicError);
        return [];
      }
    }
  }

  async prepareSessionQuestions(
    clientHistory: string,
    lastSession: string,
    treatmentGoals: string[]
  ): Promise<SessionPreparation> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        max_tokens: 4096, // Maximum tokens for comprehensive session preparation
        temperature: 0.2, // Low temperature for consistent therapeutic guidance
        messages: [
          {
            role: "system",
            content: `You are a clinical AI assistant that helps therapists prepare for sessions.
            Based on the client's history, last session notes, and treatment goals, generate:
            1. Key topics to address in the upcoming session
            2. Therapeutic questions to explore
            3. Risk assessment considerations
            4. Intervention suggestions
            5. Goal-focused activities
            
            Return JSON with format: {
              "keyTopics": ["topic1", "topic2"],
              "therapeuticQuestions": ["question1", "question2"],
              "riskAssessment": "assessment text",
              "interventionSuggestions": ["intervention1", "intervention2"],
              "goals": ["goal1", "goal2"]
            }`
          },
          {
            role: "user",
            content: `Client History: ${clientHistory}\n\nLast Session: ${lastSession}\n\nTreatment Goals: ${treatmentGoals.join(', ')}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        keyTopics: result.keyTopics || [],
        therapeuticQuestions: result.therapeuticQuestions || [],
        riskAssessment: result.riskAssessment || "",
        interventionSuggestions: result.interventionSuggestions || [],
        goals: result.goals || []
      };
    } catch (error) {
      console.error("Error generating session preparation:", error);
      return {
        keyTopics: [],
        therapeuticQuestions: [],
        riskAssessment: "",
        interventionSuggestions: [],
        goals: []
      };
    }
  }

  async analyzeCaseConceptualization(
    clientInfo: string,
    assessmentData: string
  ): Promise<{
    presenting: string;
    predisposing: string;
    precipitating: string;
    perpetuating: string;
    protective: string;
    formulation: string;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a clinical psychologist expert in case conceptualization using the 5 P's framework.
            Analyze the provided client information and assessment data to create a comprehensive case conceptualization:
            
            1. Presenting: Current problems and symptoms
            2. Predisposing: Historical factors that increase vulnerability
            3. Precipitating: Recent triggers or stressors
            4. Perpetuating: Factors maintaining the problems
            5. Protective: Strengths and resources
            6. Formulation: Integrated understanding connecting all factors
            
            Return JSON with the 5 P's analysis.`
          },
          {
            role: "user",
            content: `Client Information: ${clientInfo}\n\nAssessment Data: ${assessmentData}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        presenting: result.presenting || "",
        predisposing: result.predisposing || "",
        precipitating: result.precipitating || "",
        perpetuating: result.perpetuating || "",
        protective: result.protective || "",
        formulation: result.formulation || ""
      };
    } catch (error) {
      console.error("Error analyzing case conceptualization:", error);
      return {
        presenting: "",
        predisposing: "",
        precipitating: "",
        perpetuating: "",
        protective: "",
        formulation: ""
      };
    }
  }

  async findCrossReferences(
    noteContent: string,
    existingNotes: Array<{ id: string; content: string; embedding?: number[] }>
  ): Promise<Array<{ noteId: string; relevanceScore: number }>> {
    try {
      // Generate embedding for the new note
      const noteEmbedding = await this.generateEmbedding(noteContent);
      
      // Calculate similarity with existing notes
      const similarities = existingNotes
        .filter(note => note.embedding && note.embedding.length > 0)
        .map(note => {
          const similarity = this.cosineSimilarity(noteEmbedding, note.embedding!);
          return {
            noteId: note.id,
            relevanceScore: similarity
          };
        })
        .filter(item => item.relevanceScore > 0.7) // Only include highly relevant notes
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5); // Top 5 most relevant

      return similarities;
    } catch (error) {
      console.error("Error finding cross references:", error);
      return [];
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (normA * normB);
  }
}

export const aiService = new AIService();
