/**
 * Enhanced Document Upload Component
 * 
 * Features:
 * - Sophisticated drag-and-drop interface
 * - Real-time processing feedback with detailed validation scores
 * - Support for PDF, DOCX, DOC, RTF, and TXT files
 * - Advanced AI analysis with confidence scoring
 * - Progress tracking with detailed extraction metrics
 * - Manual review workflow for uncertain results
 * - Alternative interpretation display
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Brain,
  Calendar,
  User,
  FileSearch,
  Target,
  TrendingUp,
  Clock,
  Shield
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ProcessingStage {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  score?: number;
  details?: string;
  icon: React.ComponentType<any>;
}

interface EnhancedProcessingResult {
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
    clinicalThemes?: string[];
    emotions?: string[];
    interventions?: string[];
    progressRating?: number;
    nextSteps?: string[];
  };
  validationDetails: {
    textExtractionScore: number;
    aiAnalysisScore: number;
    dateValidationScore: number;
    clientMatchScore: number;
    overallQuality: number;
  };
  alternativeInterpretations?: any[];
}

export default function EnhancedDocumentUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>([]);
  const [processingResult, setProcessingResult] = useState<EnhancedProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialStages: ProcessingStage[] = [
    { name: 'Text Extraction', status: 'pending', icon: FileSearch },
    { name: 'AI Analysis', status: 'pending', icon: Brain },
    { name: 'Date Parsing', status: 'pending', icon: Calendar },
    { name: 'Client Matching', status: 'pending', icon: User },
    { name: 'Validation', status: 'pending', icon: Shield },
  ];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      
      return apiRequest('/api/documents/enhanced-upload', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (result: any) => {
      try {
        setProcessingResult(result);
        setIsProcessing(false);
        
        // Update final stage statuses based on results
        if (result.validationDetails) {
          setProcessingStages(prev => prev.map(stage => {
            const scoreMap = {
              'Text Extraction': result.validationDetails?.textExtractionScore || 0,
              'AI Analysis': result.validationDetails?.aiAnalysisScore || 0,
              'Date Parsing': result.validationDetails?.dateValidationScore || 0,
              'Client Matching': result.validationDetails?.clientMatchScore || 0,
              'Validation': result.validationDetails?.overallQuality || 0,
            };
            
            const score = scoreMap[stage.name as keyof typeof scoreMap];
            return {
              ...stage,
              status: score > 50 ? 'completed' : 'failed' as const,
              score,
              details: score > 80 ? 'Excellent' : score > 60 ? 'Good' : score > 40 ? 'Fair' : 'Needs Review'
            };
          }));
        }
        
        // Show success or warning toast
        if (result.success) {
          toast({
            title: result.needsManualReview ? "Processing Complete - Review Needed" : "Processing Complete",
            description: `Document processed with ${result.confidence || 50}% confidence. ${result.needsManualReview ? 'Manual review recommended.' : 'Ready for use.'}`,
          });
          
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['/api/progress-notes'] });
          queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
          queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
          queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
          queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
          queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        } else {
          toast({
            title: "Processing Failed",
            description: result.processingNotes || "Document processing failed",
            variant: "destructive"
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        toast({
          title: "Processing Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      setIsProcessing(false);
      setProcessingStages(prev => prev.map(stage => ({ ...stage, status: 'failed' as const })));
      toast({
        title: "Upload Failed",
        description: error.message || "An error occurred during processing",
        variant: "destructive"
      });
    }
  });

  const simulateProcessingStages = useCallback(() => {
    setProcessingStages(initialStages);
    
    // Simulate progressive stage completion
    const stageUpdates = [
      { delay: 500, stage: 0 },   // Text Extraction
      { delay: 1500, stage: 1 },  // AI Analysis  
      { delay: 2200, stage: 2 },  // Date Parsing
      { delay: 2800, stage: 3 },  // Client Matching
      { delay: 3200, stage: 4 },  // Validation
    ];
    
    stageUpdates.forEach(({ delay, stage }) => {
      setTimeout(() => {
        setProcessingStages(prev => prev.map((s, i) => 
          i === stage ? { ...s, status: 'processing' as const } : s
        ));
      }, delay);
    });
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setUploadedFiles([file]);
    setProcessingResult(null);
    setIsProcessing(true);
    
    simulateProcessingStages();
    uploadMutation.mutate(file);
  }, [uploadMutation, simulateProcessingStages]);

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
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024 // 50MB
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-teal';
      case 'failed': return 'bg-red-500';
      default: return 'bg-teal/50';
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-sepia/80';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-sepia';
    if (score >= 40) return 'text-sepia';
    return 'text-red-600';
  };

  const getRiskLevelColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-red-50 text-red-800 border-red-200';
      case 'moderate': return 'bg-teal-light text-ink border-teal';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-parchment text-ink border-teal/20';
    }
  };

  return (
    <div className="space-y-6" data-testid="enhanced-document-upload">
      {/* Upload Area */}
      <Card className="border-2 border-dashed border-teal/30 hover:border-teal/60 transition-colors">
        <CardContent className="p-8">
          <div
            {...getRootProps()}
            className={`text-center cursor-pointer transition-colors rounded-lg p-6 ${
              isDragActive ? 'bg-teal/10 border-teal/50' : 'hover:bg-parchment/80'
            }`}
            data-testid="dropzone"
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-teal mb-4" />
            <h3 className="text-lg font-semibold text-ink mb-2">
              Enhanced Progress Note Upload
            </h3>
            <p className="text-sepia mb-4">
              {isDragActive
                ? "Drop your document here..."
                : "Drag and drop your progress note, or click to browse"}
            </p>
            <p className="text-sm text-sepia/80">
              Supports: TXT (optimal), PDF, DOCX, DOC, RTF • Max 50MB
            </p>
            <p className="text-xs text-teal mt-2">
              ✨ Now with enhanced AI analysis, robust PDF parsing, and intelligent client matching
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Processing Stages */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Enhanced AI Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processingStages.map((stage, index) => {
              const IconComponent = stage.icon;
              return (
                <div key={stage.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(stage.status)}`} />
                    <IconComponent className="h-4 w-4 text-sepia" />
                    <span className="font-medium">{stage.name}</span>
                    {stage.status === 'processing' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal" />
                    )}
                  </div>
                  {stage.score !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getScoreColor(stage.score)}`}>
                        {stage.score}%
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {stage.details}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Processing Results */}
      {processingResult && (
        <div className="space-y-4">
          {/* Overall Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {processingResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  Processing Results
                </div>
                <Badge 
                  variant={processingResult.confidence > 80 ? "default" : "secondary"}
                  className="text-sm"
                >
                  {processingResult.confidence}% Confidence
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress 
                value={processingResult.confidence} 
                className="w-full"
                data-testid="confidence-progress"
              />
              
              {processingResult.needsManualReview && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This document requires manual review. Please verify the extracted information before finalizing.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="text-sm text-sepia">
                {processingResult.processingNotes}
              </div>
            </CardContent>
          </Card>

          {/* Extracted Data */}
          <Card>
            <CardHeader>
              <CardTitle>Extracted Clinical Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Information */}
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Client Information
                  </h4>
                  <div className="text-sm">
                    <strong>Name:</strong> {processingResult.extractedData.clientName || 'Not identified'}
                  </div>
                  <div className="text-sm">
                    <strong>Match Score:</strong> 
                    <span className={getScoreColor(processingResult.validationDetails.clientMatchScore)}>
                      {" "}{processingResult.validationDetails.clientMatchScore}%
                    </span>
                  </div>
                </div>

                {/* Session Information */}
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Session Information
                  </h4>
                  <div className="text-sm">
                    <strong>Date:</strong> {
                      processingResult.extractedData.sessionDate 
                        ? new Date(processingResult.extractedData.sessionDate).toLocaleDateString()
                        : 'Not identified'
                    }
                  </div>
                  <div className="text-sm">
                    <strong>Type:</strong> {processingResult.extractedData.sessionType || 'Individual'}
                  </div>
                  <div className="text-sm">
                    <strong>Date Confidence:</strong>
                    <span className={getScoreColor(processingResult.validationDetails.dateValidationScore)}>
                      {" "}{processingResult.validationDetails.dateValidationScore}%
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Clinical Analysis */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Clinical Analysis
                </h4>
                
                {/* Risk Level */}
                {processingResult.extractedData.riskLevel && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Risk Level:</span>
                    <Badge className={getRiskLevelColor(processingResult.extractedData.riskLevel)}>
                      {processingResult.extractedData.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                )}

                {/* Progress Rating */}
                {processingResult.extractedData.progressRating && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Progress Rating:</span>
                    <Badge variant="outline">
                      {processingResult.extractedData.progressRating}/10
                    </Badge>
                  </div>
                )}

                {/* Themes */}
                {processingResult.extractedData.clinicalThemes && processingResult.extractedData.clinicalThemes.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Themes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {processingResult.extractedData.clinicalThemes.map((theme, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emotions */}
                {processingResult.extractedData.emotions && processingResult.extractedData.emotions.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Emotions:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {processingResult.extractedData.emotions.map((emotion, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {emotion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interventions */}
                {processingResult.extractedData.interventions && processingResult.extractedData.interventions.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Interventions:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {processingResult.extractedData.interventions.map((intervention, index) => (
                        <Badge key={index} variant="default" className="text-xs">
                          {intervention}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Content Preview */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Content Preview
                </h4>
                <div className="bg-parchment/80 p-3 rounded text-sm max-h-32 overflow-y-auto">
                  {processingResult.extractedData.content.substring(0, 500)}
                  {processingResult.extractedData.content.length > 500 && "..."}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Validation Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(processingResult.validationDetails).map(([key, score]) => (
                  <div key={key} className="text-center">
                    <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                      {score}%
                    </div>
                    <div className="text-xs text-sepia capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setUploadedFiles([]);
                setProcessingResult(null);
                setProcessingStages([]);
              }}
              variant="outline"
              data-testid="upload-another"
            >
              Upload Another Document
            </Button>
            
            {processingResult.progressNoteId && (
              <Button 
                onClick={() => {
                  // Navigate to progress note
                  window.location.href = `/progress-notes`;
                }}
                data-testid="view-progress-note"
              >
                View Progress Note
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}