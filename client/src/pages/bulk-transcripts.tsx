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
import '../styles/bulk-transcripts-fix.css';

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

  // Fetch transcript statistics with optimized caching
  const { data: stats, isLoading: statsLoading } = useQuery<UploadStats>({
    queryKey: ['/api/transcripts/stats'],
    refetchInterval: enableRealTimeUpdates ? 20000 : false, // Poll every 20 seconds
    refetchIntervalInBackground: false,
    staleTime: 10000, // 10 seconds cache
  });

  // Fetch transcript batches with reduced polling
  const { data: batches, isLoading: batchesLoading } = useQuery<TranscriptBatch[]>({
    queryKey: ['/api/transcripts/batches'],
    refetchInterval: enableRealTimeUpdates ? 10000 : false, // Poll every 10 seconds (reduced from 2)
    refetchIntervalInBackground: false,
  });

  // Fetch files needing review with reduced polling
  const { data: reviewFiles, isLoading: reviewLoading } = useQuery<TranscriptFile[]>({
    queryKey: ['/api/transcripts/review'],
    refetchInterval: enableRealTimeUpdates ? 15000 : false, // Poll every 15 seconds (reduced from 3)
    refetchIntervalInBackground: false,
  });

  // Fetch clients for assignment (no polling needed)
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    staleTime: 300000, // 5 minutes cache
  });

  // Individual file status for expanded batches with optimized caching
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
    refetchInterval: enableRealTimeUpdates ? 30000 : false, // Poll every 30 seconds for expanded batches
    staleTime: 15000, // 15 seconds cache
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
        className: 'bg-teal/10 text-teal border-teal/20 animate-pulse' 
      },
      processing: { 
        variant: 'default' as const, 
        text: 'Processing',
        className: 'bg-teal/20 text-ink border-teal/30 animate-pulse' 
      },
      completed: { 
        variant: 'secondary' as const, 
        text: 'Completed',
        className: 'bg-teal/10 text-ink border-teal/20' 
      },
      failed: { 
        variant: 'destructive' as const, 
        text: 'Failed',
        className: 'bg-ink/20 text-white border-ink/30' 
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
      <div className="flex items-center space-x-1 text-xs text-sepia">
        <Activity className="h-3 w-3" />
        <span>{rate}% complete</span>
      </div>
    );
  };

  const getFileStatusIcon = (status: string, processingStatus?: string | null) => {
    switch (status) {
      case 'uploaded':
        return <Clock className="h-4 w-4 text-teal animate-pulse" />;
      case 'processing':
        return <Activity className="h-4 w-4 text-teal animate-spin" />;
      case 'completed':
      case 'assigned':
        return <CheckCircle className="h-4 w-4 text-teal" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-ink" />;
      default:
        return <FileText className="h-4 w-4 text-sepia" />;
    }
  };

  const getFileProcessingDetails = (file: TranscriptFile) => {
    const confidence = file.clientMatchConfidence ? (file.clientMatchConfidence * 100).toFixed(1) : 'N/A';
    const details = [];
    
    if (file.suggestedClientName) details.push(`Client: ${file.suggestedClientName}`);
    if (file.extractedSessionDate) details.push(`Date: ${formatEDTDate(file.extractedSessionDate)}`);
    if (file.themes && file.themes.length > 0) details.push(`Themes: ${file.themes.slice(0, 2).join(', ')}`);
    
    return { confidence, details };
  };



  return (
    <div className="bulk-transcripts-page space-y-8" data-testid="bulk-transcripts-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          Bulk Transcript Processing
        </h1>
        <p className="mt-2 text-lg text-sepia">
          Upload hundreds of transcripts and let AI process them automatically
        </p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white border-sepia/20">
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-teal mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-sepia">Total Files</p>
                  <p className="text-2xl font-bold text-ink">{stats.totalFiles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-sepia/20">
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-teal mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-sepia">Processed</p>
                  <p className="text-2xl font-bold text-ink">{stats.processedFiles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-sepia/20">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-teal mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-sepia">Need Review</p>
                  <p className="text-2xl font-bold text-ink">{stats.filesNeedingReview}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-sepia/20">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Upload className="h-8 w-8 text-teal mb-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-sepia">Total Batches</p>
                  <p className="text-2xl font-bold text-ink">{stats.totalBatches}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Controls */}
      <Card className="bg-parchment border-teal/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="real-time-toggle" className="text-sm font-medium text-sepia">
                Real-time Updates
              </Label>
              <p className="text-xs text-sepia/70 mt-1">
                {enableRealTimeUpdates ? "Auto-refreshing data every 10-30 seconds" : "Manual refresh only"}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="real-time-toggle"
                type="checkbox"
                checked={enableRealTimeUpdates}
                onChange={(e) => setEnableRealTimeUpdates(e.target.checked)}
                className="rounded border-teal/20"
                data-testid="real-time-toggle"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/transcripts'] });
                  toast({ title: "Data refreshed", description: "All transcript data has been updated" });
                }}
                className="text-teal border-teal/20 hover:bg-teal/10"
                data-testid="manual-refresh"
              >
                Refresh Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" data-testid="tab-upload">Upload New Batch</TabsTrigger>
          <TabsTrigger value="batches" data-testid="tab-batches">View Batches</TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review">Manual Review</TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card className="bg-white border-sepia/20">
            <CardHeader>
              <CardTitle className="text-ink">Upload Transcript Batch</CardTitle>
              <CardDescription className="text-sepia">
                Select multiple transcript files to upload and process automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="batch-name" className="text-ink">Batch Name</Label>
                <Input
                  id="batch-name"
                  data-testid="input-batch-name"
                  placeholder="e.g., January 2025 Session Transcripts"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="border-sepia/30 focus:ring-sage focus:border-teal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="files" className="text-ink">Transcript Files</Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx,.doc,.rtf"
                  onChange={handleFileChange}
                  data-testid="input-files"
                  className="border-sepia/30 focus:ring-sage focus:border-teal"
                />
                <p className="text-sm text-sepia">
                  Accepts: TXT, PDF, DOCX, DOC, RTF files (up to 500 files, 50MB each)
                </p>
              </div>

              {selectedFiles && selectedFiles.length > 0 && (
                <div className="p-4 bg-parchment border border-sepia/20 rounded-md">
                  <p className="text-sm font-medium text-ink">
                    Selected: {selectedFiles.length} files
                  </p>
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {Array.from(selectedFiles).map((file, index) => (
                      <p key={index} className="text-xs text-sepia truncate">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || !selectedFiles || selectedFiles.length === 0}
                className="w-full bg-teal hover:bg-teal/80 text-white"
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
          <Card className="bg-parchment border-teal/20">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-ink">Interactive Batch Processing</CardTitle>
                  <CardDescription className="text-sepia">
                    Real-time visualization of transcript batch processing with detailed progress metrics
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEnableRealTimeUpdates(!enableRealTimeUpdates)}
                    className={`${enableRealTimeUpdates ? 'bg-teal/20 text-ink border-teal' : 'text-sepia border-sepia/30'}`}
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal mx-auto"></div>
                  <p className="mt-2 text-sepia">Loading batch processing data...</p>
                </div>
              ) : batches && batches.length > 0 ? (
                <div className="space-y-4">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="border border-teal/20 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                      data-testid={`batch-${batch.id}`}
                    >
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <div className="p-5 cursor-pointer hover:bg-white/80 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-3">
                                  <h3 className="text-lg font-semibold text-ink">{batch.name}</h3>
                                  {getStatusBadge(batch.status)}
                                  {expandedBatches.has(batch.id) ? (
                                    <ChevronUp className="h-5 w-5 text-sepia" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5 text-sepia" />
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div className="flex items-center space-x-2 text-sm">
                                    <Clock className="h-4 w-4 text-sepia" />
                                    <span className="text-sepia">
                                      {formatEDTDateTime(batch.uploadedAt)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm">
                                    <FileText className="h-4 w-4 text-teal" />
                                    <span className="text-sepia">
                                      {batch.processedFiles || 0}/{batch.totalFiles} files
                                    </span>
                                  </div>
                                  {batch.status === 'processing' && (
                                    <>
                                      <div className="flex items-center space-x-2 text-sm">
                                        <Timer className="h-4 w-4 text-teal" />
                                        <span className="text-sepia">ETA: {estimateTimeRemaining(batch)}</span>
                                      </div>
                                      {getProcessingRateIndicator(batch)}
                                    </>
                                  )}
                                  {(batch.failedFiles || 0) > 0 && (
                                    <div className="flex items-center space-x-2 text-sm">
                                      <AlertCircle className="h-4 w-4 text-ink" />
                                      <span className="text-ink">Failed: {batch.failedFiles}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Enhanced Progress Bar */}
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-sepia font-medium">Processing Progress</span>
                                    <span className="text-ink font-semibold">
                                      {calculateProgress(batch).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <Progress 
                                      value={calculateProgress(batch)} 
                                      className="h-3 bg-teal/10"
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
                                          <CheckCircle className="h-3 w-3 text-teal" />
                                          <span className="text-teal">
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
                          <div className="px-5 pb-5 border-t border-teal/10">
                            <div className="pt-4">
                              <h4 className="font-medium text-ink mb-3">Detailed Processing Metrics</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-teal/5 border-teal/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <TrendingUp className="h-5 w-5 text-teal" />
                                      <div>
                                        <p className="text-sm font-medium text-ink">Throughput</p>
                                        <p className="text-lg font-bold text-teal">
                                          {batch.status === 'processing' ? 
                                            `${Math.max(1, Math.round((batch.processedFiles || 0) / Math.max(1, ((Date.now() - new Date(batch.processedAt || batch.uploadedAt).getTime()) / 60000))))} files/min` :
                                            'N/A'
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                                
                                <Card className="bg-teal/5 border-teal/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <Zap className="h-5 w-5 text-teal" />
                                      <div>
                                        <p className="text-sm font-medium text-ink">Efficiency</p>
                                        <p className="text-lg font-bold text-teal">
                                          {batch.totalFiles > 0 ? 
                                            `${(((batch.successfulFiles || 0) / batch.totalFiles) * 100).toFixed(1)}%` :
                                            '0%'
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card className="bg-sepia/5 border-sepia/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <Clock className="h-5 w-5 text-sepia" />
                                      <div>
                                        <p className="text-sm font-medium text-ink">Status</p>
                                        <p className="text-sm font-medium text-sepia capitalize">
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
                                  className="text-teal border-teal/30 hover:bg-teal/10"
                                  onClick={() => toggleBatchExpansion(batch.id)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {expandedBatches.has(batch.id) ? 'Hide' : 'View'} Individual Files
                                </Button>

                                {/* Individual File Processing Status */}
                                {expandedBatches.has(batch.id) && (
                                  <div className="mt-4 p-4 bg-white rounded-lg border border-teal/20">
                                    <h5 className="font-medium text-ink mb-3 flex items-center">
                                      <FileText className="h-4 w-4 mr-2" />
                                      File Processing Details ({batch.totalFiles} files)
                                    </h5>
                                    
                                    {expandedBatchFiles.isLoading ? (
                                      <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal"></div>
                                        <span className="ml-2 text-sepia">Loading file details...</span>
                                      </div>
                                    ) : expandedBatchFiles.data && expandedBatchFiles.data.length > 0 ? (
                                      <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {expandedBatchFiles.data.flat().map((file) => {
                                          if (!file) return null;
                                          const { confidence, details } = getFileProcessingDetails(file);
                                          return (
                                            <div 
                                              key={file.id} 
                                              className="p-3 bg-white rounded border border-teal/10 hover:border-teal/20 transition-colors"
                                            >
                                              <div className="flex items-start justify-between">
                                                <div className="flex items-start space-x-3 flex-1">
                                                  {getFileStatusIcon(file.status, file.processingStatus)}
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-ink truncate" title={file.fileName}>
                                                      {file.fileName}
                                                    </p>
                                                    {details.length > 0 && (
                                                      <div className="mt-1 space-y-1">
                                                        {details.map((detail, idx) => (
                                                          <p key={idx} className="text-xs text-sepia/80">{detail}</p>
                                                        ))}
                                                      </div>
                                                    )}
                                                    {file.processingNotes && (
                                                      <p className="text-xs text-sepia/70 mt-1 italic">
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
                                                        ? 'bg-teal/10 text-teal border-teal/30' 
                                                        : file.status === 'failed'
                                                        ? 'bg-ink/10 text-ink border-ink/30'
                                                        : file.status === 'processing'
                                                        ? 'bg-teal/10 text-teal border-teal/30'
                                                        : 'bg-sepia/10 text-sepia border-sepia/30'
                                                    }`}
                                                  >
                                                    {file.status}
                                                  </Badge>
                                                  {file.clientMatchConfidence && (
                                                    <p className="text-xs text-sepia mt-1">
                                                      {confidence}% confidence
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {/* Progress indicator for individual files */}
                                              {file.status === 'processing' && (
                                                <div className="mt-2">
                                                  <div className="flex justify-between text-xs text-sepia mb-1">
                                                    <span>Processing...</span>
                                                    <span>{file.processingStatus || 'pending'}</span>
                                                  </div>
                                                  <div className="h-1 bg-teal/20 rounded-full overflow-hidden">
                                                    <div className="h-full bg-teal animate-pulse rounded-full w-3/4"></div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-center py-4">
                                        <p className="text-sepia">No file details available</p>
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
                  <FileText className="h-16 w-16 text-teal/40 mx-auto mb-4" />
                  <p className="text-lg text-sepia mb-2">No transcript batches uploaded yet</p>
                  <p className="text-sm text-sepia/70">Upload your first batch to see interactive processing visualization</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review">
          <Card className="bg-white border-sepia/20">
            <CardHeader>
              <CardTitle className="text-ink">Manual Review Required</CardTitle>
              <CardDescription className="text-sepia">
                Files that need manual review and client assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal mx-auto"></div>
                  <p className="mt-2 text-sepia">Loading files...</p>
                </div>
              ) : reviewFiles && reviewFiles.length > 0 ? (
                <div className="space-y-4">
                  {reviewFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-4 border border-teal/20 bg-teal/5 rounded-lg"
                      data-testid={`review-file-${file.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-ink">{file.fileName}</h3>
                          <p className="text-sm text-sepia">
                            Confidence: {((file.clientMatchConfidence || 0) * 100).toFixed(1)}%
                          </p>
                          {file.suggestedClientName && (
                            <p className="text-sm text-teal">
                              Suggested: {file.suggestedClientName}
                            </p>
                          )}
                          <p className="text-sm text-sepia">
                            Reason: {file.manualReviewReason || 'Low confidence match'}
                          </p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <select 
                            className="text-sm border border-sepia/30 rounded px-2 py-1 focus:ring-sage focus:border-teal"
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
                            className="text-sm border-sepia/30 focus:ring-sage focus:border-teal"
                            data-testid={`input-date-${file.id}`}
                          />
                          <Button
                            size="sm"
                            className="bg-teal hover:bg-teal/80 text-white"
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
                  <CheckCircle className="h-12 w-12 text-teal mx-auto mb-4" />
                  <p className="text-sepia">All files have been processed successfully</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}