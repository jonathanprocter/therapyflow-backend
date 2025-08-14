import fs from "fs/promises";
import path from "path";
import { storage } from "../storage";

// Use the enhanced document processor we already have
import { EnhancedDocumentProcessor } from "./enhanced-document-processor";

const processor = new EnhancedDocumentProcessor();

function cleanFallback(raw: Buffer | string) {
  const text = (typeof raw === "string" ? raw : raw.toString("utf-8"))
    .replace(/\r/g, "\n")
    .replace(/(?:obj|endobj|stream|endstream|xref|trailer|startxref)[\s\S]*?/gi, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

export async function parsePDF(documentId: string) {
  const doc = await storage.getDocument(documentId);
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  
  // Get buffer data from metadata instead of file path
  const bufferArray = doc.metadata?.buffer as number[] | undefined;
  if (!bufferArray) throw new Error(`Missing buffer data for document ${documentId}`);

  let text = "";
  let meta: any = { method: "enhanced-processor" };
  let qualityScore = 0;
  
  try {
    // Convert array back to Buffer
    const data = Buffer.from(bufferArray);
    
    // Use our enhanced document processor with therapist ID
    const result = await processor.processDocument(data, doc.fileName || "document.pdf", doc.therapistId);
    
    text = result.extractedText || "";
    qualityScore = result.overallQuality || 0;
    
    meta = {
      method: "enhanced-processor",
      quality: qualityScore,
      aiAnalysis: result.aiAnalysis,
      validation: result.validation,
      processingNotes: result.processingNotes
    };
    
    if (text.length < 50) {
      console.warn(`PDF parsing yielded very short text (${text.length} chars)`);
      throw new Error("Extracted text too short, likely corrupted PDF");
    }
    
    console.log(`✅ PDF parsing successful: ${text.length} chars, quality: ${qualityScore}%`);
    
  } catch (error) {
    console.warn('⚠️ Enhanced processing failed, trying basic extraction:', error);
    
    // Fallback to basic extraction using the buffer data
    try {
      const data = Buffer.from(bufferArray);
      text = cleanFallback(data);
      qualityScore = text.length > 100 ? 40 : 10;
      meta = { method: "fallback", error: String(error) };
      
      if (text.length < 50) {
        throw new Error("All extraction methods failed - document appears corrupted");
      }
    } catch (fallbackError) {
      throw new Error(`PDF parsing failed: ${fallbackError}`);
    }
  }

  // Update document with parsed text
  await storage.updateDocument(documentId, { parsedText: text, metadata: { ...doc.metadata, ...meta } });
  
  return { text, meta, qualityScore };
}