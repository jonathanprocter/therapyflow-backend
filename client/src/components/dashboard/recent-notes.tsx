import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProgressNoteWithClient } from "@/types/clinical";

export default function RecentNotes() {
  const { data: notes, isLoading } = useQuery<ProgressNoteWithClient[]>({
    queryKey: ["/api/progress-notes?recent=true"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Progress Notes</h3>
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-12 w-full" />
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="recent-notes">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900" data-testid="notes-title">
            Recent Progress Notes
          </h3>
          <Button data-testid="new-note-button">
            <i className="fas fa-plus mr-2"></i>
            New Note
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!notes || !Array.isArray(notes) || notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500" data-testid="no-notes">
            <i className="fas fa-notes-medical text-4xl mb-4 opacity-50"></i>
            <p>No progress notes available</p>
          </div>
        ) : (
          <>
            {notes && notes.map((note) => (
              <div
                key={note.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                data-testid={`note-${note.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900" data-testid={`note-client-${note.id}`}>
                        {note.client?.name || "Unknown Client"}
                      </h4>
                      <span className="text-xs text-gray-500" data-testid={`note-date-${note.id}`}>
                        {new Date(note.sessionDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2" data-testid={`note-content-${note.id}`}>
                      {note.content && note.content.length > 150 
                        ? `${note.content.substring(0, 150)}...`
                        : note.content || "No content available"
                      }
                    </p>
                    {note.aiTags && note.aiTags.length > 0 && (
                      <div className="flex items-center space-x-2" data-testid={`note-tags-${note.id}`}>
                        {note.aiTags.slice(0, 3).map((tag, index) => {
                          const tagColors = [
                            "bg-blue-100 text-blue-800",
                            "bg-green-100 text-green-800", 
                            "bg-purple-100 text-purple-800"
                          ];
                          return (
                            <span 
                              key={tag}
                              className={`inline-flex items-center px-2 py-1 text-xs rounded ${tagColors[index % tagColors.length]}`}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-gray-400 hover:text-primary h-auto p-1"
                      data-testid={`edit-note-${note.id}`}
                    >
                      <i className="fas fa-edit"></i>
                    </Button>
                    <span className="text-xs text-gray-400" data-testid={`note-ai-status-${note.id}`}>
                      AI Tagged
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="text-center pt-4">
              <Button variant="ghost" data-testid="view-all-notes">
                View All Notes →
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
