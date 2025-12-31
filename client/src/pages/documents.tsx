import { DocumentUploader } from '@/components/DocumentUploader';

export default function Documents() {
  return (
    <div className="space-y-6 p-6" style={{ backgroundColor: '#F2F3F1', minHeight: '100vh' }} data-testid="documents-page">
      <div 
        className="pb-4"
        style={{ borderBottom: '1px solid rgba(115, 138, 110, 0.2)' }}
      >
        <h1 
          className="text-2xl font-bold" 
          style={{ color: '#344C3D' }}
          data-testid="page-title"
        >
          Document Processing Center
        </h1>
        <p 
          className="mt-2" 
          style={{ color: '#738A6E' }}
          data-testid="page-description"
        >
          Upload and process PDF, DOCX, and text documents with AI-powered client identification and appointment date tagging.
        </p>
      </div>

      <DocumentUploader />
    </div>
  );
}