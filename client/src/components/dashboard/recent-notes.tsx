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
      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>Recent Progress Notes</h3>
            <div 
              className="h-8 w-24 rounded"
              style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
            ></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg" style={{ borderColor: 'rgba(115, 138, 110, 0.2)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="h-4 w-32 rounded"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                    ></div>
                    <div 
                      className="h-3 w-20 rounded"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                    ></div>
                  </div>
                  <div 
                    className="h-12 w-full rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                  ></div>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="h-5 w-16 rounded"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                    ></div>
                    <div 
                      className="h-5 w-20 rounded"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                    ></div>
                    <div 
                      className="h-5 w-12 rounded"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                    ></div>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <div 
                    className="h-6 w-6 rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                  ></div>
                  <div 
                    className="h-3 w-16 rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid="recent-notes">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }} data-testid="notes-title">
            Recent Progress Notes
          </h3>
          <Button 
            className="hover:bg-opacity-90"
            style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
            data-testid="new-note-button"
          >
            <i className="fas fa-plus mr-2"></i>
            New Note
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!notes || notes.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#738A6E' }} data-testid="no-notes">
            <i className="fas fa-notes-medical text-4xl mb-4 opacity-50" style={{ color: '#88A5BC' }}></i>
            <p>No progress notes available</p>
          </div>
        ) : (
          <>
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-ivory-50"
                style={{ 
                  borderColor: 'rgba(115, 138, 110, 0.2)'
                }}
                data-testid={`note-${note.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium" style={{ color: '#344C3D' }} data-testid={`note-client-${note.id}`}>
                        {note.client?.name || "Unknown Client"}
                      </h4>
                      <span className="text-xs" style={{ color: '#738A6E' }} data-testid={`note-date-${note.id}`}>
                        {new Date(note.sessionDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: '#738A6E' }} data-testid={`note-content-${note.id}`}>
                      {note.content && note.content.length > 150 
                        ? `${note.content.substring(0, 150)}...`
                        : note.content || "No content available"
                      }</p>
                    {note.aiTags.length > 0 && (
                      <div className="flex items-center space-x-2" data-testid={`note-tags-${note.id}`}>
                        {note.aiTags.slice(0, 3).map((tag, index) => {
                          const tagColors = [
                            { backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' },
                            { backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' },
                            { backgroundColor: 'rgba(115, 138, 110, 0.1)', color: '#738A6E' }
                          ];
                          return (
                            <span 
                              key={tag}
                              className="inline-flex items-center px-2 py-1 text-xs rounded"
                              style={tagColors[index % tagColors.length]}
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
                      className="h-auto p-1"
                      style={{ color: '#88A5BC' }}
                      data-testid={`edit-note-${note.id}`}
                    >
                      <i className="fas fa-edit"></i>
                    </Button>
                    <span className="text-xs" style={{ color: '#738A6E' }} data-testid={`note-ai-status-${note.id}`}>
                      AI Tagged
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="text-center pt-4">
              <Button variant="ghost" style={{ color: '#88A5BC' }} data-testid="view-all-notes">
                View All Notes →
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}