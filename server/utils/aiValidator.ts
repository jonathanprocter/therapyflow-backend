import { z } from 'zod';

// Core AI response validation schemas
export const clinicalInsightSchema = z.object({
  content: z.string().min(10).max(500),
  confidence: z.number().min(0).max(1),
  category: z.enum(['assessment', 'progress', 'intervention', 'risk', 'goal']),
  evidence: z.array(z.string()).optional(),
});

export const riskAssessmentSchema = z.object({
  level: z.enum(['low', 'medium', 'high', 'critical']),
  factors: z.array(z.string()),
  recommendations: z.array(z.string()),
  immediateAction: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const therapeuticRecommendationSchema = z.object({
  intervention: z.string().min(5).max(200),
  rationale: z.string().min(10).max(300),
  priority: z.enum(['low', 'medium', 'high']),
  timeline: z.string().optional(),
  outcome_measures: z.array(z.string()).optional(),
});

// Comprehensive AI response validation
export const validatedAIResponseSchema = z.object({
  insights: z.array(clinicalInsightSchema),
  riskAssessment: riskAssessmentSchema.optional(),
  recommendations: z.array(therapeuticRecommendationSchema),
  tags: z.array(z.string()),
  summary: z.string().min(20).max(500),
  confidence: z.number().min(0).max(1),
  processingMetadata: z.object({
    model: z.string(),
    processingTime: z.number(),
    validationPassed: z.boolean(),
    flags: z.array(z.string()).optional(),
  }),
});

export type ValidatedAIResponse = z.infer<typeof validatedAIResponseSchema>;

/**
 * AI Response Validator with clinical safety checks
 * Ensures all AI outputs meet clinical standards and safety requirements
 */
export class ClinicalAIValidator {
  
  // Content safety flags
  private static readonly INAPPROPRIATE_PATTERNS = [
    /\b(kill|suicide|harm|die|death)\s+(yourself|myself|himself|herself)\b/gi,
    /\b(how to)\s+(die|kill|harm)\b/gi,
    /\b(ways to)\s+(die|kill|harm)\b/gi,
  ];

  // Clinical terminology that requires validation
  private static readonly HIGH_RISK_TERMS = [
    'suicidal', 'homicidal', 'psychotic', 'manic', 'crisis', 'emergency',
    'hospitalization', 'medication', 'diagnosis', 'disorder'
  ];

  /**
   * Validate and enhance AI response for clinical use
   */
  static async validateResponse(
    rawResponse: any,
    context: {
      clientId: string;
      therapistId: string;
      sessionType?: string;
      originalContent: string;
    }
  ): Promise<{
    isValid: boolean;
    validatedResponse?: ValidatedAIResponse;
    errors: string[];
    warnings: string[];
    riskFlags: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const riskFlags: string[] = [];

    try {
      // 1. Basic structure validation
      const structureValidation = this.validateBasicStructure(rawResponse);
      if (!structureValidation.isValid) {
        errors.push(...structureValidation.errors);
        return { isValid: false, errors, warnings, riskFlags };
      }

      // 2. Content safety validation
      const safetyValidation = this.validateContentSafety(rawResponse, context.originalContent);
      if (!safetyValidation.isValid) {
        errors.push(...safetyValidation.errors);
        riskFlags.push(...safetyValidation.riskFlags);
      }

      // 3. Clinical appropriateness validation
      const clinicalValidation = this.validateClinicalContent(rawResponse);
      warnings.push(...clinicalValidation.warnings);
      riskFlags.push(...clinicalValidation.riskFlags);

      // 4. Confidence threshold validation
      const confidenceValidation = this.validateConfidenceThresholds(rawResponse);
      warnings.push(...confidenceValidation.warnings);

      // 5. Construct validated response
      const validatedResponse = this.constructValidatedResponse(rawResponse, {
        processingMetadata: {
          model: rawResponse.model || 'unknown',
          processingTime: rawResponse.processingTime || 0,
          validationPassed: errors.length === 0,
          flags: [...warnings, ...riskFlags],
        },
      });

      return {
        isValid: errors.length === 0,
        validatedResponse: errors.length === 0 ? validatedResponse : undefined,
        errors,
        warnings,
        riskFlags,
      };

    } catch (error: any) {
      console.error('[AI-VALIDATOR] Validation failed:', error);
      errors.push(`Validation error: ${error?.message || 'Unknown validation error'}`);
      
      return { isValid: false, errors, warnings, riskFlags };
    }
  }

  /**
   * Validate basic response structure
   */
  private static validateBasicStructure(response: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!response || typeof response !== 'object') {
      errors.push('Response must be a valid object');
      return { isValid: false, errors };
    }

    // Required fields
    if (!response.insights || !Array.isArray(response.insights)) {
      errors.push('Response must include insights array');
    }

    if (!response.tags || !Array.isArray(response.tags)) {
      errors.push('Response must include tags array');
    }

    if (!response.summary || typeof response.summary !== 'string') {
      errors.push('Response must include summary string');
    }

    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      errors.push('Response must include valid confidence score (0-1)');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate content safety and appropriateness
   */
  private static validateContentSafety(
    response: any,
    originalContent: string
  ): {
    isValid: boolean;
    errors: string[];
    riskFlags: string[];
  } {
    const errors: string[] = [];
    const riskFlags: string[] = [];

    // Check for inappropriate content patterns
    const allText = JSON.stringify(response).toLowerCase();
    
    for (const pattern of this.INAPPROPRIATE_PATTERNS) {
      if (pattern.test(allText)) {
        errors.push('Response contains inappropriate content that could be harmful');
        riskFlags.push('inappropriate-content');
        break;
      }
    }

    // Check for high-risk terminology misuse
    for (const term of this.HIGH_RISK_TERMS) {
      if (allText.includes(term)) {
        riskFlags.push(`high-risk-term-${term}`);
      }
    }

    // Validate risk assessment if present
    if (response.riskAssessment) {
      if (response.riskAssessment.level === 'critical' && !response.riskAssessment.immediateAction) {
        errors.push('Critical risk assessment must include immediate action flag');
      }
    }

    return { isValid: errors.length === 0, errors, riskFlags };
  }

  /**
   * Validate clinical content appropriateness
   */
  private static validateClinicalContent(response: any): {
    warnings: string[];
    riskFlags: string[];
  } {
    const warnings: string[] = [];
    const riskFlags: string[] = [];

    // Check insight quality
    if (response.insights) {
      for (const insight of response.insights) {
        if (typeof insight === 'string' && insight.length < 10) {
          warnings.push('Some insights may be too brief for clinical value');
        }
      }
    }

    // Check recommendation specificity
    if (response.recommendations) {
      for (const rec of response.recommendations) {
        if (typeof rec === 'string' && rec.length < 15) {
          warnings.push('Some recommendations may lack sufficient detail');
        }
      }
    }

    // Check for diagnostic language (therapists shouldn't diagnose unless qualified)
    const diagnosticTerms = ['diagnosed with', 'diagnosis of', 'meets criteria for'];
    const responseText = JSON.stringify(response).toLowerCase();
    
    for (const term of diagnosticTerms) {
      if (responseText.includes(term)) {
        warnings.push('Response contains diagnostic language - ensure appropriate clinical authority');
        riskFlags.push('diagnostic-language');
      }
    }

    return { warnings, riskFlags };
  }

  /**
   * Validate confidence thresholds for different content types
   */
  private static validateConfidenceThresholds(response: any): {
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Low confidence warnings
    if (response.confidence < 0.6) {
      warnings.push('Low AI confidence - manual review recommended');
    }

    // Risk assessment confidence
    if (response.riskAssessment && response.riskAssessment.confidence < 0.7) {
      warnings.push('Low confidence in risk assessment - manual validation required');
    }

    return { warnings };
  }

  /**
   * Construct standardized validated response
   */
  private static constructValidatedResponse(
    rawResponse: any,
    metadata: any
  ): ValidatedAIResponse {
    // Convert simple strings to structured insights
    const insights = (rawResponse.insights || []).map((insight: any) => {
      if (typeof insight === 'string') {
        return {
          content: insight,
          confidence: rawResponse.confidence || 0.5,
          category: this.categorizeInsight(insight),
        };
      }
      return insight;
    });

    // Convert simple recommendations to structured format
    const recommendations = (rawResponse.recommendations || []).map((rec: any) => {
      if (typeof rec === 'string') {
        return {
          intervention: rec,
          rationale: 'AI-generated recommendation based on session analysis',
          priority: 'medium' as const,
        };
      }
      return rec;
    });

    return {
      insights,
      riskAssessment: rawResponse.riskAssessment,
      recommendations,
      tags: rawResponse.tags || [],
      summary: rawResponse.summary || 'No summary provided',
      confidence: rawResponse.confidence || 0.5,
      processingMetadata: metadata.processingMetadata,
    };
  }

  /**
   * Categorize insight based on content
   */
  private static categorizeInsight(insight: string): 'assessment' | 'progress' | 'intervention' | 'risk' | 'goal' {
    const lower = insight.toLowerCase();
    
    if (lower.includes('goal') || lower.includes('objective')) return 'goal';
    if (lower.includes('risk') || lower.includes('concern')) return 'risk';
    if (lower.includes('progress') || lower.includes('improvement')) return 'progress';
    if (lower.includes('intervention') || lower.includes('technique')) return 'intervention';
    
    return 'assessment';
  }

  /**
   * Generate safety report for high-risk responses
   */
  static generateSafetyReport(
    validationResult: any,
    context: { clientId: string; therapistId: string }
  ): {
    requiresReview: boolean;
    safetyLevel: 'safe' | 'caution' | 'unsafe';
    actions: string[];
    reviewNotes: string[];
  } {
    const { errors, warnings, riskFlags } = validationResult;
    
    let safetyLevel: 'safe' | 'caution' | 'unsafe' = 'safe';
    const actions: string[] = [];
    const reviewNotes: string[] = [];

    if (errors.length > 0) {
      safetyLevel = 'unsafe';
      actions.push('Block AI response from reaching client');
      actions.push('Generate fallback response');
      reviewNotes.push('AI response failed safety validation');
    } else if (riskFlags.length > 2 || warnings.length > 3) {
      safetyLevel = 'caution';
      actions.push('Flag for manual review');
      reviewNotes.push('AI response has multiple risk indicators');
    }

    return {
      requiresReview: safetyLevel !== 'safe',
      safetyLevel,
      actions,
      reviewNotes,
    };
  }
}