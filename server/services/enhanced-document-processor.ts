/**
 * Enhanced Document Processor with Robust AI Analysis
 * 
 * This completely reimplemented document processing system provides:
 * - Advanced PDF text extraction with multiple fallback methods
 * - Sophisticated AI-powered clinical data extraction
 * - Robust date parsing with multiple format support
 * - Advanced client name matching with fuzzy logic
 * - Comprehensive text preprocessing and cleaning
 * - Multi-stage validation and confidence scoring
 */

// Conditional import for pdf-parse to handle module loading issues
let pdf: any = null;
try {
  pdf = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse not available, using fallback PDF extraction');
}
import mammoth from 'mammoth';
import { stripHtml } from 'string-strip-html';
import { storage } from '../storage';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { format, isValid, parse } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "dummy_key"
});

export interface RobustProcessingResult {
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
    clinicalThemes?: string[];
    emotions?: string[];
    interventions?: string[];
    progressRating?: number;
    nextSteps?: string[];
  };
  validationDetails: {
    textExtractionScore: number;
    aiAnalysisScore: number;
    dateValidationScore: number;
    clientMatchScore: number;
    overallQuality: number;
  };
  alternativeInterpretations?: any[];
}

export interface ExtractedClinicalData {
  clientName: string;
  sessionDate: string;
  sessionType: string;
  content: string;
  themes: string[];
  emotions: string[];
  interventions: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  progressRating: number;
  nextSteps: string[];
  clinicalNotes: string;
  confidence: number;
  alternativeInterpretations: {
    clientName?: string[];
    sessionDate?: string[];
    reasoning: string;
  };
}

export class EnhancedDocumentProcessor {
  
  /**
   * Main entry point for robust document processing
   */
  async processDocument(
    file: Buffer,
    fileName: string,
    therapistId: string
  ): Promise<RobustProcessingResult> {
    console.log(`🔄 Starting enhanced processing for: ${fileName}`);
    
    try {
      // Stage 1: Advanced Text Extraction
      const extractionResult = await this.extractTextRobustly(file, fileName);
      console.log(`📄 Text extraction score: ${extractionResult.quality}/100`);
      
      // Stage 2: Text Preprocessing and Cleaning
      const cleanedText = this.preprocessText(extractionResult.text);
      console.log(`🧹 Text preprocessed, length: ${cleanedText.length} chars`);
      
      // Stage 3: Multi-Pass AI Analysis
      const aiAnalysis = await this.performMultiPassAIAnalysis(cleanedText, fileName);
      console.log(`🤖 AI analysis score: ${aiAnalysis.confidence}/100`);
      
      // Stage 4: Advanced Date Parsing
      const parsedDate = this.parseSessionDateRobustly(aiAnalysis.sessionDate, cleanedText);
      console.log(`📅 Date parsing result: ${parsedDate?.confidence || 0}/100`);
      
      // Stage 5: Intelligent Client Matching
      const clientMatch = await this.findClientIntelligently(aiAnalysis.clientName, therapistId);
      console.log(`👤 Client match score: ${clientMatch.confidence}/100`);
      
      // Stage 6: Session Matching with Fuzzy Logic
      const sessionMatch = await this.findSessionIntelligently(
        clientMatch.id,
        parsedDate?.date,
        therapistId
      );
      
      // Stage 7: Comprehensive Validation
      const validation = this.validateExtractedData(
        extractionResult,
        aiAnalysis,
        parsedDate,
        clientMatch
      );
      
      // Stage 8: Decision Making
      const needsManualReview = this.shouldRequireManualReview(validation, aiAnalysis);
      
      // Stage 9: Create Progress Note
      const progressNote = await this.createEnhancedProgressNote(
        clientMatch.id,
        sessionMatch?.id,
        aiAnalysis,
        parsedDate?.date,
        therapistId,
        needsManualReview
      );
      
      // Stage 10: Document Storage
      await this.saveProcessedDocument(
        file,
        fileName,
        clientMatch.id,
        therapistId,
        extractionResult.text,
        progressNote.id,
        aiAnalysis
      );
      
      return {
        success: true,
        clientId: clientMatch.id,
        sessionId: sessionMatch?.id,
        progressNoteId: progressNote.id,
        confidence: validation.overallQuality,
        processingNotes: this.generateDetailedProcessingNotes(
          extractionResult, aiAnalysis, parsedDate, clientMatch, validation
        ),
        needsManualReview,
        extractedData: {
          clientName: aiAnalysis.clientName,
          sessionDate: parsedDate?.date,
          content: aiAnalysis.content,
          sessionType: aiAnalysis.sessionType,
          riskLevel: aiAnalysis.riskLevel,
          clinicalThemes: aiAnalysis.themes,
          emotions: aiAnalysis.emotions,
          interventions: aiAnalysis.interventions,
          progressRating: aiAnalysis.progressRating,
          nextSteps: aiAnalysis.nextSteps,
        },
        validationDetails: validation,
        alternativeInterpretations: aiAnalysis.alternativeInterpretations ? [aiAnalysis.alternativeInterpretations] : undefined
      };
      
    } catch (error: any) {
      console.error('❌ Enhanced processing failed:', error);
      return {
        success: false,
        confidence: 0,
        processingNotes: `Enhanced processing failed: ${error?.message || 'Unknown error'}. Please ensure the document contains readable text and try again.`,
        needsManualReview: true,
        extractedData: { content: '' },
        validationDetails: {
          textExtractionScore: 0,
          aiAnalysisScore: 0,
          dateValidationScore: 0,
          clientMatchScore: 0,
          overallQuality: 0
        }
      };
    }
  }

  /**
   * Advanced text extraction with multiple fallback methods
   */
  async extractTextRobustly(file: Buffer, fileName: string): Promise<{
    text: string;
    quality: number;
    method: string;
    metadata?: any;
  }> {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf':
        return this.extractFromPDFRobustly(file);
      case 'docx':
        return this.extractFromDOCXRobustly(file);
      case 'doc':
        return this.extractFromDOCRobustly(file);
      case 'rtf':
        return this.extractFromRTFRobustly(file);
      case 'txt':
      case 'text':
        return {
          text: file.toString('utf-8'),
          quality: 95,
          method: 'direct_text',
          metadata: { encoding: 'utf-8' }
        };
      default:
        // Try as text first, then apply intelligent detection
        return this.extractWithIntelligentDetection(file);
    }
  }

  /**
   * Robust PDF extraction with multiple approaches
   */
  async extractFromPDFRobustly(file: Buffer): Promise<{
    text: string;
    quality: number;
    method: string;
    metadata?: any;
  }> {
    console.log('🔍 Attempting robust PDF extraction...');
    
    try {
      // Primary method: pdf-parse (if available)
      if (pdf) {
        const data = await pdf(file, {
          // Optimize for clinical documents
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        });
      
      if (data.text && data.text.length > 50) {
        console.log('✅ PDF extraction successful via pdf-parse');
        return {
          text: data.text,
          quality: 85,
          method: 'pdf-parse',
          metadata: {
            pages: data.numpages,
            info: data.info
          }
        };
      }
      } else {
        console.log('📄 pdf-parse not available, using alternative extraction');
      }
    } catch (error) {
      console.warn('⚠️ pdf-parse failed, trying alternatives:', error);
    }

    // Fallback: Try to extract as raw text
    try {
      const rawText = file.toString('latin1');
      const extractedText = this.extractTextFromPDFBytes(rawText);
      
      if (extractedText && extractedText.length > 20) {
        console.log('✅ PDF extraction via raw byte parsing');
        return {
          text: extractedText,
          quality: 60,
          method: 'raw_bytes'
        };
      }
    } catch (error) {
      console.warn('⚠️ Raw byte extraction failed:', error);
    }

    // Final fallback: OCR-like text detection
    const ocrText = this.performBasicOCRFallback(file);
    return {
      text: ocrText || 'PDF text extraction failed. Please save as TXT for optimal processing.',
      quality: ocrText ? 40 : 10,
      method: 'ocr_fallback'
    };
  }

  /**
   * Extract text from PDF bytes using patterns
   */
  extractTextFromPDFBytes(rawText: string): string {
    const textPatterns = [
      /BT\s*.*?ET/g,  // Text objects
      /\(([^)]+)\)/g, // Parenthetical text
      /\[([^\]]+)\]/g, // Bracketed text
    ];
    
    let extractedText = '';
    
    for (const pattern of textPatterns) {
      const matches = rawText.match(pattern);
      if (matches) {
        extractedText += matches.join(' ') + ' ';
      }
    }
    
    // Clean and decode
    return extractedText
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Basic OCR fallback for PDFs
   */
  performBasicOCRFallback(file: Buffer): string {
    // This is a simplified version - in production you'd use actual OCR
    const text = file.toString('ascii', 0, Math.min(file.length, 5000));
    
    // Look for readable text patterns
    const readableText = text
      .match(/[A-Za-z]{3,}/g)
      ?.join(' ') || '';
    
    return readableText.length > 50 ? readableText : '';
  }

  /**
   * Extract from DOCX with robust error handling
   */
  async extractFromDOCXRobustly(file: Buffer): Promise<{
    text: string;
    quality: number;
    method: string;
    metadata?: any;
  }> {
    try {
      const result = await mammoth.extractRawText({ buffer: file });
      
      if (result.value && result.value.length > 20) {
        return {
          text: result.value,
          quality: 90,
          method: 'mammoth',
          metadata: { 
            warnings: result.messages,
            hasImages: result.messages.some(m => m.message.includes('image'))
          }
        };
      }
    } catch (error) {
      console.warn('DOCX extraction failed:', error);
    }
    
    // Fallback to ZIP parsing
    return this.extractFromDOCXViaZip(file);
  }

  /**
   * Fallback DOCX extraction via ZIP parsing
   */
  extractFromDOCXViaZip(file: Buffer): any {
    // Simplified ZIP parsing for DOCX
    const text = file.toString('utf8');
    const xmlMatch = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    
    if (xmlMatch) {
      const extractedText = xmlMatch
        .map(match => match.replace(/<[^>]+>/g, ''))
        .join(' ');
      
      return {
        text: extractedText,
        quality: 70,
        method: 'zip_parse'
      };
    }
    
    return {
      text: 'DOCX extraction failed. Please save as TXT format.',
      quality: 15,
      method: 'failed'
    };
  }

  /**
   * Extract from RTF robustly
   */
  extractFromRTFRobustly(file: Buffer): any {
    const rtfText = file.toString('utf8');
    
    // Remove RTF control sequences
    let plainText = rtfText
      .replace(/\{\\[^}]+\}/g, '') // Remove RTF groups
      .replace(/\\[a-z]+\d*/g, '') // Remove RTF commands
      .replace(/\{|\}/g, '') // Remove braces
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      text: plainText,
      quality: plainText.length > 50 ? 80 : 30,
      method: 'rtf_parse'
    };
  }

  /**
   * Extract from DOC files
   */
  extractFromDOCRobustly(file: Buffer): any {
    // Basic DOC extraction - in production use a proper library
    const text = file.toString('binary');
    const readableText = text
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      text: readableText.length > 50 ? readableText : 'DOC format requires conversion to TXT',
      quality: readableText.length > 50 ? 60 : 20,
      method: 'doc_binary'
    };
  }

  /**
   * Intelligent file type detection and extraction
   */
  extractWithIntelligentDetection(file: Buffer): any {
    const header = file.subarray(0, 100).toString('hex');
    
    // Check for PDF signature
    if (header.startsWith('255044462d')) {
      return this.extractFromPDFRobustly(file);
    }
    
    // Check for ZIP-based formats (DOCX)
    if (header.startsWith('504b0304')) {
      return this.extractFromDOCXRobustly(file);
    }
    
    // Default to text
    return {
      text: file.toString('utf8'),
      quality: 70,
      method: 'auto_detect_text'
    };
  }

  /**
   * Advanced text preprocessing and cleaning
   */
  preprocessText(rawText: string): string {
    let cleaned = rawText;
    
    // Remove HTML if present
    if (cleaned.includes('<') && cleaned.includes('>')) {
      cleaned = stripHtml(cleaned).result;
    }
    
    // Normalize whitespace
    cleaned = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\f/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n');
    
    // Remove headers/footers patterns
    cleaned = this.removeHeadersFooters(cleaned);
    
    // Fix common OCR errors
    cleaned = this.fixCommonOCRErrors(cleaned);
    
    // Standardize clinical terminology
    cleaned = this.standardizeClinicalTerms(cleaned);
    
    return cleaned.trim();
  }

  /**
   * Remove headers and footers
   */
  removeHeadersFooters(text: string): string {
    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
      const cleanLine = line.trim().toLowerCase();
      
      // Skip likely headers/footers
      if (cleanLine.length < 3) return false;
      if (cleanLine.match(/^page \d+/)) return false;
      if (cleanLine.match(/^\d+\/\d+\/\d+$/)) return false;
      if (cleanLine.match(/^confidential/)) return false;
      if (cleanLine.includes('www.') || cleanLine.includes('@')) return false;
      
      return true;
    });
    
    return filteredLines.join('\n');
  }

  /**
   * Fix common OCR errors in clinical documents
   */
  fixCommonOCRErrors(text: string): string {
    const corrections = {
      '0lient': 'client',
      'c1ient': 'client',
      'sess10n': 'session',
      'theraplst': 'therapist',
      'anxlety': 'anxiety',
      'depress10n': 'depression',
      'c0ping': 'coping',
      'fee1ing': 'feeling',
      'em0tional': 'emotional',
    };
    
    let corrected = text;
    for (const [error, correction] of Object.entries(corrections)) {
      corrected = corrected.replace(new RegExp(error, 'gi'), correction);
    }
    
    return corrected;
  }

  /**
   * Standardize clinical terminology
   */
  standardizeClinicalTerms(text: string): string {
    const standardizations = {
      'pt': 'patient',
      'tx': 'treatment',
      'dx': 'diagnosis',
      'hx': 'history',
      'sx': 'symptoms',
      'fx': 'functioning',
    };
    
    let standardized = text;
    for (const [abbr, full] of Object.entries(standardizations)) {
      standardized = standardized.replace(
        new RegExp(`\\b${abbr}\\b`, 'gi'), 
        full
      );
    }
    
    return standardized;
  }

  /**
   * Multi-pass AI analysis with comprehensive extraction
   */
  async performMultiPassAIAnalysis(text: string, fileName: string): Promise<ExtractedClinicalData> {
    console.log('🤖 Starting multi-pass AI analysis...');
    
    const analysisPrompt = `
You are an expert clinical psychologist with 20+ years of experience in therapeutic documentation and clinical assessment. Analyze this clinical document with the highest level of professional expertise.

DOCUMENT TO ANALYZE:
"""
${text}
"""

FILENAME: ${fileName}

Perform a comprehensive clinical analysis and extract the following information. Be extremely thorough and clinically sophisticated in your analysis:

1. CLIENT IDENTIFICATION:
   - Extract the client's name with high confidence
   - Consider variations, nicknames, or partial names
   - Provide alternative interpretations if ambiguous

2. SESSION DATE EXTRACTION:
   - Identify the exact session date
   - Support multiple date formats (MM/DD/YYYY, DD/MM/YYYY, Month DD, YYYY, etc.)
   - Consider context clues and document metadata
   - Provide alternative date interpretations if multiple dates are present

3. CLINICAL CONTENT ANALYSIS:
   - Session type (individual, group, family, couples, intake, etc.)
   - Primary therapeutic themes and topics discussed
   - Emotional states and mood indicators
   - Interventions and techniques used
   - Risk assessment and safety concerns
   - Progress indicators and therapeutic gains
   - Homework assignments or next steps
   - Treatment plan updates

4. PROFESSIONAL ASSESSMENT:
   - Rate the session progress (1-10 scale)
   - Identify risk level (low, moderate, high, critical)
   - Extract clinical insights and patterns
   - Note any immediate concerns or follow-up needs

Return your analysis in this exact JSON format:
{
  "clientName": "extracted client name",
  "sessionDate": "YYYY-MM-DD format",
  "sessionType": "type of session",
  "content": "comprehensive session summary",
  "themes": ["theme1", "theme2", "theme3"],
  "emotions": ["emotion1", "emotion2", "emotion3"],
  "interventions": ["intervention1", "intervention2"],
  "riskLevel": "low|moderate|high|critical",
  "progressRating": 1-10,
  "nextSteps": ["step1", "step2"],
  "clinicalNotes": "professional clinical observations",
  "confidence": 1-100,
  "alternativeInterpretations": {
    "clientName": ["alternative1", "alternative2"],
    "sessionDate": ["date1", "date2"],
    "reasoning": "explanation of alternatives"
  }
}

Be extremely thorough and professional. This is critical clinical documentation.
`;

    try {
      // Try Anthropic first (more reliable for complex analysis)
      console.log('🔄 Using Anthropic Claude for analysis...');
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.1, // Low temperature for consistency
        messages: [
          {
            role: "user",
            content: analysisPrompt
          }
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const analysisText = content.text;
        
        // Extract JSON from response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysisResult = JSON.parse(jsonMatch[0]);
          console.log('✅ Anthropic analysis completed successfully');
          return analysisResult;
        }
      }
    } catch (error) {
      console.warn('⚠️ Anthropic analysis failed, trying OpenAI:', error);
    }

    // Fallback to OpenAI
    try {
      console.log('🔄 Using OpenAI GPT-4o for analysis...');
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert clinical therapist. Analyze the provided clinical document and extract structured data in JSON format."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const result = response.choices[0]?.message?.content;
      if (result) {
        console.log('✅ OpenAI analysis completed successfully');
        return JSON.parse(result);
      }
    } catch (error) {
      console.error('❌ Both AI providers failed:', error);
    }

    // Manual fallback if AI fails
    return this.performManualFallbackAnalysis(text);
  }

  /**
   * Manual fallback analysis when AI fails
   */
  performManualFallbackAnalysis(text: string): ExtractedClinicalData {
    console.log('🔧 Performing manual fallback analysis...');
    
    return {
      clientName: this.extractClientNameManually(text) || 'Unknown Client',
      sessionDate: this.extractDateManually(text) || new Date().toISOString().split('T')[0],
      sessionType: this.extractSessionTypeManually(text) || 'individual',
      content: text.substring(0, 1000) + (text.length > 1000 ? '...' : ''),
      themes: this.extractThemesManually(text),
      emotions: this.extractEmotionsManually(text),
      interventions: this.extractInterventionsManually(text),
      riskLevel: this.assessRiskManually(text),
      progressRating: 5, // Neutral default
      nextSteps: this.extractNextStepsManually(text),
      clinicalNotes: 'Manual analysis - AI processing unavailable',
      confidence: 60, // Lower confidence for manual analysis
      alternativeInterpretations: {
        clientName: [],
        sessionDate: [],
        reasoning: 'Manual fallback analysis performed'
      }
    };
  }

  /**
   * Manual client name extraction using patterns
   */
  extractClientNameManually(text: string): string | null {
    const namePatterns = [
      /(?:client|patient|individual):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:name|client name):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /session\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+session/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Manual date extraction using patterns
   */
  extractDateManually(text: string): string | null {
    const datePatterns = [
      /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
      /\b(\d{1,2}-\d{1,2}-\d{4})\b/,
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i,
      /\b(\d{4}-\d{2}-\d{2})\b/,
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const parsedDate = new Date(match[1]);
        if (isValid(parsedDate)) {
          return format(parsedDate, 'yyyy-MM-dd');
        }
      }
    }
    
    return null;
  }

  /**
   * Manual session type extraction
   */
  extractSessionTypeManually(text: string): string {
    const sessionTypes = [
      'individual', 'group', 'family', 'couples', 'intake', 
      'assessment', 'therapy', 'counseling', 'consultation'
    ];
    
    const lowerText = text.toLowerCase();
    for (const type of sessionTypes) {
      if (lowerText.includes(type)) {
        return type;
      }
    }
    
    return 'individual';
  }

  /**
   * Manual theme extraction
   */
  extractThemesManually(text: string): string[] {
    const themeKeywords = {
      'anxiety': ['anxiety', 'anxious', 'worry', 'nervous', 'panic'],
      'depression': ['depression', 'depressed', 'sad', 'hopeless', 'down'],
      'trauma': ['trauma', 'ptsd', 'flashback', 'triggered'],
      'relationships': ['relationship', 'partner', 'family', 'conflict'],
      'coping': ['coping', 'stress', 'management', 'strategies'],
      'grief': ['grief', 'loss', 'bereavement', 'mourning'],
      'anger': ['anger', 'angry', 'rage', 'frustration'],
    };
    
    const foundThemes: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        foundThemes.push(theme);
      }
    }
    
    return foundThemes;
  }

  /**
   * Manual emotion extraction
   */
  extractEmotionsManually(text: string): string[] {
    const emotions = [
      'happy', 'sad', 'angry', 'anxious', 'calm', 'excited', 
      'frustrated', 'hopeful', 'overwhelmed', 'peaceful'
    ];
    
    const foundEmotions: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const emotion of emotions) {
      if (lowerText.includes(emotion)) {
        foundEmotions.push(emotion);
      }
    }
    
    return foundEmotions;
  }

  /**
   * Manual intervention extraction
   */
  extractInterventionsManually(text: string): string[] {
    const interventions = [
      'cognitive restructuring', 'mindfulness', 'breathing exercises',
      'behavioral activation', 'exposure therapy', 'role playing',
      'homework assignment', 'psychoeducation', 'relaxation'
    ];
    
    const foundInterventions: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const intervention of interventions) {
      if (lowerText.includes(intervention.toLowerCase())) {
        foundInterventions.push(intervention);
      }
    }
    
    return foundInterventions;
  }

  /**
   * Manual risk assessment
   */
  assessRiskManually(text: string): 'low' | 'moderate' | 'high' | 'critical' {
    const highRiskKeywords = ['suicide', 'self-harm', 'cutting', 'killing', 'death wish'];
    const moderateRiskKeywords = ['depressed', 'hopeless', 'crisis', 'emergency'];
    
    const lowerText = text.toLowerCase();
    
    if (highRiskKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'critical';
    }
    
    if (moderateRiskKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'moderate';
    }
    
    return 'low';
  }

  /**
   * Manual next steps extraction
   */
  extractNextStepsManually(text: string): string[] {
    const nextStepPatterns = [
      /(?:next session|homework|assignment|follow.?up):\s*([^.]*)/gi,
      /(?:plan|goal|objective):\s*([^.]*)/gi,
    ];
    
    const steps: string[] = [];
    
    for (const pattern of nextStepPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        if (match[1] && match[1].trim()) {
          steps.push(match[1].trim());
        }
      }
    }
    
    return steps.length > 0 ? steps : ['Continue current treatment plan'];
  }

  /**
   * Robust date parsing with multiple format support
   */
  parseSessionDateRobustly(dateString: string, fullText: string): {
    date: Date;
    confidence: number;
    method: string;
  } | null {
    if (!dateString) return null;
    
    const dateFormats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'dd/MM/yyyy',
      'MM-dd-yyyy',
      'dd-MM-yyyy',
      'MMMM dd, yyyy',
      'MMM dd, yyyy',
      'dd MMMM yyyy',
      'dd MMM yyyy',
    ];
    
    // Try parsing with known formats
    for (const formatStr of dateFormats) {
      try {
        const parsed = parse(dateString, formatStr, new Date());
        if (isValid(parsed)) {
          return {
            date: parsed,
            confidence: 95,
            method: `format_${formatStr}`
          };
        }
      } catch (error) {
        // Continue to next format
      }
    }
    
    // Try natural language parsing
    try {
      const naturalDate = new Date(dateString);
      if (isValid(naturalDate)) {
        return {
          date: naturalDate,
          confidence: 80,
          method: 'natural_parse'
        };
      }
    } catch (error) {
      // Continue to fallback
    }
    
    // Fallback: extract from full text
    const extractedDate = this.extractDateFromContext(fullText);
    if (extractedDate) {
      return {
        date: extractedDate,
        confidence: 60,
        method: 'context_extraction'
      };
    }
    
    return null;
  }

  /**
   * Extract date from document context
   */
  extractDateFromContext(text: string): Date | null {
    const datePatterns = [
      /session\s+(?:on\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+session/i,
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const date = new Date(match[1]);
        if (isValid(date)) {
          return date;
        }
      }
    }
    
    return null;
  }

  /**
   * Intelligent client matching with fuzzy logic
   */
  async findClientIntelligently(
    extractedName: string, 
    therapistId: string
  ): Promise<{ id: string; confidence: number; name: string; method: string }> {
    try {
      const clients = await storage.getClients(therapistId);
      
      if (!extractedName || extractedName === 'Unknown Client') {
        // Return a default client or create new one
        return {
          id: await this.createNewClient('Unknown Client', therapistId),
          confidence: 30,
          name: 'Unknown Client',
          method: 'default_creation'
        };
      }
      
      const matches = clients.map(client => ({
        ...client,
        similarity: this.calculateNameSimilarity(extractedName, client.name)
      })).sort((a, b) => b.similarity - a.similarity);
      
      const bestMatch = matches[0];
      
      if (bestMatch && bestMatch.similarity > 0.8) {
        return {
          id: bestMatch.id,
          confidence: Math.round(bestMatch.similarity * 100),
          name: bestMatch.name,
          method: 'exact_match'
        };
      }
      
      if (bestMatch && bestMatch.similarity > 0.6) {
        return {
          id: bestMatch.id,
          confidence: Math.round(bestMatch.similarity * 100),
          name: bestMatch.name,
          method: 'fuzzy_match'
        };
      }
      
      // Create new client
      const newClientId = await this.createNewClient(extractedName, therapistId);
      return {
        id: newClientId,
        confidence: 70,
        name: extractedName,
        method: 'new_client_created'
      };
      
    } catch (error) {
      console.error('Error finding client:', error);
      
      // Fallback: create new client
      const newClientId = await this.createNewClient(extractedName || 'Unknown Client', therapistId);
      return {
        id: newClientId,
        confidence: 50,
        name: extractedName || 'Unknown Client',
        method: 'error_fallback'
      };
    }
  }

  /**
   * Calculate name similarity using multiple algorithms
   */
  calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    
    // Exact match
    if (n1 === n2) return 1.0;
    
    // Contains match
    if (n1.includes(n2) || n2.includes(n1)) return 0.9;
    
    // Levenshtein distance
    const levenshtein = this.calculateLevenshtein(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    const levenshteinSimilarity = 1 - (levenshtein / maxLength);
    
    // Token similarity (for first/last names)
    const tokens1 = n1.split(/\s+/);
    const tokens2 = n2.split(/\s+/);
    const tokenSimilarity = this.calculateTokenSimilarity(tokens1, tokens2);
    
    // Return weighted average
    return (levenshteinSimilarity * 0.6) + (tokenSimilarity * 0.4);
  }

  /**
   * Calculate Levenshtein distance
   */
  calculateLevenshtein(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Calculate token-based similarity
   */
  calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 && tokens2.length === 0) return 1;
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    let matches = 0;
    const totalTokens = Math.max(tokens1.length, tokens2.length);
    
    for (const token1 of tokens1) {
      for (const token2 of tokens2) {
        if (token1 === token2) {
          matches++;
          break;
        }
      }
    }
    
    return matches / totalTokens;
  }

  /**
   * Create new client with extracted name
   */
  async createNewClient(name: string, therapistId: string): Promise<string> {
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const newClient = await storage.createClient({
      therapistId,
      name: `${firstName} ${lastName}`.trim(),
      email: '',
      phone: '',
      status: 'active' as const,
      tags: ['auto-created']
    });
    
    console.log(`✅ Created new client: ${name} (ID: ${newClient.id})`);
    return newClient.id;
  }

  /**
   * Find matching session with intelligent date matching
   */
  async findSessionIntelligently(
    clientId: string,
    sessionDate: Date | undefined,
    therapistId: string
  ): Promise<{ id: string; confidence: number } | null> {
    if (!sessionDate) return null;
    
    try {
      const sessions = await storage.getSessions(therapistId);
      
      // Find sessions on exact date
      const exactMatches = sessions.filter(session => {
        const sessionDateOnly = new Date(session.scheduledAt).toDateString();
        const targetDateOnly = sessionDate.toDateString();
        return sessionDateOnly === targetDateOnly;
      });
      
      if (exactMatches.length > 0) {
        return {
          id: exactMatches[0].id,
          confidence: 95
        };
      }
      
      // Find closest session within 3 days
      const closeMatches = sessions.filter(session => {
        const timeDiff = Math.abs(new Date(session.scheduledAt).getTime() - sessionDate.getTime());
        const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
        return daysDiff <= 3;
      });
      
      if (closeMatches.length > 0) {
        // Sort by closest date
        closeMatches.sort((a, b) => {
          const diffA = Math.abs(new Date(a.scheduledAt).getTime() - sessionDate.getTime());
          const diffB = Math.abs(new Date(b.scheduledAt).getTime() - sessionDate.getTime());
          return diffA - diffB;
        });
        
        return {
          id: closeMatches[0].id,
          confidence: 75
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('Error finding matching session:', error);
      return null;
    }
  }

  /**
   * Validate extracted data and calculate scores
   */
  validateExtractedData(
    extractionResult: any,
    aiAnalysis: ExtractedClinicalData,
    parsedDate: any,
    clientMatch: any
  ): {
    textExtractionScore: number;
    aiAnalysisScore: number;
    dateValidationScore: number;
    clientMatchScore: number;
    overallQuality: number;
  } {
    const textScore = Math.min(100, extractionResult.quality);
    const aiScore = aiAnalysis.confidence;
    const dateScore = parsedDate?.confidence || 0;
    const clientScore = clientMatch.confidence;
    
    const overallQuality = Math.round(
      (textScore * 0.2) + 
      (aiScore * 0.4) + 
      (dateScore * 0.2) + 
      (clientScore * 0.2)
    );
    
    return {
      textExtractionScore: textScore,
      aiAnalysisScore: aiScore,
      dateValidationScore: dateScore,
      clientMatchScore: clientScore,
      overallQuality
    };
  }

  /**
   * Determine if manual review is needed
   */
  shouldRequireManualReview(validation: any, aiAnalysis: ExtractedClinicalData): boolean {
    // Always require review for critical risk
    if (aiAnalysis.riskLevel === 'critical') return true;
    
    // Require review for low confidence
    if (validation.overallQuality < 70) return true;
    
    // Require review for unclear client identification
    if (validation.clientMatchScore < 60) return true;
    
    // Require review for date ambiguity
    if (validation.dateValidationScore < 50) return true;
    
    return false;
  }

  /**
   * Validate and sanitize progress rating
   */
  validateProgressRating(rating: any): number {
    // Handle string values like "Unable to rate", "N/A", etc.
    if (typeof rating === 'string') {
      const numericRating = parseInt(rating);
      if (isNaN(numericRating)) {
        console.warn(`Invalid progress rating: "${rating}", defaulting to 5`);
        return 5; // Default middle value
      }
      return Math.max(1, Math.min(10, numericRating));
    }
    
    // Handle numeric values
    if (typeof rating === 'number') {
      if (isNaN(rating)) return 5;
      return Math.max(1, Math.min(10, Math.round(rating)));
    }
    
    // Default fallback
    console.warn(`Unknown progress rating type: ${typeof rating}, defaulting to 5`);
    return 5;
  }

  /**
   * Create enhanced progress note with all extracted data
   */
  async createEnhancedProgressNote(
    clientId: string,
    sessionId: string | undefined,
    aiAnalysis: ExtractedClinicalData,
    sessionDate: Date | undefined,
    therapistId: string,
    needsManualReview: boolean
  ): Promise<{ id: string }> {
    const progressNote = await storage.createProgressNote({
      clientId,
      sessionId: sessionId || null,
      therapistId,
      sessionDate: sessionDate || new Date(),
      content: aiAnalysis.content,
      tags: [...(aiAnalysis.themes || []), ...(aiAnalysis.emotions || [])],
      riskLevel: aiAnalysis.riskLevel,
      progressRating: this.validateProgressRating(aiAnalysis.progressRating),
      processingNotes: aiAnalysis.clinicalNotes,
      // needsReview: needsManualReview, // Remove if not in schema
      // aiGenerated: true, // Remove if not in schema
      metadata: {
        extractedThemes: aiAnalysis.themes,
        extractedEmotions: aiAnalysis.emotions,
        interventions: aiAnalysis.interventions,
        nextSteps: aiAnalysis.nextSteps,
        clinicalNotes: aiAnalysis.clinicalNotes,
        alternativeInterpretations: aiAnalysis.alternativeInterpretations
      }
    });
    
    return progressNote;
  }

  /**
   * Save processed document with metadata
   */
  async saveProcessedDocument(
    file: Buffer,
    fileName: string,
    clientId: string,
    therapistId: string,
    extractedText: string,
    progressNoteId: string,
    aiAnalysis: ExtractedClinicalData
  ): Promise<void> {
    await storage.createDocument({
      clientId,
      therapistId,
      fileName: fileName,
      fileType: fileName.split('.').pop() || 'unknown',
      filePath: `/uploads/${fileName}`, // Add required filePath
      extractedText,
      fileSize: file.length,
      metadata: {
        aiAnalysis: {
          themes: aiAnalysis.themes,
          emotions: aiAnalysis.emotions,
          riskLevel: aiAnalysis.riskLevel,
          confidence: aiAnalysis.confidence
        },
        processingDate: new Date().toISOString()
      }
    });
  }

  /**
   * Generate detailed processing notes
   */
  generateDetailedProcessingNotes(
    extractionResult: any,
    aiAnalysis: ExtractedClinicalData,
    parsedDate: any,
    clientMatch: any,
    validation: any
  ): string {
    const notes = [];
    
    notes.push(`📄 Text Extraction: ${extractionResult.method} (${extractionResult.quality}% quality)`);
    notes.push(`🤖 AI Analysis: ${aiAnalysis.confidence}% confidence`);
    notes.push(`📅 Date Parsing: ${parsedDate?.method || 'failed'} (${parsedDate?.confidence || 0}% confidence)`);
    notes.push(`👤 Client Match: ${clientMatch.method} (${clientMatch.confidence}% confidence)`);
    notes.push(`✅ Overall Quality: ${validation.overallQuality}%`);
    
    if (aiAnalysis.riskLevel !== 'low') {
      notes.push(`⚠️ Risk Level: ${aiAnalysis.riskLevel.toUpperCase()}`);
    }
    
    if (aiAnalysis.alternativeInterpretations?.reasoning) {
      notes.push(`🔍 Alternative Interpretations Available`);
    }
    
    return notes.join('\n');
  }
}

// Export singleton instance
export const enhancedDocumentProcessor = new EnhancedDocumentProcessor();