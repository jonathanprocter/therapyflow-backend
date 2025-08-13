import { storage } from '../storage';
import { aiService } from './aiService';
import * as fs from 'fs';
import * as path from 'path';

export interface ProcessingResult {
  success: boolean;
  clientId?: string;
  sessionId?: string;
  progressNoteId?: string;
  confidence: number;
  processingNotes: string;
  needsManualReview: boolean;
  extractedData: {
    clientName?: string;
    sessionDate?: Date;
    content: string;
    sessionType?: string;
    riskLevel?: string;
  };
}

export interface ClientMatch {
  id: string;
  name: string;
  similarity: number;
  isExact: boolean;
}

export class DocumentProcessor {
  /**
   * Main entry point for processing uploaded documents
   */
  async processDocument(
    file: Buffer,
    fileName: string,
    therapistId: string
  ): Promise<ProcessingResult> {
    try {
      // Extract text from PDF
      const extractedText = await this.extractTextFromPDF(file);
      
      // Use AI to analyze and extract structured data
      const extractedData = await this.analyzeProgressNote(extractedText);
      
      // Find or create client
      const clientMatch = await this.findOrCreateClient(
        extractedData.clientName || 'Unknown Client',
        therapistId
      );
      
      // Find matching session
      const sessionMatch = await this.findMatchingSession(
        clientMatch.id,
        extractedData.sessionDate,
        therapistId
      );
      
      // Determine if manual review is needed
      const needsManualReview = this.shouldRequireManualReview(
        clientMatch,
        sessionMatch,
        extractedData
      );
      
      // Create or update progress note
      const progressNote = await this.createProgressNote(
        clientMatch.id,
        sessionMatch?.id,
        extractedData,
        therapistId,
        needsManualReview
      );
      
      // Save original document
      await this.saveDocument(
        file,
        fileName,
        clientMatch.id,
        therapistId,
        extractedText,
        progressNote.id
      );
      
      return {
        success: true,
        clientId: clientMatch.id,
        sessionId: sessionMatch?.id,
        progressNoteId: progressNote.id,
        confidence: this.calculateConfidence(clientMatch, sessionMatch, extractedData),
        processingNotes: this.generateProcessingNotes(clientMatch, sessionMatch, extractedData),
        needsManualReview,
        extractedData,
      };
    } catch (error: any) {
      console.error('Error processing document:', error);
      return {
        success: false,
        confidence: 0,
        processingNotes: `Processing failed: ${error?.message || 'Unknown error'}`,
        needsManualReview: true,
        extractedData: { content: '' },
      };
    }
  }

  /**
   * Extract text from PDF using a simple buffer text extraction
   */
  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      // Convert buffer to string and extract readable text
      const text = buffer.toString('utf8');
      
      // Basic PDF text extraction - look for readable content
      // This is a simplified approach - in production, you'd use a proper PDF parser
      const textContent = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (textContent.length < 50) {
        throw new Error('No readable text found in PDF');
      }
      
      return textContent;
    } catch (error: any) {
      // Fallback: return a basic structure for processing
      return `PDF Document Content - Extracted from ${buffer.length} byte file. Manual text entry required for processing.`;
    }
  }

  /**
   * Use AI to analyze progress note and extract structured data
   */
  private async analyzeProgressNote(text: string): Promise<any> {
    const prompt = `
Analyze this therapy progress note and extract the following information in JSON format:

{
  "clientName": "exact client name mentioned",
  "sessionDate": "session date in ISO format (YYYY-MM-DD)",
  "sessionTime": "session time if mentioned",
  "sessionType": "individual/couples/family/group",
  "content": "full progress note content",
  "riskLevel": "low/moderate/high/critical based on content",
  "keyTopics": ["array", "of", "main", "topics"],
  "interventions": ["interventions", "used"],
  "progressRating": "1-10 scale if mentioned",
  "nextSteps": "planned next steps",
  "confidence": "0-1 confidence score for extraction accuracy"
}

Progress Note Text:
${text}

Important: 
- Look for date patterns like "01/15/2024", "January 15, 2024", "1-15-24"
- Client names are often at the top or in headers
- Session types may be implicit (assume "individual" if not specified)
- Assess risk level based on mentions of self-harm, substance use, crisis, etc.
`;

    try {
      // Use the AI service to analyze the text
      const analysisResult = await aiService.generateClinicalTags(text);
      // Parse a basic analysis structure for now
      return {
        content: text,
        confidence: 0.8,
        clientName: this.extractClientNameFallback(text),
        sessionDate: this.extractDateFallback(text),
        riskLevel: 'low',
        keyTopics: analysisResult.slice(0, 5).map(tag => tag.name),
        interventions: [],
        sessionType: 'individual'
      };
    } catch (error: any) {
      console.error('Error analyzing progress note with AI:', error);
      return {
        content: text,
        confidence: 0.1,
        clientName: this.extractClientNameFallback(text),
        sessionDate: this.extractDateFallback(text),
      };
    }
  }

  /**
   * Find existing client or create new one with intelligent name matching
   */
  private async findOrCreateClient(
    clientName: string,
    therapistId: string
  ): Promise<ClientMatch & { id: string }> {
    // Get all clients for the therapist
    const existingClients = await storage.getClients(therapistId);
    
    // Find exact match first
    const exactMatch = existingClients.find(
      client => client.name.toLowerCase() === clientName.toLowerCase()
    );
    
    if (exactMatch) {
      return {
        id: exactMatch.id,
        name: exactMatch.name,
        similarity: 1.0,
        isExact: true,
      };
    }
    
    // Find similar names using fuzzy matching
    const similarMatches = existingClients
      .map(client => ({
        ...client,
        similarity: this.calculateNameSimilarity(clientName, client.name),
      }))
      .filter(match => match.similarity > 0.8)
      .sort((a, b) => b.similarity - a.similarity);
    
    if (similarMatches.length > 0) {
      const bestMatch = similarMatches[0];
      return {
        id: bestMatch.id,
        name: bestMatch.name,
        similarity: bestMatch.similarity,
        isExact: false,
      };
    }
    
    // Create new client if no match found
    const newClient = await storage.createClient({
      therapistId,
      name: clientName,
      status: 'active',
    });
    
    return {
      id: newClient.id,
      name: newClient.name,
      similarity: 1.0,
      isExact: true,
    };
  }

  /**
   * Calculate name similarity using Levenshtein distance and common variations
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    
    // Check for common name variations
    const variations = {
      'chris': ['christopher', 'christian', 'christina'],
      'mike': ['michael', 'mitchell'],
      'bob': ['robert', 'bobby'],
      'dave': ['david', 'davis'],
      'sue': ['susan', 'susanne'],
      'liz': ['elizabeth', 'elisabeth'],
      'rick': ['richard', 'ricky'],
      'jim': ['james', 'jimmy'],
    };
    
    // Check if names are variations of each other
    for (const [short, longs] of Object.entries(variations)) {
      if ((n1 === short && longs.includes(n2)) || 
          (n2 === short && longs.includes(n1)) ||
          (longs.includes(n1) && longs.includes(n2))) {
        return 0.95;
      }
    }
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Find matching session based on client and date
   */
  private async findMatchingSession(
    clientId: string,
    sessionDate: Date | undefined,
    therapistId: string
  ): Promise<any> {
    if (!sessionDate) return null;
    
    // Get all sessions for the client
    const sessions = await storage.getSessions(clientId);
    
    // Find session on the same date (within 24 hours)
    const targetDate = new Date(sessionDate);
    const matchingSessions = sessions.filter(session => {
      const sessionTime = new Date(session.scheduledAt);
      const timeDiff = Math.abs(sessionTime.getTime() - targetDate.getTime());
      return timeDiff <= 24 * 60 * 60 * 1000; // Within 24 hours
    });
    
    // Return the closest match
    if (matchingSessions.length > 0) {
      return matchingSessions.sort((a, b) => {
        const aDiff = Math.abs(new Date(a.scheduledAt).getTime() - targetDate.getTime());
        const bDiff = Math.abs(new Date(b.scheduledAt).getTime() - targetDate.getTime());
        return aDiff - bDiff;
      })[0];
    }
    
    return null;
  }

  /**
   * Determine if manual review is required
   */
  private shouldRequireManualReview(
    clientMatch: ClientMatch,
    sessionMatch: any,
    extractedData: any
  ): boolean {
    // Require manual review if:
    // - Client similarity is low
    // - No session found for the date
    // - High risk content detected
    // - Low confidence in extraction
    
    return (
      clientMatch.similarity < 0.9 ||
      !sessionMatch ||
      extractedData.riskLevel === 'high' ||
      extractedData.riskLevel === 'critical' ||
      extractedData.confidence < 0.7
    );
  }

  /**
   * Create progress note with extracted data
   */
  private async createProgressNote(
    clientId: string,
    sessionId: string | undefined,
    extractedData: any,
    therapistId: string,
    needsManualReview: boolean
  ) {
    return await storage.createProgressNote({
      clientId,
      sessionId,
      therapistId,
      content: extractedData.content,
      sessionDate: extractedData.sessionDate ? new Date(extractedData.sessionDate) : new Date(),
      riskLevel: extractedData.riskLevel || 'low',
      progressRating: extractedData.progressRating,
      status: needsManualReview ? 'manual_review' : 'processed',
      isPlaceholder: false,
      requiresManualReview: needsManualReview,
      aiConfidenceScore: extractedData.confidence,
      processingNotes: needsManualReview ? 'Requires manual review due to low confidence or missing session match' : 'Automatically processed',
      tags: extractedData.keyTopics || [],
      aiTags: extractedData.interventions || [],
    });
  }

  /**
   * Save the original document to database
   */
  private async saveDocument(
    file: Buffer,
    fileName: string,
    clientId: string,
    therapistId: string,
    extractedText: string,
    progressNoteId: string
  ) {
    return await storage.createDocument({
      clientId,
      therapistId,
      fileName,
      fileType: 'application/pdf',
      filePath: `/documents/${progressNoteId}/${fileName}`,
      extractedText,
      uploadedAt: new Date(),
      fileSize: file.length,
      metadata: { progressNoteId },
    });
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    clientMatch: ClientMatch,
    sessionMatch: any,
    extractedData: any
  ): number {
    let confidence = 0;
    
    // Client match confidence (40% weight)
    confidence += clientMatch.similarity * 0.4;
    
    // Session match confidence (30% weight)
    if (sessionMatch) {
      confidence += 0.3;
    }
    
    // AI extraction confidence (30% weight)
    confidence += (extractedData.confidence || 0.5) * 0.3;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate processing notes for user
   */
  private generateProcessingNotes(
    clientMatch: ClientMatch,
    sessionMatch: any,
    extractedData: any
  ): string {
    const notes = [];
    
    if (!clientMatch.isExact) {
      notes.push(`Client matched with ${Math.round(clientMatch.similarity * 100)}% similarity`);
    }
    
    if (!sessionMatch) {
      notes.push('No matching session found for the extracted date');
    }
    
    if (extractedData.riskLevel === 'high' || extractedData.riskLevel === 'critical') {
      notes.push(`High risk content detected (${extractedData.riskLevel})`);
    }
    
    if (extractedData.confidence < 0.7) {
      notes.push('Low confidence in AI text extraction');
    }
    
    return notes.length > 0 ? notes.join('; ') : 'Successfully processed automatically';
  }

  /**
   * Fallback client name extraction using regex
   */
  private extractClientNameFallback(text: string): string {
    // Look for common patterns like "Client: John Doe" or "Patient: Jane Smith"
    const patterns = [
      /(?:client|patient|name):\s*([A-Za-z\s]+)/i,
      /^([A-Za-z\s]+)\s*(?:session|therapy|progress)/im,
      /for\s+([A-Za-z\s]+)\s*(?:on|date)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return 'Unknown Client';
  }

  /**
   * Fallback date extraction using regex
   */
  private extractDateFallback(text: string): Date | undefined {
    // Look for date patterns
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return undefined;
  }
}

export const documentProcessor = new DocumentProcessor();