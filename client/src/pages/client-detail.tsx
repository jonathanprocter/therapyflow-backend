import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, FileText, MessageSquare, User } from "lucide-react";

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/sessions", { clientId }],
    enabled: !!clientId,
  });

  const { data: progressNotes, isLoading: notesLoading } = useQuery({
    queryKey: ["/api/progress-notes", { clientId }],
    enabled: !!clientId,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/documents", { clientId }],
    enabled: !!clientId,
  });

  if (clientLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
              <p className="text-gray-500 mb-4">The requested client could not be found.</p>
              <Link href="/clients">
                <Button>Back to Clients</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const clientSessions = Array.isArray(sessions) ? sessions.filter((session: any) => session.clientId === clientId) : [];
  const clientNotes = Array.isArray(progressNotes) ? progressNotes.filter((note: any) => note.clientId === clientId) : [];
  const clientDocuments = Array.isArray(documents) ? documents.filter((doc: any) => doc.clientId === clientId) : [];

  return (
    <div className="flex h-screen bg-gray-50" data-testid="client-detail-page">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/clients">
                <Button variant="ghost" size="sm" data-testid="back-to-clients">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Clients
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900" data-testid="client-name">
                  {client.name}
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                    {client.status}
                  </Badge>
                  {client.tags && client.tags.length > 0 && (
                    <div className="flex gap-2">
                      {client.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" data-testid="edit-client">
                  Edit Client
                </Button>
                <Button data-testid="schedule-session">
                  Schedule Session
                </Button>
              </div>
            </div>
          </div>

          {/* Client Info Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {client.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{client.email}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-gray-900">{client.phone}</p>
                  </div>
                )}
                {client.dateOfBirth && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                    <p className="text-gray-900">{new Date(client.dateOfBirth).toLocaleDateString()}</p>
                  </div>
                )}
                {client.emergencyContact && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                    <p className="text-gray-900">{client.emergencyContact}</p>
                  </div>
                )}
                {client.insurance && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Insurance</label>
                    <p className="text-gray-900">{client.insurance}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Client Since</label>
                  <p className="text-gray-900">{new Date(client.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for different sections */}
          <Tabs defaultValue="sessions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sessions" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sessions ({clientSessions.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Progress Notes ({clientNotes.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents ({clientDocuments.length})
              </TabsTrigger>
            </TabsList>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Session History</CardTitle>
                </CardHeader>
                <CardContent>
                  {sessionsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-20 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : clientSessions.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No sessions recorded for this client</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientSessions.map((session: any) => (
                        <div key={session.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {session.sessionType.charAt(0).toUpperCase() + session.sessionType.slice(1)} Session
                              </h4>
                              <p className="text-sm text-gray-500">
                                {new Date(session.scheduledAt).toLocaleDateString()} at {new Date(session.scheduledAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                                {session.status}
                              </Badge>
                              <span className="text-sm text-gray-500">{session.duration} min</span>
                            </div>
                          </div>
                          {session.notes && (
                            <p className="text-sm text-gray-600 mt-2">{session.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Progress Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {notesLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-32 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : clientNotes.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No progress notes for this client</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientNotes.map((note: any) => (
                        <div key={note.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">
                              {new Date(note.sessionDate).toLocaleDateString()}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="prose max-w-none">
                            <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                          </div>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex gap-1 mt-3">
                              {note.tags.map((tag: string, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Client Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  {documentsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-16 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : clientDocuments.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No documents uploaded for this client</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientDocuments.map((document: any) => (
                        <div key={document.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{document.filename}</h4>
                              <p className="text-sm text-gray-500">
                                Uploaded on {new Date(document.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{document.fileType}</Badge>
                              <Button variant="outline" size="sm">
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}