import { storage } from "./storage";

export async function createDocument({ clientId, appointmentDate, filename, mimeType, meta }: {
  clientId: string; 
  appointmentDate: string; 
  filename: string; 
  mimeType: string; 
  meta?: any;
}) {
  const insertDoc = {
    clientId,
    therapistId: "dr-jonathan-procter",
    fileName: filename,
    fileType: mimeType,
    filePath: meta?.filePath || "",
    metadata: {
      ...meta,
      appointmentDate,
      status: "uploaded"
    }
  };
  
  const document = await storage.createDocument(insertDoc);
  return {
    ...document,
    appointmentDate,
    status: "uploaded"
  };
}

export async function getDocument(documentId: string) {
  return await storage.getDocument(documentId);
}

export async function updateDocumentParsed(documentId: string, text: string, meta?: any) {
  const document = await storage.getDocument(documentId);
  if (!document) throw new Error("Document not found");
  
  const updated = await storage.updateDocument(documentId, {
    extractedText: text,
    metadata: {
      ...document.metadata,
      ...meta,
      status: "parsed",
      updatedAt: new Date().toISOString()
    }
  });
  
  return {
    ...updated,
    text: updated.extractedText,
    status: "parsed"
  };
}

export async function getAIResult(documentId: string) {
  // For now, return a simple structure until we need full AI results
  return null;
}

export async function saveAIResult(data: any) {
  return await storage.createAIResult(data);
}

export async function upsertAppointment(data: any) {
  // Placeholder - not implemented yet
  return { id: "placeholder" };
}

export async function upsertEdges(data: any) {
  // Placeholder - not implemented yet
  return [];
}

export async function listAIResultsForClient(clientId: string) {
  // Placeholder - not implemented yet
  return [];
}

export const createAIResult = storage.createAIResult;