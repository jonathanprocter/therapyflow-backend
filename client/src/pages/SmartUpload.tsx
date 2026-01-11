import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Brain, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
  const [useAsyncProcessing, setUseAsyncProcessing] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
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
      
      if (useAsyncProcessing) {
        const asyncResult = await apiRequest('/api/documents/smart-process-async', {
          method: 'POST',
          body: JSON.stringify({ documentIds })
        });
        setJobId(asyncResult.jobId);
        setJobStatus(asyncResult.status);
      } else {
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
      }
      
      if (!useAsyncProcessing) {
        toast({
          title: "Smart Processing Complete",
          description: `AI extracted client information from ${processResults.length || 0} documents`
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      if (!useAsyncProcessing) {
        setProcessing(false);
      }
    }
  };

  React.useEffect(() => {
    if (!jobId) return;

    let isActive = true;
    const pollJob = async () => {
      try {
        const data = await apiRequest(`/api/jobs/${jobId}`);
        if (!isActive) return;
        setJobStatus(data.status);

        if (data.status === 'completed') {
          setProcessResults(data.result?.results || []);
          setProcessing(false);
          loadJobHistory();
          toast({
            title: "Smart Processing Complete",
            description: `AI extracted client information from ${data.result?.results?.length || 0} documents`
          });
        }

        if (data.status === 'failed') {
          setProcessing(false);
          loadJobHistory();
          toast({
            title: "Smart Processing Failed",
            description: data.error || "Processing failed. Please try again.",
            variant: "destructive"
          });
        }
      } catch (err) {
        console.error('Job polling failed', err);
      }
    };

    const interval = setInterval(pollJob, 2000);
    pollJob();

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [jobId]);

  const loadJobHistory = async () => {
    try {
      const data = await apiRequest('/api/jobs?limit=25');
      setJobHistory(data.jobs || []);
    } catch (error) {
      console.error('Failed to load job history', error);
    }
  };

  React.useEffect(() => {
    loadJobHistory();
    const interval = setInterval(loadJobHistory, 15000);
    return () => clearInterval(interval);
  }, []);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return { backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' };
    if (confidence >= 70) return { backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' };
    return { backgroundColor: 'rgba(115, 138, 110, 0.15)', color: '#738A6E' };
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" style={{ backgroundColor: '#F2F3F1', minHeight: '100vh' }}>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: '#344C3D' }}>
          <Sparkles className="h-8 w-8" style={{ color: '#88A5BC' }} />
          Smart Document Upload
        </h1>
        <p className="mt-2" style={{ color: '#738A6E' }}>
          Upload clinical documents and let AI automatically extract client names, appointment dates, and clinical information
        </p>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
            <Brain className="h-5 w-5" style={{ color: '#88A5BC' }} />
            AI-Powered Document Processing
          </CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Just upload your documents - the AI will automatically identify clients, dates, and extract clinical data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'rgba(136, 165, 188, 0.08)', color: '#344C3D' }}>
            <div>
              <div className="font-medium">Processing Mode</div>
              <div style={{ color: '#738A6E' }}>Use background processing for large batches.</div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useAsyncProcessing}
                onChange={(event) => setUseAsyncProcessing(event.target.checked)}
                data-testid="toggle-async-processing"
              />
              Background
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="files" style={{ color: '#344C3D' }}>Documents</Label>
            <Input
              id="files"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => setFiles(e.target.files)}
              data-testid="input-smart-files"
              className="border border-sage/30 focus:border-[#88A5BC] focus:ring-[#88A5BC]"
            />
            <p className="text-sm" style={{ color: '#738A6E' }}>
              Supported formats: PDF, DOCX, DOC, TXT
            </p>
          </div>

          <Button 
            onClick={handleSmartUpload} 
            disabled={uploading || processing || !files?.length}
            className="w-full hover:bg-opacity-90"
            style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
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
            <Card key={result.documentId} className="bg-white" data-testid={`card-smart-result-${result.documentId}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
                      <FileText className="h-5 w-5" style={{ color: '#88A5BC' }} />
                      Document Analysis
                    </CardTitle>
                    <CardDescription style={{ color: '#738A6E' }}>
                      ID: {result.documentId.substring(0, 8)}... • Status: {result.status}
                    </CardDescription>
                  </div>
                  {result.error ? (
                    <AlertCircle className="h-5 w-5" style={{ color: '#738A6E' }} />
                  ) : (
                    <CheckCircle className="h-5 w-5" style={{ color: '#8EA58C' }} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.error && (
                  <div className="rounded p-3" style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)', border: '1px solid rgba(115, 138, 110, 0.3)' }}>
                    <p className="text-sm" style={{ color: '#738A6E' }}>{result.error}</p>
                  </div>
                )}
                
                {result.smartParsing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-white" style={{ border: '1px solid rgba(136, 165, 188, 0.2)' }}>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2" style={{ color: '#344C3D' }}>Client Information</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: '#738A6E' }}>Suggested ID:</span>
                            <Badge variant="outline" className="font-mono" style={{ borderColor: '#88A5BC', color: '#88A5BC' }}>
                              {result.smartParsing.suggestedClientId}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: '#738A6E' }}>Confidence:</span>
                            <Badge style={getConfidenceColor(result.smartParsing.clientNameConfidence)}>
                              {result.smartParsing.clientNameConfidence}%
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white" style={{ border: '1px solid rgba(142, 165, 140, 0.2)' }}>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2" style={{ color: '#344C3D' }}>Appointment Details</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: '#738A6E' }}>Date:</span>
                            <Badge variant="outline" style={{ borderColor: '#8EA58C', color: '#8EA58C' }}>
                              {result.smartParsing.suggestedAppointmentDate}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: '#738A6E' }}>Session Type:</span>
                            <Badge variant="outline" style={{ borderColor: '#8EA58C', color: '#8EA58C' }}>
                              {result.smartParsing.sessionType}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: '#738A6E' }}>Confidence:</span>
                            <Badge style={getConfidenceColor(result.smartParsing.dateConfidence)}>
                              {result.smartParsing.dateConfidence}%
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {result.charCount && (
                  <div className="text-sm" style={{ color: '#738A6E' }}>
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
        <Card className="bg-white">
          <CardContent className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4" style={{ color: '#88A5BC' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>Ready for Smart Processing</h3>
            <p style={{ color: '#738A6E' }}>
              {files.length} file{files.length > 1 ? 's' : ''} selected. Click "Smart Upload & Process" to begin AI analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {processing && jobStatus && (
        <Card className="bg-white">
          <CardContent className="py-6 text-sm" style={{ color: '#738A6E' }}>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#88A5BC' }} />
              Processing job {jobId} • Status: {jobStatus}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
            <Brain className="h-5 w-5" style={{ color: '#88A5BC' }} />
            Job History
          </CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Recent async jobs with retry support for failures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobHistory.length === 0 ? (
            <p className="text-sm" style={{ color: '#738A6E' }}>No recent jobs.</p>
          ) : (
            jobHistory.map((job) => (
              <div key={job.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium" style={{ color: '#344C3D' }}>{job.type}</div>
                  <div style={{ color: '#738A6E' }}>
                    {new Date(job.createdAt).toLocaleString()} • Status: {job.status} • Retries: {job.retries || 0}/{job.maxRetries || 0}
                  </div>
                  {job.error && (
                    <div className="text-xs text-red-600">{job.error}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{job.isDead ? 'dead' : job.status}</Badge>
                  {job.status === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await apiRequest(`/api/jobs/${job.id}/retry`, { method: 'POST' });
                        loadJobHistory();
                      }}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
