// server/services/pdfService.ts
import { Buffer } from 'node:buffer';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface PDFData {
  text: string;
  numpages?: number;
  numrender?: number;
  info?: any;
  metadata?: any;
  version?: string;
}

class PDFService {
  private pdfParse: any = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Auto-initialize on construction
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🔄 Initializing PDF service...');
    
    // Try multiple PDF parsing libraries
    const libraries = [
      { name: 'pdf-parse-fork', import: () => import('pdf-parse-fork') },
      { name: 'pdf-parse', import: () => import('pdf-parse') },
      { name: 'pdfjs-dist', import: () => import('pdfjs-dist') },
    ];

    for (const lib of libraries) {
      try {
        const module = await lib.import();
        this.pdfParse = module.default || module;
        console.log(`✅ PDF service initialized with ${lib.name}`);
        this.initialized = true;
        return;
      } catch (error) {
        console.log(`⚠️ Could not load ${lib.name}:`, (error as Error).message);
      }
    }

    console.warn('⚠️ No PDF parsing library available - using fallback extraction');
    this.initialized = true;
  }

  async extractText(buffer: Buffer): Promise<string> {
    // Ensure initialization is complete
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!buffer || buffer.length === 0) {
      throw new Error('Invalid or empty PDF buffer');
    }

    // Check if it's actually a PDF
    const pdfHeader = buffer.slice(0, 5).toString();
    if (!pdfHeader.includes('%PDF')) {
      throw new Error('Buffer does not appear to be a valid PDF file');
    }

    if (this.pdfParse) {
      try {
        const data: PDFData = await this.pdfParse(buffer);
        
        if (!data.text) {
          console.warn('PDF parsed but no text extracted');
          return this.fallbackExtraction(buffer);
        }
        
        console.log(`✅ Extracted ${data.text.length} characters from PDF`);
        return this.cleanText(data.text);
      } catch (error) {
        console.error('PDF parse error:', error);
        return this.fallbackExtraction(buffer);
      }
    }

    return this.fallbackExtraction(buffer);
  }

  async extractFromFile(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      return this.extractText(buffer);
    } catch (error) {
      throw new Error(`Failed to read PDF file: ${(error as Error).message}`);
    }
  }

  private fallbackExtraction(buffer: Buffer): string {
    console.log('📄 Using fallback PDF extraction...');
    
    try {
      // Look for text streams in the PDF
      const bufferStr = buffer.toString('binary');
      const textMatches: string[] = [];
      
      // Extract text between BT (Begin Text) and ET (End Text) markers
      const textRegex = /BT\s*(.*?)\s*ET/gs;
      let match;
      
      while ((match = textRegex.exec(bufferStr)) !== null) {
        const textContent = match[1];
        
        // Extract text from Tj and TJ operators
        const tjRegex = /\((.*?)\)\s*Tj/g;
        const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
        
        let tjMatch;
        while ((tjMatch = tjRegex.exec(textContent)) !== null) {
          textMatches.push(this.decodePDFString(tjMatch[1]));
        }
        
        while ((tjMatch = tjArrayRegex.exec(textContent)) !== null) {
          const arrayContent = tjMatch[1];
          const stringRegex = /\((.*?)\)/g;
          let stringMatch;
          while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
            textMatches.push(this.decodePDFString(stringMatch[1]));
          }
        }
      }
      
      const extractedText = textMatches.join(' ');
      
      if (extractedText.length < 50) {
        // If we couldn't extract much, try a simpler approach
        const simpleText = buffer.toString('utf8', 0, Math.min(buffer.length, 10000))
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        return simpleText.length > extractedText.length ? simpleText : extractedText;
      }
      
      return this.cleanText(extractedText);
    } catch (error) {
      console.error('Fallback extraction failed:', error);
      return '';
    }
  }

  private decodePDFString(str: string): string {
    // Decode PDF escape sequences
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\(\d{1,3})/g, (match, octal) => {
        return String.fromCharCode(parseInt(octal, 8));
      });
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[^\x20-\x7E\n\r]/g, '') // Remove non-printable chars
      .replace(/\n{3,}/g, '\n\n')     // Limit consecutive newlines
      .trim();
  }

  // Utility method to check if PDF parsing is available
  isAvailable(): boolean {
    return this.initialized && this.pdfParse !== null;
  }

  // Get service status
  getStatus(): { initialized: boolean; library: string | null } {
    return {
      initialized: this.initialized,
      library: this.pdfParse ? 'Available' : 'Fallback',
    };
  }
}

// Export singleton instance
export const pdfService = new PDFService();

// Export convenience functions
export const extractPdfText = (buffer: Buffer) => pdfService.extractText(buffer);
export const extractPdfFromFile = (filePath: string) => pdfService.extractFromFile(filePath);
export const isPdfServiceAvailable = () => pdfService.isAvailable();
export const getPdfServiceStatus = () => pdfService.getStatus();