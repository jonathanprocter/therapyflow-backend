import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Users, Clock, CheckCircle, AlertCircle, Eye, ChevronDown, ChevronUp, Activity, Zap, TrendingUp, Timer } from 'lucide-react';
import type { TranscriptBatch, TranscriptFile, Client } from '@shared/schema';
import { formatEDTDate, formatEDTDateTime } from '@/utils/timezone';

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
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [enableRealTimeUpdates, setEnableRealTimeUpdates] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch transcript statistics
  const { data: stats, isLoading: statsLoading } = useQuery<UploadStats>({
    queryKey: ['/api/transcripts/stats'],
  });

  // Fetch transcript batches with real-time updates
  const { data: batches, isLoading: batchesLoading } = useQuery<TranscriptBatch[]>({
    queryKey: ['/api/transcripts/batches'],
    refetchInterval: enableRealTimeUpdates ? 2000 : false, // Poll every 2 seconds for processing batches
    refetchIntervalInBackground: false,
  });

  // Fetch files needing review with real-time updates
  const { data: reviewFiles, isLoading: reviewLoading } = useQuery<TranscriptFile[]>({
    queryKey: ['/api/transcripts/review'],
    refetchInterval: enableRealTimeUpdates ? 3000 : false, // Poll every 3 seconds
    refetchIntervalInBackground: false,
  });

  // Fetch clients for assignment
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // Enhanced stats fetch with real-time updates
  const { data: enhancedStats, isLoading: enhancedStatsLoading } = useQuery<UploadStats>({
    queryKey: ['/api/transcripts/stats'],
    refetchInterval: enableRealTimeUpdates ? 5000 : false, // Poll every 5 seconds
    refetchIntervalInBackground: false,
  });

  // Individual file status for expanded batches
  const expandedBatchFiles = useQuery<TranscriptFile[][]>({
    queryKey: ['/api/transcripts/batch-files', Array.from(expandedBatches)],
    queryFn: async () => {
      const batchIds = Array.from(expandedBatches);
      if (batchIds.length === 0) return [];
      
      const filePromises = batchIds.map(batchId =>
        apiRequest(`/api/transcripts/batches/${batchId}/files`)
      );
      
      return await Promise.all(filePromises);
    },
    enabled: expandedBatches.size > 0,
    refetchInterval: enableRealTimeUpdates ? 3000 : false,
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

  // Helper functions for batch management
  const toggleBatchExpansion = (batchId: string) => {
    setExpandedBatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
      }
      return newSet;
    });
  };

  const calculateProgress = (batch: TranscriptBatch): number => {
    if (batch.totalFiles === 0) return 0;
    return ((batch.processedFiles || 0) / batch.totalFiles) * 100;
  };

  const estimateTimeRemaining = (batch: TranscriptBatch): string => {
    const processed = batch.processedFiles || 0;
    const total = batch.totalFiles;
    const remaining = total - processed;
    
    if (remaining <= 0) return 'Complete';
    if (processed === 0) return 'Calculating...';
    
    // Estimate based on processing rate (rough estimate: 30 seconds per file)
    const avgTimePerFile = 30; // seconds
    const remainingSeconds = remaining * avgTimePerFile;
    
    if (remainingSeconds < 60) return `${Math.round(remainingSeconds)}s`;
    if (remainingSeconds < 3600) return `${Math.round(remainingSeconds / 60)}m`;
    return `${Math.round(remainingSeconds / 3600)}h`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      uploading: { 
        variant: 'secondary' as const, 
        text: 'Uploading',
        className: 'bg-french-blue/10 text-french-blue border-french-blue/20 animate-pulse' 
      },
      processing: { 
        variant: 'default' as const, 
        text: 'Processing',
        className: 'bg-sage/20 text-evergreen border-sage/30 animate-pulse' 
      },
      completed: { 
        variant: 'secondary' as const, 
        text: 'Completed',
        className: 'bg-sage/10 text-evergreen border-sage/20' 
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

  const getProcessingRateIndicator = (batch: TranscriptBatch) => {
    if (batch.status !== 'processing') return null;
    const processed = batch.processedFiles || 0;
    const total = batch.totalFiles;
    const rate = processed > 0 ? (processed / total * 100).toFixed(1) : '0.0';
    return (
      <div className="flex items-center space-x-1 text-xs text-moss">
        <Activity className="h-3 w-3" />
        <span>{rate}% complete</span>
      </div>
    );
  };

  const getFileStatusIcon = (status: string, processingStatus?: string | null) => {
    switch (status) {
      case 'uploaded':
        return <Clock className="h-4 w-4 text-french-blue animate-pulse" />;
      case 'processing':
        return <Activity className="h-4 w-4 text-sage animate-spin" />;
      case 'completed':
      case 'assigned':
        return <CheckCircle className="h-4 w-4 text-sage" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-moss" />;
    }
  };

  const getFileProcessingDetails = (file: TranscriptFile) => {
    const confidence = file.clientMatchConfidence ? (file.clientMatchConfidence * 100).toFixed(1) : 'N/A';
    const details = [];
    
    if (file.suggestedClientName) details.push(`Client: ${file.suggestedClientName}`);
    if (file.sessionDate) details.push(`Date: ${formatEDTDate(file.sessionDate)}`);
    if (file.themes && file.themes.length > 0) details.push(`Themes: ${file.themes.slice(0, 2).join(', ')}`);
    
    return { confidence, details };
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
          <Card className="bg-ivory border-sage/20">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-evergreen">Interactive Batch Processing</CardTitle>
                  <CardDescription className="text-moss">
                    Real-time visualization of transcript batch processing with detailed progress metrics
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEnableRealTimeUpdates(!enableRealTimeUpdates)}
                    className={`${enableRealTimeUpdates ? 'bg-sage/20 text-evergreen border-sage' : 'text-moss border-moss/30'}`}
                    data-testid="toggle-realtime"
                  >
                    {enableRealTimeUpdates ? <Activity className="h-4 w-4 mr-1 animate-pulse" /> : <Activity className="h-4 w-4 mr-1" />}
                    {enableRealTimeUpdates ? 'Live' : 'Paused'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage mx-auto"></div>
                  <p className="mt-2 text-moss">Loading batch processing data...</p>
                </div>
              ) : batches && batches.length > 0 ? (
                <div className="space-y-4">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="border border-sage/20 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                      data-testid={`batch-${batch.id}`}
                    >
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <div className="p-5 cursor-pointer hover:bg-white/80 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-3">
                                  <h3 className="text-lg font-semibold text-evergreen">{batch.name}</h3>
                                  {getStatusBadge(batch.status)}
                                  {expandedBatches.has(batch.id) ? (
                                    <ChevronUp className="h-5 w-5 text-moss" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5 text-moss" />
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div className="flex items-center space-x-2 text-sm">
                                    <Clock className="h-4 w-4 text-moss" />
                                    <span className="text-moss">
                                      {formatEDTDateTime(batch.uploadedAt)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm">
                                    <FileText className="h-4 w-4 text-french-blue" />
                                    <span className="text-moss">
                                      {batch.processedFiles || 0}/{batch.totalFiles} files
                                    </span>
                                  </div>
                                  {batch.status === 'processing' && (
                                    <>
                                      <div className="flex items-center space-x-2 text-sm">
                                        <Timer className="h-4 w-4 text-sage" />
                                        <span className="text-moss">ETA: {estimateTimeRemaining(batch)}</span>
                                      </div>
                                      {getProcessingRateIndicator(batch)}
                                    </>
                                  )}
                                  {(batch.failedFiles || 0) > 0 && (
                                    <div className="flex items-center space-x-2 text-sm">
                                      <AlertCircle className="h-4 w-4 text-red-500" />
                                      <span className="text-red-600">Failed: {batch.failedFiles}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Enhanced Progress Bar */}
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-moss font-medium">Processing Progress</span>
                                    <span className="text-evergreen font-semibold">
                                      {calculateProgress(batch).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <Progress 
                                      value={calculateProgress(batch)} 
                                      className="h-3 bg-sage/10"
                                    />
                                    {batch.status === 'processing' && (
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                    )}
                                  </div>
                                  
                                  {/* Success/Failed breakdown */}
                                  {(batch.successfulFiles || 0) > 0 || (batch.failedFiles || 0) > 0 ? (
                                    <div className="flex space-x-4 text-xs">
                                      {(batch.successfulFiles || 0) > 0 && (
                                        <div className="flex items-center space-x-1">
                                          <CheckCircle className="h-3 w-3 text-sage" />
                                          <span className="text-sage">
                                            {batch.successfulFiles} successful
                                          </span>
                                        </div>
                                      )}
                                      {(batch.failedFiles || 0) > 0 && (
                                        <div className="flex items-center space-x-1">
                                          <AlertCircle className="h-3 w-3 text-red-500" />
                                          <span className="text-red-600">
                                            {batch.failedFiles} failed
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="px-5 pb-5 border-t border-sage/10">
                            <div className="pt-4">
                              <h4 className="font-medium text-evergreen mb-3">Detailed Processing Metrics</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-sage/5 border-sage/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <TrendingUp className="h-5 w-5 text-sage" />
                                      <div>
                                        <p className="text-sm font-medium text-evergreen">Throughput</p>
                                        <p className="text-lg font-bold text-sage">
                                          {batch.status === 'processing' ? 
                                            `${Math.max(1, Math.round((batch.processedFiles || 0) / Math.max(1, ((Date.now() - new Date(batch.processedAt || batch.uploadedAt).getTime()) / 60000))))} files/min` :
                                            'N/A'
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                                
                                <Card className="bg-french-blue/5 border-french-blue/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <Zap className="h-5 w-5 text-french-blue" />
                                      <div>
                                        <p className="text-sm font-medium text-evergreen">Efficiency</p>
                                        <p className="text-lg font-bold text-french-blue">
                                          {batch.totalFiles > 0 ? 
                                            `${(((batch.successfulFiles || 0) / batch.totalFiles) * 100).toFixed(1)}%` :
                                            '0%'
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="bg-moss/5 border-moss/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <Clock className="h-5 w-5 text-moss" />
                                      <div>
                                        <p className="text-sm font-medium text-evergreen">Status</p>
                                        <p className="text-sm font-medium text-moss capitalize">
                                          {batch.status === 'processing' ? `${estimateTimeRemaining(batch)} remaining` : batch.status}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                              
                              <div className="mt-4 space-y-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-french-blue border-french-blue/30 hover:bg-french-blue/10"
                                  onClick={() => toggleBatchExpansion(batch.id)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {expandedBatches.has(batch.id) ? 'Hide' : 'View'} Individual Files
                                </Button>

                                {/* Individual File Processing Status */}
                                {expandedBatches.has(batch.id) && (
                                  <div className="mt-4 p-4 bg-white rounded-lg border border-sage/20">
                                    <h5 className="font-medium text-evergreen mb-3 flex items-center">
                                      <FileText className="h-4 w-4 mr-2" />
                                      File Processing Details ({batch.totalFiles} files)
                                    </h5>
                                    
                                    {expandedBatchFiles.isLoading ? (
                                      <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sage"></div>
                                        <span className="ml-2 text-moss">Loading file details...</span>
                                      </div>
                                    ) : expandedBatchFiles.data && expandedBatchFiles.data.length > 0 ? (
                                      <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {expandedBatchFiles.data.flat().map((file) => {
                                          if (!file) return null;
                                          const { confidence, details } = getFileProcessingDetails(file);
                                          return (
                                            <div 
                                              key={file.id} 
                                              className="p-3 bg-white rounded border border-sage/10 hover:border-sage/20 transition-colors"
                                            >
                                              <div className="flex items-start justify-between">
                                                <div className="flex items-start space-x-3 flex-1">
                                                  {getFileStatusIcon(file.status, file.processingStatus)}
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-evergreen truncate" title={file.fileName}>
                                                      {file.fileName}
                                                    </p>
                                                    {details.length > 0 && (
                                                      <div className="mt-1 space-y-1">
                                                        {details.map((detail, idx) => (
                                                          <p key={idx} className="text-xs text-moss/80">{detail}</p>
                                                        ))}
                                                      </div>
                                                    )}
                                                    {file.processingNotes && (
                                                      <p className="text-xs text-moss/70 mt-1 italic">
                                                        {file.processingNotes}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <Badge 
                                                    variant="outline" 
                                                    className={`text-xs ${
                                                      file.status === 'completed' || file.status === 'assigned' 
                                                        ? 'bg-sage/10 text-sage border-sage/30' 
                                                        : file.status === 'failed'
                                                        ? 'bg-red-50 text-red-700 border-red-200'
                                                        : file.status === 'processing'
                                                        ? 'bg-french-blue/10 text-french-blue border-french-blue/30'
                                                        : 'bg-moss/10 text-moss border-moss/30'
                                                    }`}
                                                  >
                                                    {file.status}
                                                  </Badge>
                                                  {file.clientMatchConfidence && (
                                                    <p className="text-xs text-moss mt-1">
                                                      {confidence}% confidence
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {/* Progress indicator for individual files */}
                                              {file.status === 'processing' && (
                                                <div className="mt-2">
                                                  <div className="flex justify-between text-xs text-moss mb-1">
                                                    <span>Processing...</span>
                                                    <span>{file.processingStatus || 'pending'}</span>
                                                  </div>
                                                  <div className="h-1 bg-sage/20 rounded-full overflow-hidden">
                                                    <div className="h-full bg-sage animate-pulse rounded-full w-3/4"></div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-center py-4">
                                        <p className="text-moss">No file details available</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-sage/40 mx-auto mb-4" />
                  <p className="text-lg text-moss mb-2">No transcript batches uploaded yet</p>
                  <p className="text-sm text-moss/70">Upload your first batch to see interactive processing visualization</p>
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