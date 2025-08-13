import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ProgressNoteForm from "@/components/forms/progress-note-form";
import type { ProgressNoteWithClient } from "@/types/clinical";

export default function ProgressNotes() {
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: notes, isLoading } = useQuery<ProgressNoteWithClient[]>({
    queryKey: ["/api/progress-notes?recent=true"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const filteredNotes = notes?.filter(note => 
    selectedClient === "all" || note.clientId === selectedClient
  ) || [];

  const getRiskLevelColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case "critical": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "moderate": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getProgressRatingColor = (rating?: number) => {
    if (!rating) return "text-gray-400";
    if (rating >= 8) return "text-green-600";
    if (rating >= 6) return "text-yellow-600";
    if (rating >= 4) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="flex h-screen bg-gray-50" data-testid="progress-notes-page">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="notes-title">
                Progress Notes
              </h1>
              <p className="text-gray-600" data-testid="notes-subtitle">
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

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="create-note-button">
                    <i className="fas fa-plus mr-2"></i>
                    New Progress Note
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Progress Note</DialogTitle>
                  </DialogHeader>
                  <ProgressNoteForm onSuccess={() => setIsCreateDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-20 bg-gray-200 rounded mb-4"></div>
                    <div className="flex space-x-2 mb-4">
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12" data-testid="no-notes">
              <i className="fas fa-notes-medical text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedClient === "all" ? "No progress notes yet" : "No notes for selected client"}
              </h3>
              <p className="text-gray-500 mb-4">
                Start documenting therapeutic sessions and track client progress
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid="create-first-note"
              >
                <i className="fas fa-plus mr-2"></i>
                Create Your First Note
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredNotes.map((note) => (
                <Card 
                  key={note.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer" 
                  data-testid={`note-card-${note.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900" data-testid={`note-client-${note.id}`}>
                        {note.client?.name || "Unknown Client"}
                      </h3>
                      <Badge 
                        className={getRiskLevelColor(note.riskLevel)}
                        data-testid={`note-risk-${note.id}`}
                      >
                        {note.riskLevel || "Low"} Risk
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span data-testid={`note-date-${note.id}`}>
                        {new Date(note.sessionDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      {note.progressRating && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs">Progress:</span>
                          <span 
                            className={`font-medium ${getProgressRatingColor(note.progressRating)}`}
                            data-testid={`note-progress-${note.id}`}
                          >
                            {note.progressRating}/10
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-600 mb-4 line-clamp-4" data-testid={`note-content-${note.id}`}>
                      {note.content}
                    </p>

                    {/* AI Tags */}
                    {note.aiTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3" data-testid={`note-ai-tags-${note.id}`}>
                        {note.aiTags.slice(0, 4).map((tag, index) => {
                          const tagColors = [
                            "bg-blue-100 text-blue-800",
                            "bg-green-100 text-green-800", 
                            "bg-purple-100 text-purple-800",
                            "bg-indigo-100 text-indigo-800"
                          ];
                          return (
                            <span 
                              key={tag}
                              className={`inline-flex items-center px-2 py-1 text-xs rounded ${tagColors[index % tagColors.length]}`}
                            >
                              <i className="fas fa-robot mr-1"></i>
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
                            className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-xs text-gray-400" data-testid={`note-created-${note.id}`}>
                        Created {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" data-testid={`view-note-${note.id}`}>
                          <i className="fas fa-eye"></i>
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`edit-note-${note.id}`}>
                          <i className="fas fa-edit"></i>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}