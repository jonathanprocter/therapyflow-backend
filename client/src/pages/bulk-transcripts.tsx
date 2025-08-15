import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Users, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import type { TranscriptBatch, TranscriptFile, Client } from '@shared/schema';

interface UploadStats {
  totalBatches: number;
  totalFiles: number;
  processedFiles: number;
  filesNeedingReview: number;
  recentBatches: TranscriptBatch[];
}

export default function BulkTranscripts() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [batchName, setBatchName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch transcript statistics
  const { data: stats, isLoading: statsLoading } = useQuery<UploadStats>({
    queryKey: ['/api/transcripts/stats'],
  });

  // Fetch transcript batches
  const { data: batches, isLoading: batchesLoading } = useQuery<TranscriptBatch[]>({
    queryKey: ['/api/transcripts/batches'],
  });

  // Fetch files needing review
  const { data: reviewFiles, isLoading: reviewLoading } = useQuery<TranscriptFile[]>({
    queryKey: ['/api/transcripts/review'],
  });

  // Fetch clients for assignment
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('/api/transcripts/batches', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Upload Successful',
        description: 'Your transcript batch has been uploaded and processing will begin shortly.',
      });
      setSelectedFiles(null);
      setBatchName('');
      setUploadProgress(0);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts'] });
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload transcript batch',
        variant: 'destructive',
      });
    },
  });

  // Assign transcript mutation
  const assignMutation = useMutation({
    mutationFn: async ({ fileId, clientId, sessionDate, sessionType }: {
      fileId: string;
      clientId: string;
      sessionDate: string;
      sessionType: string;
    }) => {
      return apiRequest(`/api/transcripts/files/${fileId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ clientId, sessionDate, sessionType }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Assignment Successful',
        description: 'Transcript has been assigned and progress note created.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts'] });
    },
    onError: (error) => {
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to assign transcript',
        variant: 'destructive',
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select files to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!batchName.trim()) {
      toast({
        title: 'Batch Name Required',
        description: 'Please enter a name for this batch.',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('batchName', batchName);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    uploadMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      uploading: { 
        variant: 'secondary' as const, 
        text: 'Uploading',
        className: 'bg-blue-100 text-blue-800 border-blue-200' 
      },
      processing: { 
        variant: 'default' as const, 
        text: 'Processing',
        className: 'bg-moss-200 text-moss-800 border-moss-300' 
      },
      completed: { 
        variant: 'secondary' as const, 
        text: 'Completed',
        className: 'bg-sage/20 text-evergreen border-sage/30' 
      },
      failed: { 
        variant: 'destructive' as const, 
        text: 'Failed',
        className: 'bg-red-100 text-red-800 border-red-200' 
      },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.processing;
    return <Badge variant={config.variant} className={config.className}>{config.text}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8" data-testid="bulk-transcripts-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Bulk Transcript Processing
        </h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Upload hundreds of transcripts and let AI process them automatically
        </p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600 mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Files</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Processed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.processedFiles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-orange-600 mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Need Review</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.filesNeedingReview}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Upload className="h-8 w-8 text-blue-600 mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Batches</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalBatches}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" data-testid="tab-upload">Upload New Batch</TabsTrigger>
          <TabsTrigger value="batches" data-testid="tab-batches">View Batches</TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review">Manual Review</TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Upload Transcript Batch</CardTitle>
              <CardDescription className="text-gray-600">
                Select multiple transcript files to upload and process automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="batch-name" className="text-gray-700">Batch Name</Label>
                <Input
                  id="batch-name"
                  data-testid="input-batch-name"
                  placeholder="e.g., January 2025 Session Transcripts"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="files" className="text-gray-700">Transcript Files</Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx,.doc,.rtf"
                  onChange={handleFileChange}
                  data-testid="input-files"
                  className="border-gray-300"
                />
                <p className="text-sm text-gray-600">
                  Accepts: TXT, PDF, DOCX, DOC, RTF files (up to 500 files, 50MB each)
                </p>
              </div>

              {selectedFiles && selectedFiles.length > 0 && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm font-medium text-gray-700">
                    Selected: {selectedFiles.length} files
                  </p>
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {Array.from(selectedFiles).map((file, index) => (
                      <p key={index} className="text-xs text-gray-600 truncate">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || !selectedFiles || selectedFiles.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Batch
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batches">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Transcript Batches</CardTitle>
              <CardDescription className="text-gray-600">
                View all uploaded transcript batches and their processing status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading batches...</p>
                </div>
              ) : batches && batches.length > 0 ? (
                <div className="space-y-4">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="p-4 border border-gray-200 rounded-lg"
                      data-testid={`batch-${batch.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{batch.name}</h3>
                          <p className="text-sm text-gray-600">
                            Uploaded: {formatDate(batch.uploadedAt.toString())}
                          </p>
                          <div className="mt-2 flex items-center space-x-4 text-sm">
                            <span className="text-gray-600">
                              Files: {batch.successfulFiles || 0}/{batch.totalFiles}
                            </span>
                            {(batch.failedFiles || 0) > 0 && (
                              <span className="text-red-600">
                                Failed: {batch.failedFiles}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(batch.status)}
                          {batch.status === 'processing' && (
                            <Progress 
                              value={((batch.processedFiles || 0) / batch.totalFiles) * 100} 
                              className="w-32 mt-2"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No transcript batches uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Manual Review Required</CardTitle>
              <CardDescription className="text-gray-600">
                Files that need manual review and client assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading files...</p>
                </div>
              ) : reviewFiles && reviewFiles.length > 0 ? (
                <div className="space-y-4">
                  {reviewFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-4 border border-orange-200 bg-orange-50 rounded-lg"
                      data-testid={`review-file-${file.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{file.fileName}</h3>
                          <p className="text-sm text-gray-600">
                            Confidence: {((file.clientMatchConfidence || 0) * 100).toFixed(1)}%
                          </p>
                          {file.suggestedClientName && (
                            <p className="text-sm text-blue-600">
                              Suggested: {file.suggestedClientName}
                            </p>
                          )}
                          <p className="text-sm text-orange-600">
                            Reason: {file.manualReviewReason || 'Low confidence match'}
                          </p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <select 
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                            data-testid={`select-client-${file.id}`}
                          >
                            <option value="">Select Client</option>
                            {clients?.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="date"
                            className="text-sm"
                            data-testid={`input-date-${file.id}`}
                          />
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-assign-${file.id}`}
                          >
                            Assign
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-gray-600">All files have been processed successfully</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}