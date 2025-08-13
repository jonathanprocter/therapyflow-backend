import { aiService } from './aiService';
import { anthropicService } from './anthropicService';

export interface DocumentMetadata {
  clientName?: string;
  appointmentDate?: string;
  sessionType?: string;
  documentType: 'progress_note' | 'assessment' | 'treatment_plan' | 'other';
  confidence: number;
  extractedText: string;
  processingNotes?: string[];
}

export interface BatchProcessingResult {
  totalFiles: number;
  successfullyProcessed: number;
  failedFiles: string[];
  documents: Array<{
    filename: string;
    metadata: DocumentMetadata;
    suggestedClientId?: string;
    suggestedSessionId?: string;
  }>;
}

export class DocumentProcessor {
  private readonly MAX_TEXT_LENGTH = 50000; // Limit text for AI processing

  async processDocument(buffer: Buffer, filename: string): Promise<DocumentMetadata> {
    try {
      const text = await this.extractText(buffer, filename);
      const metadata = await this.analyzeDocument(text, filename);
      return {
        ...metadata,
        extractedText: text
      };
    } catch (error) {
      console.error(`Error processing document ${filename}:`, error);
      return {
        documentType: 'other',
        confidence: 0,
        extractedText: '',
        processingNotes: [`Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async batchProcess(files: Array<{buffer: Buffer, filename: string}>): Promise<BatchProcessingResult> {
    const results: BatchProcessingResult = {
      totalFiles: files.length,
      successfullyProcessed: 0,
      failedFiles: [],
      documents: []
    };

    for (const file of files) {
      try {
        const metadata = await this.processDocument(file.buffer, file.filename);
        
        if (metadata.confidence > 0.3) {
          results.successfullyProcessed++;
          results.documents.push({
            filename: file.filename,
            metadata,
            ...(await this.suggestMatches(metadata))
          });
        } else {
          results.failedFiles.push(file.filename);
        }
      } catch (error) {
        console.error(`Batch processing error for ${file.filename}:`, error);
        results.failedFiles.push(file.filename);
      }
    }

    return results;
  }

  private async extractText(buffer: Buffer, filename: string): Promise<string> {
    const extension = filename.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf':
        return await this.extractPdfText(buffer);
      case 'docx':
        return await this.extractDocxText(buffer);
      case 'txt':
        return buffer.toString('utf-8');
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractDocxText(buffer: Buffer): Promise<string> {
    try {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      // Fallback to basic XML parsing if mammoth fails
      try {
        const text = buffer.toString('utf-8');
        const textMatches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (textMatches) {
          return textMatches.map(match => 
            match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1')
          ).join(' ');
        }
        return text.replace(/[^\x20-\x7E\n\r]/g, '').trim();
      } catch (fallbackError) {
        throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async analyzeDocument(text: string, filename: string): Promise<Omit<DocumentMetadata, 'extractedText'>> {
    // Truncate text if too long
    const analyzableText = text.length > this.MAX_TEXT_LENGTH 
      ? text.substring(0, this.MAX_TEXT_LENGTH) + '...' 
      : text;

    try {
      // Try OpenAI first for document analysis
      const analysis = await this.analyzeWithOpenAI(analyzableText, filename);
      return analysis;
    } catch (openaiError) {
      console.error('OpenAI analysis failed, trying Anthropic:', openaiError);
      try {
        // Fallback to Anthropic
        const analysis = await this.analyzeWithAnthropic(analyzableText, filename);
        return analysis;
      } catch (anthropicError) {
        console.error('Both AI providers failed:', anthropicError);
        // Basic fallback analysis
        return this.basicAnalysis(text, filename);
      }
    }
  }

  private async analyzeWithOpenAI(text: string, filename: string): Promise<Omit<DocumentMetadata, 'extractedText'>> {
    const { aiService } = await import('./aiService');
    const response = await aiService.openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      max_tokens: 4096, // Maximum tokens for comprehensive document analysis
      temperature: 0.1, // Very low temperature for precise document analysis
      messages: [
        {
          role: "system",
          content: `You are a clinical document analysis AI specialized in processing therapy and medical documents.
          
          Analyze the provided document and extract:
          1. Client name (look for "Client:", "Patient:", names mentioned consistently)
          2. Appointment/session date (look for dates, timestamps, "Date:", "Session:")
          3. Session type (individual therapy, group therapy, assessment, intake, etc.)
          4. Document type (progress_note, assessment, treatment_plan, other)
          5. Confidence level (0-1) in the accuracy of extracted information
          
          Return JSON format:
          {
            "clientName": "extracted name or null",
            "appointmentDate": "YYYY-MM-DD or null",
            "sessionType": "session type or null", 
            "documentType": "progress_note|assessment|treatment_plan|other",
            "confidence": 0.8,
            "processingNotes": ["any relevant observations"]
          }`
        },
        {
          role: "user",
          content: `Document filename: ${filename}\n\nDocument content:\n${text}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      clientName: result.clientName || undefined,
      appointmentDate: result.appointmentDate || undefined,
      sessionType: result.sessionType || undefined,
      documentType: result.documentType || 'other',
      confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
      processingNotes: result.processingNotes || []
    };
  }

  private async analyzeWithAnthropic(text: string, filename: string): Promise<Omit<DocumentMetadata, 'extractedText'>> {
    // Use basic analysis for now since we can't easily access Anthropic here
    return this.basicAnalysis(text, filename);
  }

  private basicAnalysis(text: string, filename: string): Omit<DocumentMetadata, 'extractedText'> {
    const processingNotes: string[] = ['Fallback to basic text analysis'];
    
    // Basic name extraction patterns
    const namePatterns = [
      /(?:Client|Patient|Name):\s*([A-Za-z\s]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s|,|\.|$)/
    ];
    
    let clientName: string | undefined;
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        clientName = match[1].trim();
        break;
      }
    }

    // Basic date extraction
    const datePatterns = [
      /(?:Date|Session):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
    ];
    
    let appointmentDate: string | undefined;
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          appointmentDate = parsed.toISOString().split('T')[0];
          break;
        }
      }
    }

    // Document type detection
    let documentType: DocumentMetadata['documentType'] = 'other';
    const lower = text.toLowerCase();
    if (lower.includes('progress note') || lower.includes('session note')) {
      documentType = 'progress_note';
    } else if (lower.includes('assessment') || lower.includes('evaluation')) {
      documentType = 'assessment';
    } else if (lower.includes('treatment plan') || lower.includes('care plan')) {
      documentType = 'treatment_plan';
    }

    return {
      clientName,
      appointmentDate,
      documentType,
      confidence: 0.4, // Lower confidence for basic analysis
      processingNotes
    };
  }

  private async suggestMatches(metadata: DocumentMetadata): Promise<{
    suggestedClientId?: string;
    suggestedSessionId?: string;
  }> {
    // This would integrate with your database to find matching clients and sessions
    // For now, return empty suggestions
    return {};
  }
}

export const documentProcessor = new DocumentProcessor();