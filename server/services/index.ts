/**
 * AI Services Index
 * Exports all AI-powered services ported from TherapyGenius
 */

// AI Router with circuit breaker pattern
export { aiRouter, AIProvider, AIError, HIPAAComplianceError } from "./ai-router";
export type { AIMessage, AIRouterConfig, AIMetrics } from "./ai-router";

// Assessment Extraction
export { assessmentExtractor, AssessmentInstrument } from "./assessment-extractor";
export type {
  AssessmentExtraction,
  ExtractedAssessment,
  AssessmentExtractionResult
} from "./assessment-extractor";

// Session Tagging
export { sessionTagger } from "./session-tagger";
export type { SessionTags, SessionTagResult } from "./session-tagger";

// Client Tagging
export { clientTagger } from "./client-tagger";
export type { ClientTags, ClientTagResult } from "./client-tagger";

// Insights Aggregation
export { insightsAggregator } from "./insights-aggregator";
export type {
  InsightType,
  InsightPriority,
  AggregatedInsight,
  PracticeInsights,
  ClientInsightSummary
} from "./insights-aggregator";

// Recommendation Engine
export { recommendationEngine } from "./recommendation-engine";
export type {
  RecommendationType,
  RecommendationConfidence,
  Recommendation,
  SessionRecommendations,
  TreatmentRecommendations
} from "./recommendation-engine";

// Smart Calendar Sync
export { smartCalendarSync, syncScheduler } from "./smart-calendar-sync";
export type { TriggerSource } from "./smart-calendar-sync";

// Report Composer
export { reportComposer, ReportType } from "./report-composer";
export type {
  ClinicalReport,
  ReportGenerationResult,
  ReportOptions
} from "./report-composer";
