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
import { FileText, Calendar, User, Upload, AlertCircle, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
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

  // Create placeholders mutation
  const createPlaceholdersMutation = useMutation({
    mutationFn: () => apiRequest('/api/progress-notes/create-placeholders', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
    },
  });

  // Update progress note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      apiRequest(`/api/progress-notes/${id}`, 'PATCH', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
      setEditDialogOpen(false);
      setSelectedNote(null);
    },
  });

  // Delete progress note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/progress-notes/${id}`, 'DELETE'),
    onSuccess: (data) => {
      console.log('Delete successful:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/placeholders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress-notes/manual-review'] });
    },
    onError: (error: Error) => {
      console.error('Delete error:', error);
      alert(`Failed to delete progress note: ${error.message}`);
    },
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

  const handleDeleteNote = (noteId: string, noteName: string) => {
    if (window.confirm(`Are you sure you want to delete the progress note for "${noteName}"? This action cannot be undone.`)) {
      try {
        deleteNoteMutation.mutate(noteId);
      } catch (error) {
        console.error('Error initiating delete:', error);
        alert('Failed to delete progress note. Please try again.');
      }
    }
  };

  const getStatusBadge = (note: ProgressNote) => {
    if (note.isPlaceholder) {
      return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Placeholder</Badge>;
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Progress Notes Management</h1>
          <p className="text-gray-600 mt-2">Manage SimplePractice appointments and progress note placeholders</p>
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
              {placeholdersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : placeholders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No placeholders found. Click "Create Placeholders" to generate them for SimplePractice appointments.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {placeholders.map((note: ProgressNote) => (
                    <Card key={note.id} className="border-l-4 border-l-yellow-400">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{note.client?.name || 'Unknown Client'}</span>
                              {getStatusBadge(note)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(note.sessionDate), 'PPP p')}</span>
                              {note.session && (
                                <span className="text-gray-400">
                                  • {note.session.sessionType} • {note.session.duration}min
                                </span>
                              )}
                            </div>
                            {note.content && (
                              <p className="text-sm text-gray-700 mt-2 line-clamp-2">
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : manualReviewNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
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
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{note.client?.name || 'Unknown Client'}</span>
                              {getStatusBadge(note)}
                              {note.aiConfidenceScore && (
                                <Badge variant="outline" className="text-xs">
                                  Confidence: {Math.round(note.aiConfidenceScore * 100)}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(note.sessionDate), 'PPP p')}</span>
                            </div>
                            {note.processingNotes && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm">
                                <strong>Processing Notes:</strong> {note.processingNotes}
                              </div>
                            )}
                            {note.content && (
                              <p className="text-sm text-gray-700 mt-2 line-clamp-3">
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
    </div>
  );
}