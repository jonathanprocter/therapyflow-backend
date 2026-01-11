import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  documentId: string;
  filename: string;
  status: string;
}

interface ProcessResult {
  documentId: string;
  status: string;
  charCount?: number;
  qualityScore?: number;
  error?: string;
  aiResultId?: string;
  edgesCount?: number;
}

export default function DocumentsUpload() {
  const [clientId, setClientId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [processResults, setProcessResults] = useState<ProcessResult[]>([]);
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!clientId || !appointmentDate || !files?.length) {
      toast({
        title: "Missing Information",
        description: "Please provide client ID, appointment date, and select files",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setUploadResults([]);
    
    try {
      const formData = new FormData();
      formData.append('clientId', clientId);
      formData.append('appointmentDate', appointmentDate);
      
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      setUploadResults(result.uploaded || []);
      
      toast({
        title: "Upload Successful",
        description: `${result.uploaded?.length || 0} documents uploaded`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleProcessBatch = async () => {
    if (!uploadResults.length) {
      toast({
        title: "No Documents",
        description: "Upload documents first",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    setProcessResults([]);

    try {
      const documentIds = uploadResults.map(r => r.documentId);
      
      const response = await fetch('/api/documents/process-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          appointmentDate,
          documentIds
        })
      });

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.status}`);
      }

      const result = await response.json();
      setProcessResults(result.results || []);
      
      const successful = result.results?.filter((r: ProcessResult) => !r.error).length || 0;
      toast({
        title: "Processing Complete",
        description: `${successful}/${result.results?.length || 0} documents processed successfully`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Processing Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" style={{ backgroundColor: '#F2F3F1', minHeight: '100vh' }}>
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#344C3D' }}>Document Upload & Processing</h1>
        <p className="mt-2" style={{ color: '#738A6E' }}>
          Upload clinical documents for AI-powered analysis and semantic processing
        </p>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
            <Upload className="h-5 w-5" style={{ color: '#88A5BC' }} />
            Upload Documents
          </CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Upload PDFs, DOCX, or text files for processing through the CareNotesAI pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId" style={{ color: '#344C3D' }}>Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g., client-123"
                className="bg-white border border-teal/30 focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)' }}
                data-testid="input-client-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentDate" style={{ color: '#344C3D' }}>Appointment Date</Label>
              <Input
                id="appointmentDate"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="bg-white border border-teal/30 focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)' }}
                data-testid="input-appointment-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="files" style={{ color: '#344C3D' }}>Documents</Label>
            <Input
              id="files"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => setFiles(e.target.files)}
              className="bg-white border border-teal/30 focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
              style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)' }}
              data-testid="input-files"
            />
            <p className="text-sm" style={{ color: '#738A6E' }}>
              Supported formats: PDF, DOCX, DOC, TXT
            </p>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={uploading || !clientId || !appointmentDate || !files?.length}
            className="w-full hover:bg-opacity-90 focus:ring-2 focus:ring-[#8EA58C] focus:ring-offset-0"
            style={{ 
              backgroundColor: '#8EA58C', 
              borderColor: '#8EA58C',
              color: '#FFFFFF'
            }}
            data-testid="button-upload"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Documents
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {uploadResults.length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
              <FileText className="h-5 w-5" style={{ color: '#88A5BC' }} />
              Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadResults.map((result) => (
                <div 
                  key={result.documentId} 
                  className="flex items-center justify-between p-3 border rounded"
                  style={{ borderColor: 'rgba(115, 138, 110, 0.2)' }}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4" style={{ color: '#8EA58C' }} />
                    <span className="font-medium" style={{ color: '#344C3D' }}>{result.filename}</span>
                  </div>
                  <span className="text-sm" style={{ color: '#738A6E' }}>
                    ID: {result.documentId.substring(0, 8)}...
                  </span>
                </div>
              ))}
            </div>

            <Button 
              onClick={handleProcessBatch} 
              disabled={processing}
              className="w-full mt-4 hover:bg-opacity-90 focus:ring-2 focus:ring-[#8EA58C] focus:ring-offset-0"
              style={{ 
                backgroundColor: '#8EA58C', 
                borderColor: '#8EA58C',
                color: '#FFFFFF'
              }}
              data-testid="button-process-batch"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Process All Documents (Parse + AI Analysis)"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {processResults.length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle style={{ color: '#344C3D' }}>Processing Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processResults.map((result) => (
                <div 
                  key={result.documentId} 
                  className="p-3 border rounded"
                  style={{ borderColor: 'rgba(115, 138, 110, 0.2)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.error ? (
                        <AlertCircle className="h-4 w-4" style={{ color: '#738A6E' }} />
                      ) : (
                        <CheckCircle className="h-4 w-4" style={{ color: '#8EA58C' }} />
                      )}
                      <span className="font-medium" style={{ color: '#344C3D' }}>
                        Doc: {result.documentId.substring(0, 8)}...
                      </span>
                    </div>
                    <span className="text-sm" style={{ color: '#738A6E' }}>
                      {result.status}
                    </span>
                  </div>
                  
                  {result.error && (
                    <p className="text-sm mt-1" style={{ color: '#738A6E' }}>{result.error}</p>
                  )}
                  
                  {result.charCount && (
                    <div className="text-sm mt-1" style={{ color: '#738A6E' }}>
                      Extracted: {result.charCount} characters
                      {result.qualityScore && ` (Quality: ${result.qualityScore}%)`}
                      {result.edgesCount && ` • ${result.edgesCount} semantic edges`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}