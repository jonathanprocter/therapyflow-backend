/**
 * Drop Zone Page
 *
 * A simple, mobile-friendly drag-and-drop upload interface for documents.
 * Can be accessed from any device (phone, tablet, computer) via browser.
 * Uploaded documents are processed through the AI document pipeline.
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Cloud,
  Smartphone,
  Laptop,
  FolderOpen,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  success: boolean;
  documentId?: string;
  clientId?: string;
  documentType?: string;
  message: string;
  fileName: string;
}

interface DriveStatus {
  connected: boolean;
  watchFolderName: string | null;
  watchFolderId: string | null;
  lastSync: string | null;
  filesProcessed: number;
  isPolling: boolean;
}

export default function DropZonePage() {
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for Google Drive status
  const { data: driveStatus } = useQuery<DriveStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await fetch('/api/drive/status');
      if (!res.ok) throw new Error('Failed to fetch Drive status');
      return res.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('analyze', 'true');
      formData.append('source', 'drop-zone');

      const response = await fetch('/api/documents/drop-zone-upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data, file) => {
      setUploadResults(prev => [...prev, {
        success: true,
        documentId: data.documentId || data.id,
        clientId: data.clientId,
        documentType: data.documentType || data.document_type,
        message: data.message || 'Document uploaded and processing',
        fileName: file.name
      }]);

      setUploadingFiles(prev => {
        const next = new Map(prev);
        next.delete(file.name);
        return next;
      });

      toast({
        title: 'Upload Successful',
        description: `${file.name} has been uploaded and is being processed.`
      });

      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: Error, file) => {
      setUploadResults(prev => [...prev, {
        success: false,
        message: error.message,
        fileName: file.name
      }]);

      setUploadingFiles(prev => {
        const next = new Map(prev);
        next.delete(file.name);
        return next;
      });

      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Drive sync mutation
  const syncDriveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/drive/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Drive Sync Complete',
        description: `Processed ${data.processed} files, ${data.errors} errors.`
      });
      queryClient.invalidateQueries({ queryKey: ['drive-status'] });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      setUploadingFiles(prev => new Map(prev).set(file.name, 0));
      uploadMutation.mutate(file);
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024 // 50MB
  });

  const clearResults = () => {
    setUploadResults([]);
  };

  const openDriveAuth = () => {
    window.open('/api/drive/auth-url', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-800">Document Drop Zone</h1>
          <p className="text-slate-600">
            Upload session transcripts, progress notes, or clinical documents from any device
          </p>
          <div className="flex justify-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Smartphone className="w-4 h-4" />
              Phone
            </span>
            <span className="flex items-center gap-1">
              <Laptop className="w-4 h-4" />
              Computer
            </span>
            <span className="flex items-center gap-1">
              <Cloud className="w-4 h-4" />
              Cloud
            </span>
          </div>
        </div>

        {/* Main Drop Zone */}
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                transition-all duration-200 ease-in-out
                ${isDragActive ? 'border-blue-500 bg-blue-50 scale-105' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
                ${isDragReject ? 'border-red-500 bg-red-50' : ''}
              `}
            >
              <input {...getInputProps()} />

              <div className="space-y-4">
                <div className={`
                  mx-auto w-16 h-16 rounded-full flex items-center justify-center
                  ${isDragActive ? 'bg-blue-100' : 'bg-slate-100'}
                `}>
                  <Upload className={`w-8 h-8 ${isDragActive ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-slate-700">
                    {isDragActive ? 'Drop files here...' : 'Drag & drop documents here'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    or click to browse
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="outline">.txt</Badge>
                  <Badge variant="outline">.docx</Badge>
                  <Badge variant="outline">.pdf</Badge>
                  <Badge variant="outline">.doc</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Drive Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg">Google Drive Integration</CardTitle>
              </div>
              {driveStatus?.connected && (
                <Badge variant={driveStatus.isPolling ? 'default' : 'secondary'}>
                  {driveStatus.isPolling ? 'Active' : 'Paused'}
                </Badge>
              )}
            </div>
            <CardDescription>
              Connect Google Drive to automatically process documents from a cloud folder
            </CardDescription>
          </CardHeader>
          <CardContent>
            {driveStatus?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Watch Folder:</span>
                  <span className="font-medium">{driveStatus.watchFolderName || 'Not configured'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Files Processed:</span>
                  <span className="font-medium">{driveStatus.filesProcessed}</span>
                </div>
                {driveStatus.lastSync && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Last Sync:</span>
                    <span className="font-medium">
                      {new Date(driveStatus.lastSync).toLocaleString()}
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => syncDriveMutation.mutate()}
                  disabled={syncDriveMutation.isPending}
                >
                  {syncDriveMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Sync Now</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-500 mb-4">
                  Connect Google Drive to enable cloud folder watching
                </p>
                <Button onClick={openDriveAuth}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect Google Drive
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Progress */}
        {uploadingFiles.size > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from(uploadingFiles.entries()).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{fileName}</span>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  </div>
                  <Progress value={100} className="h-1 animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Upload Results</CardTitle>
                <Button variant="ghost" size="sm" onClick={clearResults}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {uploadResults.map((result, index) => (
                <Alert key={index} variant={result.success ? 'default' : 'destructive'}>
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <AlertTitle className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {result.fileName}
                      </AlertTitle>
                      <AlertDescription className="text-sm">
                        {result.message}
                        {result.documentType && (
                          <Badge variant="outline" className="ml-2">
                            {result.documentType}
                          </Badge>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Supported Formats Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Supported Document Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">Session Transcripts</h4>
                <p className="text-slate-500">
                  Upload therapy session transcripts to automatically generate SOAP-formatted progress notes.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">Progress Notes</h4>
                <p className="text-slate-500">
                  Clinical notes are parsed, linked to clients, and associated with appointments.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">Treatment Plans</h4>
                <p className="text-slate-500">
                  Treatment plans are extracted and associated with client records.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">General Documents</h4>
                <p className="text-slate-500">
                  Any clinical document is AI-analyzed, classified, and stored appropriately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Naming Convention Tip */}
        <Alert>
          <FileText className="w-4 h-4" />
          <AlertTitle>Naming Tip</AlertTitle>
          <AlertDescription>
            Include the client name in your filename for automatic matching:
            <code className="block mt-2 text-xs bg-slate-100 p-2 rounded">
              "John Smith - Session 2024-01-15.txt"
            </code>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
