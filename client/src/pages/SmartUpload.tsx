import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Brain, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SmartParsingResult {
  suggestedClientId: string;
  suggestedAppointmentDate: string;
  clientNameConfidence: number;
  dateConfidence: number;
  sessionType: string;
}

interface ProcessResult {
  documentId: string;
  status: string;
  charCount?: number;
  qualityScore?: number;
  error?: string;
  aiResultId?: string;
  edgesCount?: number;
  smartParsing?: SmartParsingResult;
}

export default function SmartUpload() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [processResults, setProcessResults] = useState<ProcessResult[]>([]);
  const { toast } = useToast();

  const handleSmartUpload = async () => {
    if (!files?.length) {
      toast({
        title: "No Files Selected",
        description: "Please select files to upload",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setProcessing(true);
    setUploadResults([]);
    setProcessResults([]);
    
    try {
      // Step 1: Upload files without requiring client ID or date
      const formData = new FormData();
      formData.append('clientId', 'smart-parsing'); // Placeholder
      formData.append('appointmentDate', new Date().toISOString().split('T')[0]); // Today as placeholder
      
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const uploadResponse = await fetch('/api/documents/smart-upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      setUploadResults(uploadResult.uploaded || []);
      setUploading(false);

      // Step 2: Process documents with smart parsing
      const documentIds = uploadResult.uploaded?.map((r: any) => r.documentId) || [];
      
      const processResponse = await fetch('/api/documents/smart-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds })
      });

      if (!processResponse.ok) {
        throw new Error(`Processing failed: ${processResponse.status}`);
      }

      const processResult = await processResponse.json();
      setProcessResults(processResult.results || []);
      
      toast({
        title: "Smart Processing Complete",
        description: `AI extracted client information from ${processResult.results?.length || 0} documents`
      });

    } catch (error) {
      console.error('Smart upload error:', error);
      toast({
        title: "Upload Failed",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "bg-green-100 text-green-800";
    if (confidence >= 70) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-blue-600" />
          Smart Document Upload
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload clinical documents and let AI automatically extract client names, appointment dates, and clinical information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Powered Document Processing
          </CardTitle>
          <CardDescription>
            Just upload your documents - the AI will automatically identify clients, dates, and extract clinical data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="files">Documents</Label>
            <Input
              id="files"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => setFiles(e.target.files)}
              data-testid="input-smart-files"
            />
            <p className="text-sm text-muted-foreground">
              Supported formats: PDF, DOCX, DOC, TXT
            </p>
          </div>

          <Button 
            onClick={handleSmartUpload} 
            disabled={uploading || processing || !files?.length}
            className="w-full"
            data-testid="button-smart-upload"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : processing ? (
              <>
                <Brain className="h-4 w-4 mr-2 animate-spin" />
                AI Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Smart Upload & Process
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {processResults.length > 0 && (
        <div className="space-y-4">
          {processResults.map((result) => (
            <Card key={result.documentId} data-testid={`card-smart-result-${result.documentId}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Document Analysis
                    </CardTitle>
                    <CardDescription>
                      ID: {result.documentId.substring(0, 8)}... • Status: {result.status}
                    </CardDescription>
                  </div>
                  {result.error ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.error && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-red-800 text-sm">{result.error}</p>
                  </div>
                )}
                
                {result.smartParsing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-blue-50">
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Client Information</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Suggested ID:</span>
                            <Badge variant="outline" className="font-mono">
                              {result.smartParsing.suggestedClientId}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Confidence:</span>
                            <Badge className={getConfidenceColor(result.smartParsing.clientNameConfidence)}>
                              {result.smartParsing.clientNameConfidence}%
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50">
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Appointment Details</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Date:</span>
                            <Badge variant="outline">
                              {result.smartParsing.suggestedAppointmentDate}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Session Type:</span>
                            <Badge variant="outline">
                              {result.smartParsing.sessionType}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Confidence:</span>
                            <Badge className={getConfidenceColor(result.smartParsing.dateConfidence)}>
                              {result.smartParsing.dateConfidence}%
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {result.charCount && (
                  <div className="text-sm text-muted-foreground">
                    Processed: {result.charCount} characters
                    {result.qualityScore && ` • Quality: ${result.qualityScore}%`}
                    {result.edgesCount && ` • Semantic connections: ${result.edgesCount}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {files && files.length > 0 && processResults.length === 0 && !uploading && !processing && (
        <Card>
          <CardContent className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready for Smart Processing</h3>
            <p className="text-muted-foreground">
              {files.length} file{files.length > 1 ? 's' : ''} selected. Click "Smart Upload & Process" to begin AI analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}