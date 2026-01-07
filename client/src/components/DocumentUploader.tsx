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
    if (confidence >= 0.8) return { backgroundColor: '#8EA58C' };
    if (confidence >= 0.6) return { backgroundColor: '#88A5BC' };
    return { backgroundColor: '#738A6E' };
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
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
            <Upload className="h-5 w-5" style={{ color: '#88A5BC' }} />
            Progress Note Upload & Processing
          </CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Upload progress notes (TXT recommended, PDF, DOCX, DOC, RTF supported) for automatic client matching and session assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
            style={{
              borderColor: isDragActive ? '#88A5BC' : 'rgba(115, 138, 110, 0.3)',
              backgroundColor: isDragActive ? 'rgba(136, 165, 188, 0.05)' : 'transparent'
            }}
            data-testid="upload-dropzone"
          >
            <input {...getInputProps()} />
            <FileText className="mx-auto h-12 w-12 mb-4" style={{ color: 'rgba(115, 138, 110, 0.4)' }} />
            {isDragActive ? (
              <p className="font-medium" style={{ color: '#88A5BC' }}>
                Drop files here...
              </p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2" style={{ color: '#344C3D' }}>
                  Drag & drop progress notes here
                </p>
                <p className="mb-4" style={{ color: '#738A6E' }}>
                  TXT (recommended), PDF, DOCX, DOC, RTF supported
                </p>
                <Button 
                  variant="outline" 
                  disabled={uploading} 
                  data-testid="button-browse"
                  style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                  className="hover:bg-opacity-10"
                >
                  Browse Files
                </Button>
              </div>
            )}
            
            {allowMultiple && (
              <p className="text-sm mt-4" style={{ color: '#738A6E' }}>
                Maximum {maxFiles} files • TXT, PDF, DOCX, DOC, RTF formats
              </p>
            )}
          </div>

          {uploading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: '#344C3D' }}>Processing documents...</span>
                <span className="text-sm" style={{ color: '#738A6E' }}>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle style={{ color: '#344C3D' }}>Processing Results</CardTitle>
            <CardDescription style={{ color: '#738A6E' }}>
              {results.filter(r => r.success).length} of {results.length} documents processed successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((result, index) => (
              <div 
                key={index} 
                className="border rounded-lg p-4 space-y-3"
                style={{ borderColor: 'rgba(115, 138, 110, 0.2)' }}
                data-testid={`result-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <Check className="h-5 w-5" style={{ color: '#8EA58C' }} />
                    ) : (
                      <X className="h-5 w-5" style={{ color: '#738A6E' }} />
                    )}
                    <span className="font-medium" style={{ color: '#344C3D' }}>
                      {result.fileName || `Document ${index + 1}`}
                    </span>
                  </div>
                  
                  {result.success && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div 
                          className="h-2 w-2 rounded-full"
                          style={getConfidenceColor(result.confidence)}
                        />
                        <span className="text-sm" style={{ color: '#738A6E' }}>
                          {Math.round(result.confidence * 100)}% confidence
                        </span>
                      </div>
                      
                      {result.needsManualReview && (
                        <Badge 
                          variant="secondary" 
                          className="gap-1"
                          style={{ backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' }}
                        >
                          <AlertCircle className="h-3 w-3" />
                          Manual Review
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {result.success ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" style={{ color: '#738A6E' }}>
                    <div>
                      <strong style={{ color: '#344C3D' }}>Client:</strong> {result.extractedData.clientName || 'Unknown'}
                    </div>
                    <div>
                      <strong style={{ color: '#344C3D' }}>Session Date:</strong> {
                        result.extractedData.sessionDate 
                          ? new Date(result.extractedData.sessionDate).toLocaleDateString()
                          : 'Not found'
                      }
                    </div>
                    <div>
                      <strong style={{ color: '#344C3D' }}>Session Type:</strong> {result.extractedData.sessionType || 'Individual'}
                    </div>
                    <div>
                      <strong style={{ color: '#344C3D' }}>Risk Level:</strong> 
                      <Badge 
                        className="ml-2"
                        style={{ 
                          backgroundColor: '#8EA58C', 
                          color: 'white'
                        }}
                      >
                        {result.extractedData.riskLevel || 'Low'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <Alert className="border" style={{ borderColor: 'rgba(115, 138, 110, 0.3)', backgroundColor: 'rgba(115, 138, 110, 0.05)' }}>
                    <AlertCircle className="h-4 w-4" style={{ color: '#738A6E' }} />
                    <AlertDescription style={{ color: '#738A6E' }}>
                      {result.error || 'Processing failed'}
                    </AlertDescription>
                  </Alert>
                )}

                {result.processingNotes && (
                  <div className="text-sm p-3 rounded" style={{ color: '#738A6E', backgroundColor: 'rgba(115, 138, 110, 0.05)' }}>
                    <strong style={{ color: '#344C3D' }}>Processing Notes:</strong> {result.processingNotes}
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