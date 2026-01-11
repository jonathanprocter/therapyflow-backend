import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { InteractiveProgressNoteEditor } from '@/components/progress-notes/InteractiveProgressNoteEditor';
import { ArrowLeft, Brain, FileText, Plus } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export default function InteractiveNoteCreator() {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [, setLocation] = useLocation();

  // Get clients for selection
  const { data: clients } = useQuery({
    queryKey: ['/api/clients'],
    select: (data: any[]) => data?.filter(client => client.status === 'active') || []
  });

  // Get sessions for selected client
  const { data: sessions } = useQuery({
    queryKey: ['/api/sessions', selectedClientId],
    enabled: !!selectedClientId,
    select: (data: any[]) => data?.filter(session => 
      session.clientId === selectedClientId && 
      session.status === 'scheduled'
    ) || []
  });

  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const selectedSession = sessions?.find(s => s.id === selectedSessionId);

  const handleStartEditor = () => {
    if (!selectedClientId) return;
    setShowEditor(true);
  };

  const handleNoteSaved = (noteId: string) => {
    setShowEditor(false);
    setLocation('/progress-notes');
  };

  const handleCancel = () => {
    setShowEditor(false);
  };

  if (showEditor) {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleCancel}
            className="mb-4"
            data-testid="button-back-to-setup"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Setup
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-6 w-6" style={{ color: '#88A5BC' }} />
            <h1 className="text-2xl font-bold" style={{ color: '#344C3D' }}>AI-Assisted Progress Note</h1>
          </div>
          <p style={{ color: '#738A6E' }}>
            Creating note for <strong>{selectedClient?.name}</strong>
            {selectedSession && (
              <span> - Session on {new Date(selectedSession.scheduledAt).toLocaleDateString()}</span>
            )}
          </p>
        </div>

        <InteractiveProgressNoteEditor
          clientId={selectedClientId}
          sessionId={selectedSessionId}
          onSave={handleNoteSaved}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-6 w-6" style={{ color: '#88A5BC' }} />
          <h1 className="text-3xl font-bold" style={{ color: '#344C3D' }}>Interactive Progress Note Creator</h1>
        </div>
        <p style={{ color: '#738A6E' }}>
          Create comprehensive progress notes with real-time AI suggestions and clinical insights
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Brain className="h-8 w-8" style={{ color: '#88A5BC' }} />
              <h3 className="font-semibold" style={{ color: '#344C3D' }}>Real-Time AI</h3>
            </div>
            <p className="text-sm" style={{ color: '#738A6E' }}>
              Get intelligent suggestions as you type, with clinical insights based on your content
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-8 w-8" style={{ color: '#8EA58C' }} />
              <h3 className="font-semibold" style={{ color: '#344C3D' }}>Structured Format</h3>
            </div>
            <p className="text-sm" style={{ color: '#738A6E' }}>
              Follows professional SOAP note structure with guided sections
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Plus className="h-8 w-8" style={{ color: '#344C3D' }} />
              <h3 className="font-semibold" style={{ color: '#344C3D' }}>Smart Interventions</h3>
            </div>
            <p className="text-sm" style={{ color: '#738A6E' }}>
              AI suggests evidence-based interventions and next steps
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Setup Form */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle style={{ color: '#344C3D' }}>Create New Progress Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: '#344C3D' }}>Select Client *</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger 
                className="bg-white border focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                data-testid="select-client"
              >
                <SelectValue placeholder="Choose a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      <span>{client.name}</span>
                      {client.tags?.length > 0 && (
                        <div className="flex gap-1">
                          {client.tags.slice(0, 2).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Session Selection (Optional) */}
          {selectedClientId && sessions && sessions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#344C3D' }}>Link to Session (Optional)</label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger 
                  className="bg-white border focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                  data-testid="select-session"
                >
                  <SelectValue placeholder="Choose a session..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific session</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {new Date(session.scheduledAt).toLocaleDateString()} - {session.type || 'Session'}
                      {session.notes && (
                        <span className="text-sepia/80 ml-2">({session.notes.substring(0, 30)}...)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected Client Info */}
          {selectedClient && (
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(242, 243, 241, 0.5)', borderColor: 'rgba(115, 138, 110, 0.2)' }}>
              <h4 className="font-medium mb-2" style={{ color: '#344C3D' }}>Selected Client</h4>
              <div className="space-y-1 text-sm">
                <p style={{ color: '#738A6E' }}><strong>Name:</strong> {selectedClient.name}</p>
                {selectedClient.email && <p style={{ color: '#738A6E' }}><strong>Email:</strong> {selectedClient.email}</p>}
                {selectedClient.tags?.length > 0 && (
                  <div>
                    <strong style={{ color: '#738A6E' }}>Tags:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedClient.tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs" style={{ backgroundColor: '#8EA58C', color: '#FFFFFF' }}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Start Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleStartEditor}
              disabled={!selectedClientId}
              size="lg"
              style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C', color: '#FFFFFF' }}
              className="hover:bg-opacity-90"
              data-testid="button-start-editor"
            >
              <Brain className="h-4 w-4 mr-2" />
              Start AI-Assisted Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="mt-8 text-center">
        <p className="text-sm mb-4" style={{ color: '#738A6E' }}>
          Or continue with traditional note creation
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/progress-notes">
            <Button variant="outline" data-testid="link-traditional-notes">
              <FileText className="h-4 w-4 mr-2" />
              View All Progress Notes
            </Button>
          </Link>
          <Link href="/clients">
            <Button variant="outline" data-testid="link-manage-clients">
              Manage Clients
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}