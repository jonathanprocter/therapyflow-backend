import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Lightbulb, 
  FileText, 
  Save, 
  Wand2, 
  AlertTriangle, 
  TrendingUp,
  MessageSquare,
  Target,
  Clock
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AISuggestion {
  id: string;
  type: 'intervention' | 'theme' | 'risk_assessment' | 'next_steps' | 'clinical_insight';
  title: string;
  content: string;
  confidence: number;
  context?: string;
}

interface ProgressNoteSection {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface InteractiveProgressNoteEditorProps {
  clientId: string;
  sessionId?: string;
  sessionDate?: string | Date;
  initialContent?: Partial<ProgressNoteSection>;
  onSave?: (noteId: string) => void;
  onCancel?: () => void;
}

export function InteractiveProgressNoteEditor({ 
  clientId, 
  sessionId, 
  sessionDate,
  initialContent = {},
  onSave,
  onCancel 
}: InteractiveProgressNoteEditorProps) {
  const [noteContent, setNoteContent] = useState<ProgressNoteSection>({
    subjective: initialContent.subjective || '',
    objective: initialContent.objective || '',
    assessment: initialContent.assessment || '',
    plan: initialContent.plan || ''
  });
  
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillSource, setPrefillSource] = useState<'progress_note' | 'document' | 'none' | null>(null);
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [preserveEdits, setPreserveEdits] = useState(true);
  const [activeSection, setActiveSection] = useState<keyof ProgressNoteSection>('subjective');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState<'low' | 'moderate' | 'high' | 'critical'>('low');
  const [progressRating, setProgressRating] = useState<number>(5);
  
  const queryClient = useQueryClient();

  // Get client context for AI suggestions
  const { data: clientData } = useQuery({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId
  });

  // Get recent progress notes for context
  const { data: recentNotes } = useQuery({
    queryKey: ['/api/progress-notes', { clientId, limit: 5 }],
    enabled: !!clientId
  });

  // Generate AI suggestions based on current content
  const generateAISuggestions = useCallback(async (content: string, section: string) => {
    if (!content.trim() || content.length < 20) return;
    
    setIsGeneratingSuggestions(true);
    try {
      const response = await fetch(`/api/ai/progress-note-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          sessionId,
          content,
          section,
          context: {
            clientData,
            recentNotes: Array.isArray(recentNotes) ? recentNotes.slice(0, 3) : [],
            currentSections: noteContent
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to generate AI suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [clientId, sessionId, clientData, recentNotes, noteContent]);

  // Debounced suggestion generation
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentContent = noteContent[activeSection];
      if (currentContent) {
        generateAISuggestions(currentContent, activeSection);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [noteContent[activeSection], activeSection, generateAISuggestions]);

  const handlePrefill = useCallback(async () => {
    setIsPrefilling(true);
    try {
      const data = await apiRequest('/api/ai/progress-note-draft', {
        method: 'POST',
        body: JSON.stringify({ clientId, sessionId })
      });

      if (data?.draft) {
        const draft: ProgressNoteSection = {
          subjective: data.draft.subjective || '',
          objective: data.draft.objective || '',
          assessment: data.draft.assessment || '',
          plan: data.draft.plan || ''
        };
        setNoteContent(prev => ({
          subjective: preserveEdits && prev.subjective.trim().length > 0 ? prev.subjective : draft.subjective,
          objective: preserveEdits && prev.objective.trim().length > 0 ? prev.objective : draft.objective,
          assessment: preserveEdits && prev.assessment.trim().length > 0 ? prev.assessment : draft.assessment,
          plan: preserveEdits && prev.plan.trim().length > 0 ? prev.plan : draft.plan
        }));

        const firstSection = (['subjective', 'objective', 'assessment', 'plan'] as const).find(
          section => draft[section].trim().length > 0
        );
        if (firstSection) {
          setActiveSection(firstSection);
        }
      }

      setPrefillSource(data?.source || 'none');
    } catch (error) {
      console.error('Failed to prefill progress note:', error);
      setPrefillSource('none');
    } finally {
      setHasPrefilled(true);
      setIsPrefilling(false);
    }
  }, [clientId, sessionId, preserveEdits]);

  useEffect(() => {
    const hasContent = Object.values(noteContent).some(value => value.trim().length > 0);
    if (!clientId || hasPrefilled || hasContent) {
      return;
    }

    handlePrefill();
  }, [clientId, sessionId, noteContent, hasPrefilled, handlePrefill]);

  // Save progress note mutation
  const saveNoteMutation = useMutation({
    mutationFn: async (noteData: any) => {
      const response = await fetch('/api/progress-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes'] });
      onSave?.(data.id);
    }
  });

  // Handle section content changes
  const handleSectionChange = (section: keyof ProgressNoteSection, value: string) => {
    setNoteContent(prev => ({
      ...prev,
      [section]: value
    }));
  };

  // Apply AI suggestion
  const applySuggestion = (suggestion: AISuggestion) => {
    if (suggestion.type === 'intervention' || suggestion.type === 'next_steps') {
      const currentPlan = noteContent.plan;
      const newPlan = currentPlan 
        ? `${currentPlan}\n\n${suggestion.content}` 
        : suggestion.content;
      handleSectionChange('plan', newPlan);
    } else if (suggestion.type === 'theme' || suggestion.type === 'clinical_insight') {
      const currentAssessment = noteContent.assessment;
      const newAssessment = currentAssessment 
        ? `${currentAssessment}\n\n${suggestion.content}` 
        : suggestion.content;
      handleSectionChange('assessment', newAssessment);
    }
    
    // Remove applied suggestion
    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  // Save progress note
  const handleSave = () => {
    const noteDate = sessionDate ? new Date(sessionDate) : new Date();
    const sessionDateValue = isNaN(noteDate.getTime())
      ? new Date().toISOString().split('T')[0]
      : noteDate.toISOString().split('T')[0];

    const fullContent = `**Subjective:**\n${noteContent.subjective}\n\n**Objective:**\n${noteContent.objective}\n\n**Assessment:**\n${noteContent.assessment}\n\n**Plan:**\n${noteContent.plan}`;
    
    saveNoteMutation.mutate({
      clientId,
      sessionId,
      content: fullContent,
      tags: selectedTags,
      riskLevel,
      progressRating,
      sessionDate: sessionDateValue
    });
  };

  const getSectionIcon = (section: keyof ProgressNoteSection) => {
    switch (section) {
      case 'subjective': return <MessageSquare className="h-4 w-4" />;
      case 'objective': return <FileText className="h-4 w-4" />;
      case 'assessment': return <Brain className="h-4 w-4" />;
      case 'plan': return <Target className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getSuggestionIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'intervention': return <Wand2 className="h-4 w-4" />;
      case 'theme': return <TrendingUp className="h-4 w-4" />;
      case 'risk_assessment': return <AlertTriangle className="h-4 w-4" />;
      case 'next_steps': return <Target className="h-4 w-4" />;
      case 'clinical_insight': return <Lightbulb className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex gap-6 h-[800px]" data-testid="interactive-progress-note-editor">
      {/* Main Editor */}
      <div className="flex-1 space-y-4">
        <Card className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
              <FileText className="h-5 w-5" style={{ color: '#88A5BC' }} />
              Interactive Progress Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(isPrefilling || prefillSource) && (
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#344C3D' }}
                data-testid="prefill-status"
              >
                <div className="flex items-center gap-2">
                  <span>
                    {isPrefilling
                      ? 'Generating AI draft from recent history...'
                      : prefillSource === 'progress_note'
                        ? 'AI draft seeded from the most recent progress note.'
                        : prefillSource === 'document'
                          ? 'AI draft seeded from the most recent document.'
                          : 'AI draft unavailable; start from scratch.'}
                  </span>
                  {prefillSource && prefillSource !== 'none' && (
                    <Badge variant="outline" style={{ borderColor: '#88A5BC', color: '#88A5BC' }}>
                      AI Draft
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPrefilling}
                  className="text-xs"
                  style={{ borderColor: '#88A5BC', color: '#88A5BC' }}
                  onClick={handlePrefill}
                  data-testid="button-regenerate-draft"
                >
                  {isPrefilling ? 'Regenerating...' : 'Regenerate Draft'}
                </Button>
                <label className="flex items-center gap-2 text-xs" style={{ color: '#738A6E' }}>
                  <input
                    type="checkbox"
                    checked={preserveEdits}
                    onChange={(event) => setPreserveEdits(event.target.checked)}
                    className="h-3 w-3"
                    data-testid="checkbox-preserve-edits"
                  />
                  Preserve my edits
                </label>
              </div>
            )}
            {/* Section Tabs */}
            <div className="flex space-x-1 rounded-lg p-1" style={{ backgroundColor: 'rgba(242, 243, 241, 0.8)' }}>
              {(['subjective', 'objective', 'assessment', 'plan'] as const).map((section) => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors capitalize"
                  style={activeSection === section 
                    ? { backgroundColor: '#FFFFFF', color: '#344C3D', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: '#738A6E' }
                  }
                  data-testid={`section-tab-${section}`}
                >
                  {getSectionIcon(section)}
                  {section}
                </button>
              ))}
            </div>

            {/* Active Section Editor */}
            <div className="space-y-2">
              <label className="text-sm font-medium capitalize" style={{ color: '#344C3D' }}>
                {activeSection} Section
              </label>
              <Textarea
                value={noteContent[activeSection]}
                onChange={(e) => handleSectionChange(activeSection, e.target.value)}
                placeholder={`Enter ${activeSection} information...`}
                className="min-h-[200px] resize-none bg-white border focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                data-testid={`textarea-${activeSection}`}
              />
            </div>

            {/* Progress Rating & Risk Level */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium" style={{ color: '#344C3D' }}>Progress Rating (1-10)</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={progressRating}
                  onChange={(e) => setProgressRating(parseInt(e.target.value))}
                  className="mt-1 bg-white border focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                  data-testid="input-progress-rating"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium" style={{ color: '#344C3D' }}>Risk Level</label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as any)}
                  className="mt-1 w-full px-3 py-2 border rounded-md"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                  data-testid="select-risk-level"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onCancel} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saveNoteMutation.isPending}
                style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C', color: '#FFFFFF' }}
                className="hover:bg-opacity-90"
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveNoteMutation.isPending ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Suggestions Sidebar */}
      <div className="w-80">
        <Card className="h-full bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
              <Brain className="h-5 w-5" style={{ color: '#88A5BC' }} />
              AI Suggestions
              {isGeneratingSuggestions && (
                <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full" style={{ borderColor: '#88A5BC' }} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[700px] px-4">
              {aiSuggestions.length === 0 ? (
                <div className="text-center py-8">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" style={{ color: '#738A6E' }} />
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Start typing in any section to receive AI-powered suggestions
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {aiSuggestions.map((suggestion) => (
                    <Card key={suggestion.id} className="p-3 bg-white border-l-4" style={{ borderLeftColor: '#88A5BC' }} data-testid={`suggestion-${suggestion.id}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <div style={{ color: '#88A5BC' }}>
                          {getSuggestionIcon(suggestion.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium" style={{ color: '#344C3D' }}>{suggestion.title}</h4>
                          <Badge variant="secondary" className="text-xs mt-1" style={{ backgroundColor: '#8EA58C', color: '#FFFFFF' }}>
                            {Math.round(suggestion.confidence)}% confident
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm mb-3" style={{ color: '#738A6E' }}>
                        {suggestion.content}
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => applySuggestion(suggestion)}
                        className="w-full"
                        style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                        data-testid={`button-apply-${suggestion.id}`}
                      >
                        Apply Suggestion
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
