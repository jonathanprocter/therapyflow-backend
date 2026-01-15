import { db } from "../db";
import { semanticEdges, documents } from "../../shared/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";

export async function getGraph(clientId: string, range?: {from?: string; to?: string}) {
  const docs = await db.select().from(documents).where(eq(documents.clientId, clientId));
  const ids = docs.map((d: any) => d.id);
  if (!ids.length) return [];
  
  const edges = await db
    .select()
    .from(semanticEdges)
    .where(inArray(semanticEdges.documentId, ids));
  return edges;
}

export async function recall(clientId: string, q: string) {
  const docs = await db.select().from(documents).where(eq(documents.clientId, clientId));
  const ids = docs.map((d: any) => d.id);
  if (!ids.length) return [];
  
  const likePattern = `%${q}%`;
  const edges = await db
    .select()
    .from(semanticEdges)
    .where(
      and(
        inArray(semanticEdges.documentId, ids),
        or(
          sql`${semanticEdges.from} ILIKE ${likePattern}`,
          sql`${semanticEdges.to} ILIKE ${likePattern}`
        )
      )
    );
  return edges;
}
