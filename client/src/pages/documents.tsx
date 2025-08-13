import { DocumentUploader } from '@/components/DocumentUploader';

export default function Documents() {
  return (
    <div className="space-y-6" data-testid="documents-page">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
          Document Processing Center
        </h1>
        <p className="text-gray-600 mt-2" data-testid="page-description">
          Upload and process PDF, DOCX, and text documents with AI-powered client identification and appointment date tagging.
        </p>
      </div>

      <DocumentUploader />
    </div>
  );
}