/**
 * Intelligent Document Classifier and Processor
 *
 * This service intelligently differentiates between:
 * 1. Transcripts - Raw session recordings that need to be processed into comprehensive progress notes
 * 2. Progress Notes - Already-written clinical documentation that should be parsed and filed by date
 * 3. Bulk Documents - Multiple progress notes in one file that need to be split by date of service
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { storage } from '../storage';
import { format, parse, isValid } from 'date-fns';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy_key"
});

// Document classification types
export type DocumentType = 'transcript' | 'progress_note' | 'bulk_progress_notes' | 'unknown';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
  estimatedNoteCount?: number;
  detectedDates?: string[];
  detectedClients?: string[];
}

export interface ProcessedNote {
  clientName: string;
  sessionDate: Date;
  content: string;
  sessionType: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  progressRating: number;
  themes: string[];
  emotions: string[];
  interventions: string[];
  nextSteps: string[];
  tonalAnalysis?: string;
  keyPoints?: string[];
  significantQuotes?: string[];
  narrativeSummary?: string;
  confidence: number;
}

export interface BulkProcessingResult {
  success: boolean;
  documentType: DocumentType;
  notes: ProcessedNote[];
  totalProcessed: number;
  errors: string[];
  processingNotes: string;
}

/**
 * The comprehensive clinical progress note prompt for transcript processing
 */
const COMPREHENSIVE_PROGRESS_NOTE_PROMPT = `You are an expert clinical therapist with extensive training in psychotherapy, clinical documentation, and therapeutic modalities including ACT, DBT, Narrative Therapy, and Existentialism. Your task is to create a comprehensive clinical progress note from the provided therapy session transcript that demonstrates the depth, clinical sophistication, and analytical rigor of an experienced mental health professional.

TRANSCRIPT TO ANALYZE:
"""
{TRANSCRIPT_TEXT}
"""

Create a progress note with the following precise structure:

1. **Title**: "Comprehensive Clinical Progress Note for [Client's Full Name]'s Therapy Session on [Date]"

2. **Subjective Section**:
Document the client's reported experience in-depth:
- Chief concerns and how the client describes their current situation
- Direct quotes that capture the client's voice and experience
- Emotional states as reported by the client
- Context for how these concerns connect to previous sessions and broader treatment patterns

3. **Objective Section**:
Describe observable clinical data:
- Client presentation (dress, grooming, demeanor)
- Mental status observations (orientation, speech, thought process)
- Affect and mood with specific descriptors
- Nonverbal communication and body language
- Behavioral observations during session
- Contrasts between reported and observed emotional states

4. **Assessment Section**:
Provide comprehensive clinical formulation:
- Diagnostic considerations and how current presentation relates to diagnosis
- Clinical themes and patterns identified
- Progress toward treatment goals
- Risk assessment (suicidal ideation, self-harm, harm to others)
- Therapeutic relationship observations
- Integration with theoretical framework (ACT, DBT, etc.)
- Connection between current material and core beliefs/schemas

5. **Plan Section**:
Detail treatment planning:
- Specific therapeutic interventions used in this session
- Homework or between-session assignments
- Modifications to treatment plan
- Focus areas for next session
- Referrals or coordination of care needs

6. **Supplemental Analyses**:

**Tonal Analysis**: Identify 2-3 significant tonal/emotional shifts during the session. For each shift:
- Describe what the shift was (from what to what)
- What triggered the shift
- Clinical significance of the shift

**Thematic Analysis**: Identify 2-3 dominant themes with:
- How the theme manifested in the session
- Connection to treatment goals
- Clinical implications

**Sentiment Analysis**: Analyze client's sentiments toward:
- Self (dominant negative/positive patterns)
- Others/external situations
- Treatment/therapy process

7. **Key Points**: 3-4 most clinically significant insights with:
- The insight itself
- Evidence from the session
- Therapeutic implications
- Connection to treatment plan

8. **Significant Quotes**: 2-3 meaningful client statements with:
- The exact quote
- Context in which it was said
- Clinical significance and interpretation

9. **Comprehensive Narrative Summary**:
A cohesive 2-3 paragraph narrative that:
- Synthesizes the session's clinical content
- Places it in context of overall treatment
- Identifies the therapeutic work accomplished
- Notes areas for continued focus

Return your analysis in this exact JSON format:
{
  "clientName": "extracted full name",
  "sessionDate": "YYYY-MM-DD",
  "sessionType": "individual|couples|family|group",
  "title": "Comprehensive Clinical Progress Note for...",
  "subjective": "full subjective section text",
  "objective": "full objective section text",
  "assessment": "full assessment section text",
  "plan": "full plan section text",
  "tonalAnalysis": "full tonal analysis with shifts",
  "thematicAnalysis": "full thematic analysis",
  "sentimentAnalysis": "full sentiment analysis",
  "keyPoints": ["point 1 with full detail", "point 2", "point 3"],
  "significantQuotes": [
    {"quote": "exact quote", "context": "context", "significance": "clinical significance"}
  ],
  "narrativeSummary": "comprehensive narrative summary",
  "themes": ["clinical theme 1", "clinical theme 2"],
  "emotions": ["emotion 1", "emotion 2"],
  "interventions": ["intervention 1", "intervention 2"],
  "riskLevel": "low|moderate|high|critical",
  "progressRating": 1-10,
  "nextSteps": ["next step 1", "next step 2"],
  "confidence": 1-100
}

Demonstrate clinical sophistication, therapeutic wisdom, and professional documentation standards. This is critical clinical documentation that must meet the highest professional standards.`;

/**
 * Prompt for classifying document type
 */
const CLASSIFICATION_PROMPT = `You are an expert clinical documentation analyst. Analyze the following document and determine its type.

DOCUMENT TEXT:
"""
{DOCUMENT_TEXT}
"""

Classify this document into ONE of these categories:

1. **transcript** - Raw therapy session recording/transcription that needs to be converted into a clinical progress note. Characteristics:
   - Contains dialogue between therapist and client
   - May include speaker labels (Therapist:, Client:, T:, C:, etc.)
   - Raw conversational content
   - No formal clinical structure (SOAP, DAP, etc.)
   - May contain timestamps, "um", "uh", pauses, etc.

2. **progress_note** - A single already-written clinical progress note. Characteristics:
   - Formal clinical structure (Subjective/Objective/Assessment/Plan, etc.)
   - Professional clinical language
   - Single session documentation
   - Contains clinical formulation, not raw dialogue

3. **bulk_progress_notes** - Multiple progress notes in one document. Characteristics:
   - Contains multiple dated entries
   - Multiple session dates visible
   - Clear separation between different session notes
   - May be a monthly/weekly compilation

Return your analysis in this exact JSON format:
{
  "documentType": "transcript|progress_note|bulk_progress_notes",
  "confidence": 1-100,
  "reasoning": "explanation of classification",
  "estimatedNoteCount": number (if bulk_progress_notes),
  "detectedDates": ["YYYY-MM-DD", ...],
  "detectedClients": ["client name", ...]
}`;

/**
 * Prompt for splitting bulk progress notes
 */
const BULK_SPLIT_PROMPT = `You are an expert clinical documentation analyst. The following document contains multiple progress notes that need to be split into individual session entries.

BULK DOCUMENT:
"""
{DOCUMENT_TEXT}
"""

Split this document into individual progress notes. For each note, extract:
1. The date of service
2. The client name (if identifiable)
3. The complete note content for that session

Return your analysis in this exact JSON format:
{
  "notes": [
    {
      "clientName": "client name or 'Unknown'",
      "sessionDate": "YYYY-MM-DD",
      "content": "complete progress note content for this session",
      "sessionType": "individual|couples|family|group",
      "riskLevel": "low|moderate|high|critical",
      "progressRating": 1-10,
      "themes": ["theme1", "theme2"],
      "emotions": ["emotion1"],
      "interventions": ["intervention1"],
      "nextSteps": ["next step"],
      "confidence": 1-100
    }
  ],
  "totalNotes": number,
  "processingNotes": "any notes about ambiguities or issues"
}`;

export class IntelligentDocumentClassifier {

  /**
   * Main entry point - classifies document and processes accordingly
   */
  async processDocument(
    text: string,
    fileName: string,
    therapistId: string
  ): Promise<BulkProcessingResult> {
    console.log(`🔍 Intelligently classifying document: ${fileName}`);

    try {
      // Step 1: Classify the document type
      const classification = await this.classifyDocument(text);
      console.log(`📋 Classification: ${classification.documentType} (${classification.confidence}% confidence)`);
      console.log(`💭 Reasoning: ${classification.reasoning}`);

      // Step 2: Process based on classification
      switch (classification.documentType) {
        case 'transcript':
          return await this.processTranscript(text, fileName, therapistId);

        case 'progress_note':
          return await this.processSingleProgressNote(text, fileName, therapistId);

        case 'bulk_progress_notes':
          return await this.processBulkProgressNotes(text, fileName, therapistId);

        default:
          // Try to process as transcript by default
          console.log('⚠️ Unknown document type, attempting transcript processing');
          return await this.processTranscript(text, fileName, therapistId);
      }
    } catch (error: any) {
      console.error('❌ Intelligent document processing failed:', error);
      return {
        success: false,
        documentType: 'unknown',
        notes: [],
        totalProcessed: 0,
        errors: [error.message || 'Unknown error'],
        processingNotes: `Processing failed: ${error.message}`
      };
    }
  }

  /**
   * Classify the document type using AI
   */
  async classifyDocument(text: string): Promise<ClassificationResult> {
    const prompt = CLASSIFICATION_PROMPT.replace('{DOCUMENT_TEXT}', text.substring(0, 8000));

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.warn('⚠️ Anthropic classification failed, trying OpenAI:', error);
    }

    // Fallback to OpenAI
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a clinical documentation analyst. Classify documents accurately." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1024,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const result = response.choices[0]?.message?.content;
      if (result) {
        return JSON.parse(result);
      }
    } catch (error) {
      console.error('❌ Both AI providers failed for classification:', error);
    }

    // Manual fallback classification
    return this.manualClassification(text);
  }

  /**
   * Manual classification based on heuristics
   */
  manualClassification(text: string): ClassificationResult {
    const lowerText = text.toLowerCase();

    // Check for transcript indicators
    const transcriptIndicators = [
      /therapist\s*:/i,
      /client\s*:/i,
      /\bt\s*:/i,
      /\bc\s*:/i,
      /speaker\s*\d/i,
      /\[pause\]/i,
      /\[inaudible\]/i,
      /um+\b/,
      /uh+\b/,
      /\d{1,2}:\d{2}/  // timestamps
    ];

    const transcriptScore = transcriptIndicators.filter(r => r.test(text)).length;

    // Check for progress note structure
    const noteIndicators = [
      /subjective/i,
      /objective/i,
      /assessment/i,
      /\bplan\b/i,
      /soap\s*note/i,
      /progress\s*note/i,
      /clinical\s*note/i,
      /presenting\s*problem/i,
      /mental\s*status/i,
      /treatment\s*goal/i
    ];

    const noteScore = noteIndicators.filter(r => r.test(text)).length;

    // Check for multiple dates (bulk indicator)
    const dateMatches = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [];
    const uniqueDates = [...new Set(dateMatches)];

    if (uniqueDates.length >= 3 && noteScore >= 2) {
      return {
        documentType: 'bulk_progress_notes',
        confidence: 60,
        reasoning: 'Multiple dates detected with progress note structure',
        estimatedNoteCount: uniqueDates.length,
        detectedDates: uniqueDates
      };
    }

    if (transcriptScore >= 3) {
      return {
        documentType: 'transcript',
        confidence: 60,
        reasoning: 'Contains dialogue markers and conversational patterns'
      };
    }

    if (noteScore >= 3) {
      return {
        documentType: 'progress_note',
        confidence: 60,
        reasoning: 'Contains clinical documentation structure'
      };
    }

    return {
      documentType: 'unknown',
      confidence: 30,
      reasoning: 'Could not confidently classify document type'
    };
  }

  /**
   * Process a transcript into a comprehensive progress note
   */
  async processTranscript(
    text: string,
    fileName: string,
    therapistId: string
  ): Promise<BulkProcessingResult> {
    console.log('📝 Processing transcript into comprehensive progress note...');

    const prompt = COMPREHENSIVE_PROGRESS_NOTE_PROMPT.replace('{TRANSCRIPT_TEXT}', text);

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          // Construct full progress note content from structured data
          const fullContent = this.constructProgressNoteContent(result);

          const processedNote: ProcessedNote = {
            clientName: result.clientName || 'Unknown Client',
            sessionDate: this.parseDate(result.sessionDate) || new Date(),
            content: fullContent,
            sessionType: result.sessionType || 'individual',
            riskLevel: result.riskLevel || 'low',
            progressRating: result.progressRating || 5,
            themes: result.themes || [],
            emotions: result.emotions || [],
            interventions: result.interventions || [],
            nextSteps: result.nextSteps || [],
            tonalAnalysis: result.tonalAnalysis,
            keyPoints: result.keyPoints,
            significantQuotes: result.significantQuotes?.map((q: any) =>
              typeof q === 'string' ? q : `"${q.quote}" - ${q.significance}`
            ),
            narrativeSummary: result.narrativeSummary,
            confidence: result.confidence || 80
          };

          return {
            success: true,
            documentType: 'transcript',
            notes: [processedNote],
            totalProcessed: 1,
            errors: [],
            processingNotes: 'Transcript successfully processed into comprehensive clinical progress note'
          };
        }
      }
    } catch (error: any) {
      console.error('❌ Transcript processing failed:', error);
      return {
        success: false,
        documentType: 'transcript',
        notes: [],
        totalProcessed: 0,
        errors: [error.message],
        processingNotes: `Transcript processing failed: ${error.message}`
      };
    }

    return {
      success: false,
      documentType: 'transcript',
      notes: [],
      totalProcessed: 0,
      errors: ['Failed to parse AI response'],
      processingNotes: 'Could not parse transcript processing response'
    };
  }

  /**
   * Construct full progress note content from structured data
   */
  constructProgressNoteContent(data: any): string {
    const sections: string[] = [];

    if (data.title) {
      sections.push(`**${data.title}**\n`);
    }

    if (data.subjective) {
      sections.push(`**Subjective**\n${data.subjective}\n`);
    }

    if (data.objective) {
      sections.push(`**Objective**\n${data.objective}\n`);
    }

    if (data.assessment) {
      sections.push(`**Assessment**\n${data.assessment}\n`);
    }

    if (data.plan) {
      sections.push(`**Plan**\n${data.plan}\n`);
    }

    if (data.tonalAnalysis) {
      sections.push(`**Tonal Analysis**\n${data.tonalAnalysis}\n`);
    }

    if (data.thematicAnalysis) {
      sections.push(`**Thematic Analysis**\n${data.thematicAnalysis}\n`);
    }

    if (data.sentimentAnalysis) {
      sections.push(`**Sentiment Analysis**\n${data.sentimentAnalysis}\n`);
    }

    if (data.keyPoints && data.keyPoints.length > 0) {
      sections.push(`**Key Points**\n${data.keyPoints.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}\n`);
    }

    if (data.significantQuotes && data.significantQuotes.length > 0) {
      const quotes = data.significantQuotes.map((q: any) => {
        if (typeof q === 'string') return q;
        return `"${q.quote}"\nContext: ${q.context}\nSignificance: ${q.significance}`;
      }).join('\n\n');
      sections.push(`**Significant Quotes**\n${quotes}\n`);
    }

    if (data.narrativeSummary) {
      sections.push(`**Comprehensive Narrative Summary**\n${data.narrativeSummary}`);
    }

    return sections.join('\n');
  }

  /**
   * Process a single already-written progress note
   */
  async processSingleProgressNote(
    text: string,
    fileName: string,
    therapistId: string
  ): Promise<BulkProcessingResult> {
    console.log('📄 Processing single progress note...');

    const extractionPrompt = `Extract key information from this clinical progress note:

PROGRESS NOTE:
"""
${text}
"""

Return in JSON format:
{
  "clientName": "extracted name",
  "sessionDate": "YYYY-MM-DD",
  "sessionType": "individual|couples|family|group",
  "content": "the full progress note content",
  "themes": ["theme1", "theme2"],
  "emotions": ["emotion1"],
  "interventions": ["intervention1"],
  "riskLevel": "low|moderate|high|critical",
  "progressRating": 1-10,
  "nextSteps": ["step1"],
  "confidence": 1-100
}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.1,
        messages: [{ role: "user", content: extractionPrompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          const processedNote: ProcessedNote = {
            clientName: result.clientName || 'Unknown Client',
            sessionDate: this.parseDate(result.sessionDate) || new Date(),
            content: result.content || text,
            sessionType: result.sessionType || 'individual',
            riskLevel: result.riskLevel || 'low',
            progressRating: result.progressRating || 5,
            themes: result.themes || [],
            emotions: result.emotions || [],
            interventions: result.interventions || [],
            nextSteps: result.nextSteps || [],
            confidence: result.confidence || 80
          };

          return {
            success: true,
            documentType: 'progress_note',
            notes: [processedNote],
            totalProcessed: 1,
            errors: [],
            processingNotes: 'Progress note extracted and processed successfully'
          };
        }
      }
    } catch (error: any) {
      console.error('❌ Progress note extraction failed:', error);
    }

    // Fallback - return the note as-is with minimal extraction
    return {
      success: true,
      documentType: 'progress_note',
      notes: [{
        clientName: this.extractClientNameManually(text) || 'Unknown Client',
        sessionDate: this.extractDateManually(text) || new Date(),
        content: text,
        sessionType: 'individual',
        riskLevel: 'low',
        progressRating: 5,
        themes: [],
        emotions: [],
        interventions: [],
        nextSteps: [],
        confidence: 50
      }],
      totalProcessed: 1,
      errors: [],
      processingNotes: 'Progress note processed with manual fallback extraction'
    };
  }

  /**
   * Process bulk progress notes - split and file by date
   */
  async processBulkProgressNotes(
    text: string,
    fileName: string,
    therapistId: string
  ): Promise<BulkProcessingResult> {
    console.log('📚 Processing bulk progress notes...');

    const prompt = BULK_SPLIT_PROMPT.replace('{DOCUMENT_TEXT}', text);

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          const processedNotes: ProcessedNote[] = (result.notes || []).map((note: any) => ({
            clientName: note.clientName || 'Unknown Client',
            sessionDate: this.parseDate(note.sessionDate) || new Date(),
            content: note.content,
            sessionType: note.sessionType || 'individual',
            riskLevel: note.riskLevel || 'low',
            progressRating: note.progressRating || 5,
            themes: note.themes || [],
            emotions: note.emotions || [],
            interventions: note.interventions || [],
            nextSteps: note.nextSteps || [],
            confidence: note.confidence || 70
          }));

          return {
            success: true,
            documentType: 'bulk_progress_notes',
            notes: processedNotes,
            totalProcessed: processedNotes.length,
            errors: [],
            processingNotes: `Successfully split ${processedNotes.length} progress notes from bulk document. ${result.processingNotes || ''}`
          };
        }
      }
    } catch (error: any) {
      console.error('❌ Bulk processing failed:', error);
      return {
        success: false,
        documentType: 'bulk_progress_notes',
        notes: [],
        totalProcessed: 0,
        errors: [error.message],
        processingNotes: `Bulk processing failed: ${error.message}`
      };
    }

    return {
      success: false,
      documentType: 'bulk_progress_notes',
      notes: [],
      totalProcessed: 0,
      errors: ['Failed to parse bulk split response'],
      processingNotes: 'Could not split bulk progress notes'
    };
  }

  /**
   * Parse date string into Date object
   */
  parseDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;

    const formats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'MM-dd-yyyy',
      'M/d/yyyy',
      'MMMM d, yyyy',
      'MMM d, yyyy'
    ];

    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      } catch {}
    }

    // Try native Date parsing as fallback
    const nativeDate = new Date(dateStr);
    if (isValid(nativeDate)) {
      return nativeDate;
    }

    return null;
  }

  /**
   * Manual client name extraction
   */
  extractClientNameManually(text: string): string | null {
    const patterns = [
      /(?:patient|client|name)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /(?:session with|meeting with)\s+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /^([A-Z][a-z]+ [A-Z][a-z]+)(?:'s)?\s+(?:session|therapy|progress)/im
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Manual date extraction
   */
  extractDateManually(text: string): Date | null {
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
      /([A-Z][a-z]+ \d{1,2},? \d{4})/i,
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return this.parseDate(match[0]);
      }
    }

    return null;
  }

  /**
   * Save processed notes to database
   */
  async saveProcessedNotes(
    notes: ProcessedNote[],
    therapistId: string,
    originalDocumentId?: string
  ): Promise<{ savedIds: string[]; errors: string[] }> {
    const savedIds: string[] = [];
    const errors: string[] = [];

    for (const note of notes) {
      try {
        // Find or match client
        let clientId: string | undefined;
        const clients = await storage.getClients(therapistId);
        const matchedClient = clients.find(c =>
          c.name.toLowerCase().includes(note.clientName.toLowerCase()) ||
          note.clientName.toLowerCase().includes(c.name.toLowerCase())
        );

        if (matchedClient) {
          clientId = matchedClient.id;
        } else {
          // Create new client
          const newClient = await storage.createClient({
            name: note.clientName,
            therapistId,
            status: 'active'
          });
          clientId = newClient.id;
        }

        // Create progress note
        const progressNote = await storage.createProgressNote({
          clientId,
          therapistId,
          sessionDate: note.sessionDate,
          content: note.content,
          tags: [...note.themes, ...note.emotions],
          riskLevel: note.riskLevel,
          progressRating: note.progressRating,
          status: 'final',
          isPlaceholder: false,
          aiConfidenceScore: note.confidence / 100,
          originalDocumentId
        });

        savedIds.push(progressNote.id);
        console.log(`✅ Saved progress note for ${note.clientName} on ${format(note.sessionDate, 'yyyy-MM-dd')}`);

      } catch (error: any) {
        console.error(`❌ Failed to save note for ${note.clientName}:`, error);
        errors.push(`Failed to save note for ${note.clientName}: ${error.message}`);
      }
    }

    return { savedIds, errors };
  }
}

// Export singleton instance
export const intelligentDocumentClassifier = new IntelligentDocumentClassifier();
