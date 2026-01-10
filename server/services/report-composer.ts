/**
 * Report Composer Service
 * AI-powered clinical report generation ported from TherapyGenius
 */

import { storage } from '../storage';
import { aiRouter } from './ai-router';
import { insightsAggregator } from './insights-aggregator';
import { recommendationEngine } from './recommendation-engine';
import { z } from 'zod';

// Report types
export enum ReportType {
  PROGRESS_REPORT = "progress_report",
  TREATMENT_SUMMARY = "treatment_summary",
  ASSESSMENT_REPORT = "assessment_report",
  DISCHARGE_SUMMARY = "discharge_summary",
  INTAKE_REPORT = "intake_report",
  CRISIS_REPORT = "crisis_report",
  COMPREHENSIVE_EVALUATION = "comprehensive_evaluation"
}

// Report generation validation schema
const clinicalReportSchema = z.object({
  reportHeader: z.object({
    reportType: z.nativeEnum(ReportType),
    clientName: z.string(),
    clientId: z.string(),
    dateOfBirth: z.string().optional(),
    therapistName: z.string(),
    reportDate: z.string(),
    reportPeriod: z.object({
      startDate: z.string(),
      endDate: z.string()
    }).optional(),
    confidentialityNotice: z.string()
  }),
  executiveSummary: z.object({
    presentingProblems: z.array(z.string()),
    keyFindings: z.array(z.string()),
    treatmentResponse: z.string(),
    currentStatus: z.string(),
    recommendations: z.array(z.string())
  }),
  clientInformation: z.object({
    demographics: z.object({
      age: z.number().optional(),
      genderIdentity: z.string().optional(),
      relationshipStatus: z.string().optional(),
      employment: z.string().optional()
    }),
    emergencyContact: z.any().optional()
  }),
  clinicalPresentation: z.object({
    currentSymptoms: z.array(z.string()),
    mentalStatusExam: z.string().optional(),
    riskAssessment: z.object({
      suicideRisk: z.enum(["none", "low", "moderate", "high", "imminent"]),
      violenceRisk: z.enum(["none", "low", "moderate", "high", "imminent"]),
      riskFactors: z.array(z.string()),
      protectiveFactors: z.array(z.string())
    }),
    diagnosticImpression: z.array(z.string()),
    differentialDiagnosis: z.array(z.string()).optional()
  }),
  assessmentResults: z.object({
    standardizedAssessments: z.array(z.object({
      instrument: z.string(),
      date: z.string(),
      score: z.number(),
      interpretation: z.string(),
      severity: z.string().optional(),
      trend: z.enum(["improving", "stable", "worsening", "new"]).optional()
    })),
    clinicalObservations: z.array(z.string()),
    functionalAssessment: z.string()
  }),
  treatmentHistory: z.object({
    currentTreatment: z.object({
      startDate: z.string(),
      totalSessions: z.number(),
      sessionFrequency: z.string(),
      therapeuticApproach: z.array(z.string()),
      medications: z.array(z.string()).optional()
    }),
    treatmentGoals: z.array(z.object({
      goal: z.string(),
      status: z.enum(["achieved", "in_progress", "not_started", "modified", "discontinued"]),
      progress: z.string()
    })),
    interventionsUsed: z.array(z.object({
      intervention: z.string(),
      frequency: z.string(),
      effectiveness: z.enum(["very_effective", "effective", "somewhat_effective", "not_effective", "unknown"])
    })),
    treatmentCompliance: z.string(),
    barriers: z.array(z.string()),
    facilitators: z.array(z.string())
  }),
  progressNotes: z.array(z.object({
    date: z.string(),
    sessionType: z.string(),
    duration: z.string(),
    summary: z.string(),
    interventions: z.array(z.string()),
    homework: z.string().optional(),
    planForNextSession: z.string().optional()
  })),
  treatmentRecommendations: z.object({
    immediateRecommendations: z.array(z.string()),
    shortTermGoals: z.array(z.string()),
    longTermGoals: z.array(z.string()),
    referrals: z.array(z.string()),
    sessionPlanChanges: z.string().optional(),
    monitoringPlan: z.array(z.string())
  }),
  prognosis: z.object({
    shortTermPrognosis: z.string(),
    longTermPrognosis: z.string(),
    factorsAffectingPrognosis: z.array(z.string()),
    overallPrognosis: z.enum(["excellent", "good", "fair", "guarded", "poor"])
  }),
  additionalNotes: z.object({
    specialConsiderations: z.array(z.string()),
    culturalFactors: z.array(z.string()),
    ethicalConsiderations: z.array(z.string()),
    qualityAssurance: z.string()
  }),
  metadata: z.object({
    generatedDate: z.string(),
    reportVersion: z.string(),
    dataSourceCount: z.object({
      assessments: z.number(),
      sessions: z.number(),
      documents: z.number()
    }),
    aiGenerated: z.boolean(),
    clinicalReviewRequired: z.boolean(),
    confidentialityLevel: z.enum(["standard", "restricted", "highly_restricted"])
  })
});

export type ClinicalReport = z.infer<typeof clinicalReportSchema>;

export interface ReportGenerationResult {
  success: boolean;
  report: ClinicalReport | null;
  errors?: string[];
  metadata: {
    clientId: string;
    reportType: ReportType;
    generationTime: number;
    wordCount: number;
    dataSourcesUsed: number;
  };
}

export interface ReportOptions {
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  includeAIAnalysis?: boolean;
  includeRecommendations?: boolean;
  includeProgressCharts?: boolean;
  confidentialityLevel?: "standard" | "restricted" | "highly_restricted";
  therapistName?: string;
}

class ReportComposerService {

  /**
   * Generate a comprehensive clinical report
   */
  async generateReport(
    clientId: string,
    therapistId: string,
    reportType: ReportType,
    options: ReportOptions = {}
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();

    try {
      console.log(`[Report Composer] Generating ${reportType} for client ${clientId}`);

      // Gather all client data
      const [client, sessions, treatmentPlan, progressNotes] = await Promise.all([
        storage.getClient(clientId),
        storage.getSessions(clientId),
        storage.getTreatmentPlan(clientId),
        storage.getProgressNotes(clientId)
      ]);

      if (!client) {
        throw new Error("Client not found");
      }

      // Filter by date range if specified
      const filteredSessions = this.filterByDateRange(sessions, options.dateRange);
      const filteredNotes = this.filterByDateRange(progressNotes, options.dateRange);

      // Get AI analysis if requested
      let insights = null;
      let recommendations = null;

      if (options.includeAIAnalysis && process.env.HIPAA_SAFE_AI === 'true') {
        try {
          insights = await insightsAggregator.generateClientInsights(clientId, therapistId);
        } catch (error) {
          console.error('[Report Composer] Error getting insights:', error);
        }
      }

      if (options.includeRecommendations && process.env.HIPAA_SAFE_AI === 'true') {
        try {
          const recResult = await recommendationEngine.generateTreatmentRecommendations(
            client,
            progressNotes,
            treatmentPlan
          );
          recommendations = recResult;
        } catch (error) {
          console.error('[Report Composer] Error getting recommendations:', error);
        }
      }

      // Generate narrative sections
      const narrativeSections = options.includeAIAnalysis && process.env.HIPAA_SAFE_AI === 'true'
        ? await this.generateNarrativeSections(client, filteredSessions, filteredNotes, reportType)
        : this.getDefaultNarrativeSections();

      // Compose the full report
      const report = this.composeReport(
        client,
        filteredSessions,
        filteredNotes,
        treatmentPlan,
        insights,
        recommendations,
        narrativeSections,
        reportType,
        options
      );

      const generationTime = Date.now() - startTime;

      return {
        success: true,
        report,
        metadata: {
          clientId,
          reportType,
          generationTime,
          wordCount: this.calculateWordCount(report),
          dataSourcesUsed: filteredSessions.length + filteredNotes.length
        }
      };

    } catch (error) {
      console.error(`[Report Composer] Error:`, error);
      return {
        success: false,
        report: null,
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          clientId,
          reportType,
          generationTime: Date.now() - startTime,
          wordCount: 0,
          dataSourcesUsed: 0
        }
      };
    }
  }

  /**
   * Generate AI-powered narrative sections
   */
  private async generateNarrativeSections(
    client: any,
    sessions: any[],
    notes: any[],
    reportType: ReportType
  ): Promise<Record<string, string>> {

    try {
      const clinicalSummary = this.prepareClinicalSummary(client, sessions, notes);

      const narrativePrompt = `You are an expert clinical psychologist writing a ${reportType.replace(/_/g, ' ')} report.

Based on the following clinical data, generate professional narrative sections:

${clinicalSummary}

Generate these sections:
1. Clinical Presentation Summary (2-3 paragraphs)
2. Treatment Response Narrative (2-3 paragraphs)
3. Functional Assessment (1-2 paragraphs)
4. Mental Status Examination findings
5. Treatment Compliance Discussion (1-2 paragraphs)
6. Prognostic Factors Analysis (1-2 paragraphs)

Use professional clinical terminology. Base content on provided data only.`;

      const response = await aiRouter.chat([
        { role: 'system', content: 'You are a clinical psychologist generating professional report narratives.' },
        { role: 'user', content: narrativePrompt }
      ]);

      // Parse the response into sections
      return this.parseNarrativeResponse(response.content || '');

    } catch (error) {
      console.error('[Report Composer] Narrative generation error:', error);
      return this.getDefaultNarrativeSections();
    }
  }

  private parseNarrativeResponse(content: string): Record<string, string> {
    // Parse AI response into structured sections
    const sections: Record<string, string> = {
      clinicalPresentation: '',
      treatmentResponse: '',
      functionalAssessment: '',
      mentalStatusExam: '',
      treatmentCompliance: '',
      prognosticFactors: ''
    };

    // Simple extraction - look for section headers
    const sectionPatterns = [
      { key: 'clinicalPresentation', pattern: /clinical presentation[^:]*:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|treatment response|$)/i },
      { key: 'treatmentResponse', pattern: /treatment response[^:]*:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|functional assessment|$)/i },
      { key: 'functionalAssessment', pattern: /functional assessment[^:]*:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|mental status|$)/i },
      { key: 'mentalStatusExam', pattern: /mental status[^:]*:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|treatment compliance|$)/i },
      { key: 'treatmentCompliance', pattern: /treatment compliance[^:]*:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|prognostic|$)/i },
      { key: 'prognosticFactors', pattern: /prognostic[^:]*:?\s*\n?([\s\S]*?)$/i }
    ];

    for (const { key, pattern } of sectionPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        sections[key] = match[1].trim();
      }
    }

    return sections;
  }

  private getDefaultNarrativeSections(): Record<string, string> {
    return {
      clinicalPresentation: 'Clinical presentation data available in structured format.',
      treatmentResponse: 'Treatment response data available in structured format.',
      functionalAssessment: 'Functional assessment data available in structured format.',
      mentalStatusExam: 'Mental status examination findings available in structured format.',
      treatmentCompliance: 'Treatment compliance data available in structured format.',
      prognosticFactors: 'Prognostic factors data available in structured format.'
    };
  }

  private prepareClinicalSummary(client: any, sessions: any[], notes: any[]): string {
    const clientInfo = `Client: ${client.name?.split(' ')[0] || client.name} ${client.name?.split(' ').slice(1).join(' ') || ''}`;
    const sessionCount = `Total Sessions: ${sessions.length}`;
    const notesSummary = notes.slice(0, 5).map(n =>
      `- ${n.sessionDate ? new Date(n.sessionDate).toLocaleDateString() : 'Unknown date'}: ${n.content?.slice(0, 200) || 'No content'}...`
    ).join('\n');

    return `${clientInfo}\n${sessionCount}\n\nRecent Progress Notes:\n${notesSummary}`;
  }

  /**
   * Compose the full clinical report
   */
  private composeReport(
    client: any,
    sessions: any[],
    notes: any[],
    treatmentPlan: any,
    insights: any,
    recommendations: any,
    narrativeSections: Record<string, string>,
    reportType: ReportType,
    options: ReportOptions
  ): ClinicalReport {

    const now = new Date();

    return {
      reportHeader: {
        reportType,
        clientName: `${client.name?.split(' ')[0] || client.name} ${client.name?.split(' ').slice(1).join(' ') || ''}`,
        clientId: client.id,
        dateOfBirth: client.dateOfBirth?.toISOString(),
        therapistName: options.therapistName || "Clinical Staff",
        reportDate: now.toISOString(),
        reportPeriod: options.dateRange ? {
          startDate: options.dateRange.startDate.toISOString(),
          endDate: options.dateRange.endDate.toISOString()
        } : undefined,
        confidentialityNotice: "This report contains confidential information protected by HIPAA. Distribution is restricted to authorized personnel only."
      },

      executiveSummary: {
        presentingProblems: this.extractPresentingProblems(notes),
        keyFindings: this.extractKeyFindings(sessions, notes),
        treatmentResponse: narrativeSections.treatmentResponse,
        currentStatus: this.determineCurrentStatus(sessions, insights),
        recommendations: recommendations?.immediateRecommendations?.slice(0, 5) || []
      },

      clientInformation: {
        demographics: {
          age: client.dateOfBirth ?
            Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) :
            undefined,
          genderIdentity: client.genderIdentity,
          relationshipStatus: client.relationshipStatus,
          employment: client.employment
        },
        emergencyContact: client.emergencyContact
      },

      clinicalPresentation: {
        currentSymptoms: this.extractSymptoms(notes),
        mentalStatusExam: narrativeSections.mentalStatusExam || undefined,
        riskAssessment: {
          suicideRisk: insights?.riskLevel || "low",
          violenceRisk: "low",
          riskFactors: insights?.riskFactors || [],
          protectiveFactors: insights?.protectiveFactors || []
        },
        diagnosticImpression: this.extractDiagnoses(treatmentPlan),
        differentialDiagnosis: []
      },

      assessmentResults: {
        standardizedAssessments: [],
        clinicalObservations: this.extractClinicalObservations(notes),
        functionalAssessment: narrativeSections.functionalAssessment
      },

      treatmentHistory: {
        currentTreatment: {
          startDate: sessions[sessions.length - 1]?.scheduledAt?.toISOString() || now.toISOString(),
          totalSessions: sessions.length,
          sessionFrequency: this.calculateSessionFrequency(sessions),
          therapeuticApproach: treatmentPlan?.approaches || ["Individual Therapy"],
          medications: []
        },
        treatmentGoals: this.extractTreatmentGoals(treatmentPlan),
        interventionsUsed: this.extractInterventions(notes),
        treatmentCompliance: narrativeSections.treatmentCompliance,
        barriers: [],
        facilitators: []
      },

      progressNotes: notes.slice(0, 10).map(note => ({
        date: note.sessionDate?.toISOString() || now.toISOString(),
        sessionType: note.sessionType || "Individual",
        duration: "50 minutes",
        summary: note.content?.slice(0, 500) || '',
        interventions: [],
        homework: undefined,
        planForNextSession: note.nextSessionPlan
      })),

      treatmentRecommendations: {
        immediateRecommendations: recommendations?.immediateRecommendations || [],
        shortTermGoals: recommendations?.shortTermGoals || [],
        longTermGoals: recommendations?.longTermGoals || [],
        referrals: recommendations?.referrals || [],
        sessionPlanChanges: undefined,
        monitoringPlan: []
      },

      prognosis: {
        shortTermPrognosis: narrativeSections.prognosticFactors || "Guarded - continued treatment recommended",
        longTermPrognosis: "Dependent on treatment adherence and symptom management",
        factorsAffectingPrognosis: insights?.prognosticFactors || [],
        overallPrognosis: this.determineOverallPrognosis(sessions, insights)
      },

      additionalNotes: {
        specialConsiderations: [],
        culturalFactors: [],
        ethicalConsiderations: [],
        qualityAssurance: "This report was generated with AI assistance and requires clinical review."
      },

      metadata: {
        generatedDate: now.toISOString(),
        reportVersion: "1.0",
        dataSourceCount: {
          assessments: 0,
          sessions: sessions.length,
          documents: notes.length
        },
        aiGenerated: options.includeAIAnalysis || false,
        clinicalReviewRequired: true,
        confidentialityLevel: options.confidentialityLevel || "standard"
      }
    };
  }

  // Helper methods
  private filterByDateRange(items: any[], dateRange?: { startDate: Date; endDate: Date }): any[] {
    if (!dateRange) return items;

    return items.filter(item => {
      const date = new Date(item.scheduledAt || item.sessionDate || item.createdAt);
      return date >= dateRange.startDate && date <= dateRange.endDate;
    });
  }

  private extractPresentingProblems(notes: any[]): string[] {
    const problems: string[] = [];

    for (const note of notes.slice(0, 5)) {
      const content = note.content?.toLowerCase() || '';
      if (content.includes('anxiety')) problems.push('Anxiety symptoms');
      if (content.includes('depression')) problems.push('Depressive symptoms');
      if (content.includes('sleep')) problems.push('Sleep disturbance');
      if (content.includes('relationship')) problems.push('Relationship concerns');
    }

    return [...new Set(problems)].slice(0, 5);
  }

  private extractKeyFindings(sessions: any[], notes: any[]): string[] {
    return [
      `Client attended ${sessions.filter(s => s.status === 'completed').length} of ${sessions.length} scheduled sessions`,
      `${notes.length} progress notes documented`,
      'Ongoing engagement in treatment process'
    ];
  }

  private determineCurrentStatus(sessions: any[], insights: any): string {
    const recentSessions = sessions.filter(s => {
      const date = new Date(s.scheduledAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    });

    if (recentSessions.length === 0) {
      return "Not actively engaged in treatment - follow-up recommended";
    } else if (recentSessions.length >= 4) {
      return "Actively engaged in weekly treatment";
    } else {
      return "Engaged in ongoing treatment with regular sessions";
    }
  }

  private extractSymptoms(notes: any[]): string[] {
    const symptoms: string[] = [];
    const symptomKeywords = [
      'anxious', 'depressed', 'worried', 'sad', 'irritable',
      'insomnia', 'fatigue', 'concentration', 'appetite', 'mood'
    ];

    for (const note of notes.slice(0, 5)) {
      const content = note.content?.toLowerCase() || '';
      for (const keyword of symptomKeywords) {
        if (content.includes(keyword) && !symptoms.includes(keyword)) {
          symptoms.push(keyword);
        }
      }
    }

    return symptoms.slice(0, 10);
  }

  private extractDiagnoses(treatmentPlan: any): string[] {
    if (!treatmentPlan) return [];
    return treatmentPlan.diagnoses || [];
  }

  private extractClinicalObservations(notes: any[]): string[] {
    return notes.slice(0, 5).map(note =>
      `${new Date(note.sessionDate || note.createdAt).toLocaleDateString()}: ${note.content?.slice(0, 100) || 'Session documented'}`
    );
  }

  private calculateSessionFrequency(sessions: any[]): string {
    if (sessions.length < 2) return "Initial session";

    const dates = sessions.map(s => new Date(s.scheduledAt).getTime()).sort((a, b) => a - b);
    const intervals: number[] = [];

    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avgInterval <= 8) return "Weekly";
    if (avgInterval <= 15) return "Bi-weekly";
    if (avgInterval <= 35) return "Monthly";
    return "Less than monthly";
  }

  private extractTreatmentGoals(treatmentPlan: any): ClinicalReport['treatmentHistory']['treatmentGoals'] {
    if (!treatmentPlan?.goals) {
      return [
        { goal: "Reduce symptom severity", status: "in_progress", progress: "Ongoing" },
        { goal: "Improve coping skills", status: "in_progress", progress: "Ongoing" }
      ];
    }

    return treatmentPlan.goals.map((goal: any) => ({
      goal: goal.description || goal,
      status: goal.status || "in_progress",
      progress: goal.progress || "Ongoing"
    }));
  }

  private extractInterventions(notes: any[]): ClinicalReport['treatmentHistory']['interventionsUsed'] {
    const interventionKeywords = [
      { keyword: 'cbt', name: 'Cognitive Behavioral Therapy' },
      { keyword: 'cognitive', name: 'Cognitive Restructuring' },
      { keyword: 'mindfulness', name: 'Mindfulness Techniques' },
      { keyword: 'relaxation', name: 'Relaxation Training' },
      { keyword: 'exposure', name: 'Exposure Therapy' },
      { keyword: 'behavioral activation', name: 'Behavioral Activation' }
    ];

    const found: ClinicalReport['treatmentHistory']['interventionsUsed'] = [];

    for (const note of notes) {
      const content = note.content?.toLowerCase() || '';
      for (const { keyword, name } of interventionKeywords) {
        if (content.includes(keyword) && !found.find(f => f.intervention === name)) {
          found.push({
            intervention: name,
            frequency: "As clinically indicated",
            effectiveness: "effective"
          });
        }
      }
    }

    return found;
  }

  private determineOverallPrognosis(sessions: any[], insights: any): ClinicalReport['prognosis']['overallPrognosis'] {
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const totalSessions = sessions.length;
    const attendanceRate = totalSessions > 0 ? completedSessions / totalSessions : 0;

    if (attendanceRate >= 0.9) return "good";
    if (attendanceRate >= 0.7) return "fair";
    if (attendanceRate >= 0.5) return "guarded";
    return "guarded";
  }

  private calculateWordCount(report: ClinicalReport): number {
    const jsonString = JSON.stringify(report);
    return jsonString.split(/\s+/).length;
  }

  /**
   * Generate a quick progress summary (lighter weight than full report)
   */
  async generateProgressSummary(clientId: string, therapistId: string): Promise<{
    success: boolean;
    summary: string;
    keyPoints: string[];
    recommendations: string[];
  }> {
    try {
      const [client, sessions, notes] = await Promise.all([
        storage.getClient(clientId),
        storage.getSessions(clientId),
        storage.getProgressNotes(clientId)
      ]);

      if (!client) {
        throw new Error("Client not found");
      }

      const recentNotes = notes.slice(0, 5);
      const completedSessions = sessions.filter(s => s.status === 'completed').length;

      const keyPoints = [
        `${completedSessions} sessions completed`,
        `${recentNotes.length} recent progress notes`,
        recentNotes.length > 0 ? `Last session: ${new Date(recentNotes[0].sessionDate || recentNotes[0].createdAt).toLocaleDateString()}` : 'No recent sessions'
      ];

      const recommendations = [
        "Continue current treatment approach",
        "Monitor symptom progression",
        "Review treatment goals at next session"
      ];

      return {
        success: true,
        summary: `${client.name?.split(' ')[0] || client.name} ${client.name?.split(' ').slice(1).join(' ') || ''} has completed ${completedSessions} sessions. Treatment is ongoing with regular documentation.`,
        keyPoints,
        recommendations
      };

    } catch (error) {
      return {
        success: false,
        summary: '',
        keyPoints: [],
        recommendations: []
      };
    }
  }
}

export const reportComposer = new ReportComposerService();
