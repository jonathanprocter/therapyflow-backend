import type { Express } from "express";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { storage } from "../storage";
import { 
  insertTranscriptBatchSchema, 
  insertTranscriptFileSchema 
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import { EnhancedDocumentProcessor } from "../services/enhanced-document-processor";

// Configure multer for file upload handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 500 // Max 500 files per batch
  },
  fileFilter: (req, file, cb) => {
    // Accept common transcript file types
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/rtf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT, PDF, DOCX, DOC, and RTF files are allowed.'));
    }
  }
});

// Initialize the enhanced document processor
const enhancedProcessor = new EnhancedDocumentProcessor();

// Helper function to process a batch (extracted for reuse)
async function processTranscriptBatch(batchId: string, fileBuffers?: { [fileId: string]: Buffer }) {
  console.log(`🔄 Processing batch ${batchId}`);
  
  // Get all files in the batch
  const files = await storage.getTranscriptFilesByBatch(batchId);
  console.log(`📁 Found ${files.length} files in batch`);

  let processedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    try {
      // Process each file with AI to extract client info
      console.log(`🤖 Processing file: ${file.fileName}`);
      
      // Update file status to indicate processing
      await storage.updateTranscriptFile(file.id, {
        processingStatus: 'analyzing',
        processedAt: new Date()
      });

      // Get the file buffer if available (from memory during upload)
      let fileBuffer = fileBuffers?.[file.id];
      if (!fileBuffer && file.filePath) {
        const resolvedPath = path.resolve(process.cwd(), file.filePath.replace(/^\//, ""));
        fileBuffer = await fs.readFile(resolvedPath);
      }
      if (!fileBuffer) {
        throw new Error(`File buffer not found for ${file.fileName}`);
      }

      // Use the enhanced document processor for real AI processing
      const processingResult = await enhancedProcessor.processDocument(
        fileBuffer, 
        file.fileName, 
        file.therapistId
      );

      console.log(`📊 Processing quality: ${processingResult.validationDetails.overallQuality}%`);

      // Extract client and date information from the AI analysis
      const clientName = processingResult.extractedData?.clientName || 'Unknown Client';
      const sessionDate = processingResult.extractedData?.sessionDate || null;
      const sessionType = processingResult.extractedData?.sessionType || 'individual';
      const riskLevel = processingResult.extractedData?.riskLevel || 'low';

      // Calculate confidence based on processing quality and AI confidence
      const overallQuality = processingResult.validationDetails.overallQuality || 90;
      const aiConfidence = processingResult.confidence / 100;
      const clientMatchConfidence = Math.min(
        (overallQuality / 100) * aiConfidence,
        1.0
      );

      // Update file with real AI results
      await storage.updateTranscriptFile(file.id, {
        suggestedClientName: clientName,
        clientMatchConfidence: clientMatchConfidence,
        extractedSessionDate: sessionDate,
        sessionType: sessionType,
        themes: processingResult.extractedData?.clinicalThemes || ['session notes'],
        riskLevel: riskLevel,
        processingStatus: 'completed',
        status: clientMatchConfidence > 0.75 ? 'processed' : 'processing',
        requiresManualReview: clientMatchConfidence <= 0.75 || processingResult.validationDetails.overallQuality < 85,
        manualReviewReason: clientMatchConfidence <= 0.75 ? 
          `Low confidence client match (${Math.round(clientMatchConfidence * 100)}%)` : 
          processingResult.validationDetails.overallQuality < 85 ? 
            `Low processing quality (${processingResult.validationDetails.overallQuality}%)` : null
      });

      // Create progress note from the processed document
      if (processingResult.progressNoteId && processingResult.clientId) {
        console.log(`📝 Progress note created with ID: ${processingResult.progressNoteId}`);
        
        // The enhanced processor already creates the progress note
        // We just need to make sure it's properly linked to the transcript file
      }

      processedCount++;
      console.log(`✅ Processed ${file.fileName} - Client: ${clientName}, Confidence: ${Math.round(clientMatchConfidence * 100)}%`);
      
    } catch (error) {
      console.error(`❌ Failed to process ${file.fileName}:`, error);
      await storage.updateTranscriptFile(file.id, {
        processingStatus: 'failed',
        status: 'failed',
        errorDetails: String(error)
      });
      failedCount++;
    }
  }

  // Update batch status
  await storage.updateTranscriptBatch(batchId, {
    status: failedCount === 0 ? 'completed' : 'failed',
    processedFiles: processedCount,
    failedFiles: failedCount,
    completedAt: new Date()
  });

  console.log(`🎉 Batch processing completed: ${processedCount} processed, ${failedCount} failed`);
  return { processedCount, failedCount, totalFiles: files.length };
}

export function registerTranscriptRoutes(app: Express): void {
  // Get all transcript batches for a therapist
  app.get('/api/transcripts/batches', async (req: any, res) => {
    try {
      const therapistId = req.therapistId;
      const batches = await storage.getTranscriptBatches(therapistId);
      res.json(batches);
    } catch (error) {
      console.error('Error fetching transcript batches:', error);
      res.status(500).json({ error: 'Failed to fetch transcript batches' });
    }
  });

  // Get a specific transcript batch with its files
  app.get('/api/transcripts/batches/:batchId', async (req, res) => {
    try {
      const { batchId } = req.params;
      const [batch, files] = await Promise.all([
        storage.getTranscriptBatch(batchId),
        storage.getTranscriptFilesByBatch(batchId)
      ]);

      if (!batch) {
        return res.status(404).json({ error: 'Transcript batch not found' });
      }

      res.json({ batch, files });
    } catch (error) {
      console.error('Error fetching transcript batch:', error);
      res.status(500).json({ error: 'Failed to fetch transcript batch' });
    }
  });

  // Create a new transcript batch and upload files
  app.post('/api/transcripts/batches', upload.array('files', 500), async (req: any, res) => {
    try {
      const therapistId = req.therapistId;
      const { batchName } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      if (!batchName) {
        return res.status(400).json({ error: 'Batch name is required' });
      }

      // Validate batch data
      const batchData = {
        therapistId,
        name: batchName,
        totalFiles: files.length,
        status: 'uploading' as const
      };

      const validatedBatch = insertTranscriptBatchSchema.parse(batchData);
      
      // Create the batch
      const batch = await storage.createTranscriptBatch(validatedBatch);

      // Process each file and store buffers for processing
      const transcriptFiles = [];
      const fileBuffers: { [fileId: string]: Buffer } = {};
      const transcriptsDir = path.resolve(process.cwd(), "uploads", "transcripts", batch.id);
      await fs.mkdir(transcriptsDir, { recursive: true });
      
      for (const file of files) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storedName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
        const storedPath = path.join(transcriptsDir, storedName);
        await fs.writeFile(storedPath, file.buffer);

        const fileData = {
          batchId: batch.id,
          therapistId,
          fileName: file.originalname,
          fileSize: file.size,
          filePath: `/uploads/transcripts/${batch.id}/${storedName}`,
          status: 'uploaded' as const,
          processingStatus: 'pending' as const
        };

        const validatedFile = insertTranscriptFileSchema.parse(fileData);
        const transcriptFile = await storage.createTranscriptFile(validatedFile);
        transcriptFiles.push(transcriptFile);

        // Store file buffer keyed by transcript file ID to avoid collisions on name
        fileBuffers[transcriptFile.id] = file.buffer;
      }

      // Update batch status
      await storage.updateTranscriptBatch(batch.id, {
        status: 'processing',
        processedAt: new Date()
      });

      // Trigger automatic processing in the background with file buffers
      processTranscriptBatch(batch.id, fileBuffers).catch((error: any) => {
        console.error(`Background processing failed for batch ${batch.id}:`, error);
      });

      res.json({
        batch,
        files: transcriptFiles,
        message: `Successfully uploaded ${files.length} files. Processing will begin shortly.`
      });
    } catch (error: any) {
      console.error('Error creating transcript batch:', error);
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error as ZodError);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: 'Failed to create transcript batch' });
    }
  });

  // Get detailed files for a specific batch (for drill-down visualization)
  app.get('/api/transcripts/batches/:batchId/files', async (req, res) => {
    try {
      const { batchId } = req.params;
      const files = await storage.getTranscriptFilesByBatch(batchId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching batch files:', error);
      res.status(500).json({ error: 'Failed to fetch batch files' });
    }
  });

  // Get files that need manual review
  app.get('/api/transcripts/review', async (req: any, res) => {
    try {
      const therapistId = req.therapistId;
      const files = await storage.getTranscriptFilesForReview(therapistId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching files for review:', error);
      res.status(500).json({ error: 'Failed to fetch files for review' });
    }
  });

  // Assign a transcript file to a client
  app.post('/api/transcripts/files/:fileId/assign', async (req, res) => {
    try {
      const { fileId } = req.params;
      const { clientId, sessionDate, sessionType = 'individual' } = req.body;

      if (!clientId || !sessionDate) {
        return res.status(400).json({ error: 'Client ID and session date are required' });
      }

      // Assign the transcript to the client
      const assignedFile = await storage.assignTranscriptToClient(
        fileId,
        clientId,
        new Date(sessionDate),
        sessionType
      );

      // Create a progress note from the transcript
      const progressNote = await storage.createProgressNoteFromTranscript(fileId);

      res.json({
        file: assignedFile,
        progressNote,
        message: 'Transcript successfully assigned and progress note created'
      });
    } catch (error) {
      console.error('Error assigning transcript:', error);
      res.status(500).json({ error: 'Failed to assign transcript' });
    }
  });

  // Update transcript file (for manual review results)
  app.put('/api/transcripts/files/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const updates = req.body;

      // Remove any fields that shouldn't be updated directly
      delete updates.id;
      delete updates.uploadedAt;
      delete updates.batchId;

      const updatedFile = await storage.updateTranscriptFile(fileId, updates);
      res.json(updatedFile);
    } catch (error) {
      console.error('Error updating transcript file:', error);
      res.status(500).json({ error: 'Failed to update transcript file' });
    }
  });

  // Process a batch of transcripts (manual trigger)
  app.post('/api/transcripts/process-batch', async (req, res) => {
    try {
      const { batchId } = req.body;

      if (!batchId) {
        return res.status(400).json({ error: 'Batch ID is required' });
      }

      // Use the shared processing function
      const result = await processTranscriptBatch(batchId);

      res.json({
        batchId,
        ...result,
        status: result.failedCount === 0 ? 'completed' : 'failed'
      });
    } catch (error) {
      console.error('Error processing batch:', error);
      res.status(500).json({ error: 'Failed to process batch' });
    }
  });

  // Get processing statistics
  app.get('/api/transcripts/stats', async (req: any, res) => {
    try {
      const therapistId = req.therapistId;

      // You could implement these queries in storage for better performance
      const [batches, reviewFiles] = await Promise.all([
        storage.getTranscriptBatches(therapistId),
        storage.getTranscriptFilesForReview(therapistId)
      ]);

      const stats = {
        totalBatches: batches.length,
        totalFiles: batches.reduce((sum, batch) => sum + batch.totalFiles, 0),
        processedFiles: batches.reduce((sum, batch) => sum + (batch.processedFiles || 0), 0),
        filesNeedingReview: reviewFiles.length,
        recentBatches: batches.slice(0, 5)
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching transcript stats:', error);
      res.status(500).json({ error: 'Failed to fetch transcript statistics' });
    }
  });
}
