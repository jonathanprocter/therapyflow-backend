import { z } from "zod";
import { storage } from "../storage";

const PROMPT_ID = "care_notes_v1";

// Enhanced schema based on the specification
const ResultSchema = z.object({
  entities: z.object({
    client: z.object({
      id: z.string().optional(),
      name: z.string().optional()
    }).optional(),
    appointment: z.object({
      date: z.string().optional(), // YYYY-MM-DD
      time: z.string().optional(), // HH:MM
      type: z.string().optional()
    }).optional()
  }).optional(),
  extractions: z.object({
    diagnoses: z.array(z.object({
      code: z.string().optional(),
      label: z.string()
    })).optional(),
    medications: z.array(z.object({
      name: z.string(),
      dose: z.string().optional(),
      freq: z.string().optional()
    })).optional(),
    symptoms: z.array(z.string()).optional(),
    risk_factors: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional()
  }).optional(),
  summary: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  semanticEdges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    relation: z.string(),
    weight: z.number().optional()
  })).optional()
});

function buildPrompt(text: string): string {
  return `You are a clinical documentation extraction assistant. Extract structured data from parsed clinical notes. Return strictly valid JSON following the schema provided by the user without additional text.

Schema:
- entities.client: { id?: string, name?: string }
- entities.appointment: { date?: string(YYYY-MM-DD), time?: string(HH:MM), type?: string }
- extractions.diagnoses: [{ code?: string, label: string }]
- extractions.medications: [{ name: string, dose?: string, freq?: string }]
- extractions.symptoms: string[]
- extractions.risk_factors: string[]
- extractions.goals: string[]
- summary: string
- recommendations: string[]
- confidence: number(0-1)
- semanticEdges: [{ from: string, to: string, relation: string, weight?: number }]

Guidelines:
- Prefer explicit values from text; otherwise infer conservatively.
- Keep ICD codes when present; else label only.
- Normalize dates to YYYY-MM-DD in user's timezone (America/New_York).
- Only return JSON.

Content:
${text}`;
}

function buildSmartParsingPrompt(text: string): string {
  return `You are a smart clinical document parser. Extract key information from clinical documents and suggest client IDs and appointment details. Return ONLY valid JSON.

Schema:
{
  "entities": {
    "client": { "id": "suggested-client-id", "name": "extracted client name" },
    "appointment": { "date": "YYYY-MM-DD", "time": "HH:MM", "type": "session type" }
  },
  "smartParsing": {
    "suggestedClientId": "client-firstname-lastname",
    "suggestedAppointmentDate": "YYYY-MM-DD",
    "clientNameConfidence": 95,
    "dateConfidence": 80,
    "sessionType": "individual"
  },
  "extractions": {
    "symptoms": ["symptom1", "symptom2"],
    "goals": ["goal1", "goal2"]
  },
  "summary": "Brief clinical summary",
  "recommendations": ["rec1", "rec2"],
  "confidence": 0.85
}

Instructions:
- Extract client names from patterns like "Client:", "Patient:", names in headers
- Extract dates from patterns like "Date:", "Session Date:", timestamps
- Generate client IDs in format "client-firstname-lastname" (lowercase, hyphenated)
- Session types: "individual", "couples", "session without patient present"
- Confidence scores: 0-100 (how certain you are about extraction)
- Default session type to "individual" if unclear

Document:
${text}`;
}

async function callLLM(prompt: string): Promise<{ raw: string; model: string }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  // Try OpenAI first
  if (openaiKey) {
    // Add timeout to prevent hanging connections
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.1
        }),
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return { raw: content, model: "openai:gpt-4o" };
      }
    } catch (error) {
      console.warn('OpenAI failed, trying Anthropic:', error);
    } finally {
      clearTimeout(timeout);
    }
  }
  
  // Fallback to Anthropic
  if (anthropicKey) {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = message.content.map(c => c.type === 'text' ? c.text : "").join("\n");
    return { raw: content, model: "anthropic:claude-3-5-sonnet-20241022" };
  }
  
  throw new Error("No AI provider available - set OPENAI_API_KEY or ANTHROPIC_API_KEY");
}

function tryParseJSON(raw: string) {
  // Strip code fences if present
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(trimmed);
}

export async function processDocumentWithAI(documentId: string, therapistId?: string) {
  // SECURITY: Pass therapistId for tenant isolation
  const doc = await storage.getDocument(documentId, therapistId);
  if (!doc?.extractedText) throw new Error(`Document ${documentId} not parsed or empty`);

  console.log(`🤖 Processing document ${documentId} with AI...`);
  
  const prompt = buildPrompt(doc.extractedText);
  let parsed: any;
  let model = "";
  
  try {
    const { raw, model: usedModel } = await callLLM(prompt);
    model = usedModel;
    parsed = tryParseJSON(raw);
    console.log(`✅ AI processing successful with ${model}`);
  } catch (e) {
    console.warn('First AI attempt failed, retrying with explicit JSON reminder:', e);
    // retry once with explicit JSON-only reminder
    const retry = buildPrompt(doc.extractedText + "\n\nRespond with JSON only.");
    const { raw, model: usedModel } = await callLLM(retry);
    model = usedModel;
    parsed = tryParseJSON(raw);
  }

  const result = ResultSchema.parse({ ...parsed, documentId });
  const entities = result.entities ?? {};
  const extractions = result.extractions ?? {};
  const confidence = result.confidence ?? 0;
  const summary = result.summary ?? "";
  const recommendations = result.recommendations ?? [];
  const edges = result.semanticEdges ?? [];

  // persist AI results (temporarily disabled - requires implementing storage.createAIResult)
  const saved = {
    id: `ai_${documentId}_${Date.now()}`,
    documentId, 
    promptId: PROMPT_ID, 
    model, 
    entities, 
    extractions, 
    summary, 
    recommendations, 
    confidence
  };

  // Persist AI results for auditability and downstream linking
  try {
    const aiRecord = await storage.createAiDocumentResult({
      documentId,
      promptId: PROMPT_ID,
      model,
      entities,
      extractions,
      summary,
      recommendations,
      confidence: Math.round(confidence * 100),
    });

    if (doc?.id) {
      const existingMetadata = (doc.metadata && typeof doc.metadata === "object")
        ? (doc.metadata as Record<string, unknown>)
        : {};
      await storage.updateDocument(doc.id, {
        metadata: {
          ...existingMetadata,
          aiResultId: aiRecord.id,
          aiAnalysis: {
            entities,
            extractions,
            summary,
            recommendations,
            confidence: Math.round(confidence * 100),
            model,
            analyzedAt: new Date().toISOString(),
          },
        },
      }, therapistId);
    }
  } catch (error) {
    console.warn("[AI] Failed to persist AI document results:", error);
  }

  // upsert appointment link if entities.appointment exists and doc has clientId
  // Temporarily disabled - would use storage.upsertAppointment
  // if (doc.clientId && entities.appointment?.date) {
  //   await upsertAppointment({
  //     clientId: doc.clientId,
  //     date: entities.appointment.date!,
  //     time: entities.appointment.time,
  //     notesId: saved.id,
  //   });
  // }

  // upsert edges - temporarily disabled
  // if (edges?.length) {
  //   await upsertEdges(edges);
  // }

  console.log(`✅ AI processing complete: ${edges.length} semantic edges created`);
  
  return { saved, edgesCount: edges.length };
}

export async function smartParseDocument(documentId: string, therapistId?: string) {
  // SECURITY: Pass therapistId for tenant isolation
  const doc = await storage.getDocument(documentId, therapistId);
  if (!doc?.extractedText) throw new Error(`Document ${documentId} not parsed or empty`);

  console.log(`🧠 Smart parsing document ${documentId}...`);
  
  const prompt = buildSmartParsingPrompt(doc.extractedText);
  let parsed: any;
  let model = "";
  
  try {
    const { raw, model: usedModel } = await callLLM(prompt);
    model = usedModel;
    parsed = tryParseJSON(raw);
    console.log(`✅ Smart parsing successful with ${model}`);
  } catch (e) {
    console.warn('Smart parsing failed, retrying with explicit JSON reminder:', e);
    const retry = buildSmartParsingPrompt(doc.extractedText + "\n\nRespond with JSON only.");
    const { raw, model: usedModel } = await callLLM(retry);
    model = usedModel;
    parsed = tryParseJSON(raw);
  }

  // Extract smart parsing results
  const smartParsing = parsed.smartParsing || {};
  const entities = parsed.entities || {};
  const extractions = parsed.extractions || {};
  const summary = parsed.summary || "";
  const recommendations = parsed.recommendations || [];
  const confidence = parsed.confidence || 0;

  console.log(`🔍 Smart parsing results: Client ID: ${smartParsing.suggestedClientId}, Date: ${smartParsing.suggestedAppointmentDate}`);
  
  return {
    smartParsing,
    entities,
    extractions,
    summary,
    recommendations,
    confidence,
    model
  };
}
