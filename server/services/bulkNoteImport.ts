import { aiService } from "./aiService";
import { storage } from "../storage";

const DATE_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i,
];

function splitIntoChunks(rawText: string): { index: number; text: string; dateHint?: string }[] {
  const lines = rawText.split(/\r?\n/);
  const chunks: { index: number; text: string; dateHint?: string }[] = [];
  let current: string[] = [];
  let currentDate: string | undefined;
  let index = 0;

  const flush = () => {
    if (current.length === 0) return;
    const text = current.join("\n").trim();
    if (text.length > 0) {
      chunks.push({ index, text, dateHint: currentDate });
      index += 1;
    }
    current = [];
    currentDate = undefined;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const dateMatch = DATE_PATTERNS.map((pattern) => trimmed.match(pattern)).find(Boolean);
    if (dateMatch) {
      flush();
      currentDate = dateMatch[0];
    }
    current.push(line);
  }

  flush();
  return chunks.length > 0 ? chunks : [{ index: 0, text: rawText }];
}

function normalizeDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

function findSessionIdByDate(
  sessions: any[],
  dateString: string | null,
  toleranceDays: number
): string | null {
  if (!dateString) return null;
  const target = new Date(dateString);
  if (isNaN(target.getTime())) return null;

  const exactMatch = sessions.find(session => {
    const sessionDate = new Date(session.scheduledAt);
    return sessionDate.toDateString() === target.toDateString();
  });
  if (exactMatch) return exactMatch.id;

  if (toleranceDays <= 0) return null;

  let closest: { id: string; diff: number } | null = null;
  for (const session of sessions) {
    const sessionDate = new Date(session.scheduledAt);
    const diffDays = Math.abs(sessionDate.getTime() - target.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays <= toleranceDays) {
      if (!closest || diffDays < closest.diff) {
        closest = { id: session.id, diff: diffDays };
      }
    }
  }

  return closest ? closest.id : null;
}

export async function bulkImportProgressNotes(
  clientId: string,
  therapistId: string,
  rawText: string,
  options?: { dryRun?: boolean; createPlaceholdersForMissing?: boolean; dateToleranceDays?: number; includeIndices?: number[] }
) {
  const dryRun = options?.dryRun ?? false;
  const createPlaceholdersForMissing = options?.createPlaceholdersForMissing ?? false;
  const dateToleranceDays = options?.dateToleranceDays ?? 0;
  const includeIndices = options?.includeIndices ?? null;
  const chunks = splitIntoChunks(rawText);
  const sessions = await storage.getSessions(clientId);
  const results: any[] = [];

  for (const chunk of chunks) {
    if (includeIndices && !includeIndices.includes(chunk.index)) {
      continue;
    }
    const prompt = `
You are an expert clinical therapist. Extract a single progress note from the text.
Return JSON only:
{
  "sessionDate": "YYYY-MM-DD",
  "content": "full progress note content",
  "confidence": 0-1
}

Text:
${chunk.text}
`;

    let extracted: any = {};
    try {
      const aiResponse = await aiService.processTherapyDocument(chunk.text, prompt);
      extracted = JSON.parse(aiResponse);
    } catch (error) {
      extracted = {};
    }

    const sessionDate =
      normalizeDate(extracted.sessionDate) ||
      normalizeDate(chunk.dateHint) ||
      null;

    const sessionId = findSessionIdByDate(sessions, sessionDate, dateToleranceDays);

    if (sessionId) {
      const existing = await storage.getProgressNotesBySession(sessionId);
      if (existing.length > 0) {
        results.push({
          index: chunk.index,
          sessionDate,
          sessionId,
          status: "skipped_existing_note",
          noteId: existing[0].id,
        });
        continue;
      }
    }

    const confidence = typeof extracted.confidence === "number" ? extracted.confidence : 0.5;

    if (dryRun) {
      results.push({
        index: chunk.index,
        sessionDate,
        sessionId,
        status: sessionId ? "ready" : "needs_match",
        confidence
      });
      continue;
    }

    const note = await storage.createProgressNote({
      clientId,
      sessionId: sessionId || undefined,
      therapistId,
      sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
      content: extracted.content || chunk.text,
      status: sessionId ? "uploaded" : "manual_review",
      isPlaceholder: false,
      requiresManualReview: !sessionId || confidence < 0.7,
      aiConfidenceScore: confidence,
      tags: [],
      aiTags: []
    });

    results.push({
      index: chunk.index,
      sessionDate,
      sessionId,
      status: note.requiresManualReview ? "manual_review" : "created",
      noteId: note.id,
      confidence
    });
  }

  if (!dryRun && createPlaceholdersForMissing) {
    for (const result of results.filter(r => !r.sessionId)) {
      if (!result.sessionDate) continue;
      const sessionDate = new Date(result.sessionDate);
      const matches = sessions.filter(session =>
        new Date(session.scheduledAt).toDateString() === sessionDate.toDateString()
      );

      for (const session of matches) {
        const existingNotes = await storage.getProgressNotesBySession(session.id);
        if (existingNotes.length > 0) continue;
        await storage.createProgressNotePlaceholder(
          session.id,
          session.clientId,
          session.therapistId,
          session.scheduledAt
        );
        await storage.updateSession(session.id, {
          hasProgressNotePlaceholder: true,
          progressNoteStatus: 'placeholder'
        });
      }
    }
  }

  return {
    total: results.length,
    matchedSessions: results.filter(r => r.sessionId).length,
    missingSessions: results.filter(r => !r.sessionId).length,
    results
  };
}
