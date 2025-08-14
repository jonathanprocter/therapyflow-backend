import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Search, FileText, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIResult {
  id: string;
  documentId: string;
  model: string;
  entities: any;
  extractions: any;
  summary: string;
  recommendations: string[];
  confidence: number;
  createdAt: string;
}

export default function CareNotesResults() {
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AIResult[]>([]);
  const { toast } = useToast();

  const handleFetchResults = async () => {
    if (!clientId) {
      toast({
        title: "Missing Client ID",
        description: "Please enter a client ID",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/ai/results/${clientId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results || []);
      
      toast({
        title: "Results Loaded",
        description: `Found ${data.results?.length || 0} AI analysis results`
      });

    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: "Fetch Failed",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (confidence: number) => {
    if (confidence >= 80) return { backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' };
    if (confidence >= 60) return { backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' };
    return { backgroundColor: 'rgba(115, 138, 110, 0.15)', color: '#738A6E' };
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" style={{ backgroundColor: '#F2F3F1', minHeight: '100vh' }}>
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#344C3D' }}>AI Analysis Results</h1>
        <p className="mt-2" style={{ color: '#738A6E' }}>
          View AI-processed clinical document analysis and insights
        </p>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
            <Search className="h-5 w-5" style={{ color: '#88A5BC' }} />
            Search Results
          </CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Enter a client ID to view their AI analysis results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="searchClientId" style={{ color: '#344C3D' }}>Client ID</Label>
              <Input
                id="searchClientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter client ID to search"
                className="border border-gray-300 focus:border-[#88A5BC] focus:ring-[#88A5BC]"
                data-testid="input-search-client-id"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleFetchResults} 
                disabled={loading || !clientId}
                className="hover:bg-opacity-90"
                style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
                data-testid="button-fetch-results"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid gap-6">
          {results.map((result) => (
            <Card key={result.id} className="bg-white" data-testid={`card-result-${result.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
                      <Brain className="h-5 w-5" style={{ color: '#88A5BC' }} />
                      AI Analysis Result
                    </CardTitle>
                    <CardDescription style={{ color: '#738A6E' }}>
                      Document ID: {result.documentId} • 
                      Model: {result.model} • 
                      Processed: {new Date(result.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge 
                    style={getRiskColor(result.confidence)}
                    data-testid={`badge-confidence-${result.id}`}
                  >
                    {result.confidence}% confidence
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                {result.summary && (
                  <div>
                    <h4 className="font-semibold mb-2" style={{ color: '#344C3D' }}>Summary</h4>
                    <p style={{ color: '#738A6E' }} data-testid={`text-summary-${result.id}`}>
                      {result.summary}
                    </p>
                  </div>
                )}

                {/* Entities */}
                {result.entities && (
                  <div>
                    <h4 className="font-semibold mb-2" style={{ color: '#344C3D' }}>Identified Entities</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {result.entities.client && (
                        <div>
                          <Label style={{ color: '#344C3D' }}>Client</Label>
                          <p className="text-sm" style={{ color: '#738A6E' }}>{result.entities.client.name || 'Not specified'}</p>
                        </div>
                      )}
                      {result.entities.appointment && (
                        <div>
                          <Label style={{ color: '#344C3D' }}>Appointment</Label>
                          <p className="text-sm" style={{ color: '#738A6E' }}>
                            {result.entities.appointment.date || 'Date not specified'}
                            {result.entities.appointment.time && ` at ${result.entities.appointment.time}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Extractions */}
                {result.extractions && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.extractions.diagnoses && result.extractions.diagnoses.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: '#344C3D' }}>
                          <AlertTriangle className="h-4 w-4" style={{ color: '#88A5BC' }} />
                          Diagnoses
                        </h4>
                        <div className="space-y-1">
                          {result.extractions.diagnoses.map((diagnosis: any, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="mr-1 mb-1"
                              style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                            >
                              {diagnosis.code ? `${diagnosis.code}: ` : ''}{diagnosis.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.extractions.medications && result.extractions.medications.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2" style={{ color: '#344C3D' }}>Medications</h4>
                        <div className="space-y-1">
                          {result.extractions.medications.map((med: any, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="mr-1 mb-1"
                              style={{ borderColor: '#88A5BC', color: '#88A5BC' }}
                            >
                              {med.name} {med.dose ? `${med.dose}` : ''} {med.freq ? `${med.freq}` : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.extractions.symptoms && result.extractions.symptoms.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2" style={{ color: '#344C3D' }}>Symptoms</h4>
                        <div className="space-y-1">
                          {result.extractions.symptoms.map((symptom: string, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="mr-1 mb-1"
                              style={{ borderColor: '#738A6E', color: '#738A6E' }}
                            >
                              {symptom}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.extractions.goals && result.extractions.goals.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2" style={{ color: '#344C3D' }}>Treatment Goals</h4>
                        <div className="space-y-1">
                          {result.extractions.goals.map((goal: string, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="mr-1 mb-1"
                              style={{ borderColor: '#8EA58C', color: '#8EA58C', backgroundColor: 'rgba(142, 165, 140, 0.05)' }}
                            >
                              {goal}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: '#344C3D' }}>
                      <CheckCircle className="h-4 w-4" style={{ color: '#8EA58C' }} />
                      Recommendations
                    </h4>
                    <ul className="list-disc list-inside space-y-1" data-testid={`list-recommendations-${result.id}`}>
                      {result.recommendations.map((rec, idx) => (
                        <li key={idx} style={{ color: '#738A6E' }}>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {clientId && !loading && results.length === 0 && (
        <Card className="bg-white">
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: '#88A5BC' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>No Results Found</h3>
            <p style={{ color: '#738A6E' }}>
              No AI analysis results found for client "{clientId}". 
              Make sure documents have been uploaded and processed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}