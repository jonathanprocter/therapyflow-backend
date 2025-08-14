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

export async function getAIResult(documentId: string) {
  // For now, return a simple structure until we need full AI results
  return null;
}

export const createAIResult = storage.createAIResult;