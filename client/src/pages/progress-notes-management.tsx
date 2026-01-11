import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Calendar, User, Upload, AlertCircle, CheckCircle, Clock, Edit, Trash2, ClipboardPaste, Brain, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { DocumentUploader } from '@/components/DocumentUploader';

interface ProgressNote {
  id: string;
  content: string | null;
  sessionDate: string;
  status: string;
  isPlaceholder: boolean;
  requiresManualReview: boolean;
  aiConfidenceScore?: number;
  processingNotes?: string;
  qualityScore?: number;
  qualityFlags?: string[];
  sessionId?: string;
  client?: {
    id: string;
    name: string;
  };
  session?: {
    id: string;
    scheduledAt: string;
    sessionType: string;
    duration: number;
  };
}

export default function ProgressNotesManagement() {
  const [selectedNote, setSelectedNote] = useState<ProgressNote | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkClientId, setBulkClientId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkResults, setBulkResults] = useState<any | null>(null);
  const [bulkPreview, setBulkPreview] = useState<any | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [autoCreatePlaceholders, setAutoCreatePlaceholders] = useState(true);
  const [dateToleranceDays, setDateToleranceDays] = useState(0);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [aiSuggestionOpen, setAiSuggestionOpen] = useState(false);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any | null>(null);
  const queryClient = useQueryClient();

  // Fetch placeholders
  const { data: placeholders = [], isLoading: placeholdersLoading } = useQuery<ProgressNote[]>({
    queryKey: ['/api/progress-notes/placeholders'],
    enabled: true,
  });

  // Fetch manual review notes
  const { data: manualReviewNotes = [], isLoading: manualReviewLoading } = useQuery<ProgressNote[]>({
    queryKey: ['/api/progress-notes/manual-review'],
    enabled: true,
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
    enabled: true,
  });

  // Create placeholders mutation
  const createPlaceholdersMutation = useMutation({
    mutationFn: () => apiRequest('/api/progress-notes/create-placeholders', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
    },
  });

  const createRangePlaceholdersMutation = useMutation({
    mutationFn: () => apiRequest('/api/progress-notes/create-placeholders-range', {
      method: 'POST',
      body: JSON.stringify({ startDate: rangeStart, endDate: rangeEnd }),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
    },
  });

  // Update progress note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      apiRequest(`/api/progress-notes/${id}`, { method: 'PATCH', body: JSON.stringify(updates), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
      setEditDialogOpen(false);
      setSelectedNote(null);
    },
  });

  // Delete progress note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/progress-notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Failed to delete progress note: ${errorMessage}`);
    },
  });

  const bulkPasteMutation = useMutation({
    mutationFn: () => apiRequest('/api/progress-notes/bulk-paste', {
      method: 'POST',
      body: JSON.stringify({
        clientId: bulkClientId,
        rawText: bulkText,
        createPlaceholdersForMissing: autoCreatePlaceholders,
        dateToleranceDays,
        includeIndices: selectedIndices.length > 0 ? selectedIndices : undefined
      }),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: (data) => {
      setBulkResults(data);
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
    }
  });

  const bulkPreviewMutation = useMutation({
    mutationFn: () => apiRequest('/api/progress-notes/bulk-paste', {
      method: 'POST',
      body: JSON.stringify({ clientId: bulkClientId, rawText: bulkText, dryRun: true, dateToleranceDays }),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: (data) => {
      setBulkPreview(data);
      const indices = (data.results || []).map((item: any) => item.index).filter((value: any) => typeof value === 'number');
      setSelectedIndices(indices);
    }
  });

  const handleEditNote = (note: ProgressNote) => {
    setSelectedNote(note);
    setEditContent(note.content || '');
    setEditDialogOpen(true);
  };

  const handleSaveNote = () => {
    if (!selectedNote) return;
    
    updateNoteMutation.mutate({
      id: selectedNote.id,
      updates: {
        content: editContent,
        status: 'uploaded',
        isPlaceholder: false,
      },
    });
  };

  const handleMarkReviewed = (note: ProgressNote) => {
    updateNoteMutation.mutate({
      id: note.id,
      updates: {
        status: 'processed',
        requiresManualReview: false,
      },
    });
  };

  const handleAiSuggest = async (note: ProgressNote) => {
    if (!note.content || !note.client?.id) return;
    setAiSuggestionLoading(true);
    setAiSuggestionOpen(true);
    try {
      const response = await apiRequest('/api/ai/analyze-note', {
        method: 'POST',
        body: JSON.stringify({ content: note.content, clientId: note.client.id }),
        headers: { 'Content-Type': 'application/json' }
      });
      setAiSuggestion(response.analysis || response);
    } catch (error) {
      setAiSuggestion({ error: 'Failed to generate AI suggestions.' });
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  const handleDeleteNote = (noteId: string, noteName: string) => {
    if (window.confirm(`Are you sure you want to delete the progress note for "${noteName}"? This action cannot be undone.`)) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  const getStatusBadge = (note: ProgressNote) => {
    if (note.isPlaceholder) {
      return <Badge variant="outline" className="text-moss"><Clock className="w-3 h-3 mr-1" />Placeholder</Badge>;
    }
    if (note.requiresManualReview) {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Needs Review</Badge>;
    }
    if (note.status === 'uploaded') {
      return <Badge variant="default"><Upload className="w-3 h-3 mr-1" />Uploaded</Badge>;
    }
    if (note.status === 'processed') {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Processed</Badge>;
    }
    return <Badge variant="secondary">{note.status}</Badge>;
  };

  const getQualityBadge = (note: ProgressNote) => {
    const score = note.qualityScore ?? 0;
    const label = `Quality ${score}`;
    if (score >= 80) {
      return <Badge variant="default" className="bg-emerald-500">{label}</Badge>;
    }
    if (score >= 60) {
      return <Badge variant="outline" className="text-amber-700 border-amber-300">{label}</Badge>;
    }
    return <Badge variant="destructive">{label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-evergreen">Progress Notes Management</h1>
          <p className="text-moss mt-2">Manage SimplePractice appointments and progress note placeholders</p>
        </div>
        <Button 
          onClick={() => createPlaceholdersMutation.mutate()}
          disabled={createPlaceholdersMutation.isPending}
          className="flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {createPlaceholdersMutation.isPending ? 'Creating...' : 'Create Placeholders'}
        </Button>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload & Process
          </TabsTrigger>
          <TabsTrigger value="placeholders" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Placeholders ({placeholders.length})
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Manual Review ({manualReviewNotes.length})
          </TabsTrigger>
          <TabsTrigger value="bulk-paste" className="flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4" />
            Bulk Paste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <DocumentUploader 
            onUploadComplete={(results) => {
              // Refresh data after upload
              queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
              queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
            }}
          />
        </TabsContent>

        <TabsContent value="bulk-paste" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5" />
                Bulk Paste Progress Notes
              </CardTitle>
              <CardDescription>
                Paste multiple notes from the chart. AI will split them, extract dates, and match them to sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-client">Client</Label>
                <select
                  id="bulk-client"
                  className="w-full px-3 py-2 border rounded-md"
                  style={{ borderColor: 'rgba(115, 138, 110, 0.3)' }}
                  value={bulkClientId}
                  onChange={(event) => setBulkClientId(event.target.value)}
                  data-testid="select-bulk-client"
                >
                  <option value="">Select a client</option>
                  {clients.map((client: any) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-text">Progress Notes Text</Label>
                <Textarea
                  id="bulk-text"
                  value={bulkText}
                  onChange={(event) => setBulkText(event.target.value)}
                  placeholder="Paste multiple notes here. Separate by date headings or blank lines."
                  className="min-h-[200px]"
                  data-testid="textarea-bulk-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-tolerance">Date Match Tolerance (days)</Label>
                <Input
                  id="date-tolerance"
                  type="number"
                  min="0"
                  max="7"
                  value={dateToleranceDays}
                  onChange={(event) => setDateToleranceDays(Number(event.target.value))}
                  data-testid="input-date-tolerance"
                />
              </div>
              <Button
                onClick={() => bulkPreviewMutation.mutate()}
                disabled={!bulkClientId || !bulkText || bulkPreviewMutation.isPending}
                variant="outline"
                data-testid="button-bulk-preview"
              >
                {bulkPreviewMutation.isPending ? 'Previewing...' : 'Preview Matches'}
              </Button>
              <Button
                onClick={() => bulkPasteMutation.mutate()}
                disabled={!bulkClientId || !bulkText || bulkPasteMutation.isPending}
                data-testid="button-bulk-import"
              >
                {bulkPasteMutation.isPending ? 'Importing...' : 'Import Notes'}
              </Button>

              <label className="flex items-center gap-2 text-sm" style={{ color: '#738A6E' }}>
                <input
                  type="checkbox"
                  checked={autoCreatePlaceholders}
                  onChange={(event) => setAutoCreatePlaceholders(event.target.checked)}
                  data-testid="checkbox-auto-placeholders"
                />
                Auto-create placeholders for missing sessions
              </label>

              {bulkPreview && (
                <div className="rounded-lg border p-4 text-sm space-y-2" style={{ borderColor: 'rgba(115, 138, 110, 0.2)' }}>
                  <div>
                    Preview: {bulkPreview.total} • Matched: {bulkPreview.matchedSessions} • Missing Sessions: {bulkPreview.missingSessions}
                  </div>
                  <div className="text-xs" style={{ color: '#738A6E' }}>
                    Selected for import: {selectedIndices.length}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const indices = (bulkPreview.results || [])
                          .filter((item: any) => !showMissingOnly || item.status === "needs_match")
                          .map((item: any) => item.index);
                        setSelectedIndices(indices);
                      }}
                      data-testid="button-select-all-preview"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIndices([])}
                      data-testid="button-clear-preview"
                    >
                      Clear All
                    </Button>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showMissingOnly}
                        onChange={(event) => setShowMissingOnly(event.target.checked)}
                        data-testid="checkbox-show-missing"
                      />
                      Only show missing matches
                    </label>
                  </div>
                  <div className="space-y-1">
                    {(bulkPreview.results || [])
                      .filter((item: any) => !showMissingOnly || item.status === "needs_match")
                      .map((item: any, idx: number) => {
                        const checked = selectedIndices.includes(item.index);
                        return (
                          <label key={idx} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  setSelectedIndices((prev) => {
                                    if (event.target.checked) {
                                      return [...prev, item.index];
                                    }
                                    return prev.filter((value) => value !== item.index);
                                  });
                                }}
                                data-testid={`preview-select-${item.index}`}
                              />
                              <span>{item.sessionDate || 'Unknown date'}</span>
                            </span>
                            <Badge variant="outline">
                              {item.status}
                            </Badge>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {bulkResults && (
                <div className="rounded-lg border p-4 text-sm space-y-2" style={{ borderColor: 'rgba(115, 138, 110, 0.2)' }}>
                  <div>
                    Imported: {bulkResults.total} • Matched: {bulkResults.matchedSessions} • Missing Sessions: {bulkResults.missingSessions}
                  </div>
                  <div className="space-y-1">
                    {bulkResults.results?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>{item.sessionDate || 'Unknown date'}</span>
                        <Badge variant="outline">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="placeholders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Progress Note Placeholders
              </CardTitle>
              <CardDescription>
                These are empty progress note slots for your SimplePractice appointments. Click edit to add content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div>
                    <Label htmlFor="rangeStart">Start date</Label>
                    <Input
                      id="rangeStart"
                      type="date"
                      value={rangeStart}
                      onChange={(event) => setRangeStart(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rangeEnd">End date</Label>
                    <Input
                      id="rangeEnd"
                      type="date"
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => createRangePlaceholdersMutation.mutate()}
                  disabled={!rangeStart || !rangeEnd || createRangePlaceholdersMutation.isPending}
                >
                  {createRangePlaceholdersMutation.isPending ? 'Creating...' : 'Create Range Placeholders'}
                </Button>
              </div>
              {placeholdersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage"></div>
                </div>
              ) : placeholders.length === 0 ? (
                <div className="text-center py-8 text-moss/80">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-sage/70" />
                  <p>No placeholders found. Click "Create Placeholders" to generate them for SimplePractice appointments.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {placeholders.map((note: ProgressNote) => (
                    <Card key={note.id} className="border-l-4 border-l-sage">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-moss/80" />
                              <span className="font-medium">{note.client?.name || 'Unknown Client'}</span>
                              {getStatusBadge(note)}
                              {note.qualityScore !== undefined && getQualityBadge(note)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-moss">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(note.sessionDate), 'PPP p')}</span>
                              {note.session && (
                                <span className="text-sage">
                                  • {note.session.sessionType} • {note.session.duration}min
                                </span>
                              )}
                            </div>
                            {note.content && (
                              <p className="text-sm text-evergreen/90 mt-2 line-clamp-2">
                                {note.content.substring(0, 150)}...
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditNote(note)}
                              className="flex items-center gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              {note.content ? 'Edit' : 'Add Content'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteNote(note.id, note.client?.name || 'Unknown Client')}
                              disabled={deleteNoteMutation.isPending}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700"
                              data-testid={`delete-note-${note.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Notes Requiring Manual Review
              </CardTitle>
              <CardDescription>
                Progress notes that need your attention due to processing issues or unclear content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {manualReviewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage"></div>
                </div>
              ) : manualReviewNotes.length === 0 ? (
                <div className="text-center py-8 text-moss/80">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-300" />
                  <p>No notes require manual review. All processed notes look good!</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {manualReviewNotes.map((note: ProgressNote) => (
                    <Card key={note.id} className="border-l-4 border-l-red-400">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-moss/80" />
                              <span className="font-medium">{note.client?.name || 'Unknown Client'}</span>
                              {getStatusBadge(note)}
                              {note.qualityScore !== undefined && getQualityBadge(note)}
                              {note.aiConfidenceScore && (
                                <Badge variant="outline" className="text-xs">
                                  Confidence: {Math.round(note.aiConfidenceScore * 100)}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-moss">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(note.sessionDate), 'PPP p')}</span>
                            </div>
                            {note.processingNotes && (
                              <div className="bg-ivory border border-moss/20 rounded p-2 text-sm">
                                <strong>Processing Notes:</strong> {note.processingNotes}
                              </div>
                            )}
                            {note.qualityFlags && note.qualityFlags.length > 0 && (
                              <div className="text-xs text-red-600">
                                Flags: {note.qualityFlags.join(", ")}
                              </div>
                            )}
                            {note.content && (
                              <p className="text-sm text-evergreen/90 mt-2 line-clamp-3">
                                {note.content.substring(0, 200)}...
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditNote(note)}
                              className="flex items-center gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Review & Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAiSuggest(note)}
                              className="flex items-center gap-1"
                            >
                              <Brain className="w-4 h-4" />
                              AI Suggest
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleMarkReviewed(note)}
                              className="flex items-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Mark Reviewed
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteNote(note.id, note.client?.name || 'Unknown Client')}
                              disabled={deleteNoteMutation.isPending}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700"
                              data-testid={`delete-note-${note.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Note Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedNote?.content ? 'Edit Progress Note' : 'Add Progress Note Content'}
            </DialogTitle>
            <DialogDescription>
              {selectedNote?.client?.name && (
                <>Client: {selectedNote.client.name} • Session: {selectedNote.sessionDate && format(new Date(selectedNote.sessionDate), 'PPP p')}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="content">Progress Note Content</Label>
              <Textarea
                id="content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Enter your progress note content here..."
                className="min-h-[200px] mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveNote}
                disabled={updateNoteMutation.isPending || !editContent.trim()}
              >
                {updateNoteMutation.isPending ? 'Saving...' : 'Save Progress Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiSuggestionOpen} onOpenChange={setAiSuggestionOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>AI Suggestions</DialogTitle>
            <DialogDescription>
              Review AI-generated insights to support manual edits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {aiSuggestionLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating suggestions...
              </div>
            )}
            {!aiSuggestionLoading && aiSuggestion?.error && (
              <div className="text-red-600">{aiSuggestion.error}</div>
            )}
            {!aiSuggestionLoading && aiSuggestion && !aiSuggestion.error && (
              <div className="space-y-4">
                {aiSuggestion.summary && (
                  <div>
                    <div className="text-sm font-semibold">Summary</div>
                    <p className="text-sm text-muted-foreground">{aiSuggestion.summary}</p>
                  </div>
                )}
                {aiSuggestion.insights && (
                  <div>
                    <div className="text-sm font-semibold">Key Insights</div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {aiSuggestion.insights.map((item: string, idx: number) => (
                        <li key={`insight-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSuggestion.recommendations && (
                  <div>
                    <div className="text-sm font-semibold">Recommendations</div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {aiSuggestion.recommendations.map((item: string, idx: number) => (
                        <li key={`rec-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSuggestion.riskFactors && (
                  <div>
                    <div className="text-sm font-semibold">Risk Factors</div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {aiSuggestion.riskFactors.map((item: string, idx: number) => (
                        <li key={`risk-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSuggestion.tags && (
                  <div>
                    <div className="text-sm font-semibold">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestion.tags.map((tag: string) => (
                        <span key={tag} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Raw JSON</summary>
                  <pre className="whitespace-pre-wrap rounded-lg border p-3 bg-muted/30 mt-2">
                    {JSON.stringify(aiSuggestion, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
