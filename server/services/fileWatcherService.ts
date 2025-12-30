/**
 * File Watcher Service
 * Monitors a designated folder for dropped documents and processes them automatically
 *
 * Supports:
 * - Session transcripts (txt, docx, pdf) -> Progress notes
 * - Progress notes -> Link to appointments
 * - General documents -> AI classification and processing
 */

import { promises as fs } from 'fs';
import path from 'path';
import { storage } from '../storage';
import { enhancedDocumentProcessor } from './enhanced-document-processor';
import { aiService } from './aiService';

interface WatchedFile {
  path: string;
  name: string;
  size: number;
  type: string;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: any;
}

interface ProcessingResult {
  success: boolean;
  documentId?: string;
  clientId?: string;
  sessionId?: string;
  progressNoteId?: string;
  documentType?: string;
  message: string;
}

interface WatchFolderConfig {
  path: string;
  therapistId: string;
  pollIntervalMs: number;
  processedSubfolder: string;
  errorSubfolder: string;
}

class FileWatcherService {
  private config: WatchFolderConfig;
  private isWatching: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private processedFiles: Map<string, WatchedFile> = new Map();
  private fileStabilityMap: Map<string, { size: number; checkCount: number }> = new Map();

  constructor() {
    // Default configuration - can be overridden via environment variables
    this.config = {
      path: process.env.WATCH_FOLDER_PATH || path.join(process.cwd(), 'watch-folder'),
      therapistId: process.env.DEFAULT_THERAPIST_ID || 'dr-jonathan-procter',
      pollIntervalMs: parseInt(process.env.WATCH_POLL_INTERVAL || '5000'),
      processedSubfolder: 'processed',
      errorSubfolder: 'errors'
    };
  }

  /**
   * Initialize the watch folder structure
   */
  async initialize(): Promise<void> {
    try {
      // Create main watch folder
      await fs.mkdir(this.config.path, { recursive: true });

      // Create subfolders
      await fs.mkdir(path.join(this.config.path, this.config.processedSubfolder), { recursive: true });
      await fs.mkdir(path.join(this.config.path, this.config.errorSubfolder), { recursive: true });

      // Create instructions file
      const instructionsPath = path.join(this.config.path, 'README.txt');
      const instructions = `
TherapyFlow Document Watch Folder
=================================

Drop documents here for automatic processing:

SUPPORTED FILE TYPES:
- .txt  - Session transcripts (plain text)
- .docx - Session transcripts or notes (Word documents)
- .pdf  - Progress notes or clinical documents

FILE NAMING CONVENTION (recommended):
- Use client name in filename for automatic matching
- Examples:
  - "John Smith - Session 2024-01-15.txt"
  - "Jane Doe Transcript.docx"
  - "Progress Note - Mike Johnson 2024-01-20.pdf"

PROCESSING:
- Files are automatically detected every ${this.config.pollIntervalMs / 1000} seconds
- Successfully processed files are moved to: ./${this.config.processedSubfolder}/
- Files with errors are moved to: ./${this.config.errorSubfolder}/

DOCUMENT TYPES DETECTED:
1. Session Transcripts -> Converted to progress notes
2. Progress Notes -> Linked to client appointments
3. Treatment Plans -> Associated with client records
4. General Documents -> Classified and stored

For questions, contact support@therapyflow.com
`;

      await fs.writeFile(instructionsPath, instructions.trim());

      console.log(`[FileWatcher] Initialized watch folder at: ${this.config.path}`);
    } catch (error) {
      console.error('[FileWatcher] Failed to initialize watch folder:', error);
      throw error;
    }
  }

  /**
   * Start watching the folder for new files
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      console.log('[FileWatcher] Already watching');
      return;
    }

    await this.initialize();
    this.isWatching = true;

    console.log(`[FileWatcher] Started watching: ${this.config.path}`);
    console.log(`[FileWatcher] Poll interval: ${this.config.pollIntervalMs}ms`);

    // Initial scan
    await this.scanForFiles();

    // Set up polling interval
    this.pollInterval = setInterval(async () => {
      await this.scanForFiles();
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isWatching = false;
    console.log('[FileWatcher] Stopped watching');
  }

  /**
   * Scan the watch folder for new files
   */
  private async scanForFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.path);

      for (const fileName of files) {
        // Skip subfolders and system files
        if (fileName === this.config.processedSubfolder ||
            fileName === this.config.errorSubfolder ||
            fileName.startsWith('.') ||
            fileName === 'README.txt') {
          continue;
        }

        const filePath = path.join(this.config.path, fileName);
        const stats = await fs.stat(filePath);

        // Skip directories
        if (stats.isDirectory()) continue;

        // Check if file is stable (not still being written)
        const isStable = await this.checkFileStability(filePath, stats.size);
        if (!isStable) continue;

        // Skip already processed files
        if (this.processedFiles.has(filePath)) continue;

        // Check file extension
        const ext = path.extname(fileName).toLowerCase();
        if (!['.txt', '.docx', '.pdf', '.doc'].includes(ext)) {
          console.log(`[FileWatcher] Skipping unsupported file type: ${fileName}`);
          continue;
        }

        // Process the file
        await this.processFile(filePath, fileName);
      }
    } catch (error) {
      console.error('[FileWatcher] Error scanning folder:', error);
    }
  }

  /**
   * Check if file is stable (finished being written)
   */
  private async checkFileStability(filePath: string, currentSize: number): Promise<boolean> {
    const existing = this.fileStabilityMap.get(filePath);

    if (!existing) {
      // First time seeing this file, start tracking
      this.fileStabilityMap.set(filePath, { size: currentSize, checkCount: 1 });
      return false;
    }

    if (existing.size !== currentSize) {
      // File size changed, still being written
      this.fileStabilityMap.set(filePath, { size: currentSize, checkCount: 1 });
      return false;
    }

    // File size hasn't changed
    existing.checkCount++;

    // Require 2 consecutive checks with same size (10 seconds minimum wait)
    if (existing.checkCount >= 2) {
      this.fileStabilityMap.delete(filePath);
      return true;
    }

    return false;
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, fileName: string): Promise<ProcessingResult> {
    console.log(`[FileWatcher] Processing: ${fileName}`);

    const watchedFile: WatchedFile = {
      path: filePath,
      name: fileName,
      size: (await fs.stat(filePath)).size,
      type: path.extname(fileName).toLowerCase(),
      status: 'processing'
    };

    this.processedFiles.set(filePath, watchedFile);

    try {
      // Read file content
      const buffer = await fs.readFile(filePath);

      // Determine document type based on content and filename
      const documentType = await this.classifyDocument(buffer, fileName);

      // Process based on type
      let result: ProcessingResult;

      switch (documentType) {
        case 'transcript':
          result = await this.processTranscript(buffer, fileName);
          break;
        case 'progress_note':
          result = await this.processProgressNote(buffer, fileName);
          break;
        case 'treatment_plan':
          result = await this.processTreatmentPlan(buffer, fileName);
          break;
        default:
          result = await this.processGenericDocument(buffer, fileName);
      }

      // Move file to processed folder
      const processedPath = path.join(
        this.config.path,
        this.config.processedSubfolder,
        `${Date.now()}_${fileName}`
      );
      await fs.rename(filePath, processedPath);

      watchedFile.status = 'completed';
      watchedFile.processedAt = new Date();
      watchedFile.result = result;

      console.log(`[FileWatcher] Successfully processed: ${fileName} -> ${result.documentType}`);
      return result;

    } catch (error) {
      console.error(`[FileWatcher] Error processing ${fileName}:`, error);

      // Move to error folder
      const errorPath = path.join(
        this.config.path,
        this.config.errorSubfolder,
        `${Date.now()}_${fileName}`
      );

      try {
        await fs.rename(filePath, errorPath);

        // Write error log
        const errorLogPath = errorPath + '.error.txt';
        await fs.writeFile(errorLogPath, `Error processing file: ${fileName}\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nTimestamp: ${new Date().toISOString()}`);
      } catch (moveError) {
        console.error('[FileWatcher] Could not move file to error folder:', moveError);
      }

      watchedFile.status = 'failed';
      watchedFile.error = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        message: `Failed to process: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Classify document type based on content
   */
  private async classifyDocument(buffer: Buffer, fileName: string): Promise<string> {
    const ext = path.extname(fileName).toLowerCase();
    let textContent = '';

    try {
      if (ext === '.txt') {
        textContent = buffer.toString('utf-8');
      } else if (ext === '.docx') {
        // Extract text from docx
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
      } else if (ext === '.pdf') {
        // For PDF, use enhanced processor
        return 'generic'; // Let enhanced processor handle classification
      }

      // Simple classification based on content keywords
      const lowerContent = textContent.toLowerCase();
      const lowerFileName = fileName.toLowerCase();

      // Check for transcript indicators
      if (lowerFileName.includes('transcript') ||
          lowerContent.includes('therapist:') ||
          lowerContent.includes('client:') ||
          lowerContent.includes('session transcript') ||
          (lowerContent.includes('speaker') && lowerContent.includes(':'))) {
        return 'transcript';
      }

      // Check for progress note indicators
      if (lowerFileName.includes('progress note') ||
          lowerFileName.includes('soap') ||
          lowerContent.includes('subjective:') ||
          lowerContent.includes('objective:') ||
          lowerContent.includes('assessment:') ||
          lowerContent.includes('plan:') ||
          lowerContent.includes('progress note')) {
        return 'progress_note';
      }

      // Check for treatment plan indicators
      if (lowerFileName.includes('treatment plan') ||
          lowerContent.includes('treatment goals') ||
          lowerContent.includes('treatment objectives') ||
          lowerContent.includes('interventions:')) {
        return 'treatment_plan';
      }

      return 'generic';
    } catch (error) {
      console.error('[FileWatcher] Classification error:', error);
      return 'generic';
    }
  }

  /**
   * Process a transcript file into a progress note
   */
  private async processTranscript(buffer: Buffer, fileName: string): Promise<ProcessingResult> {
    const ext = path.extname(fileName).toLowerCase();
    let transcriptText = '';

    if (ext === '.txt') {
      transcriptText = buffer.toString('utf-8');
    } else if (ext === '.docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      transcriptText = result.value;
    }

    // Extract client name from filename
    const clientName = this.extractClientNameFromFilename(fileName);

    // Find or create client
    const client = await this.findOrCreateClient(clientName);

    // Save as document first
    const document = await storage.createDocument({
      clientId: client?.id,
      therapistId: this.config.therapistId,
      fileName: fileName,
      fileType: ext.replace('.', ''),
      extractedText: transcriptText,
      tags: ['transcript', 'auto-imported'],
      metadata: { source: 'watch-folder', originalName: fileName }
    });

    // Generate progress note from transcript using AI
    try {
      const noteContent = await aiService.processTherapyDocument(
        transcriptText,
        `Convert this session transcript into a clinical progress note in SOAP format.
Extract key themes, client statements, therapeutic interventions, and treatment progress.
Format with clear sections: Subjective, Objective, Assessment, Plan.`
      );

      // Create progress note
      const progressNote = await storage.createProgressNote({
        clientId: client?.id || 'unknown',
        therapistId: this.config.therapistId,
        sessionDate: new Date(),
        content: noteContent,
        status: 'draft',
        documentId: document.id
      });

      return {
        success: true,
        documentId: document.id,
        clientId: client?.id,
        progressNoteId: progressNote.id,
        documentType: 'transcript',
        message: `Transcript converted to progress note for ${clientName}`
      };
    } catch (error) {
      // Even if note generation fails, document is saved
      return {
        success: true,
        documentId: document.id,
        clientId: client?.id,
        documentType: 'transcript',
        message: `Transcript saved (AI note generation failed: ${error instanceof Error ? error.message : 'Unknown error'})`
      };
    }
  }

  /**
   * Process a progress note file
   */
  private async processProgressNote(buffer: Buffer, fileName: string): Promise<ProcessingResult> {
    // Use enhanced document processor
    const result = await enhancedDocumentProcessor.processDocument(
      buffer,
      fileName,
      this.config.therapistId
    );

    if (result.success && result.document) {
      // Try to link to an appointment
      const clientName = result.extractedData?.clientName || this.extractClientNameFromFilename(fileName);
      const client = await this.findOrCreateClient(clientName);

      // Look for matching session
      const sessionDate = result.extractedData?.sessionDate;
      let linkedSession = null;

      if (client && sessionDate) {
        const sessions = await storage.getSessionsByClient(client.id);
        linkedSession = sessions.find(s => {
          const sessionDateStr = new Date(s.scheduledAt).toISOString().split('T')[0];
          const noteDateStr = new Date(sessionDate).toISOString().split('T')[0];
          return sessionDateStr === noteDateStr;
        });
      }

      return {
        success: true,
        documentId: result.document.id,
        clientId: client?.id,
        sessionId: linkedSession?.id,
        documentType: 'progress_note',
        message: `Progress note processed for ${clientName}${linkedSession ? ' and linked to session' : ''}`
      };
    }

    return {
      success: false,
      documentType: 'progress_note',
      message: 'Failed to process progress note'
    };
  }

  /**
   * Process a treatment plan file
   */
  private async processTreatmentPlan(buffer: Buffer, fileName: string): Promise<ProcessingResult> {
    const result = await enhancedDocumentProcessor.processDocument(
      buffer,
      fileName,
      this.config.therapistId
    );

    if (result.success && result.document) {
      const clientName = result.extractedData?.clientName || this.extractClientNameFromFilename(fileName);
      const client = await this.findOrCreateClient(clientName);

      return {
        success: true,
        documentId: result.document.id,
        clientId: client?.id,
        documentType: 'treatment_plan',
        message: `Treatment plan processed for ${clientName}`
      };
    }

    return {
      success: false,
      documentType: 'treatment_plan',
      message: 'Failed to process treatment plan'
    };
  }

  /**
   * Process a generic document
   */
  private async processGenericDocument(buffer: Buffer, fileName: string): Promise<ProcessingResult> {
    const result = await enhancedDocumentProcessor.processDocument(
      buffer,
      fileName,
      this.config.therapistId
    );

    if (result.success && result.document) {
      return {
        success: true,
        documentId: result.document.id,
        documentType: result.documentType || 'generic',
        message: `Document processed: ${result.documentType || 'unknown type'}`
      };
    }

    return {
      success: false,
      documentType: 'generic',
      message: 'Failed to process document'
    };
  }

  /**
   * Extract client name from filename
   */
  private extractClientNameFromFilename(fileName: string): string {
    // Remove extension
    let name = fileName.replace(/\.[^.]+$/, '');

    // Remove common prefixes/suffixes
    name = name
      .replace(/transcript/gi, '')
      .replace(/progress\s*note/gi, '')
      .replace(/session/gi, '')
      .replace(/treatment\s*plan/gi, '')
      .replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '') // Remove dates
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract what looks like a name (2-3 capitalized words)
    const nameMatch = name.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?)/);
    if (nameMatch) {
      return nameMatch[1];
    }

    return name || 'Unknown Client';
  }

  /**
   * Find or create a client by name
   */
  private async findOrCreateClient(clientName: string): Promise<any> {
    if (!clientName || clientName === 'Unknown Client') {
      return null;
    }

    try {
      const clients = await storage.getClients(this.config.therapistId);

      // Try exact match first
      let client = clients.find(c =>
        c.name.toLowerCase() === clientName.toLowerCase()
      );

      if (client) return client;

      // Try partial match
      const searchName = clientName.toLowerCase();
      client = clients.find(c =>
        c.name.toLowerCase().includes(searchName) ||
        searchName.includes(c.name.toLowerCase())
      );

      if (client) return client;

      // Create new client
      client = await storage.createClient({
        therapistId: this.config.therapistId,
        name: clientName,
        status: 'active',
        email: null,
        phone: null,
        dateOfBirth: null,
        emergencyContact: null,
        insurance: null,
        tags: ['Auto-imported from watch folder']
      });

      console.log(`[FileWatcher] Created new client: ${clientName}`);
      return client;
    } catch (error) {
      console.error('[FileWatcher] Error finding/creating client:', error);
      return null;
    }
  }

  /**
   * Get watch folder status
   */
  getStatus(): {
    isWatching: boolean;
    watchPath: string;
    processedCount: number;
    pendingCount: number;
    failedCount: number;
    recentFiles: WatchedFile[];
  } {
    const files = Array.from(this.processedFiles.values());

    return {
      isWatching: this.isWatching,
      watchPath: this.config.path,
      processedCount: files.filter(f => f.status === 'completed').length,
      pendingCount: files.filter(f => f.status === 'pending' || f.status === 'processing').length,
      failedCount: files.filter(f => f.status === 'failed').length,
      recentFiles: files.slice(-10)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<WatchFolderConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart watching if currently active
    if (this.isWatching) {
      this.stopWatching();
      this.startWatching();
    }
  }

  /**
   * Get the watch folder path
   */
  getWatchPath(): string {
    return this.config.path;
  }
}

export const fileWatcherService = new FileWatcherService();
export default fileWatcherService;
