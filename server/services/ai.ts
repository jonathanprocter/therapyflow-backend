import { z } from "zod";
import { getDocument, saveAIResult, upsertAppointment, upsertEdges } from "../storage-extensions";

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

async function callLLM(prompt: string): Promise<{ raw: string; model: string }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  // Try OpenAI first
  if (openaiKey) {
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
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return { raw: content, model: "openai:gpt-4o" };
      }
    } catch (error) {
      console.warn('OpenAI failed, trying Anthropic:', error);
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

export async function processDocumentWithAI(documentId: string) {
  const doc = await getDocument(documentId);
  if (!doc?.text) throw new Error(`Document ${documentId} not parsed or empty`);

  console.log(`🤖 Processing document ${documentId} with AI...`);
  
  const prompt = buildPrompt(doc.text);
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
    const retry = buildPrompt(doc.text + "\n\nRespond with JSON only.");
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

  // persist AI results
  const saved = await saveAIResult({
    documentId, 
    promptId: PROMPT_ID, 
    model, 
    entities, 
    extractions, 
    summary, 
    recommendations, 
    confidence
  });

  // upsert appointment link if entities.appointment exists and doc has clientId
  if (doc.clientId && entities.appointment?.date) {
    await upsertAppointment({
      clientId: doc.clientId,
      date: entities.appointment.date!,
      time: entities.appointment.time,
      notesId: saved.id,
    });
  }

  // upsert edges
  if (edges?.length) {
    await upsertEdges(documentId, edges);
  }

  console.log(`✅ AI processing complete: ${edges.length} semantic edges created`);
  
  return { saved, edgesCount: edges.length };
}