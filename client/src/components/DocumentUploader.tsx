import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Upload, CheckCircle, XCircle, Clock, Users, Calendar } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface ProcessedDocument {
  filename: string;
  metadata: {
    clientName?: string;
    appointmentDate?: string;
    sessionType?: string;
    documentType: 'progress_note' | 'assessment' | 'treatment_plan' | 'other';
    confidence: number;
    extractedText: string;
    processingNotes?: string[];
  };
  suggestedClientId?: string;
  suggestedSessionId?: string;
}

interface BatchResult {
  totalFiles: number;
  successfullyProcessed: number;
  failedFiles: string[];
  documents: ProcessedDocument[];
}

export function DocumentUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(acceptedFiles);
    setResults(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: true
  });

  const processDocuments = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append(`documents`, file);
      });

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/documents/batch-process', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();

      clearInterval(progressInterval);
      setProgress(100);

      setResults(result);
      toast({
        title: "Processing Complete",
        description: `Successfully processed ${result.successfullyProcessed} of ${result.totalFiles} documents.`,
      });

    } catch (error) {
      console.error('Document processing error:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const getDocumentTypeColor = (type: string) => {
    const colors = {
      progress_note: 'bg-blue-100 text-blue-800',
      assessment: 'bg-green-100 text-green-800',
      treatment_plan: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || colors.other;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6" data-testid="document-uploader">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Document Processing Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              data-testid="drop-zone"
            >
              <input {...getInputProps()} />
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              {isDragActive ? (
                <p className="text-lg font-medium text-blue-600">Drop files here...</p>
              ) : (
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Drag & drop documents here
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Supports PDF, DOCX, and TXT files
                  </p>
                  <Button variant="outline" data-testid="button-select-files">
                    Select Files
                  </Button>
                </div>
              )}
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
                <ScrollArea className="h-32 border rounded p-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Processing Controls */}
            <div className="flex items-center gap-4">
              <Button 
                onClick={processDocuments}
                disabled={selectedFiles.length === 0 || uploading}
                className="flex-1"
                data-testid="button-process-documents"
              >
                {uploading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Process Documents
                  </>
                )}
              </Button>
              
              {selectedFiles.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedFiles([]);
                    setResults(null);
                  }}
                  data-testid="button-clear-files"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing documents...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Processing Results</span>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {results.successfullyProcessed} Success
                </Badge>
                {results.failedFiles.length > 0 && (
                  <Badge variant="outline" className="bg-red-50">
                    <XCircle className="h-3 w-3 mr-1" />
                    {results.failedFiles.length} Failed
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="processed" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="processed">Processed Documents</TabsTrigger>
                <TabsTrigger value="failed">Failed Files</TabsTrigger>
              </TabsList>

              <TabsContent value="processed" className="space-y-4">
                {results.documents.length === 0 ? (
                  <Alert>
                    <AlertDescription>No documents were successfully processed.</AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {results.documents.map((doc, index) => (
                        <Card key={index} className="border-l-4 border-l-blue-500">
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-sm">{doc.filename}</h4>
                                <div className="flex gap-2">
                                  <Badge className={getDocumentTypeColor(doc.metadata.documentType)}>
                                    {doc.metadata.documentType.replace('_', ' ')}
                                  </Badge>
                                  <Badge className={getConfidenceColor(doc.metadata.confidence)}>
                                    {(doc.metadata.confidence * 100).toFixed(0)}% confidence
                                  </Badge>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-gray-400" />
                                  <span className="text-gray-600">Client:</span>
                                  <span className="font-medium">
                                    {doc.metadata.clientName || 'Not identified'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span className="text-gray-600">Date:</span>
                                  <span className="font-medium">
                                    {doc.metadata.appointmentDate || 'Not identified'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-gray-400" />
                                  <span className="text-gray-600">Session:</span>
                                  <span className="font-medium">
                                    {doc.metadata.sessionType || 'Not identified'}
                                  </span>
                                </div>
                              </div>

                              {doc.metadata.processingNotes && doc.metadata.processingNotes.length > 0 && (
                                <div className="text-xs text-gray-500">
                                  <strong>Notes:</strong> {doc.metadata.processingNotes.join(', ')}
                                </div>
                              )}

                              <div className="flex gap-2 pt-2">
                                <Button size="sm" variant="outline" data-testid={`button-review-${index}`}>
                                  Review & Import
                                </Button>
                                <Button size="sm" variant="ghost" data-testid={`button-view-text-${index}`}>
                                  View Text
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="failed" className="space-y-4">
                {results.failedFiles.length === 0 ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>All files were processed successfully!</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {results.failedFiles.map((filename, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">{filename}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}