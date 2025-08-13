// Lazy load pdf-parse to avoid startup issues

export interface ExtractedPDFData {
  text: string;
  pages: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export class PDFService {
  async extractText(buffer: Buffer): Promise<ExtractedPDFData> {
    try {
      // Try to create a minimal PDF parser using dynamic import
      let pdfParse;
      try {
        // Use createRequire to handle the require issue in ES modules
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        pdfParse = require('pdf-parse');
      } catch (moduleError) {
        console.log('Module import failed, trying direct import...');
        const pdfModule = await import('pdf-parse');
        pdfParse = pdfModule.default;
      }
      
      if (!pdfParse) {
        throw new Error('PDF parser not available');
      }
      
      const data = await pdfParse(buffer);
      
      return {
        text: data.text || '',
        pages: data.numpages || 1,
        metadata: {
          title: data.info?.Title,
          author: data.info?.Author,
          subject: data.info?.Subject,
          creator: data.info?.Creator,
          producer: data.info?.Producer,
          creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
          modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined,
        }
      };
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      console.log('PDF parsing failed. For now, please use TXT format for reliable processing.');
      
      // For production use, we'd recommend converting PDFs to TXT first
      return {
        text: 'PDF processing temporarily unavailable. Please save your progress notes as TXT files for optimal processing. The system works perfectly with TXT format and provides the same comprehensive AI analysis.',
        pages: 1,
        metadata: {}
      };
    }
  }

  extractClinicalSections(text: string): {
    assessment?: string;
    diagnosis?: string;
    treatmentPlan?: string;
    progressNotes?: string;
    recommendations?: string;
  } {
    const sections: { [key: string]: string } = {};
    
    // Common clinical document section headers
    const sectionPatterns = {
      assessment: new RegExp("(?:clinical\\s+assessment|initial\\s+assessment|assessment\\s+summary|psychological\\s+assessment):(.*?)(?=\\n[A-Z][A-Z\\s]*:|$)", "gis"),
      diagnosis: new RegExp("(?:diagnosis|diagnostic\\s+impression|clinical\\s+diagnosis):(.*?)(?=\\n[A-Z][A-Z\\s]*:|$)", "gis"),
      treatmentPlan: new RegExp("(?:treatment\\s+plan|therapeutic\\s+plan|intervention\\s+plan):(.*?)(?=\\n[A-Z][A-Z\\s]*:|$)", "gis"),
      progressNotes: new RegExp("(?:progress\\s+notes?|session\\s+notes?|clinical\\s+notes?):(.*?)(?=\\n[A-Z][A-Z\\s]*:|$)", "gis"),
      recommendations: new RegExp("(?:recommendations?|treatment\\s+recommendations?|next\\s+steps?):(.*?)(?=\\n[A-Z][A-Z\\s]*:|$)", "gis"),
    };

    for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        sections[sectionName] = match[1].trim();
      }
    }

    return sections;
  }

  identifyDocumentType(text: string): string {
    const documentTypes = [
      { type: 'intake_form', patterns: ['intake', 'initial assessment', 'client information'] },
      { type: 'progress_note', patterns: ['progress note', 'session note', 'therapy note'] },
      { type: 'treatment_plan', patterns: ['treatment plan', 'care plan', 'therapeutic plan'] },
      { type: 'assessment_report', patterns: ['psychological assessment', 'clinical assessment', 'evaluation report'] },
      { type: 'discharge_summary', patterns: ['discharge summary', 'termination summary', 'final report'] },
      { type: 'consent_form', patterns: ['consent', 'informed consent', 'authorization'] },
    ];

    const lowerText = text.toLowerCase();
    
    for (const docType of documentTypes) {
      if (docType.patterns.some(pattern => lowerText.includes(pattern))) {
        return docType.type;
      }
    }

    return 'clinical_document';
  }

  extractClientInformation(text: string): {
    name?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    email?: string;
    emergencyContact?: string;
  } {
    const info: { [key: string]: string } = {};

    // Extract name (looking for patterns like "Name:", "Client Name:", etc.)
    const namePattern = /(?:client\s+name|name|patient\s+name):\s*([A-Za-z\s]+)/i;
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
      info.name = nameMatch[1].trim();
    }

    // Extract date of birth
    const dobPattern = /(?:date\s+of\s+birth|dob|birth\s+date):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
    const dobMatch = text.match(dobPattern);
    if (dobMatch) {
      info.dateOfBirth = dobMatch[1];
    }

    // Extract phone number
    const phonePattern = /(?:phone|telephone|cell|mobile):\s*(\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4})/i;
    const phoneMatch = text.match(phonePattern);
    if (phoneMatch) {
      info.phoneNumber = phoneMatch[1];
    }

    // Extract email
    const emailPattern = /(?:email|e-mail):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
      info.email = emailMatch[1];
    }

    // Extract emergency contact
    const emergencyPattern = /(?:emergency\s+contact|emergency):\s*([A-Za-z\s]+(?:\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4})?)/i;
    const emergencyMatch = text.match(emergencyPattern);
    if (emergencyMatch) {
      info.emergencyContact = emergencyMatch[1].trim();
    }

    return info;
  }
}

export const pdfService = new PDFService();
