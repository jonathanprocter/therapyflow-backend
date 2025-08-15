import type { Express } from "express";
import multer from "multer";
import { storage } from "../storage";
import { 
  insertTranscriptBatchSchema, 
  insertTranscriptFileSchema 
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";

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

// Helper function to process a batch (extracted for reuse)
async function processTranscriptBatch(batchId: string) {
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

      // Simulate AI processing to extract client info
      // In a real implementation, this would use actual AI
      const aiResult = {
        suggestedClientName: `Client ${Math.floor(Math.random() * 100)}`,
        clientMatchConfidence: Math.random() * 0.4 + 0.6, // 60-100%
        extractedSessionDate: new Date(),
        sessionType: 'individual',
        themes: ['therapy', 'progress'],
        emotions: ['positive', 'hopeful'],
        riskLevel: 'low'
      };

      // Update file with AI results
      await storage.updateTranscriptFile(file.id, {
        suggestedClientName: aiResult.suggestedClientName,
        clientMatchConfidence: aiResult.clientMatchConfidence,
        extractedSessionDate: aiResult.extractedSessionDate,
        sessionType: aiResult.sessionType,
        themes: aiResult.themes,
        riskLevel: aiResult.riskLevel,
        processingStatus: 'completed',
        status: aiResult.clientMatchConfidence > 0.8 ? 'processed' : 'processing',
        requiresManualReview: aiResult.clientMatchConfidence <= 0.8,
        manualReviewReason: aiResult.clientMatchConfidence <= 0.8 ? 'Low confidence client match' : null
      });

      processedCount++;
      console.log(`✅ Processed ${file.fileName}`);
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
  app.get('/api/transcripts/batches', async (req, res) => {
    try {
      const therapistId = 'dr-jonathan-procter'; // Mock therapist ID
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
  app.post('/api/transcripts/batches', upload.array('files', 500), async (req, res) => {
    try {
      const therapistId = 'dr-jonathan-procter'; // Mock therapist ID
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

      // Process each file
      const transcriptFiles = [];
      for (const file of files) {
        // For now, we'll store files in memory and create database records
        // In a real implementation, you'd upload to object storage first
        const fileData = {
          batchId: batch.id,
          therapistId,
          fileName: file.originalname,
          fileSize: file.size,
          filePath: `/transcripts/${batch.id}/${file.originalname}`, // Placeholder path
          status: 'uploaded' as const,
          processingStatus: 'pending' as const
        };

        const validatedFile = insertTranscriptFileSchema.parse(fileData);
        const transcriptFile = await storage.createTranscriptFile(validatedFile);
        transcriptFiles.push(transcriptFile);
      }

      // Update batch status
      await storage.updateTranscriptBatch(batch.id, {
        status: 'processing',
        processedAt: new Date()
      });

      // Trigger automatic processing in the background
      processTranscriptBatch(batch.id).catch((error: any) => {
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

  // Get processing statistics for visualization
  app.get('/api/transcripts/stats', async (req, res) => {
    try {
      const therapistId = 'dr-jonathan-procter'; // Mock therapist ID
      const batches = await storage.getTranscriptBatches(therapistId);
      
      const stats = {
        totalBatches: batches.length,
        totalFiles: batches.reduce((sum, batch) => sum + batch.totalFiles, 0),
        processedFiles: batches.reduce((sum, batch) => sum + (batch.processedFiles || 0), 0),
        filesNeedingReview: batches.reduce((sum, batch) => sum + (batch.failedFiles || 0), 0),
        recentBatches: batches.slice(0, 5) // Latest 5 batches
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching transcript stats:', error);
      res.status(500).json({ error: 'Failed to fetch transcript stats' });
    }
  });

  // Get files that need manual review
  app.get('/api/transcripts/review', async (req, res) => {
    try {
      const therapistId = 'dr-jonathan-procter'; // Mock therapist ID
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
  app.get('/api/transcripts/stats', async (req, res) => {
    try {
      const therapistId = 'dr-jonathan-procter'; // Mock therapist ID
      
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