import fs from "fs/promises";
import path from "path";
import { getDocument, updateDocumentParsed } from "../storage-extensions";

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
  const doc = await getDocument(documentId);
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  
  const filePath = doc.meta?.filePath as string | undefined;
  if (!filePath) throw new Error(`Missing file path for document ${documentId}`);

  let text = "";
  let meta: any = { method: "enhanced-processor" };
  let qualityScore = 0;
  
  try {
    const data = await fs.readFile(filePath);
    
    // Use our enhanced document processor
    const result = await processor.processDocument(data, doc.filename || "document.pdf");
    
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
    
    // Fallback to basic extraction
    try {
      const data = await fs.readFile(filePath);
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
  await updateDocumentParsed(documentId, text, meta);
  
  return { text, meta, qualityScore };
}