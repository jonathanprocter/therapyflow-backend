import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { aiService } from "./services/aiService";
import { calendarService } from "./services/calendarService";
import { pdfService } from "./services/pdfService";
import { documentProcessor } from "./services/documentProcessor";
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

  // Sessions endpoints
  app.get("/api/sessions", async (req: any, res) => {
    try {
      const { clientId, upcoming } = req.query;
      
      if (upcoming === "true") {
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
        res.status(400).json({ error: "clientId or upcoming parameter required" });
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
      
      // Generate AI tags and embedding
      const aiTags = await aiService.generateClinicalTags(noteData.content);
      const embedding = await aiService.generateEmbedding(noteData.content);
      
      const note = await storage.createProgressNote({
        ...noteData,
        aiTags: aiTags.map(tag => tag.name),
        embedding
      });
      
      // Find cross-references with existing notes
      const existingNotes = await storage.getProgressNotes(noteData.clientId);
      const crossRefs = await aiService.findCrossReferences(
        noteData.content,
        existingNotes.map(n => ({ id: n.id, content: n.content, embedding: n.embedding || undefined }))
      );
      
      // Store cross-references (implement in storage if needed)
      
      res.json(note);
    } catch (error) {
      console.error("Error creating progress note:", error);
      res.status(400).json({ error: "Failed to create progress note" });
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

  // Document processing endpoints for batch upload
  app.post("/api/documents/batch-process", upload.array('documents'), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      const files = req.files.map((file: any) => ({
        buffer: file.buffer,
        filename: file.originalname
      }));

      const results = await documentProcessor.batchProcess(files);
      res.json(results);
    } catch (error) {
      console.error("Error processing documents:", error);
      res.status(500).json({ error: "Failed to process documents" });
    }
  });

  app.post("/api/documents/single-process", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const metadata = await documentProcessor.processDocument(req.file.buffer, req.file.originalname);
      res.json(metadata);
    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({ error: "Failed to process document" });
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

  app.post("/api/calendar/sync", async (req: any, res) => {
    try {
      const { startDate = '2015-01-01', endDate = '2030-12-31' } = req.body;
      
      // Sync calendar events from Google Calendar (2015-2030 range)
      const syncedSessions = await googleCalendarService.syncCalendarEvents(
        req.therapistId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        syncedCount: syncedSessions.length,
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
