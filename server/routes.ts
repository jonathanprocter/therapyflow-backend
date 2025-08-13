import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { aiService } from "./services/aiService";
import { calendarService } from "./services/calendarService";
import { pdfService } from "./services/pdfService";
import { documentProcessor } from "./services/documentProcessor";
import { enhancedDocumentProcessor } from "./services/enhanced-document-processor";
import { googleCalendarService } from "./services/googleCalendarService";
import { 
  insertClientSchema, 
  insertSessionSchema, 
  insertProgressNoteSchema,
  insertCaseConceptualizationSchema,
  insertTreatmentPlanSchema,
  insertAllianceScoreSchema
} from "@shared/schema";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Mock authentication middleware - Dr. Jonathan Procter
  const requireAuth = (req: any, res: any, next: any) => {
    // Dr. Jonathan Procter as the authenticated therapist
    req.therapistId = "dr-jonathan-procter";
    req.therapistName = "Dr. Jonathan Procter";
    next();
  };

  app.use(requireAuth);

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req: any, res) => {
    try {
      const stats = await storage.getTherapistStats(req.therapistId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Clients endpoints
  app.get("/api/clients", async (req: any, res) => {
    try {
      const clients = await storage.getClients(req.therapistId);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req: any, res) => {
    try {
      const clientData = insertClientSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(400).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const clientData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, clientData);
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(400).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const clientId = req.params.id;
      
      // Verify the client exists first
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Delete the client and all related data
      await storage.deleteClient(clientId);
      
      res.json({ 
        success: true, 
        message: `Client ${client.name} and all associated data have been deleted successfully` 
      });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ 
        error: "Failed to delete client", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Sessions endpoints
  app.get("/api/sessions", async (req: any, res) => {
    try {
      const { clientId, upcoming, today } = req.query;
      
      if (today === "true") {
        const sessions = await storage.getTodaysSessions(req.therapistId);
        // Fetch client data for each session
        const sessionsWithClients = await Promise.all(
          sessions.map(async (session) => {
            const client = await storage.getClient(session.clientId);
            return { ...session, client };
          })
        );
        res.json(sessionsWithClients);
      } else if (upcoming === "true") {
        const sessions = await storage.getUpcomingSessions(req.therapistId);
        // Fetch client data for each session
        const sessionsWithClients = await Promise.all(
          sessions.map(async (session) => {
            const client = await storage.getClient(session.clientId);
            return { ...session, client };
          })
        );
        res.json(sessionsWithClients);
      } else if (clientId) {
        const sessions = await storage.getSessions(clientId);
        res.json(sessions);
      } else {
        // Return all upcoming and recent sessions for the therapist if no specific filter
        const sessions = await storage.getUpcomingSessions(req.therapistId, new Date('2010-01-01'));
        // Fetch client data for each session
        const sessionsWithClients = await Promise.all(
          sessions.map(async (session) => {
            const client = await storage.getClient(session.clientId);
            return { ...session, client };
          })
        );
        res.json(sessionsWithClients);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", async (req: any, res) => {
    try {
      const sessionData = insertSessionSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });
      
      const session = await storage.createSession(sessionData);
      
      // Sync to Google Calendar if client email is available
      const client = await storage.getClient(session.clientId);
      if (client?.email) {
        const endTime = new Date(session.scheduledAt);
        endTime.setMinutes(endTime.getMinutes() + session.duration);
        
        const googleEventId = await calendarService.syncSessionToCalendar(
          client.name,
          session.sessionType,
          session.scheduledAt,
          endTime,
          client.email
        );
        
        if (googleEventId) {
          await storage.updateSession(session.id, { googleEventId });
        }
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(400).json({ error: "Failed to create session" });
    }
  });

  // Historical session management endpoints
  app.get("/api/sessions/historical", async (req: any, res) => {
    try {
      const { includeCompleted = "true" } = req.query;
      const sessions = await storage.getAllHistoricalSessions(req.therapistId, includeCompleted === "true");
      
      // Fetch client data for each session
      const sessionsWithClients = await Promise.all(
        sessions.map(async (session) => {
          const client = await storage.getClient(session.clientId);
          return { ...session, client };
        })
      );
      
      res.json(sessionsWithClients);
    } catch (error) {
      console.error("Error fetching historical sessions:", error);
      res.status(500).json({ error: "Failed to fetch historical sessions" });
    }
  });

  app.get("/api/sessions/completed", async (req: any, res) => {
    try {
      const { clientId } = req.query;
      const sessions = await storage.getCompletedSessions(req.therapistId, clientId);
      
      // Fetch client data for each session
      const sessionsWithClients = await Promise.all(
        sessions.map(async (session) => {
          const client = await storage.getClient(session.clientId);
          return { ...session, client };
        })
      );
      
      res.json(sessionsWithClients);
    } catch (error) {
      console.error("Error fetching completed sessions:", error);
      res.status(500).json({ error: "Failed to fetch completed sessions" });
    }
  });

  app.post("/api/sessions/mark-past-completed", async (req: any, res) => {
    try {
      const updatedCount = await storage.markPastSessionsAsCompleted(req.therapistId);
      res.json({ 
        success: true, 
        message: `Marked ${updatedCount} past sessions as completed`,
        updatedCount 
      });
    } catch (error) {
      console.error("Error marking past sessions as completed:", error);
      res.status(500).json({ error: "Failed to mark past sessions as completed" });
    }
  });

  app.post("/api/sessions/create-progress-placeholders", async (req: any, res) => {
    try {
      const createdCount = await storage.createProgressNotePlaceholdersForHistoricalSessions(req.therapistId);
      res.json({ 
        success: true, 
        message: `Created ${createdCount} progress note placeholders for historical sessions`,
        createdCount 
      });
    } catch (error) {
      console.error("Error creating progress note placeholders:", error);
      res.status(500).json({ error: "Failed to create progress note placeholders" });
    }
  });

  // Progress Notes endpoints
  app.get("/api/progress-notes", async (req: any, res) => {
    try {
      const { clientId, search, recent } = req.query;
      
      if (recent === "true") {
        const notes = await storage.getRecentProgressNotes(req.therapistId);
        // Fetch client data for each note
        const notesWithClients = await Promise.all(
          notes.map(async (note) => {
            const client = await storage.getClient(note.clientId);
            return { ...note, client };
          })
        );
        res.json(notesWithClients);
      } else if (search) {
        const notes = await storage.searchProgressNotes(req.therapistId, search);
        res.json(notes);
      } else if (clientId) {
        const notes = await storage.getProgressNotes(clientId);
        res.json(notes);
      } else {
        res.status(400).json({ error: "clientId, search, or recent parameter required" });
      }
    } catch (error) {
      console.error("Error fetching progress notes:", error);
      res.status(500).json({ error: "Failed to fetch progress notes" });
    }
  });

  app.post("/api/progress-notes", async (req: any, res) => {
    try {
      const noteData = insertProgressNoteSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });
      
      // Generate AI tags and embedding if content exists
      const aiTags = noteData.content ? await aiService.generateClinicalTags(noteData.content) : [];
      const embedding = noteData.content ? await aiService.generateEmbedding(noteData.content) : [];
      
      const note = await storage.createProgressNote({
        ...noteData,
        aiTags: aiTags.map(tag => tag.name),
        embedding
      });
      
      // Find cross-references with existing notes if content exists
      let crossRefs = [];
      if (noteData.content) {
        const existingNotes = await storage.getProgressNotes(noteData.clientId);
        crossRefs = await aiService.findCrossReferences(
          noteData.content,
          existingNotes.map(n => ({ id: n.id, content: n.content || '', embedding: n.embedding || undefined }))
        );
      }
      
      // Store cross-references (implement in storage if needed)
      
      res.json(note);
    } catch (error) {
      console.error("Error creating progress note:", error);
      res.status(400).json({ error: "Failed to create progress note" });
    }
  });

  // Progress Notes Management endpoints
  app.get("/api/progress-notes/manual-review", async (req: any, res) => {
    try {
      const notes = await storage.getProgressNotesForManualReview(req.therapistId);
      const notesWithClients = await Promise.all(
        notes.map(async (note) => {
          const client = await storage.getClient(note.clientId);
          const session = note.sessionId ? await storage.getSession(note.sessionId) : null;
          return { ...note, client, session };
        })
      );
      res.json(notesWithClients);
    } catch (error) {
      console.error("Error fetching notes for manual review:", error);
      res.status(500).json({ error: "Failed to fetch notes for manual review" });
    }
  });

  app.get("/api/progress-notes/placeholders", async (req: any, res) => {
    try {
      const placeholders = await storage.getProgressNotePlaceholders(req.therapistId);
      const placeholdersWithClients = await Promise.all(
        placeholders.map(async (note) => {
          const client = await storage.getClient(note.clientId);
          const session = note.sessionId ? await storage.getSession(note.sessionId) : null;
          return { ...note, client, session };
        })
      );
      res.json(placeholdersWithClients);
    } catch (error) {
      console.error("Error fetching progress note placeholders:", error);
      res.status(500).json({ error: "Failed to fetch placeholders" });
    }
  });

  app.post("/api/progress-notes/create-placeholders", async (req: any, res) => {
    try {
      // Get all SimplePractice sessions without progress notes
      const sessions = await storage.getSimplePracticeSessions(req.therapistId);
      const placeholdersCreated = [];
      
      for (const session of sessions) {
        // Check if placeholder already exists
        const existingNotes = await storage.getProgressNotes(session.clientId);
        const hasPlaceholder = existingNotes.some(note => note.sessionId === session.id);
        
        if (!hasPlaceholder) {
          const placeholder = await storage.createProgressNotePlaceholder(
            session.id,
            session.clientId,
            req.therapistId,
            session.scheduledAt
          );
          placeholdersCreated.push(placeholder);
          
          // Update session to mark placeholder creation
          await storage.updateSession(session.id, {
            hasProgressNotePlaceholder: true,
            progressNoteStatus: 'placeholder'
          });
        }
      }
      
      res.json({
        success: true,
        placeholdersCreated: placeholdersCreated.length,
        message: `Created ${placeholdersCreated.length} progress note placeholders for SimplePractice appointments`
      });
    } catch (error) {
      console.error("Error creating progress note placeholders:", error);
      res.status(500).json({ error: "Failed to create placeholders" });
    }
  });

  app.patch("/api/progress-notes/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // If content is being added to a placeholder, update status
      if (updates.content && updates.isPlaceholder) {
        updates.isPlaceholder = false;
        updates.status = 'uploaded';
      }
      
      const note = await storage.updateProgressNote(id, updates);
      res.json(note);
    } catch (error) {
      console.error("Error updating progress note:", error);
      res.status(500).json({ error: "Failed to update progress note" });
    }
  });

  app.delete("/api/progress-notes/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify the note belongs to the authenticated therapist
      const note = await storage.getProgressNote(id);
      if (!note) {
        return res.status(404).json({ error: "Progress note not found" });
      }
      if (note.therapistId !== req.therapistId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteProgressNote(id);
      res.json({ success: true, message: "Progress note deleted successfully" });
    } catch (error) {
      console.error("Error deleting progress note:", error);
      res.status(500).json({ error: "Failed to delete progress note" });
    }
  });

  // Enhanced Document Upload and Processing endpoints
  app.post("/api/documents/upload", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Support multiple file types with enhanced processing
      const supportedMimeTypes = [
        'text/plain',                    // TXT - optimal for AI analysis
        'application/pdf',               // PDF - robust extraction now available
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/msword',            // DOC (older format)
        'text/rtf',                      // RTF
        'application/rtf'                // RTF alternative
      ];
      
      if (!supportedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: 'Supported file types: TXT, PDF, DOCX, DOC, RTF. Enhanced AI analysis now supports all formats.' 
        });
      }

      console.log(`🚀 Processing ${req.file.originalname} with enhanced AI analysis...`);
      
      const result = await enhancedDocumentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.therapistId
      );

      // Log success metrics
      if (result.success) {
        console.log(`✅ Enhanced processing completed: ${result.confidence}% confidence`);
        console.log(`📊 Validation scores: Text:${result.validationDetails?.textExtractionScore}% AI:${result.validationDetails?.aiAnalysisScore}% Date:${result.validationDetails?.dateValidationScore}% Client:${result.validationDetails?.clientMatchScore}%`);
      } else {
        console.log(`❌ Enhanced processing failed: ${result.processingNotes}`);
      }

      res.json(result);
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: 'Failed to process document with enhanced AI analysis' });
    }
  });

  // Legacy document upload endpoint (fallback)
  app.post("/api/documents/upload-legacy", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await documentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.therapistId
      );

      res.json(result);
    } catch (error) {
      console.error('Error uploading document (legacy):', error);
      res.status(500).json({ error: 'Failed to process document' });
    }
  });

  app.get("/api/documents/processing-status", async (req: any, res) => {
    try {
      const placeholders = await storage.getProgressNotePlaceholders(req.therapistId);
      const manualReview = await storage.getProgressNotesForManualReview(req.therapistId);
      
      res.json({
        placeholders: placeholders.length,
        manualReview: manualReview.length,
        totalSessions: await storage.getSessions('calendar-sync-client').then(s => s.length),
        message: `${placeholders.length} placeholders ready for content, ${manualReview.length} notes need manual review`
      });
    } catch (error) {
      console.error('Error fetching processing status:', error);
      res.status(500).json({ error: 'Failed to fetch processing status' });
    }
  });

  // Batch Processing endpoint
  app.post("/api/documents/process-batch", upload.array('documents', 10), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = [];
      for (const file of req.files) {
        if (file.mimetype === 'application/pdf') {
          try {
            const result = await documentProcessor.processDocument(
              file.buffer,
              file.originalname,
              req.therapistId
            );
            results.push(result);
          } catch (error) {
            results.push({
              success: false,
              fileName: file.originalname,
              error: (error as Error).message
            });
          }
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      res.json({
        success: true,
        processed: results.length,
        successful,
        failed,
        results,
        message: `Processed ${successful} documents successfully, ${failed} failed`
      });
    } catch (error) {
      console.error('Error processing batch documents:', error);
      res.status(500).json({ error: 'Failed to process batch documents' });
    }
  });

  // Case Conceptualization endpoints
  app.get("/api/case-conceptualization/:clientId", async (req, res) => {
    try {
      const conceptualization = await storage.getCaseConceptualization(req.params.clientId);
      res.json(conceptualization);
    } catch (error) {
      console.error("Error fetching case conceptualization:", error);
      res.status(500).json({ error: "Failed to fetch case conceptualization" });
    }
  });

  app.post("/api/case-conceptualization", async (req: any, res) => {
    try {
      const data = insertCaseConceptualizationSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });
      
      const conceptualization = await storage.createCaseConceptualization(data);
      res.json(conceptualization);
    } catch (error) {
      console.error("Error creating case conceptualization:", error);
      res.status(400).json({ error: "Failed to create case conceptualization" });
    }
  });

  // AI endpoints
  app.get("/api/ai/insights", async (req: any, res) => {
    try {
      const insights = await storage.getAiInsights(req.therapistId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      res.status(500).json({ error: "Failed to fetch AI insights" });
    }
  });

  app.post("/api/ai/session-prep/:sessionId", async (req: any, res) => {
    try {
      const session = await storage.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const client = await storage.getClient(session.clientId);
      const recentNotes = await storage.getProgressNotes(session.clientId);
      const treatmentPlan = await storage.getTreatmentPlan(session.clientId);
      
      const clientHistory = recentNotes.slice(0, 10).map(note => note.content).join('\n');
      const lastSession = recentNotes[0]?.content || '';
      const goals = treatmentPlan?.goals ? Object.values(treatmentPlan.goals as any).map((goal: any) => goal.description) : [];
      
      const preparation = await aiService.prepareSessionQuestions(
        clientHistory,
        lastSession,
        goals
      );
      
      res.json(preparation);
    } catch (error) {
      console.error("Error generating session preparation:", error);
      res.status(500).json({ error: "Failed to generate session preparation" });
    }
  });

  app.post("/api/ai/case-analysis", async (req: any, res) => {
    try {
      const { clientId } = req.body;
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const progressNotes = await storage.getProgressNotes(clientId);
      const clientInfo = JSON.stringify(client);
      const assessmentData = progressNotes.slice(0, 5).map(note => note.content).join('\n');
      
      const analysis = await aiService.analyzeCaseConceptualization(clientInfo, assessmentData);
      res.json(analysis);
    } catch (error) {
      console.error("Error generating case analysis:", error);
      res.status(500).json({ error: "Failed to generate case analysis" });
    }
  });

  // Document upload endpoint
  app.post("/api/documents/upload", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { clientId } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: "Client ID is required" });
      }
      
      // Extract text from PDF
      const extractedData = await pdfService.extractText(req.file.buffer);
      const embedding = await aiService.generateEmbedding(extractedData.text);
      
      // Identify document sections and type
      const sections = pdfService.extractClinicalSections(extractedData.text);
      const documentType = pdfService.identifyDocumentType(extractedData.text);
      
      const document = await storage.createDocument({
        clientId,
        therapistId: req.therapistId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        filePath: `/uploads/${req.file.originalname}`, // In production, use actual file storage
        extractedText: extractedData.text,
        embedding,
        tags: [documentType]
      });
      
      res.json({
        document,
        extractedData: {
          ...extractedData,
          sections,
          documentType
        }
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });



  // Treatment Plan endpoints
  app.get("/api/treatment-plan/:clientId", async (req, res) => {
    try {
      const plan = await storage.getTreatmentPlan(req.params.clientId);
      res.json(plan);
    } catch (error) {
      console.error("Error fetching treatment plan:", error);
      res.status(500).json({ error: "Failed to fetch treatment plan" });
    }
  });

  app.post("/api/treatment-plan", async (req: any, res) => {
    try {
      const planData = insertTreatmentPlanSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });
      
      const plan = await storage.createTreatmentPlan(planData);
      res.json(plan);
    } catch (error) {
      console.error("Error creating treatment plan:", error);
      res.status(400).json({ error: "Failed to create treatment plan" });
    }
  });

  // Alliance Scores endpoints
  app.get("/api/alliance-scores/:clientId", async (req, res) => {
    try {
      const scores = await storage.getAllianceScores(req.params.clientId);
      res.json(scores);
    } catch (error) {
      console.error("Error fetching alliance scores:", error);
      res.status(500).json({ error: "Failed to fetch alliance scores" });
    }
  });

  app.post("/api/alliance-scores", async (req: any, res) => {
    try {
      const scoreData = insertAllianceScoreSchema.parse({
        ...req.body,
        therapistId: req.therapistId,
        assessmentDate: new Date()
      });
      
      const score = await storage.createAllianceScore(scoreData);
      res.json(score);
    } catch (error) {
      console.error("Error creating alliance score:", error);
      res.status(400).json({ error: "Failed to create alliance score" });
    }
  });

  // Google Calendar Integration Routes (OAuth2 with 2015-2030 sync)
  app.get("/api/calendar/auth-url", async (req, res) => {
    try {
      const authUrl = await googleCalendarService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error getting auth URL:", error);
      res.status(500).json({ error: "Failed to get authorization URL" });
    }
  });

  app.get("/api/calendar/callback", async (req, res) => {
    try {
      const { code, error } = req.query;
      
      if (error) {
        return res.send(`
          <html>
            <body>
              <h2>Authorization Failed</h2>
              <p>Error: ${error}</p>
              <script>
                window.opener && window.opener.postMessage({ success: false, error: '${error}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `);
      }
      
      if (!code) {
        return res.status(400).send(`
          <html>
            <body>
              <h2>Authorization Failed</h2>
              <p>No authorization code received</p>
              <script>
                window.opener && window.opener.postMessage({ success: false, error: 'No authorization code' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `);
      }
      
      const tokens = await googleCalendarService.exchangeCodeForTokens(code as string);
      
      res.send(`
        <html>
          <head>
            <title>Calendar Connected</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .success { color: #4CAF50; }
              .container { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="success">✓ Google Calendar Connected!</h2>
              <p>Your calendar is now connected to TherapyFlow.</p>
              <p><small>You can close this window and return to the app.</small></p>
            </div>
            <script>
              window.opener && window.opener.postMessage({ success: true, tokens: ${JSON.stringify(tokens)} }, '*');
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in calendar callback:", error);
      res.send(`
        <html>
          <body>
            <h2>Authorization Failed</h2>
            <p>Error: ${(error as Error).message}</p>
            <script>
              window.opener && window.opener.postMessage({ success: false, error: '${(error as Error).message}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/calendar/auth", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Authorization code required" });
      }
      
      const tokens = await googleCalendarService.exchangeCodeForTokens(code);
      res.json({ success: true, tokens });
    } catch (error) {
      console.error("Error exchanging auth code:", error);
      res.status(500).json({ error: "Failed to exchange authorization code" });
    }
  });

  // Helper function to check name variations
  const isNameVariation = (name1: string, name2: string): boolean => {
    const normalize = (name: string) => name.toLowerCase().trim();
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    // Common name variations
    const variations: { [key: string]: string[] } = {
      'christopher': ['chris', 'christopher'],
      'chris': ['chris', 'christopher'],
      'benjamin': ['ben', 'benjamin', 'benji'],
      'ben': ['ben', 'benjamin', 'benji'],
      'michael': ['mike', 'michael', 'mick'],
      'mike': ['mike', 'michael', 'mick'],
      'william': ['will', 'william', 'bill', 'billy'],
      'will': ['will', 'william', 'bill', 'billy'],
      'robert': ['rob', 'robert', 'bob', 'bobby'],
      'rob': ['rob', 'robert', 'bob', 'bobby'],
      'elizabeth': ['liz', 'elizabeth', 'beth', 'betty'],
      'liz': ['liz', 'elizabeth', 'beth', 'betty']
    };
    
    // Extract first names for comparison
    const firstName1 = n1.split(' ')[0];
    const firstName2 = n2.split(' ')[0];
    
    // Check if names are variations of each other
    for (const [base, vars] of Object.entries(variations)) {
      if (vars.includes(firstName1) && vars.includes(firstName2)) {
        return true;
      }
    }
    
    return false;
  };

  app.post("/api/calendar/sync", async (req: any, res) => {
    try {
      const { startDate = '2010-01-01', endDate = '2035-12-31' } = req.body;
      
      // Sync calendar events from Google Calendar (2015-2030 range)
      const syncedSessions = await googleCalendarService.syncCalendarEvents(
        req.therapistId,
        startDate,
        endDate
      );

      // Save the synced sessions to the database with proper client matching
      const savedSessions = [];
      for (const session of syncedSessions) {
        try {
          // Check if session already exists (by googleEventId)
          const existingSession = await storage.getSessionByGoogleEventId(session.googleEventId!);
          
          if (!existingSession) {
            // Extract client name from the session (stored as temporary field)
            const extractedClientName = (session as any).clientName;
            let clientId = session.clientId; // Default fallback client
            
            // Try to match or create a real client if we have a valid client name
            if (extractedClientName && extractedClientName !== 'Unidentified Client' && !extractedClientName.includes('Birthday')) {
              try {
                // First, try to find existing client by name match
                const existingClients = await storage.getClients(req.therapistId);
                const matchingClient = existingClients.find(client => 
                  client.name.toLowerCase() === extractedClientName.toLowerCase() ||
                  // Handle name variations (Chris vs Christopher, etc.)
                  isNameVariation(client.name, extractedClientName)
                );
                
                if (matchingClient) {
                  clientId = matchingClient.id;
                  console.log(`Matched session to existing client: ${extractedClientName} -> ${matchingClient.name}`);
                } else {
                  // Create new client for SimplePractice appointments
                  const newClient = await storage.createClient({
                    therapistId: req.therapistId,
                    name: extractedClientName,
                    status: 'active',
                    email: null,
                    phone: null,
                    dateOfBirth: null,
                    emergencyContact: null,
                    insurance: null,
                    tags: ['SimplePractice Import']
                  });
                  clientId = newClient.id;
                  console.log(`Created new client from SimplePractice: ${extractedClientName}`);
                }
              } catch (clientError) {
                console.error(`Error matching/creating client for ${extractedClientName}:`, clientError);
                // Fall back to default client
              }
            }
            
            // Use the correct InsertSession format (camelCase)
            const sessionData: any = {
              id: session.id,
              clientId: clientId, // Use matched/created client ID
              therapistId: session.therapistId,
              scheduledAt: session.scheduledAt,
              duration: session.duration,
              sessionType: session.sessionType,
              status: session.status,
              notes: session.notes,
              googleEventId: session.googleEventId,
              isSimplePracticeEvent: (session as any).isSimplePracticeEvent || false,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt
            };
            
            const savedSession = await storage.createSession(sessionData);
            savedSessions.push(savedSession);
          }
        } catch (sessionError) {
          console.error(`Error saving session ${session.id}:`, sessionError);
          // Continue with other sessions
        }
      }

      console.log(`Successfully saved ${savedSessions.length} sessions to database`);

      res.json({
        success: true,
        syncedCount: syncedSessions.length,
        savedCount: savedSessions.length,
        sessions: syncedSessions,
        dateRange: { startDate, endDate }
      });
    } catch (error) {
      console.error("Error syncing calendar:", error);
      res.status(500).json({ error: "Failed to sync calendar events" });
    }
  });

  app.get("/api/calendar/calendars", async (req, res) => {
    try {
      const calendars = await googleCalendarService.getCalendarList();
      res.json(calendars);
    } catch (error) {
      console.error("Error fetching calendars:", error);
      res.status(500).json({ error: "Failed to fetch calendar list" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
