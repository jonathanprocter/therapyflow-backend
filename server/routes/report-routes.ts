/**
 * Report Generation Routes
 * API endpoints for clinical report generation
 */

import { Router, Request, Response } from "express";
import { reportComposer, ReportType } from "../services/report-composer";

const router = Router();

// Middleware to get therapist ID from session
const getTherapistId = (req: Request): string => {
  return (req as any).user?.id || req.headers["x-therapist-id"] as string || "";
};

/**
 * GET /api/reports/types
 * Get available report types
 */
router.get("/types", (req: Request, res: Response) => {
  const types = Object.values(ReportType).map(type => ({
    id: type,
    name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: getReportDescription(type)
  }));

  res.json({ types });
});

function getReportDescription(type: ReportType): string {
  const descriptions: Record<ReportType, string> = {
    [ReportType.PROGRESS_REPORT]: "Summary of client progress over a specified period",
    [ReportType.TREATMENT_SUMMARY]: "Comprehensive overview of treatment provided",
    [ReportType.ASSESSMENT_REPORT]: "Clinical assessment findings and interpretations",
    [ReportType.DISCHARGE_SUMMARY]: "End-of-treatment summary and recommendations",
    [ReportType.INTAKE_REPORT]: "Initial intake and evaluation documentation",
    [ReportType.CRISIS_REPORT]: "Crisis intervention documentation",
    [ReportType.COMPREHENSIVE_EVALUATION]: "Full psychological evaluation report"
  };
  return descriptions[type];
}

/**
 * POST /api/reports/generate
 * Generate a clinical report
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const {
      clientId,
      reportType,
      dateRange,
      includeAIAnalysis = true,
      includeRecommendations = true,
      confidentialityLevel = "standard",
      therapistName
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    if (!reportType || !Object.values(ReportType).includes(reportType)) {
      return res.status(400).json({
        error: "Invalid reportType",
        validTypes: Object.values(ReportType)
      });
    }

    const options: any = {
      includeAIAnalysis,
      includeRecommendations,
      confidentialityLevel,
      therapistName
    };

    if (dateRange?.startDate && dateRange?.endDate) {
      options.dateRange = {
        startDate: new Date(dateRange.startDate),
        endDate: new Date(dateRange.endDate)
      };
    }

    const result = await reportComposer.generateReport(
      clientId,
      therapistId,
      reportType,
      options
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({
        error: "Report generation failed",
        details: result.errors
      });
    }
  } catch (error) {
    console.error("[Report Routes] Generate error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

/**
 * POST /api/reports/progress-summary
 * Generate a quick progress summary
 */
router.post("/progress-summary", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    const result = await reportComposer.generateProgressSummary(clientId, therapistId);

    res.json(result);
  } catch (error) {
    console.error("[Report Routes] Progress summary error:", error);
    res.status(500).json({ error: "Failed to generate progress summary" });
  }
});

/**
 * POST /api/reports/export
 * Export a report in various formats
 */
router.post("/export", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const { report, format = "json" } = req.body;

    if (!report) {
      return res.status(400).json({ error: "report object is required" });
    }

    switch (format) {
      case "json":
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="report-${Date.now()}.json"`);
        res.json(report);
        break;

      case "text":
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="report-${Date.now()}.txt"`);
        res.send(formatReportAsText(report));
        break;

      case "markdown":
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="report-${Date.now()}.md"`);
        res.send(formatReportAsMarkdown(report));
        break;

      default:
        res.status(400).json({ error: "Invalid format. Use: json, text, or markdown" });
    }
  } catch (error) {
    console.error("[Report Routes] Export error:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});

function formatReportAsText(report: any): string {
  const lines: string[] = [];

  lines.push("=" .repeat(60));
  lines.push(`CLINICAL REPORT: ${report.reportHeader?.reportType?.toUpperCase() || 'UNKNOWN'}`);
  lines.push("=" .repeat(60));
  lines.push("");
  lines.push(`Client: ${report.reportHeader?.clientName || 'N/A'}`);
  lines.push(`Date: ${report.reportHeader?.reportDate || 'N/A'}`);
  lines.push(`Therapist: ${report.reportHeader?.therapistName || 'N/A'}`);
  lines.push("");
  lines.push("-".repeat(60));
  lines.push("EXECUTIVE SUMMARY");
  lines.push("-".repeat(60));
  lines.push("");

  if (report.executiveSummary?.presentingProblems?.length) {
    lines.push("Presenting Problems:");
    report.executiveSummary.presentingProblems.forEach((p: string) => lines.push(`  - ${p}`));
    lines.push("");
  }

  if (report.executiveSummary?.treatmentResponse) {
    lines.push("Treatment Response:");
    lines.push(report.executiveSummary.treatmentResponse);
    lines.push("");
  }

  lines.push("-".repeat(60));
  lines.push("CONFIDENTIALITY NOTICE");
  lines.push("-".repeat(60));
  lines.push(report.reportHeader?.confidentialityNotice || 'This document is confidential.');

  return lines.join("\n");
}

function formatReportAsMarkdown(report: any): string {
  const lines: string[] = [];

  lines.push(`# Clinical Report: ${report.reportHeader?.reportType?.replace(/_/g, ' ')?.toUpperCase() || 'UNKNOWN'}`);
  lines.push("");
  lines.push(`**Client:** ${report.reportHeader?.clientName || 'N/A'}`);
  lines.push(`**Date:** ${report.reportHeader?.reportDate || 'N/A'}`);
  lines.push(`**Therapist:** ${report.reportHeader?.therapistName || 'N/A'}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");

  if (report.executiveSummary?.presentingProblems?.length) {
    lines.push("### Presenting Problems");
    report.executiveSummary.presentingProblems.forEach((p: string) => lines.push(`- ${p}`));
    lines.push("");
  }

  if (report.executiveSummary?.keyFindings?.length) {
    lines.push("### Key Findings");
    report.executiveSummary.keyFindings.forEach((f: string) => lines.push(`- ${f}`));
    lines.push("");
  }

  if (report.executiveSummary?.treatmentResponse) {
    lines.push("### Treatment Response");
    lines.push(report.executiveSummary.treatmentResponse);
    lines.push("");
  }

  if (report.clinicalPresentation) {
    lines.push("## Clinical Presentation");
    lines.push("");

    if (report.clinicalPresentation.currentSymptoms?.length) {
      lines.push("### Current Symptoms");
      report.clinicalPresentation.currentSymptoms.forEach((s: string) => lines.push(`- ${s}`));
      lines.push("");
    }

    if (report.clinicalPresentation.mentalStatusExam) {
      lines.push("### Mental Status Examination");
      lines.push(report.clinicalPresentation.mentalStatusExam);
      lines.push("");
    }
  }

  if (report.treatmentHistory) {
    lines.push("## Treatment History");
    lines.push("");
    lines.push(`**Total Sessions:** ${report.treatmentHistory.currentTreatment?.totalSessions || 'N/A'}`);
    lines.push(`**Session Frequency:** ${report.treatmentHistory.currentTreatment?.sessionFrequency || 'N/A'}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Confidentiality Notice:*");
  lines.push(`*${report.reportHeader?.confidentialityNotice || 'This document is confidential.'}*`);

  return lines.join("\n");
}

export default router;
