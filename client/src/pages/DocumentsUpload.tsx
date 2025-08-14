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
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: String(error),
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
      console.error('Processing error:', error);
      toast({
        title: "Processing Failed",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Document Upload & Processing</h1>
        <p className="text-muted-foreground mt-2">
          Upload clinical documents for AI-powered analysis and semantic processing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Upload PDFs, DOCX, or text files for processing through the CareNotesAI pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g., client-123"
                data-testid="input-client-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Appointment Date</Label>
              <Input
                id="appointmentDate"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                data-testid="input-appointment-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="files">Documents</Label>
            <Input
              id="files"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => setFiles(e.target.files)}
              data-testid="input-files"
            />
            <p className="text-sm text-muted-foreground">
              Supported formats: PDF, DOCX, DOC, TXT
            </p>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={uploading || !clientId || !appointmentDate || !files?.length}
            className="w-full"
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadResults.map((result) => (
                <div key={result.documentId} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{result.filename}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ID: {result.documentId.substring(0, 8)}...
                  </span>
                </div>
              ))}
            </div>

            <Button 
              onClick={handleProcessBatch} 
              disabled={processing}
              className="w-full mt-4"
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
        <Card>
          <CardHeader>
            <CardTitle>Processing Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processResults.map((result) => (
                <div key={result.documentId} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.error ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      <span className="font-medium">
                        Doc: {result.documentId.substring(0, 8)}...
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {result.status}
                    </span>
                  </div>
                  
                  {result.error && (
                    <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  )}
                  
                  {result.charCount && (
                    <div className="text-sm text-muted-foreground mt-1">
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