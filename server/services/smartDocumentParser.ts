/**
 * Smart Document Parser Service
 *
 * Intelligently parses uploaded documents to:
 * 1. Detect document type (transcript, EHR, multi-client)
 * 2. Generate comprehensive progress notes from transcripts
 * 3. Parse and preserve EHR formatting
 * 4. Extract multiple clients and reconcile with calendar
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage.js';

const openai = new OpenAI();
const anthropic = new Anthropic();

// Document type detection
export enum DocumentType {
  TRANSCRIPT = 'transcript',
  EHR_NOTE = 'ehr_note',
  MULTI_CLIENT = 'multi_client',
  UNKNOWN = 'unknown'
}

export interface ParsedClient {
  name: string;
  dateOfService?: Date;
  content: string;
  matchedClientId?: string;
  matchedSessionId?: string;
}

export interface SmartParseResult {
  documentType: DocumentType;
  confidence: number;
  clients: ParsedClient[];
  rawContent: string;
  generatedNotes?: GeneratedProgressNote[];
  ehrData?: ParsedEHRData;
  reconciliationResults?: ReconciliationResult[];
}

export interface GeneratedProgressNote {
  clientId: string;
  clientName: string;
  sessionId?: string;
  dateOfService: Date;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  tonalAnalysis: string;
  thematicAnalysis: string;
  sentimentAnalysis: string;
  keyPoints: string;
  significantQuotes: string;
  narrativeSummary: string;
  fullNote: string;
}

export interface ParsedEHRData {
  clientName: string;
  dateOfService: Date;
  providerName?: string;
  diagnosis?: string[];
  medications?: string[];
  vitals?: Record<string, string>;
  notes: string;
  preservedFormatting: string;
}

export interface ReconciliationResult {
  clientName: string;
  dateOfService: Date;
  matchedClient?: { id: string; name: string };
  matchedSession?: { id: string; scheduledFor: Date };
  status: 'matched' | 'partial_match' | 'no_match';
  confidence: number;
}

/**
 * Main Smart Document Parser Service
 */
export class SmartDocumentParserService {

  /**
   * Detect the type of document based on content analysis
   */
  async detectDocumentType(content: string): Promise<{ type: DocumentType; confidence: number }> {
    const lowerContent = content.toLowerCase();

    // Transcript indicators
    const transcriptIndicators = [
      /therapist:/i,
      /client:/i,
      /counselor:/i,
      /patient:/i,
      /\[.*?speaking\]/i,
      /session transcript/i,
      /\d{1,2}:\d{2}(:\d{2})?\s*[-–]/i, // Timestamps
      /"[^"]{20,}"/g, // Long quoted speech
    ];

    // EHR indicators
    const ehrIndicators = [
      /chief complaint/i,
      /history of present illness/i,
      /assessment and plan/i,
      /vital signs/i,
      /medications?:/i,
      /diagnosis:/i,
      /icd-?\d{1,2}/i,
      /cpt code/i,
      /progress note/i,
      /soap note/i,
    ];

    // Multi-client indicators
    const multiClientIndicators = [
      /client\s*#?\s*\d/i,
      /patient\s*#?\s*\d/i,
      /---+\s*\n/g, // Dividers
      /={3,}/g,
      /next (client|patient)/i,
    ];

    let transcriptScore = 0;
    let ehrScore = 0;
    let multiClientScore = 0;

    transcriptIndicators.forEach(pattern => {
      if (pattern.test(content)) transcriptScore += 2;
    });

    ehrIndicators.forEach(pattern => {
      if (pattern.test(content)) ehrScore += 2;
    });

    multiClientIndicators.forEach(pattern => {
      if (pattern.test(content)) multiClientScore += 3;
    });

    // Check for multiple distinct client names
    const namePattern = /(?:client|patient)\s*(?:name)?:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/gi;
    const names = [...content.matchAll(namePattern)];
    if (names.length > 1) {
      multiClientScore += names.length * 2;
    }

    const maxScore = Math.max(transcriptScore, ehrScore, multiClientScore);
    const totalScore = transcriptScore + ehrScore + multiClientScore;

    if (maxScore === 0) {
      // Use AI to classify
      return await this.aiClassifyDocument(content);
    }

    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

    if (multiClientScore === maxScore && multiClientScore > 4) {
      return { type: DocumentType.MULTI_CLIENT, confidence };
    } else if (transcriptScore === maxScore) {
      return { type: DocumentType.TRANSCRIPT, confidence };
    } else if (ehrScore === maxScore) {
      return { type: DocumentType.EHR_NOTE, confidence };
    }

    return { type: DocumentType.UNKNOWN, confidence: 0.3 };
  }

  /**
   * Use AI to classify ambiguous documents
   */
  private async aiClassifyDocument(content: string): Promise<{ type: DocumentType; confidence: number }> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a document classifier for a therapy practice. Classify the document as one of:
- TRANSCRIPT: A therapy session transcript with dialogue between therapist and client
- EHR_NOTE: Electronic health record or clinical note (SOAP note, progress note, etc.)
- MULTI_CLIENT: A document containing information about multiple different clients
- UNKNOWN: Cannot determine

Respond with JSON: {"type": "TYPE", "confidence": 0.0-1.0}`
          },
          {
            role: 'user',
            content: content.substring(0, 3000) // First 3000 chars for classification
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 100
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        type: result.type as DocumentType || DocumentType.UNKNOWN,
        confidence: result.confidence || 0.5
      };
    } catch (error) {
      console.error('AI classification error:', error);
      return { type: DocumentType.UNKNOWN, confidence: 0.3 };
    }
  }

  /**
   * Main parsing function - routes to appropriate parser based on document type
   */
  async parseDocument(content: string, therapistId: string): Promise<SmartParseResult> {
    const { type, confidence } = await this.detectDocumentType(content);

    const result: SmartParseResult = {
      documentType: type,
      confidence,
      clients: [],
      rawContent: content
    };

    switch (type) {
      case DocumentType.TRANSCRIPT:
        result.generatedNotes = await this.processTranscript(content, therapistId);
        if (result.generatedNotes.length > 0) {
          result.clients = result.generatedNotes.map(note => ({
            name: note.clientName,
            dateOfService: note.dateOfService,
            content: note.fullNote,
            matchedClientId: note.clientId,
            matchedSessionId: note.sessionId
          }));
        }
        break;

      case DocumentType.EHR_NOTE:
        result.ehrData = await this.parseEHRNote(content);
        result.clients = [{
          name: result.ehrData.clientName,
          dateOfService: result.ehrData.dateOfService,
          content: result.ehrData.preservedFormatting
        }];
        // Try to reconcile with calendar
        result.reconciliationResults = await this.reconcileWithCalendar(
          [{ name: result.ehrData.clientName, dateOfService: result.ehrData.dateOfService }],
          therapistId
        );
        break;

      case DocumentType.MULTI_CLIENT:
        const parsedClients = await this.parseMultiClientDocument(content);
        result.clients = parsedClients;
        result.reconciliationResults = await this.reconcileWithCalendar(
          parsedClients.map(c => ({ name: c.name, dateOfService: c.dateOfService })),
          therapistId
        );
        break;

      default:
        // Try to extract any client information
        const extracted = await this.extractBasicInfo(content);
        result.clients = extracted;
    }

    return result;
  }

  /**
   * Process transcript and generate comprehensive clinical progress note
   */
  async processTranscript(transcript: string, therapistId: string): Promise<GeneratedProgressNote[]> {
    // Extract client name and date from transcript
    const { clientName, dateOfService } = await this.extractTranscriptMetadata(transcript);

    // Find matching client in database
    const clients = await storage.getClients(therapistId);
    const matchedClient = this.findBestClientMatch(clientName, clients);

    // Find matching session
    let matchedSession = null;
    if (matchedClient && dateOfService) {
      const sessions = await storage.getSessions(therapistId);
      matchedSession = sessions.find(s =>
        s.clientId === matchedClient.id &&
        this.isSameDay(new Date(s.scheduledFor), dateOfService)
      );
    }

    // Generate comprehensive progress note using the clinical prompt
    const progressNote = await this.generateClinicalProgressNote(
      transcript,
      clientName,
      dateOfService || new Date()
    );

    return [{
      clientId: matchedClient?.id || '',
      clientName: clientName || 'Unknown Client',
      sessionId: matchedSession?.id,
      dateOfService: dateOfService || new Date(),
      ...progressNote
    }];
  }

  /**
   * Generate comprehensive clinical progress note using the full clinical prompt
   */
  private async generateClinicalProgressNote(
    transcript: string,
    clientName: string,
    dateOfService: Date
  ): Promise<Omit<GeneratedProgressNote, 'clientId' | 'clientName' | 'sessionId' | 'dateOfService'>> {

    const systemPrompt = this.getClinicalPrompt();
    const dateStr = dateOfService.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    try {
      // Use Claude for the most sophisticated clinical writing
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Please generate a comprehensive clinical progress note for the following therapy session transcript.

Client Name: ${clientName}
Date of Service: ${dateStr}

TRANSCRIPT:
${transcript}

Generate the complete progress note following the exact structure and clinical depth specified in your instructions. Include all required sections: Subjective, Objective, Assessment, Plan, Tonal Analysis, Thematic Analysis, Sentiment Analysis, Key Points, Significant Quotes, and Comprehensive Narrative Summary.`
          }
        ]
      });

      const fullNote = response.content[0].type === 'text' ? response.content[0].text : '';

      // Parse the sections from the full note
      return this.parseClinicalNoteSections(fullNote);

    } catch (error) {
      console.error('Error generating clinical progress note:', error);

      // Fallback to OpenAI
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Generate a comprehensive clinical progress note for:
Client: ${clientName}
Date: ${dateStr}

TRANSCRIPT:
${transcript}`
            }
          ],
          max_tokens: 6000
        });

        const fullNote = response.choices[0].message.content || '';
        return this.parseClinicalNoteSections(fullNote);

      } catch (fallbackError) {
        console.error('Fallback generation error:', fallbackError);
        throw new Error('Failed to generate progress note');
      }
    }
  }

  /**
   * The comprehensive clinical progress note prompt
   */
  private getClinicalPrompt(): string {
    return `You are an expert clinical therapist with extensive training in psychotherapy, clinical documentation, and therapeutic modalities including ACT, DBT, Narrative Therapy, and Existentialism. Your task is to create a comprehensive clinical progress note from the provided therapy session transcript that demonstrates the depth, clinical sophistication, and analytical rigor of an experienced mental health professional.

## Document Formatting Requirements
1. Title Format: Use proper heading formatting
2. Section Headers Format: Bold headers for each section
3. Text Formatting: Professional clinical voice throughout
4. Specific Section Formatting: Each section should flow naturally with clinical sophistication

## Required Document Structure

Create a progress note with the following precise structure:

1. **Title**: "Comprehensive Clinical Progress Note for [Client's Full Name]'s Therapy Session on [Date]"

2. **Subjective Section**:
- Capture the client's reported experiences, feelings, and concerns in their own words where possible
- Include relevant quotes that illuminate their emotional state
- Connect current presentation to historical patterns and previous session themes
- Demonstrate understanding of the client's subjective experience

3. **Objective Section**:
- Document observable behaviors, appearance, affect, and mental status
- Note body language, eye contact, tone of voice changes
- Record any discrepancies between verbal and non-verbal communication
- Include clinical observations about defense mechanisms or coping patterns

4. **Assessment Section**:
- Provide diagnostic impressions with appropriate codes if relevant
- Analyze patterns observed in the session
- Connect current presentation to treatment goals
- Identify core beliefs, schemas, or attachment patterns evident in the session
- Assess risk factors and protective factors

5. **Plan Section**:
- Detail specific therapeutic interventions used and planned
- Include homework or between-session tasks
- Reference specific therapeutic modalities (ACT, DBT, Narrative Therapy, etc.)
- Set clear, measurable goals for upcoming sessions

6. **Supplemental Analyses**:

**Tonal Analysis**: Identify and analyze significant tonal shifts during the session. For each shift:
- Describe the nature of the shift (e.g., from detached to angry, from guarded to open)
- Identify the trigger or context for the shift
- Explain the clinical significance of the shift

**Thematic Analysis**: Identify dominant themes in the session:
- Name each significant theme
- Provide evidence from the session
- Connect to developmental history and treatment goals
- Explain therapeutic implications

**Sentiment Analysis**: Analyze sentiments expressed:
- Sentiments about self (with specific examples)
- Sentiments about others/relationships
- Sentiments about situations/circumstances
- Note intensity and authenticity of emotional expressions

7. **Key Points**: Summarize 2-4 critical clinical insights from the session, including:
- Why each point is clinically significant
- How it relates to treatment
- Implications for ongoing therapy

8. **Significant Quotes**: Include 2-3 verbatim quotes from the client that are clinically significant, with analysis of:
- Context in which the statement was made
- Clinical significance
- Connection to core beliefs, patterns, or treatment goals

9. **Comprehensive Narrative Summary**: A flowing narrative that:
- Synthesizes all elements of the session
- Places the session in the context of overall treatment
- Identifies opportunities and challenges for ongoing work
- Demonstrates clinical wisdom and therapeutic understanding

## Clinical Approach Requirements
Your analysis must demonstrate:
1. Depth of Clinical Thinking - Move beyond surface observations to underlying dynamics
2. Therapeutic Perspective - Show understanding of the therapeutic relationship
3. Integration of Therapeutic Frameworks - Reference appropriate modalities
4. Clinical Sophistication - Use professional terminology appropriately

## Writing Style Requirements
1. Professional Clinical Voice - Maintain objectivity while showing therapeutic warmth
2. Structural Integrity - Each section should be complete and well-organized
3. Depth and Detail - Provide thorough analysis with specific examples
4. Narrative Cohesion - Create a coherent clinical picture

The final product should be a clinically sophisticated, detailed, and comprehensive progress note that would meet the highest standards of professional documentation in a mental health setting.`;
  }

  /**
   * Parse the generated note into sections
   */
  private parseClinicalNoteSections(fullNote: string): Omit<GeneratedProgressNote, 'clientId' | 'clientName' | 'sessionId' | 'dateOfService'> {
    const sections: Record<string, string> = {};

    // Section patterns
    const sectionPatterns = [
      { key: 'subjective', patterns: [/subjective/i, /client.?s?\s*report/i] },
      { key: 'objective', patterns: [/objective/i, /clinical\s*observation/i] },
      { key: 'assessment', patterns: [/assessment/i, /clinical\s*impression/i] },
      { key: 'plan', patterns: [/plan/i, /treatment\s*plan/i, /intervention/i] },
      { key: 'tonalAnalysis', patterns: [/tonal\s*analysis/i, /tone\s*shift/i] },
      { key: 'thematicAnalysis', patterns: [/thematic\s*analysis/i, /theme/i] },
      { key: 'sentimentAnalysis', patterns: [/sentiment\s*analysis/i] },
      { key: 'keyPoints', patterns: [/key\s*points?/i, /critical\s*insight/i] },
      { key: 'significantQuotes', patterns: [/significant\s*quotes?/i, /notable\s*statement/i] },
      { key: 'narrativeSummary', patterns: [/narrative\s*summary/i, /comprehensive\s*summary/i] }
    ];

    // Split by major section headers
    const lines = fullNote.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      let foundSection = false;

      for (const { key, patterns } of sectionPatterns) {
        if (patterns.some(p => p.test(line))) {
          if (currentSection && currentContent.length > 0) {
            sections[currentSection] = currentContent.join('\n').trim();
          }
          currentSection = key;
          currentContent = [];
          foundSection = true;
          break;
        }
      }

      if (!foundSection && currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return {
      subjective: sections.subjective || '',
      objective: sections.objective || '',
      assessment: sections.assessment || '',
      plan: sections.plan || '',
      tonalAnalysis: sections.tonalAnalysis || '',
      thematicAnalysis: sections.thematicAnalysis || '',
      sentimentAnalysis: sections.sentimentAnalysis || '',
      keyPoints: sections.keyPoints || '',
      significantQuotes: sections.significantQuotes || '',
      narrativeSummary: sections.narrativeSummary || '',
      fullNote: fullNote
    };
  }

  /**
   * Extract metadata from transcript
   */
  private async extractTranscriptMetadata(transcript: string): Promise<{ clientName: string | null; dateOfService: Date | null }> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'Extract the client name and session date from this transcript. Return JSON: {"clientName": "Full Name" or null, "dateOfService": "YYYY-MM-DD" or null}'
          },
          {
            role: 'user',
            content: transcript.substring(0, 2000)
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 100
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        clientName: result.clientName || null,
        dateOfService: result.dateOfService ? new Date(result.dateOfService) : null
      };
    } catch (error) {
      console.error('Metadata extraction error:', error);
      return { clientName: null, dateOfService: null };
    }
  }

  /**
   * Parse EHR note preserving formatting
   */
  async parseEHRNote(content: string): Promise<ParsedEHRData> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Parse this EHR/clinical note and extract structured data. Return JSON:
{
  "clientName": "Full Name",
  "dateOfService": "YYYY-MM-DD",
  "providerName": "Provider name or null",
  "diagnosis": ["ICD codes or diagnoses"],
  "medications": ["medication list"],
  "vitals": {"BP": "value", "HR": "value", etc.},
  "notes": "The clinical note content",
  "preservedFormatting": "The original note with formatting preserved"
}`
          },
          {
            role: 'user',
            content: content
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        clientName: result.clientName || 'Unknown',
        dateOfService: result.dateOfService ? new Date(result.dateOfService) : new Date(),
        providerName: result.providerName,
        diagnosis: result.diagnosis || [],
        medications: result.medications || [],
        vitals: result.vitals || {},
        notes: result.notes || content,
        preservedFormatting: result.preservedFormatting || content
      };
    } catch (error) {
      console.error('EHR parsing error:', error);
      return {
        clientName: 'Unknown',
        dateOfService: new Date(),
        notes: content,
        preservedFormatting: content
      };
    }
  }

  /**
   * Parse multi-client document
   */
  async parseMultiClientDocument(content: string): Promise<ParsedClient[]> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Parse this document containing multiple clients. For each client, extract:
- Full name
- Date of service (if present)
- Their specific content/notes

Return JSON: {"clients": [{"name": "Full Name", "dateOfService": "YYYY-MM-DD" or null, "content": "their specific content"}]}`
          },
          {
            role: 'user',
            content: content
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"clients": []}');
      return (result.clients || []).map((c: any) => ({
        name: c.name || 'Unknown',
        dateOfService: c.dateOfService ? new Date(c.dateOfService) : undefined,
        content: c.content || ''
      }));
    } catch (error) {
      console.error('Multi-client parsing error:', error);
      return [];
    }
  }

  /**
   * Reconcile parsed clients with calendar/sessions
   */
  async reconcileWithCalendar(
    clients: Array<{ name: string; dateOfService?: Date }>,
    therapistId: string
  ): Promise<ReconciliationResult[]> {
    const results: ReconciliationResult[] = [];
    const allClients = await storage.getClients(therapistId);
    const allSessions = await storage.getSessions(therapistId);

    for (const parsed of clients) {
      const result: ReconciliationResult = {
        clientName: parsed.name,
        dateOfService: parsed.dateOfService || new Date(),
        status: 'no_match',
        confidence: 0
      };

      // Find matching client
      const matchedClient = this.findBestClientMatch(parsed.name, allClients);
      if (matchedClient) {
        result.matchedClient = { id: matchedClient.id, name: matchedClient.name };
        result.confidence += 0.5;
        result.status = 'partial_match';

        // Find matching session
        if (parsed.dateOfService) {
          const matchedSession = allSessions.find(s =>
            s.clientId === matchedClient.id &&
            this.isSameDay(new Date(s.scheduledFor), parsed.dateOfService!)
          );

          if (matchedSession) {
            result.matchedSession = {
              id: matchedSession.id,
              scheduledFor: new Date(matchedSession.scheduledFor)
            };
            result.confidence = 1.0;
            result.status = 'matched';
          }
        }
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Extract basic info from unknown document types
   */
  private async extractBasicInfo(content: string): Promise<ParsedClient[]> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'Extract any client names and dates from this document. Return JSON: {"clients": [{"name": "Full Name", "dateOfService": "YYYY-MM-DD" or null, "content": "relevant content"}]}'
          },
          {
            role: 'user',
            content: content.substring(0, 4000)
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"clients": []}');
      return (result.clients || []).map((c: any) => ({
        name: c.name || 'Unknown',
        dateOfService: c.dateOfService ? new Date(c.dateOfService) : undefined,
        content: c.content || content
      }));
    } catch (error) {
      console.error('Basic extraction error:', error);
      return [{ name: 'Unknown', content }];
    }
  }

  /**
   * Find best matching client by name
   */
  private findBestClientMatch(name: string | null, clients: any[]): any | null {
    if (!name) return null;

    const normalizedName = name.toLowerCase().trim();

    // Exact match
    let match = clients.find(c => c.name.toLowerCase() === normalizedName);
    if (match) return match;

    // Partial match (contains)
    match = clients.find(c =>
      c.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(c.name.toLowerCase())
    );
    if (match) return match;

    // First/last name match
    const nameParts = normalizedName.split(/\s+/);
    if (nameParts.length >= 2) {
      match = clients.find(c => {
        const clientParts = c.name.toLowerCase().split(/\s+/);
        return nameParts.some(p => clientParts.includes(p));
      });
    }

    return match || null;
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}

// Export singleton instance
export const smartDocumentParser = new SmartDocumentParserService();
