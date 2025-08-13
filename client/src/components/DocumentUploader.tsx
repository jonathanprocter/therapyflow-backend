import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Check, AlertCircle, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  success: boolean;
  clientId?: string;
  sessionId?: string;
  progressNoteId?: string;
  confidence: number;
  processingNotes: string;
  needsManualReview: boolean;
  extractedData: {
    clientName?: string;
    sessionDate?: Date;
    content: string;
    sessionType?: string;
    riskLevel?: string;
  };
  fileName?: string;
  error?: string;
}

interface DocumentUploaderProps {
  onUploadComplete?: (results: UploadResult[]) => void;
  allowMultiple?: boolean;
  maxFiles?: number;
}

export function DocumentUploader({ 
  onUploadComplete, 
  allowMultiple = true, 
  maxFiles = 10 
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      
      if (files.length === 1) {
        formData.append('document', files[0]);
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData
        });
        return response.json();
      } else {
        files.forEach(file => formData.append('documents', file));
        const response = await fetch('/api/documents/process-batch', {
          method: 'POST',
          body: formData
        });
        return response.json();
      }
    },
    onSuccess: (data: any) => {
      if (Array.isArray(data.results)) {
        setResults(data.results);
        onUploadComplete?.(data.results);
      } else {
        setResults([data]);
        onUploadComplete?.([data]);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
      
      toast({
        title: "Upload Complete",
        description: Array.isArray(data.results) 
          ? `Processed ${data.successful} documents successfully`
          : "Document processed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process documents",
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const supportedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/rtf',
      'application/rtf'
    ];
    
    const validFiles = acceptedFiles.filter(file => supportedTypes.includes(file.type));
    
    if (validFiles.length === 0) {
      toast({
        title: "Invalid File Type",
        description: "Supported formats: TXT (recommended), PDF, DOCX, DOC, RTF",
        variant: "destructive",
      });
      return;
    }

    if (validFiles.length > maxFiles) {
      toast({
        title: "Too Many Files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setResults([]);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 10;
      });
    }, 300);

    uploadMutation.mutate(validFiles, {
      onSuccess: (data) => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        toast({
          title: "Processing Complete!",
          description: `Successfully processed ${data.successful} out of ${data.processed} documents`,
        });
        
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          onUploadComplete?.(data.results);
        }, 1500);
      },
      onError: (error) => {
        clearInterval(progressInterval);
        setUploadProgress(0);
        setUploading(false);
        
        toast({
          title: "Processing Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  }, [uploadMutation, maxFiles, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/rtf': ['.rtf'],
      'application/rtf': ['.rtf']
    },
    multiple: allowMultiple,
    maxFiles,
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRiskLevelColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'high':
      case 'critical':
        return 'destructive';
      case 'moderate':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6" data-testid="document-uploader">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Progress Note Upload & Processing
          </CardTitle>
          <CardDescription>
            Upload progress notes (TXT recommended, PDF, DOCX, DOC, RTF supported) for automatic client matching and session assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50' 
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
            data-testid="upload-dropzone"
          >
            <input {...getInputProps()} />
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 dark:text-blue-400 font-medium">
                Drop files here...
              </p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Drag & drop progress notes here
                </p>
                <p className="text-gray-500 mb-4">
                  TXT (recommended), PDF, DOCX, DOC, RTF supported
                </p>
                <Button variant="outline" disabled={uploading} data-testid="button-browse">
                  Browse Files
                </Button>
              </div>
            )}
            
            {allowMultiple && (
              <p className="text-sm text-gray-500 mt-4">
                Maximum {maxFiles} files • TXT, PDF, DOCX, DOC, RTF formats
              </p>
            )}
          </div>

          {uploading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Processing documents...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Results</CardTitle>
            <CardDescription>
              {results.filter(r => r.success).length} of {results.length} documents processed successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((result, index) => (
              <div 
                key={index} 
                className="border rounded-lg p-4 space-y-3"
                data-testid={`result-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {result.fileName || `Document ${index + 1}`}
                    </span>
                  </div>
                  
                  {result.success && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div 
                          className={`h-2 w-2 rounded-full ${getConfidenceColor(result.confidence)}`}
                        />
                        <span className="text-sm text-gray-600">
                          {Math.round(result.confidence * 100)}% confidence
                        </span>
                      </div>
                      
                      {result.needsManualReview && (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Manual Review
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {result.success ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Client:</strong> {result.extractedData.clientName || 'Unknown'}
                    </div>
                    <div>
                      <strong>Session Date:</strong> {
                        result.extractedData.sessionDate 
                          ? new Date(result.extractedData.sessionDate).toLocaleDateString()
                          : 'Not found'
                      }
                    </div>
                    <div>
                      <strong>Session Type:</strong> {result.extractedData.sessionType || 'Individual'}
                    </div>
                    <div>
                      <strong>Risk Level:</strong> 
                      <Badge 
                        variant={getRiskLevelColor(result.extractedData.riskLevel)} 
                        className="ml-2"
                      >
                        {result.extractedData.riskLevel || 'Low'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {result.error || 'Processing failed'}
                    </AlertDescription>
                  </Alert>
                )}

                {result.processingNotes && (
                  <div className="text-sm text-gray-600 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    <strong>Processing Notes:</strong> {result.processingNotes}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}