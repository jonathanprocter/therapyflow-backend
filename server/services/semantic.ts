import { storage } from "../storage";
const db = storage.db;
import { semanticEdges, documents } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function getGraph(clientId: string, range?: {from?: string; to?: string}) {
  const docs = await db.select().from(documents).where(eq(documents.clientId, clientId));
  const ids = docs.map(d => d.id);
  if (!ids.length) return [];
  
  const edges = await db.select().from(semanticEdges);
  return edges.filter(e => ids.includes(e.documentId));
}

export async function recall(clientId: string, q: string) {
  const docs = await db.select().from(documents).where(eq(documents.clientId, clientId));
  const ids = docs.map(d => d.id);
  if (!ids.length) return [];
  
  const edges = await db.select().from(semanticEdges);
  return edges.filter(e => 
    ids.includes(e.documentId) && 
    (e.from.toLowerCase().includes(q.toLowerCase()) || 
     e.to.toLowerCase().includes(q.toLowerCase()))
  );
}