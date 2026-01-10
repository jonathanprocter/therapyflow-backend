/**
 * Assessment Extractor Service
 * Ported from TherapyGenius - Extracts standardized clinical assessments from documents
 * Supports PHQ-9, GAD-7, PCL-5, BDI-II, BAI, DASS-21, MDQ, MADRS, HAM-D, HAM-A, MINI, SCID
 */

import { z } from "zod";
import { aiRouter } from "./ai-router";
import { storage } from "../storage";
import type { Document, ProgressNote } from "@shared/schema";

// Supported clinical assessment instruments
export enum AssessmentInstrument {
  PHQ9 = "PHQ-9",
  GAD7 = "GAD-7",
  PCL5 = "PCL-5",
  BDI2 = "BDI-II",
  BAI = "BAI",
  DASS21 = "DASS-21",
  MDQ = "MDQ",
  MADRS = "MADRS",
  HAM_D = "HAM-D",
  HAM_A = "HAM-A",
  MINI = "MINI",
  SCID = "SCID",
  CUSTOM = "Custom"
}

// Assessment extraction validation schema
const assessmentExtractionSchema = z.object({
  assessmentsFound: z.array(z.object({
    instrument: z.nativeEnum(AssessmentInstrument),
    version: z.string().optional(),
    dateAdministered: z.string().optional(),
    scores: z.object({
      totalScore: z.number(),
      subscaleScores: z.record(z.number()).optional(),
      items: z.array(z.object({
        itemNumber: z.number(),
        response: z.union([z.number(), z.string()]),
        score: z.number().optional()
      })).optional(),
      interpretation: z.string().optional(),
      severity: z.enum(["minimal", "mild", "moderate", "moderately severe", "severe", "unknown"]).optional(),
      cutoffMet: z.boolean().optional()
    }),
    metadata: z.object({
      extractionConfidence: z.number().min(0).max(1),
      extractionMethod: z.enum(["ai_parsing", "structured_form", "manual_review"]),
      documentSection: z.string().optional(),
      administeredBy: z.string().optional(),
      notes: z.string().optional(),
      qualityFlags: z.array(z.string()).optional()
    })
  })),
  documentAnalysis: z.object({
    hasAssessmentContent: z.boolean(),
    confidence: z.number().min(0).max(1),
    suggestedInstruments: z.array(z.string()).optional(),
    extractionChallenges: z.array(z.string()).optional()
  })
});

export type AssessmentExtraction = z.infer<typeof assessmentExtractionSchema>;

export interface ExtractedAssessment {
  id?: string;
  clientId: string;
  therapistId: string;
  instrument: AssessmentInstrument;
  version?: string;
  dateAdministered: Date;
  scores: {
    totalScore: number;
    subscaleScores?: Record<string, number>;
    items?: Array<{ itemNumber: number; response: number | string; score?: number }>;
    interpretation?: string;
    severity?: string;
    cutoffMet?: boolean;
  };
  metadata: {
    sourceDocumentId?: string;
    sourceDocumentName?: string;
    confidence: number;
    extractionMethod: string;
    extractionDate: string;
    administeredBy?: string;
    documentSection?: string;
    qualityFlags?: string[];
    notes?: string;
  };
  recommendations?: string;
}

export interface AssessmentExtractionResult {
  success: boolean;
  assessmentsCreated: ExtractedAssessment[];
  extractionResults: AssessmentExtraction;
  errors?: string[];
  metadata: {
    documentId: string;
    processingTime: number;
    aiModel: string;
    extractionDate: Date;
  };
}

export class AssessmentExtractor {

  /**
   * Extract assessments from a document using AI parsing
   */
  async extractAssessmentsFromDocument(
    document: Document,
    therapistId: string,
    clientId?: string
  ): Promise<AssessmentExtractionResult> {
    const startTime = Date.now();

    try {
      console.log(`[Assessment Extractor] Processing document ${document.id} for assessments`);

      const content = document.extractedText || '';
      if (!content) {
        throw new Error("Document has no content to analyze");
      }

      // Use AI to extract assessment data
      const extractionResults = await this.parseAssessmentContent(content, document.fileName);

      const assessmentsCreated: ExtractedAssessment[] = [];
      const errors: string[] = [];

      // Determine client ID from document or parameter
      const finalClientId = clientId || document.clientId;
      if (!finalClientId) {
        throw new Error("Cannot create assessment without client ID");
      }

      // Create assessments from extraction results
      for (const assessmentData of extractionResults.assessmentsFound) {
        try {
          const assessment = this.createAssessmentFromExtraction(
            assessmentData,
            document,
            therapistId,
            finalClientId
          );
          assessmentsCreated.push(assessment);
        } catch (error) {
          const errorMsg = `Failed to create assessment for ${assessmentData.instrument}: ${error}`;
          console.error(`[Assessment Extractor] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      const processingTime = Date.now() - startTime;

      console.log(`[Assessment Extractor] Extracted ${assessmentsCreated.length} assessments from document ${document.id} in ${processingTime}ms`);

      return {
        success: true,
        assessmentsCreated,
        extractionResults,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          documentId: document.id,
          processingTime,
          aiModel: "openai/anthropic",
          extractionDate: new Date()
        }
      };

    } catch (error) {
      console.error(`[Assessment Extractor] Error processing document ${document.id}:`, error);
      return {
        success: false,
        assessmentsCreated: [],
        extractionResults: {
          assessmentsFound: [],
          documentAnalysis: {
            hasAssessmentContent: false,
            confidence: 0
          }
        },
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          documentId: document.id,
          processingTime: Date.now() - startTime,
          aiModel: "unknown",
          extractionDate: new Date()
        }
      };
    }
  }

  /**
   * Parse assessment content using AI
   */
  private async parseAssessmentContent(
    content: string,
    fileName: string
  ): Promise<AssessmentExtraction> {

    const assessmentPrompt = `
You are a clinical assessment extraction specialist. Analyze this document for standardized mental health assessment instruments and extract their scores.

Document: ${fileName}
Content: ${content.substring(0, 6000)}...

Look for these common instruments:
- PHQ-9 (Patient Health Questionnaire-9) - Depression screening
- GAD-7 (Generalized Anxiety Disorder-7) - Anxiety screening
- PCL-5 (PTSD Checklist for DSM-5) - PTSD screening
- BDI-II (Beck Depression Inventory-II) - Depression assessment
- BAI (Beck Anxiety Inventory) - Anxiety assessment
- DASS-21 (Depression, Anxiety and Stress Scale) - Emotional states
- MDQ (Mood Disorder Questionnaire) - Bipolar screening
- MADRS (Montgomery-Asberg Depression Rating Scale) - Depression severity
- HAM-D (Hamilton Depression Rating Scale) - Depression rating
- HAM-A (Hamilton Anxiety Rating Scale) - Anxiety rating

For each assessment found, extract:
1. Instrument type and version
2. Total score and subscale scores
3. Individual item responses if available
4. Date administered (if mentioned)
5. Interpretation/severity level
6. Who administered it

Provide response in this JSON format:
{
  "assessmentsFound": [
    {
      "instrument": "PHQ-9",
      "version": "standard",
      "dateAdministered": "2023-10-15",
      "scores": {
        "totalScore": 12,
        "subscaleScores": {},
        "items": [
          {"itemNumber": 1, "response": 2, "score": 2},
          {"itemNumber": 2, "response": 1, "score": 1}
        ],
        "interpretation": "Moderate depression",
        "severity": "moderate",
        "cutoffMet": true
      },
      "metadata": {
        "extractionConfidence": 0.95,
        "extractionMethod": "ai_parsing",
        "documentSection": "Assessment Results",
        "administeredBy": "Dr. Smith",
        "notes": "Patient reported symptoms for 2+ weeks",
        "qualityFlags": []
      }
    }
  ],
  "documentAnalysis": {
    "hasAssessmentContent": true,
    "confidence": 0.9,
    "suggestedInstruments": ["PHQ-9", "GAD-7"],
    "extractionChallenges": ["Handwritten responses unclear"]
  }
}

If no assessments are found, return empty assessmentsFound array with hasAssessmentContent: false.
Be conservative with confidence scores - only high confidence (>0.8) for clear, complete assessments.
`;

    try {
      const result = await aiRouter.chatJSON([{ role: "user", content: assessmentPrompt }], assessmentExtractionSchema);
      return result;
    } catch (error) {
      console.error("[Assessment Extractor] AI parsing failed:", error);
      // Return empty result if AI parsing fails
      return {
        assessmentsFound: [],
        documentAnalysis: {
          hasAssessmentContent: false,
          confidence: 0,
          extractionChallenges: [`AI parsing failed: ${error}`]
        }
      };
    }
  }

  /**
   * Create assessment record from extraction data
   */
  private createAssessmentFromExtraction(
    assessmentData: AssessmentExtraction['assessmentsFound'][0],
    document: Document,
    therapistId: string,
    clientId: string
  ): ExtractedAssessment {

    // Determine assessment date - prefer extracted date, fallback to document date
    let assessmentDate: Date;
    if (assessmentData.dateAdministered) {
      assessmentDate = new Date(assessmentData.dateAdministered);
    } else {
      assessmentDate = document.uploadedAt || new Date();
    }

    // Create assessment with full provenance metadata
    const assessment: ExtractedAssessment = {
      clientId,
      therapistId,
      instrument: assessmentData.instrument,
      version: assessmentData.version,
      dateAdministered: assessmentDate,
      scores: {
        totalScore: assessmentData.scores.totalScore ?? 0,
        subscaleScores: assessmentData.scores.subscaleScores,
        items: (assessmentData.scores.items || []).map(item => ({
          itemNumber: item.itemNumber ?? 0,
          response: item.response ?? "",
          score: item.score
        })),
        interpretation: assessmentData.scores.interpretation,
        severity: assessmentData.scores.severity,
        cutoffMet: assessmentData.scores.cutoffMet
      },
      metadata: {
        sourceDocumentId: document.id,
        sourceDocumentName: document.fileName,
        confidence: assessmentData.metadata.extractionConfidence,
        extractionMethod: assessmentData.metadata.extractionMethod,
        extractionDate: new Date().toISOString(),
        administeredBy: assessmentData.metadata.administeredBy,
        documentSection: assessmentData.metadata.documentSection,
        qualityFlags: assessmentData.metadata.qualityFlags || [],
        notes: assessmentData.metadata.notes
      },
      recommendations: this.generateRecommendations(assessmentData)
    };

    return assessment;
  }

  /**
   * Generate basic recommendations based on assessment results
   */
  private generateRecommendations(assessmentData: AssessmentExtraction['assessmentsFound'][0]): string | undefined {
    const { instrument, scores } = assessmentData;
    const totalScore = scores.totalScore;
    const severity = scores.severity;

    const recommendations: string[] = [];

    switch (instrument) {
      case AssessmentInstrument.PHQ9:
        if (totalScore >= 15) {
          recommendations.push("Consider immediate psychiatric evaluation for severe depression");
          recommendations.push("Assess for suicide risk");
        } else if (totalScore >= 10) {
          recommendations.push("Consider psychotherapy and/or medication for moderate depression");
        } else if (totalScore >= 5) {
          recommendations.push("Monitor symptoms, consider brief intervention");
        }
        break;

      case AssessmentInstrument.GAD7:
        if (totalScore >= 15) {
          recommendations.push("Consider treatment for severe anxiety");
        } else if (totalScore >= 10) {
          recommendations.push("Consider treatment for moderate anxiety");
        } else if (totalScore >= 5) {
          recommendations.push("Monitor anxiety symptoms");
        }
        break;

      case AssessmentInstrument.PCL5:
        if (totalScore >= 33) {
          recommendations.push("Consider PTSD evaluation and trauma-focused therapy");
        }
        break;

      default:
        if (severity === "severe") {
          recommendations.push("Consider immediate clinical attention");
        } else if (severity === "moderate" || severity === "moderately severe") {
          recommendations.push("Consider therapeutic intervention");
        }
    }

    return recommendations.length > 0 ? recommendations.join("; ") : undefined;
  }

  /**
   * Extract assessments from progress note content
   */
  async extractFromProgressNote(
    note: ProgressNote,
    therapistId: string
  ): Promise<ExtractedAssessment[]> {
    if (!note.content) {
      return [];
    }

    const fakeDocument: Document = {
      id: `note-${note.id}`,
      clientId: note.clientId,
      therapistId: note.therapistId,
      fileName: `Progress Note - ${note.sessionDate}`,
      fileType: "text/plain",
      filePath: "",
      extractedText: note.content,
      embedding: null,
      tags: note.tags || [],
      fileSize: note.content.length,
      metadata: null,
      uploadedAt: note.createdAt
    };

    const result = await this.extractAssessmentsFromDocument(fakeDocument, therapistId, note.clientId);
    return result.assessmentsCreated;
  }

  /**
   * Check if document likely contains assessment data (lightweight check)
   */
  async hasAssessmentContent(document: Document): Promise<{
    hasContent: boolean;
    confidence: number;
    suggestedInstruments: string[];
  }> {

    const content = document.extractedText || '';
    if (!content) {
      return { hasContent: false, confidence: 0, suggestedInstruments: [] };
    }

    // Quick keyword-based detection for common instruments
    const contentLower = content.toLowerCase();
    const keywords: Record<AssessmentInstrument, string[]> = {
      [AssessmentInstrument.PHQ9]: ['phq-9', 'phq9', 'patient health questionnaire', 'depression screening'],
      [AssessmentInstrument.GAD7]: ['gad-7', 'gad7', 'generalized anxiety disorder', 'anxiety screening'],
      [AssessmentInstrument.PCL5]: ['pcl-5', 'pcl5', 'ptsd checklist', 'trauma screening'],
      [AssessmentInstrument.BDI2]: ['bdi-ii', 'bdi2', 'beck depression inventory'],
      [AssessmentInstrument.BAI]: ['beck anxiety inventory', 'bai'],
      [AssessmentInstrument.DASS21]: ['dass-21', 'dass21', 'depression anxiety stress'],
      [AssessmentInstrument.MDQ]: ['mood disorder questionnaire', 'mdq', 'bipolar screening'],
      [AssessmentInstrument.MADRS]: ['madrs', 'montgomery-asberg', 'montgomery asberg'],
      [AssessmentInstrument.HAM_D]: ['ham-d', 'hamilton depression', 'hdrs'],
      [AssessmentInstrument.HAM_A]: ['ham-a', 'hamilton anxiety', 'hars'],
      [AssessmentInstrument.MINI]: ['mini international', 'mini neuropsychiatric'],
      [AssessmentInstrument.SCID]: ['scid', 'structured clinical interview'],
      [AssessmentInstrument.CUSTOM]: []
    };

    const suggestedInstruments: string[] = [];
    let maxConfidence = 0;

    for (const [instrument, instrumentKeywords] of Object.entries(keywords)) {
      const matches = instrumentKeywords.filter(keyword => contentLower.includes(keyword));
      if (matches.length > 0) {
        suggestedInstruments.push(instrument);
        maxConfidence = Math.max(maxConfidence, matches.length * 0.3);
      }
    }

    // Look for numeric patterns that might indicate scores
    const hasScorePatterns = /(?:score|total|sum)[:\s]*(\d+)/.test(contentLower) ||
                           /\d+\/\d+/.test(content) ||
                           /(\d+)\s*out\s*of\s*(\d+)/.test(contentLower);

    if (hasScorePatterns) {
      maxConfidence += 0.2;
    }

    return {
      hasContent: suggestedInstruments.length > 0 || hasScorePatterns,
      confidence: Math.min(maxConfidence, 1.0),
      suggestedInstruments
    };
  }

  /**
   * Get severity label for an instrument based on score
   */
  getSeverityForScore(instrument: AssessmentInstrument, score: number): string {
    switch (instrument) {
      case AssessmentInstrument.PHQ9:
        if (score <= 4) return "minimal";
        if (score <= 9) return "mild";
        if (score <= 14) return "moderate";
        if (score <= 19) return "moderately severe";
        return "severe";

      case AssessmentInstrument.GAD7:
        if (score <= 4) return "minimal";
        if (score <= 9) return "mild";
        if (score <= 14) return "moderate";
        return "severe";

      case AssessmentInstrument.PCL5:
        if (score < 33) return "below threshold";
        return "probable PTSD";

      case AssessmentInstrument.BDI2:
        if (score <= 13) return "minimal";
        if (score <= 19) return "mild";
        if (score <= 28) return "moderate";
        return "severe";

      case AssessmentInstrument.BAI:
        if (score <= 7) return "minimal";
        if (score <= 15) return "mild";
        if (score <= 25) return "moderate";
        return "severe";

      default:
        return "unknown";
    }
  }

  /**
   * Get instrument info (max score, interpretation guidance)
   */
  getInstrumentInfo(instrument: AssessmentInstrument): {
    maxScore: number;
    description: string;
    cutoffScore?: number;
    subscales?: string[];
  } {
    const instrumentInfo: Record<AssessmentInstrument, any> = {
      [AssessmentInstrument.PHQ9]: {
        maxScore: 27,
        description: "Patient Health Questionnaire-9 for depression screening",
        cutoffScore: 10,
        subscales: []
      },
      [AssessmentInstrument.GAD7]: {
        maxScore: 21,
        description: "Generalized Anxiety Disorder-7 for anxiety screening",
        cutoffScore: 10,
        subscales: []
      },
      [AssessmentInstrument.PCL5]: {
        maxScore: 80,
        description: "PTSD Checklist for DSM-5",
        cutoffScore: 33,
        subscales: ["Intrusion", "Avoidance", "Cognition/Mood", "Arousal"]
      },
      [AssessmentInstrument.BDI2]: {
        maxScore: 63,
        description: "Beck Depression Inventory-II",
        cutoffScore: 14,
        subscales: ["Cognitive-Affective", "Somatic"]
      },
      [AssessmentInstrument.BAI]: {
        maxScore: 63,
        description: "Beck Anxiety Inventory",
        cutoffScore: 16,
        subscales: []
      },
      [AssessmentInstrument.DASS21]: {
        maxScore: 126,
        description: "Depression, Anxiety and Stress Scale-21",
        subscales: ["Depression", "Anxiety", "Stress"]
      },
      [AssessmentInstrument.MDQ]: {
        maxScore: 13,
        description: "Mood Disorder Questionnaire for bipolar screening",
        cutoffScore: 7,
        subscales: []
      },
      [AssessmentInstrument.MADRS]: {
        maxScore: 60,
        description: "Montgomery-Asberg Depression Rating Scale",
        cutoffScore: 20,
        subscales: []
      },
      [AssessmentInstrument.HAM_D]: {
        maxScore: 52,
        description: "Hamilton Depression Rating Scale (17-item)",
        cutoffScore: 8,
        subscales: []
      },
      [AssessmentInstrument.HAM_A]: {
        maxScore: 56,
        description: "Hamilton Anxiety Rating Scale",
        cutoffScore: 17,
        subscales: ["Psychic", "Somatic"]
      },
      [AssessmentInstrument.MINI]: {
        maxScore: 0,
        description: "MINI International Neuropsychiatric Interview",
        subscales: []
      },
      [AssessmentInstrument.SCID]: {
        maxScore: 0,
        description: "Structured Clinical Interview for DSM Disorders",
        subscales: []
      },
      [AssessmentInstrument.CUSTOM]: {
        maxScore: 0,
        description: "Custom assessment instrument",
        subscales: []
      }
    };

    return instrumentInfo[instrument] || {
      maxScore: 0,
      description: "Unknown instrument",
      subscales: []
    };
  }
}

// Export singleton instance
export const assessmentExtractor = new AssessmentExtractor();
