import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProgressNoteForm from "@/components/forms/progress-note-form";
import EnhancedDocumentUpload from "@/components/enhanced-document-upload";
import { formatEDTDateShort } from "@/utils/timezone";
import type { ProgressNoteWithClient } from "@/types/clinical";
import { Plus, Brain, FileText, Eye, Edit, Bot } from "lucide-react";

export default function ProgressNotes() {
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: notes, isLoading } = useQuery<ProgressNoteWithClient[]>({
    queryKey: ["/api/progress-notes", { recent: "true" }],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const filteredNotes = notes?.filter(note => 
    selectedClient === "all" || note.clientId === selectedClient
  ) || [];

  const getRiskLevelColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case "critical": return { backgroundColor: 'rgba(52, 76, 61, 0.1)', color: '#344C3D' };
      case "high": return { backgroundColor: 'rgba(115, 138, 110, 0.15)', color: '#738A6E' };
      case "moderate": return { backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' };
      case "low": return { backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' };
      default: return { backgroundColor: 'rgba(115, 138, 110, 0.05)', color: '#738A6E' };
    }
  };

  const getProgressRatingColor = (rating?: number) => {
    if (!rating) return { color: 'rgba(115, 138, 110, 0.4)' };
    if (rating >= 8) return { color: '#8EA58C' };
    if (rating >= 6) return { color: '#88A5BC' };
    if (rating >= 4) return { color: '#738A6E' };
    return { color: '#344C3D' };
  };

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="progress-notes-page">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 
                className="text-2xl font-bold" 
                style={{ color: '#344C3D' }}
                data-testid="notes-title"
              >
                Progress Notes
              </h1>
              <p 
                style={{ color: '#738A6E' }}
                data-testid="notes-subtitle"
              >
                Document therapeutic sessions and track client progress
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-48" data-testid="client-filter">
                  <SelectValue placeholder="Filter by client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {Array.isArray(clients) && clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={() => window.location.href = '/interactive-notes'}
                variant="outline"
                data-testid="ai-note-button"
              >
                <Brain className="w-4 h-4 mr-2" style={{ color: '#88A5BC' }} />
                AI-Assisted Note
              </Button>
              
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    data-testid="create-note-button"
                    style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
                    className="hover:bg-opacity-90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Progress Note
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Progress Note</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Enhanced Document Upload</TabsTrigger>
                      <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="space-y-4">
                      <div className="text-sm mb-4" style={{ color: '#738A6E' }}>
                        Upload your progress notes in TXT, PDF, DOCX, DOC, or RTF format. 
                        Our enhanced AI will extract client information, session dates, themes, and create comprehensive clinical documentation.
                      </div>
                      <EnhancedDocumentUpload />
                    </TabsContent>
                    <TabsContent value="manual" className="space-y-4">
                      <ProgressNoteForm onSuccess={() => setIsCreateDialogOpen(false)} />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse bg-white">
                  <CardContent className="p-6">
                    <div className="h-4 rounded w-3/4 mb-4" style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}></div>
                    <div className="h-20 rounded mb-4" style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}></div>
                    <div className="flex space-x-2 mb-4">
                      <div className="h-6 rounded w-16" style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}></div>
                      <div className="h-6 rounded w-20" style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}></div>
                    </div>
                    <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12" data-testid="no-notes">
              <FileText className="w-24 h-24 mb-4 mx-auto" style={{ color: 'rgba(115, 138, 110, 0.3)' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: '#344C3D' }}>
                {selectedClient === "all" ? "No progress notes yet" : "No notes for selected client"}
              </h3>
              <p className="mb-4" style={{ color: '#738A6E' }}>
                Start documenting therapeutic sessions and track client progress
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid="create-first-note"
                style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
                className="hover:bg-opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Note
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredNotes.map((note) => (
                <Card 
                  key={note.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer bg-white" 
                  data-testid={`note-card-${note.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold" style={{ color: '#344C3D' }} data-testid={`note-client-${note.id}`}>
                        {note.client?.name || "Unknown Client"}
                      </h3>
                      <Badge 
                        className="rounded"
                        style={getRiskLevelColor(note.riskLevel)}
                        data-testid={`note-risk-${note.id}`}
                      >
                        {note.riskLevel || "Low"} Risk
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm" style={{ color: '#738A6E' }}>
                      <span data-testid={`note-date-${note.id}`}>
                        {formatEDTDateShort(note.sessionDate)}
                      </span>
                      {note.progressRating && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs">Progress:</span>
                          <span 
                            className="font-medium"
                            style={getProgressRatingColor(note.progressRating)}
                            data-testid={`note-progress-${note.id}`}
                          >
                            {note.progressRating}/10
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <p className="text-sm mb-4 line-clamp-4" style={{ color: '#738A6E' }} data-testid={`note-content-${note.id}`}>
                      {note.content}
                    </p>

                    {/* AI Tags */}
                    {note.aiTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3" data-testid={`note-ai-tags-${note.id}`}>
                        {note.aiTags.slice(0, 4).map((tag, index) => {
                          const tagStyles = [
                            { backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' },
                            { backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' },
                            { backgroundColor: 'rgba(115, 138, 110, 0.1)', color: '#738A6E' },
                            { backgroundColor: 'rgba(52, 76, 61, 0.1)', color: '#344C3D' }
                          ];
                          return (
                            <span 
                              key={tag}
                              className="inline-flex items-center px-2 py-1 text-xs rounded"
                              style={tagStyles[index % tagStyles.length]}
                            >
                              <Bot className="w-3 h-3 mr-1" />
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Manual Tags */}
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3" data-testid={`note-tags-${note.id}`}>
                        {note.tags.slice(0, 3).map((tag) => (
                          <span 
                            key={tag}
                            className="inline-flex items-center px-2 py-1 text-xs rounded"
                            style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)', color: '#738A6E' }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(115, 138, 110, 0.2)' }}>
                      <span className="text-xs" style={{ color: 'rgba(115, 138, 110, 0.6)' }} data-testid={`note-created-${note.id}`}>
                        Created {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" data-testid={`view-note-${note.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`edit-note-${note.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
    </div>
  );
}