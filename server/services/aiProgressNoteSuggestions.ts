import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';

// Use the same pattern as enhanced-document-processor.ts for model selection
const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface SuggestionRequest {
  clientId: string;
  sessionId?: string;
  content: string;
  section: 'subjective' | 'objective' | 'assessment' | 'plan';
  context?: {
    clientData?: any;
    recentNotes?: any[];
    currentSections?: any;
  };
}

interface AISuggestion {
  id: string;
  type: 'intervention' | 'theme' | 'risk_assessment' | 'next_steps' | 'clinical_insight';
  title: string;
  content: string;
  confidence: number;
  context?: string;
}

export class AIProgressNoteSuggestionsService {
  
  /**
   * Generate real-time AI suggestions for progress note content
   */
  async generateSuggestions(request: SuggestionRequest): Promise<AISuggestion[]> {
    try {
      const prompt = this.buildSuggestionsPrompt(request);
      
      console.log(`🤖 Generating AI suggestions for ${request.section} section...`);
      
      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2048,
        temperature: 0.3, // Slightly higher for creative suggestions
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const analysisText = content.text;
        
        // Extract JSON from response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          // Add unique IDs to suggestions
          const suggestions = result.suggestions?.map((suggestion: any) => ({
            ...suggestion,
            id: nanoid()
          })) || [];
          
          console.log(`✅ Generated ${suggestions.length} AI suggestions`);
          return suggestions;
        }
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ Failed to generate AI suggestions:', error);
      return [];
    }
  }

  /**
   * Build comprehensive prompt for AI suggestions
   */
  private buildSuggestionsPrompt(request: SuggestionRequest): string {
    const { content, section, context } = request;
    
    const contextInfo = this.buildContextInfo(context);
    
    return `
You are an expert clinical therapist with extensive experience in evidence-based therapeutic modalities including CBT, DBT, ACT, Narrative Therapy, and Existentialism. Your task is to provide intelligent, actionable suggestions for a therapist writing a progress note.

CURRENT SECTION BEING WRITTEN: ${section.toUpperCase()}
CURRENT CONTENT:
"""
${content}
"""

${contextInfo}

Based on the current content and context, provide intelligent suggestions that would help the therapist create a more comprehensive, clinically sophisticated progress note. Focus on:

FOR SUBJECTIVE SECTION:
- Suggest ways to capture more nuanced emotional expressions
- Recommend specific quotes or client language to include
- Identify themes that might be emerging

FOR OBJECTIVE SECTION:
- Suggest observable behaviors to note
- Recommend mental status observations
- Identify nonverbal communication patterns

FOR ASSESSMENT SECTION:
- Suggest clinical formulations and diagnostic considerations
- Recommend theoretical frameworks that might apply
- Identify patterns connecting to previous sessions
- Suggest risk assessment considerations

FOR PLAN SECTION:
- Recommend specific interventions based on the content
- Suggest homework assignments or between-session activities
- Recommend treatment goals or modifications
- Suggest follow-up considerations

IMPORTANT GUIDELINES:
- All suggestions must be clinically appropriate and evidence-based
- Focus on the specific section being written
- Provide practical, actionable suggestions
- Consider the therapeutic relationship and alliance
- Suggest specific rather than generic interventions
- Include confidence levels based on the available information

Return your response in this exact JSON format:
{
  "suggestions": [
    {
      "type": "intervention|theme|risk_assessment|next_steps|clinical_insight",
      "title": "Brief descriptive title",
      "content": "Detailed suggestion content (2-3 sentences)",
      "confidence": 1-100,
      "context": "Why this suggestion is relevant"
    }
  ]
}

Provide 3-5 high-quality, specific suggestions that would genuinely enhance the clinical documentation.
`;
  }

  /**
   * Build context information from available data
   */
  private buildContextInfo(context?: any): string {
    if (!context) return '';
    
    let contextInfo = '\nCONTEXT INFORMATION:\n';
    
    if (context.clientData) {
      contextInfo += `CLIENT: ${context.clientData.name || 'Unknown'}\n`;
      if (context.clientData.tags?.length) {
        contextInfo += `CLIENT TAGS: ${context.clientData.tags.join(', ')}\n`;
      }
    }
    
    if (context.recentNotes?.length) {
      contextInfo += `\nRECENT PROGRESS NOTES SUMMARY:\n`;
      context.recentNotes.forEach((note: any, index: number) => {
        contextInfo += `Note ${index + 1}: ${note.content?.substring(0, 200)}...\n`;
        if (note.tags?.length) {
          contextInfo += `Tags: ${note.tags.join(', ')}\n`;
        }
      });
    }
    
    if (context.currentSections) {
      contextInfo += '\nCURRENT NOTE SECTIONS:\n';
      Object.entries(context.currentSections).forEach(([section, content]: [string, any]) => {
        if (content && typeof content === 'string' && content.trim()) {
          contextInfo += `${section.toUpperCase()}: ${content.substring(0, 150)}...\n`;
        }
      });
    }
    
    return contextInfo;
  }

  /**
   * Generate quick suggestions for common therapeutic interventions
   */
  async generateQuickInterventions(clientContext?: any): Promise<AISuggestion[]> {
    const commonInterventions = [
      {
        type: 'intervention' as const,
        title: 'Mindfulness-Based Intervention',
        content: 'Introduce a brief mindfulness exercise to help client observe thoughts and feelings without judgment, building present-moment awareness.',
        confidence: 85,
        context: 'Effective for anxiety, depression, and emotional regulation'
      },
      {
        type: 'intervention' as const,
        title: 'Cognitive Restructuring',
        content: 'Explore underlying thought patterns and help client identify cognitive distortions, then develop more balanced perspectives.',
        confidence: 90,
        context: 'CBT technique effective for negative thought patterns'
      },
      {
        type: 'next_steps' as const,
        title: 'Between-Session Practice',
        content: 'Assign specific homework to practice skills discussed in session, with clear instructions and check-in plan.',
        confidence: 80,
        context: 'Reinforces therapeutic work outside sessions'
      },
      {
        type: 'clinical_insight' as const,
        title: 'Pattern Recognition',
        content: 'Document emerging patterns in client\'s responses and behaviors that may inform future treatment approaches.',
        confidence: 75,
        context: 'Helps track therapeutic progress and adjust treatment'
      }
    ];

    return commonInterventions.map(intervention => ({
      ...intervention,
      id: nanoid()
    }));
  }

  /**
   * Analyze content for risk indicators
   */
  async analyzeRiskFactors(content: string): Promise<AISuggestion[]> {
    const riskKeywords = {
      high: ['suicide', 'self-harm', 'cutting', 'ending it all', 'better off dead'],
      moderate: ['hopeless', 'worthless', 'can\'t go on', 'overwhelming', 'crisis'],
      low: ['stressed', 'anxious', 'sad', 'frustrated', 'tired']
    };

    const suggestions: AISuggestion[] = [];
    const lowerContent = content.toLowerCase();

    // Check for risk indicators
    if (riskKeywords.high.some(keyword => lowerContent.includes(keyword))) {
      suggestions.push({
        id: nanoid(),
        type: 'risk_assessment',
        title: 'High Risk Assessment Needed',
        content: 'Content suggests potential high-risk indicators. Consider comprehensive suicide risk assessment and safety planning.',
        confidence: 95,
        context: 'High-risk language detected in session content'
      });
    } else if (riskKeywords.moderate.some(keyword => lowerContent.includes(keyword))) {
      suggestions.push({
        id: nanoid(),
        type: 'risk_assessment',
        title: 'Moderate Risk Monitoring',
        content: 'Monitor for escalating distress and consider increased session frequency or additional support resources.',
        confidence: 80,
        context: 'Moderate risk indicators present'
      });
    }

    return suggestions;
  }
}

export const aiProgressNoteSuggestions = new AIProgressNoteSuggestionsService();