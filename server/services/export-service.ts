import { SessionSummaryGenerator, SessionSummaryRequest } from './session-summary-generator';
import { formatToEDT, formatSessionTimeRange } from '../../shared/utils/timezone.js';

export interface ExportRequest {
  sessionId: string;
  clientId: string;
  therapistId: string;
  exportFormat: 'pdf' | 'docx' | 'json' | 'csv';
  includeProgressNotes?: boolean;
  includePreviousSessions?: boolean;
  summaryType?: 'brief' | 'comprehensive' | 'clinical' | 'treatment-planning';
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  fileName: string;
  fileSize?: number;
  format: string;
  generatedAt: string;
  error?: string;
}

export class ExportService {
  private summaryGenerator = new SessionSummaryGenerator();

  /**
   * One-click export with AI-powered session summary
   */
  async exportSessionSummary(request: ExportRequest): Promise<ExportResult> {
    try {
      console.log(`📄 Exporting ${request.exportFormat} for session ${request.sessionId}`);
      
      // Generate AI-powered session summary
      const summaryRequest: SessionSummaryRequest = {
        sessionId: request.sessionId,
        clientId: request.clientId,
        therapistId: request.therapistId,
        includeProgressNotes: request.includeProgressNotes,
        includePreviousSessions: request.includePreviousSessions,
        summaryType: request.summaryType || 'comprehensive'
      };
      
      const summaryResult = await this.summaryGenerator.generateSessionSummary(summaryRequest);
      
      if (!summaryResult.success) {
        throw new Error(summaryResult.error || 'Failed to generate session summary');
      }
      
      // Get session data for export
      const exportData = await this.prepareExportData(request, summaryResult);
      
      // Generate export file based on format
      const exportResult = await this.generateExportFile(exportData, request.exportFormat);
      
      console.log(`✅ Export generated: ${exportResult.fileName}`);
      
      return exportResult;
      
    } catch (error: any) {
      console.error('❌ Export generation failed:', error);
      return {
        success: false,
        fileName: `export_error_${Date.now()}.txt`,
        format: request.exportFormat,
        generatedAt: new Date().toISOString(),
        error: error?.message || 'Unknown export error'
      };
    }
  }

  /**
   * Prepare comprehensive export data
   */
  private async prepareExportData(request: ExportRequest, summaryResult: any) {
    const { storage } = await import('../storage.js');
    
    // Get session details
    const session = await storage.getSession(request.sessionId);
    const client = await storage.getClient(request.clientId);
    const progressNotes = await storage.getProgressNotesBySession(request.sessionId);
    
    // Format session timing in EDT
    const sessionTiming = session ? formatSessionTimeRange(session.scheduledAt, session.duration) : null;
    
    return {
      exportMetadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: request.therapistId,
        exportFormat: request.exportFormat,
        sessionId: request.sessionId,
        clientId: request.clientId,
        confidenceScore: summaryResult.confidence
      },
      sessionInfo: {
        id: session?.id,
        date: session ? formatToEDT(session.scheduledAt, 'EEEE, MMMM dd, yyyy') : 'Unknown',
        time: sessionTiming?.timeRange || 'Unknown',
        duration: sessionTiming?.duration || 'Unknown',
        type: session?.sessionType || 'individual',
        status: session?.status || 'unknown'
      },
      clientInfo: {
        name: client?.name || 'Unknown Client',
        age: client?.dateOfBirth ? this.calculateAge(client.dateOfBirth.toISOString()) : 'Unknown',
        primaryConcerns: (client as any)?.primaryConcerns || 'Not documented',
        contactInfo: {
          email: client?.email || 'Not provided',
          phone: client?.phone || 'Not provided'
        }
      },
      aiSummary: summaryResult.summary,
      progressNotes: progressNotes.map((note: any) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        themes: note.clinicalThemes || [],
        riskLevel: note.riskLevel || 'low',
        createdAt: formatToEDT(note.createdAt, 'yyyy-MM-dd HH:mm:ss')
      })),
      exportSettings: {
        includeProgressNotes: request.includeProgressNotes,
        includePreviousSessions: request.includePreviousSessions,
        summaryType: request.summaryType
      }
    };
  }

  /**
   * Generate export file based on format
   */
  private async generateExportFile(exportData: any, format: string): Promise<ExportResult> {
    const timestamp = formatToEDT(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const clientName = exportData.clientInfo.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    switch (format.toLowerCase()) {
      case 'json':
        return this.generateJSONExport(exportData, clientName, timestamp);
      case 'csv':
        return this.generateCSVExport(exportData, clientName, timestamp);
      case 'pdf':
        return this.generatePDFExport(exportData, clientName, timestamp);
      case 'docx':
        return this.generateDocxExport(exportData, clientName, timestamp);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate JSON export
   */
  private async generateJSONExport(exportData: any, clientName: string, timestamp: string): Promise<ExportResult> {
    const fileName = `session_summary_${clientName}_${timestamp}.json`;
    const jsonContent = JSON.stringify(exportData, null, 2);
    
    // In a real implementation, you would save this to a file system or cloud storage
    // For now, we'll return a data URL
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonContent)}`;
    
    return {
      success: true,
      downloadUrl: dataUrl,
      fileName,
      fileSize: jsonContent.length,
      format: 'json',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate CSV export
   */
  private async generateCSVExport(exportData: any, clientName: string, timestamp: string): Promise<ExportResult> {
    const fileName = `session_summary_${clientName}_${timestamp}.csv`;
    
    const csvRows = [
      // Header
      ['Field', 'Value'],
      // Session Info
      ['Session Date', exportData.sessionInfo.date],
      ['Session Time', exportData.sessionInfo.time],
      ['Duration', exportData.sessionInfo.duration],
      ['Session Type', exportData.sessionInfo.type],
      ['Status', exportData.sessionInfo.status],
      // Client Info
      ['Client Name', exportData.clientInfo.name],
      ['Client Age', exportData.clientInfo.age],
      ['Primary Concerns', exportData.clientInfo.primaryConcerns],
      // AI Summary
      ['Session Overview', exportData.aiSummary.sessionOverview],
      ['Key Themes', exportData.aiSummary.keyThemes?.join('; ') || ''],
      ['Clinical Observations', exportData.aiSummary.clinicalObservations?.join('; ') || ''],
      ['Interventions Used', exportData.aiSummary.interventionsUsed?.join('; ') || ''],
      ['Progress Rating', exportData.aiSummary.clientProgress?.rating || ''],
      ['Risk Level', exportData.aiSummary.riskAssessment?.level || ''],
      ['Next Steps', exportData.aiSummary.nextSteps?.join('; ') || ''],
      ['Confidence Score', exportData.exportMetadata.confidenceScore]
    ];
    
    const csvContent = csvRows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    
    return {
      success: true,
      downloadUrl: dataUrl,
      fileName,
      fileSize: csvContent.length,
      format: 'csv',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate PDF export (simplified version)
   */
  private async generatePDFExport(exportData: any, clientName: string, timestamp: string): Promise<ExportResult> {
    const fileName = `session_summary_${clientName}_${timestamp}.pdf`;
    
    // Create HTML content for PDF generation
    const htmlContent = this.generateHTMLReport(exportData);
    
    // In a real implementation, you would use a PDF generation library like puppeteer or PDFKit
    // For now, we'll return an HTML data URL that can be printed to PDF
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    
    return {
      success: true,
      downloadUrl: dataUrl,
      fileName,
      fileSize: htmlContent.length,
      format: 'pdf',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate DOCX export (simplified version)
   */
  private async generateDocxExport(exportData: any, clientName: string, timestamp: string): Promise<ExportResult> {
    const fileName = `session_summary_${clientName}_${timestamp}.docx`;
    
    // Create RTF content that can be opened in Word
    const rtfContent = this.generateRTFReport(exportData);
    
    const dataUrl = `data:application/rtf;charset=utf-8,${encodeURIComponent(rtfContent)}`;
    
    return {
      success: true,
      downloadUrl: dataUrl,
      fileName,
      fileSize: rtfContent.length,
      format: 'docx',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate HTML report for PDF conversion
   */
  private generateHTMLReport(exportData: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Session Summary Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #344C3D; }
            .header { border-bottom: 2px solid #8EA58C; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 25px; }
            .section-title { color: #344C3D; font-size: 18px; font-weight: bold; margin-bottom: 10px; border-left: 4px solid #8EA58C; padding-left: 10px; }
            .field { margin-bottom: 8px; }
            .field-label { font-weight: bold; color: #738A6E; }
            .field-value { margin-left: 10px; }
            .list-item { margin-left: 20px; margin-bottom: 5px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #8EA58C; font-size: 12px; color: #738A6E; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Clinical Session Summary Report</h1>
            <p><strong>Generated:</strong> ${formatToEDT(exportData.exportMetadata.generatedAt, 'EEEE, MMMM dd, yyyy \'at\' h:mm a')}</p>
            <p><strong>Confidence Score:</strong> ${exportData.exportMetadata.confidenceScore}%</p>
        </div>

        <div class="section">
            <div class="section-title">Session Information</div>
            <div class="field"><span class="field-label">Date:</span><span class="field-value">${exportData.sessionInfo.date}</span></div>
            <div class="field"><span class="field-label">Time:</span><span class="field-value">${exportData.sessionInfo.time}</span></div>
            <div class="field"><span class="field-label">Duration:</span><span class="field-value">${exportData.sessionInfo.duration}</span></div>
            <div class="field"><span class="field-label">Type:</span><span class="field-value">${exportData.sessionInfo.type}</span></div>
            <div class="field"><span class="field-label">Status:</span><span class="field-value">${exportData.sessionInfo.status}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Client Information</div>
            <div class="field"><span class="field-label">Name:</span><span class="field-value">${exportData.clientInfo.name}</span></div>
            <div class="field"><span class="field-label">Age:</span><span class="field-value">${exportData.clientInfo.age}</span></div>
            <div class="field"><span class="field-label">Primary Concerns:</span><span class="field-value">${exportData.clientInfo.primaryConcerns}</span></div>
        </div>

        <div class="section">
            <div class="section-title">AI-Generated Session Summary</div>
            <div class="field">
                <span class="field-label">Session Overview:</span>
                <div class="field-value">${exportData.aiSummary.sessionOverview}</div>
            </div>
            
            <div class="field">
                <span class="field-label">Key Themes:</span>
                ${exportData.aiSummary.keyThemes?.map((theme: string) => `<div class="list-item">• ${theme}</div>`).join('') || '<div class="field-value">None identified</div>'}
            </div>
            
            <div class="field">
                <span class="field-label">Clinical Observations:</span>
                ${exportData.aiSummary.clinicalObservations?.map((obs: string) => `<div class="list-item">• ${obs}</div>`).join('') || '<div class="field-value">None documented</div>'}
            </div>
            
            <div class="field">
                <span class="field-label">Interventions Used:</span>
                ${exportData.aiSummary.interventionsUsed?.map((intervention: string) => `<div class="list-item">• ${intervention}</div>`).join('') || '<div class="field-value">None documented</div>'}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Progress Assessment</div>
            <div class="field"><span class="field-label">Progress Rating:</span><span class="field-value">${exportData.aiSummary.clientProgress?.rating}/10</span></div>
            <div class="field"><span class="field-label">Progress Description:</span><span class="field-value">${exportData.aiSummary.clientProgress?.description}</span></div>
        </div>

        <div class="section">
            <div class="section-title">Risk Assessment</div>
            <div class="field"><span class="field-label">Risk Level:</span><span class="field-value">${exportData.aiSummary.riskAssessment?.level}</span></div>
            <div class="field">
                <span class="field-label">Risk Factors:</span>
                ${exportData.aiSummary.riskAssessment?.factors?.map((factor: string) => `<div class="list-item">• ${factor}</div>`).join('') || '<div class="field-value">None identified</div>'}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Next Steps</div>
            ${exportData.aiSummary.nextSteps?.map((step: string) => `<div class="list-item">• ${step}</div>`).join('') || '<div class="field-value">None specified</div>'}
        </div>

        <div class="footer">
            <p>This report was generated by the CareNotes AI system on ${formatToEDT(exportData.exportMetadata.generatedAt, 'yyyy-MM-dd \'at\' HH:mm:ss')} EDT</p>
            <p>Session ID: ${exportData.exportMetadata.sessionId} | Client ID: ${exportData.exportMetadata.clientId}</p>
        </div>
    </body>
    </html>`;
  }

  /**
   * Generate RTF report for Word compatibility
   */
  private generateRTFReport(exportData: any): string {
    return `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
\\f0\\fs24 Clinical Session Summary Report\\par
\\par
Generated: ${formatToEDT(exportData.exportMetadata.generatedAt, 'EEEE, MMMM dd, yyyy')}\\par
Confidence Score: ${exportData.exportMetadata.confidenceScore}%\\par
\\par
\\b Session Information\\b0\\par
Date: ${exportData.sessionInfo.date}\\par
Time: ${exportData.sessionInfo.time}\\par
Duration: ${exportData.sessionInfo.duration}\\par
Type: ${exportData.sessionInfo.type}\\par
\\par
\\b Client Information\\b0\\par
Name: ${exportData.clientInfo.name}\\par
Age: ${exportData.clientInfo.age}\\par
Primary Concerns: ${exportData.clientInfo.primaryConcerns}\\par
\\par
\\b Session Overview\\b0\\par
${exportData.aiSummary.sessionOverview}\\par
\\par
\\b Key Themes\\b0\\par
${exportData.aiSummary.keyThemes?.map((theme: string) => `• ${theme}`).join('\\par') || 'None identified'}\\par
\\par
\\b Progress Rating\\b0\\par
${exportData.aiSummary.clientProgress?.rating}/10\\par
\\par
\\b Risk Level\\b0\\par
${exportData.aiSummary.riskAssessment?.level}\\par
}`;
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): number {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }
}

export const exportService = new ExportService();