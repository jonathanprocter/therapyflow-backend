import { storage } from "./storage";
const db = storage.db;
import { documents, aiDocumentResults, semanticEdges, sessions } from "../shared/schema";
import { eq, and } from "drizzle-orm";

export async function createDocument({ clientId, appointmentDate, filename, mimeType, meta }:{
  clientId: string; appointmentDate: string; filename: string; mimeType: string; meta?: any;
}) {
  const [row] = await db.insert(documents).values({
    clientId,
    therapistId: "dr-jonathan-procter", // Use configured therapist
    fileName: filename,
    fileType: mimeType,
    filePath: meta?.filePath || "",
    metadata: {
      ...meta,
      appointmentDate,
      status: "uploaded"
    }
  }).returning();
  return {
    ...row,
    appointmentDate,
    status: "uploaded"
  };
}

export async function updateDocumentParsed(documentId: string, text: string, meta?: any) {
  const [row] = await db.update(documents)
    .set({ 
      extractedText: text, 
      metadata: {
        ...meta,
        status: "parsed",
        updatedAt: new Date().toISOString()
      }
    })
    .where(eq(documents.id, documentId))
    .returning();
  return {
    ...row,
    text: row.extractedText,
    status: "parsed"
  };
}

export async function getDocument(documentId: string) {
  const [row] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!row) return null;
  
  return {
    ...row,
    text: row.extractedText,
    status: row.metadata?.status || "uploaded",
    appointmentDate: row.metadata?.appointmentDate,
    mimeType: row.fileType,
    filename: row.fileName,
    meta: row.metadata
  };
}

export async function getAIResult(documentId: string, promptId: string) {
  const rows = await db.select().from(aiDocumentResults)
    .where(and(eq(aiDocumentResults.documentId, documentId), eq(aiDocumentResults.promptId, promptId)));
  return rows[0] || null;
}

export async function saveAIResult({ documentId, promptId, model, entities, extractions, summary, recommendations, confidence }:{
  documentId: string; promptId: string; model?: string;
  entities: any; extractions: any; summary: string; recommendations: string[]; confidence: number;
}) {
  const existing = await getAIResult(documentId, promptId);
  if (existing) return existing;
  
  const [row] = await db.insert(aiDocumentResults).values({
    documentId, 
    promptId, 
    model, 
    entities, 
    extractions, 
    summary, 
    recommendations, 
    confidence: Math.round(confidence * 100)
  }).returning();
  return row;
}

export async function upsertAppointment({ clientId, date, time, notesId, externalRef }:{
  clientId: string; date: string; time?: string; notesId?: string; externalRef?: string;
}) {
  // For simplicity, link to existing sessions table
  const sessionDate = new Date(`${date}T${time || "14:00"}:00`);
  
  const existing = await db.select().from(sessions)
    .where(and(
      eq(sessions.clientId, clientId), 
      eq(sessions.scheduledAt, sessionDate)
    ));
    
  if (existing.length > 0) {
    const [row] = await db.update(sessions)
      .set({ 
        notes: notesId ? `AI Progress Note ID: ${notesId}` : existing[0].notes
      })
      .where(eq(sessions.id, existing[0].id))
      .returning();
    return row;
  }
  
  const [row] = await db.insert(sessions).values({ 
    clientId, 
    therapistId: "dr-jonathan-procter",
    scheduledAt: sessionDate,
    sessionType: "individual",
    status: "completed",
    notes: notesId ? `AI Progress Note ID: ${notesId}` : undefined
  }).returning();
  return row;
}

export async function upsertEdges(documentId: string, edges: {from:string;to:string;relation:string;weight?:number}[]) {
  const existing = await db.select().from(semanticEdges).where(eq(semanticEdges.documentId, documentId));
  const key = (e:any)=>`${e.from}|${e.to}|${e.relation}`;
  const existingKeys = new Set(existing.map(key));
  const toInsert = edges.filter(e => !existingKeys.has(key(e)));
  
  if (!toInsert.length) return [];
  
  const rows = await db.insert(semanticEdges).values(
    toInsert.map(e => ({ documentId, ...e }))
  ).returning();
  return rows;
}

export async function listAIResultsForClient(clientId: string, from?: string, to?: string) {
  const docs = await db.select().from(documents).where(eq(documents.clientId, clientId));
  const docIds = new Set(docs.map(d => d.id));
  if (!docIds.size) return [];
  
  const results = await db.select().from(aiDocumentResults);
  return results.filter(r => docIds.has(r.documentId));
}