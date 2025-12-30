import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Brain,
  X,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Loader2,
  Settings,
  Play,
  Check
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ContextualSuggestion {
  id: string;
  type: 'tip' | 'action' | 'insight' | 'warning';
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

interface PageContext {
  pageName: string;
  icon: React.ElementType;
  suggestions: ContextualSuggestion[];
}

// Define contextual suggestions for each page
const getPageContext = (pathname: string): PageContext => {
  if (pathname === '/' || pathname === '/dashboard') {
    return {
      pageName: 'Dashboard',
      icon: TrendingUp,
      suggestions: [
        {
          id: 'dash-1',
          type: 'tip',
          title: 'Quick Session Prep',
          description: 'Click on any upcoming session to generate AI-powered preparation notes.',
        },
        {
          id: 'dash-2',
          type: 'action',
          title: 'Review AI Insights',
          description: 'You have new AI-generated insights about client progress patterns.',
          action: { label: 'View Insights', href: '/ai-dashboard' }
        },
        {
          id: 'dash-3',
          type: 'tip',
          title: 'Upload Transcripts',
          description: 'Drag and drop session transcripts for automatic progress note generation.',
        },
      ]
    };
  }

  if (pathname === '/calendar') {
    return {
      pageName: 'Calendar',
      icon: Calendar,
      suggestions: [
        {
          id: 'cal-1',
          type: 'tip',
          title: 'Session Preparation',
          description: 'Click the "Prep" button on any session to get AI-powered preparation materials.',
        },
        {
          id: 'cal-2',
          type: 'action',
          title: 'Sync with Google',
          description: 'Keep your calendar synced with SimplePractice for automatic updates.',
          action: { label: 'Sync Now', href: '/calendar-sync' }
        },
        {
          id: 'cal-3',
          type: 'insight',
          title: 'Weekly Overview',
          description: 'View all scheduled sessions and their status at a glance.',
        },
      ]
    };
  }

  if (pathname === '/clients' || pathname.startsWith('/clients/')) {
    return {
      pageName: 'Clients',
      icon: Users,
      suggestions: [
        {
          id: 'cli-1',
          type: 'tip',
          title: 'Client Journey',
          description: 'Click on a client to see their therapeutic journey timeline and progress.',
        },
        {
          id: 'cli-2',
          type: 'insight',
          title: 'Pattern Analysis',
          description: 'AI continuously analyzes session notes to identify progress patterns.',
        },
        {
          id: 'cli-3',
          type: 'action',
          title: 'Add New Client',
          description: 'Quickly add a new client to start tracking their therapeutic journey.',
        },
      ]
    };
  }

  if (pathname === '/progress-notes' || pathname.startsWith('/progress-notes/')) {
    return {
      pageName: 'Progress Notes',
      icon: FileText,
      suggestions: [
        {
          id: 'note-1',
          type: 'tip',
          title: 'AI-Assisted Writing',
          description: 'Use the interactive note creator for AI-powered SOAP note generation.',
          action: { label: 'Create Note', href: '/interactive-notes' }
        },
        {
          id: 'note-2',
          type: 'tip',
          title: 'Bulk Import',
          description: 'Upload multiple session transcripts at once for batch processing.',
          action: { label: 'Bulk Upload', href: '/bulk-transcripts' }
        },
        {
          id: 'note-3',
          type: 'insight',
          title: 'Clinical Tags',
          description: 'Notes are automatically tagged with clinical themes and risk indicators.',
        },
      ]
    };
  }

  if (pathname === '/ai-dashboard') {
    return {
      pageName: 'AI Dashboard',
      icon: Brain,
      suggestions: [
        {
          id: 'ai-1',
          type: 'insight',
          title: 'Semantic Search',
          description: 'Search across all client notes using natural language queries.',
        },
        {
          id: 'ai-2',
          type: 'tip',
          title: 'Progress Patterns',
          description: 'View AI-detected patterns in client therapeutic progress.',
        },
        {
          id: 'ai-3',
          type: 'action',
          title: 'Generate Insights',
          description: 'Request new AI analysis for specific clients or time periods.',
        },
      ]
    };
  }

  if (pathname === '/treatment-plans') {
    return {
      pageName: 'Treatment Plans',
      icon: FileText,
      suggestions: [
        {
          id: 'tx-1',
          type: 'tip',
          title: 'Goal Tracking',
          description: 'Track progress toward treatment goals with AI-powered insights.',
        },
        {
          id: 'tx-2',
          type: 'action',
          title: 'Create New Plan',
          description: 'Start a new treatment plan with AI-suggested goals and interventions.',
        },
      ]
    };
  }

  // Default context
  return {
    pageName: 'TherapyFlow',
    icon: Brain,
    suggestions: [
      {
        id: 'default-1',
        type: 'tip',
        title: 'AI Assistant',
        description: 'I can help with session prep, note generation, and client insights.',
      },
      {
        id: 'default-2',
        type: 'action',
        title: 'Go to Dashboard',
        description: 'View your practice overview and upcoming sessions.',
        action: { label: 'Dashboard', href: '/' }
      },
    ]
  };
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  hasAudio?: boolean;
}

interface VoiceOption {
  id: string;
  name: string;
  description?: string;
  premium?: boolean;
}

interface AIContextualHelperProps {
  defaultExpanded?: boolean;
}

export function AIContextualHelper({ defaultExpanded = false }: AIContextualHelperProps) {
  const [location] = useLocation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Get AI health status
  const { data: aiHealth } = useQuery<{
    openai: boolean;
    anthropic: boolean;
  }>({
    queryKey: ['/api/ai/health'],
    refetchInterval: 60000,
  });

  // Get voice service status
  const { data: voiceHealth } = useQuery<{ available: boolean }>({
    queryKey: ['/api/voice/health'],
    refetchInterval: 60000,
  });

  // Get available voices
  const { data: voicesData } = useQuery<{ voices: VoiceOption[]; currentVoice: string }>({
    queryKey: ['/api/voice/recommended'],
  });

  // Initialize selected voice from server
  useEffect(() => {
    if (voicesData?.currentVoice && !selectedVoice) {
      setSelectedVoice(voicesData.currentVoice);
    }
  }, [voicesData?.currentVoice]);

  // Set voice mutation
  const setVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const response = await fetch('/api/voice/set-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId })
      });
      if (!response.ok) throw new Error('Failed to set voice');
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedVoice(data.currentVoice);
    }
  });

  // Preview voice mutation
  const previewVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      setPreviewingVoice(voiceId);
      const response = await fetch('/api/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId })
      });
      if (!response.ok) throw new Error('Failed to preview voice');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.audio) {
        playAudioResponse(data.audio);
      }
      setPreviewingVoice(null);
    },
    onError: () => {
      setPreviewingVoice(null);
    }
  });

  // Voice assistant mutation
  const voiceAssistantMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch('/api/voice/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          voiceId: selectedVoice || undefined,
          context: {
            messages: chatMessages.slice(-5),
            pageContext: location
          }
        })
      });
      if (!response.ok) throw new Error('Voice assistant request failed');
      return response.json();
    },
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.text,
        hasAudio: data.hasAudio
      }]);

      // Play audio response if available and voice is enabled
      if (data.audio && voiceEnabled) {
        playAudioResponse(data.audio);
      }
    }
  });

  // Play audio from base64
  const playAudioResponse = useCallback((base64Audio: string) => {
    try {
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      audioRef.current = audio;
      setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setChatInput(transcript);
          // Auto-send voice input
          handleSendMessage(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopSpeaking();
    };
  }, []);

  // Toggle voice input
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.abort();
      setIsListening(false);
    } else {
      stopSpeaking();
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, stopSpeaking]);

  // Send message
  const handleSendMessage = useCallback((text?: string) => {
    const message = text || chatInput.trim();
    if (!message) return;

    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setChatInput('');
    voiceAssistantMutation.mutate(message);
  }, [chatInput, voiceAssistantMutation]);

  const context = getPageContext(location);
  const visibleSuggestions = context.suggestions.filter(s => !dismissedSuggestions.has(s.id));

  const getTypeIcon = (type: ContextualSuggestion['type']) => {
    switch (type) {
      case 'tip': return <Lightbulb className="h-4 w-4 text-sage" />;
      case 'action': return <Sparkles className="h-4 w-4 text-french-blue" />;
      case 'insight': return <TrendingUp className="h-4 w-4 text-moss" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getTypeBadge = (type: ContextualSuggestion['type']) => {
    const styles: Record<string, string> = {
      tip: 'bg-sage/10 text-sage',
      action: 'bg-french-blue/10 text-french-blue',
      insight: 'bg-moss/10 text-moss',
      warning: 'bg-amber-100 text-amber-700',
    };
    return styles[type] || styles.tip;
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 w-14 rounded-full shadow-lg bg-evergreen hover:bg-evergreen/90"
          data-testid="ai-helper-expand"
        >
          <Brain className="h-6 w-6 text-white" />
          {visibleSuggestions.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-sage text-white text-xs flex items-center justify-center">
              {visibleSuggestions.length}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80" data-testid="ai-contextual-helper">
      <Card className="shadow-xl border-evergreen/20">
        <CardHeader className="pb-2 bg-gradient-to-r from-evergreen to-moss rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-white" />
              <CardTitle className="text-sm font-medium text-white">
                AI Assistant
              </CardTitle>
              {(aiHealth?.openai || aiHealth?.anthropic) && (
                <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                  Online
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <context.icon className="h-4 w-4 text-white/80" />
            <span className="text-xs text-white/80">{context.pageName}</span>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-3 pb-2">
            {/* Voice Chat Mode */}
            {showChat ? (
              <div className="space-y-3">
                {/* Chat Messages */}
                <ScrollArea className="h-48 pr-2">
                  <div className="space-y-2">
                    {chatMessages.length === 0 ? (
                      <p className="text-sm text-moss text-center py-4">
                        Ask me anything about your clients or practice...
                      </p>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg text-sm ${
                            msg.role === 'user'
                              ? 'bg-french-blue/10 text-evergreen ml-4'
                              : 'bg-ivory border border-sage/10 mr-4'
                          }`}
                        >
                          {msg.content}
                          {msg.hasAudio && msg.role === 'assistant' && (
                            <Badge className="ml-2 text-xs bg-sage/10 text-sage">
                              <Volume2 className="h-2 w-2 mr-1" />
                              Audio
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                    {voiceAssistantMutation.isPending && (
                      <div className="flex items-center gap-2 p-2 text-moss text-sm">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Voice/Text Input */}
                <div className="flex items-center gap-2 pt-2 border-t border-sage/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : ''}`}
                    onClick={toggleListening}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type or speak..."
                    className="flex-1 h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={voiceAssistantMutation.isPending}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleSendMessage()}
                    disabled={!chatInput.trim() || voiceAssistantMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* Voice Controls */}
                <div className="flex items-center justify-between text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-moss"
                    onClick={() => setShowChat(false)}
                  >
                    Back to tips
                  </Button>
                  <div className="flex items-center gap-2">
                    {isSpeaking && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-red-500"
                        onClick={stopSpeaking}
                      >
                        <VolumeX className="h-3 w-3 mr-1" />
                        Stop
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 text-xs ${voiceEnabled ? 'text-sage' : 'text-moss/50'}`}
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      title={voiceEnabled ? 'Disable voice responses' : 'Enable voice responses'}
                    >
                      {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-moss"
                      onClick={() => setShowSettings(!showSettings)}
                      title="Voice settings"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Voice Settings Panel */}
                {showSettings && (
                  <div className="mt-3 pt-3 border-t border-sage/10 space-y-3">
                    <div className="text-xs font-medium text-evergreen">Voice Selection</div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {voicesData?.voices?.map((voice) => (
                        <div
                          key={voice.id}
                          className={`flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer ${
                            selectedVoice === voice.id
                              ? 'border-sage bg-sage/10'
                              : 'border-sage/10 hover:border-sage/30'
                          }`}
                          onClick={() => setVoiceMutation.mutate(voice.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-evergreen">{voice.name}</span>
                              {voice.premium && (
                                <Badge className="text-[10px] bg-french-blue/10 text-french-blue px-1">Premium</Badge>
                              )}
                              {selectedVoice === voice.id && (
                                <Check className="h-3 w-3 text-sage ml-1" />
                              )}
                            </div>
                            {voice.description && (
                              <p className="text-[10px] text-moss truncate">{voice.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              previewVoiceMutation.mutate(voice.id);
                            }}
                            disabled={previewingVoice === voice.id}
                          >
                            {previewingVoice === voice.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-6 text-xs text-moss"
                      onClick={() => setShowSettings(false)}
                    >
                      Done
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Suggestions Mode */}
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {visibleSuggestions.length === 0 ? (
                      <p className="text-sm text-moss text-center py-4">
                        No suggestions right now. Keep up the great work!
                      </p>
                    ) : (
                      visibleSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="p-3 rounded-lg bg-ivory/50 border border-sage/10 hover:border-sage/30 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            {getTypeIcon(suggestion.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-evergreen">
                                  {suggestion.title}
                                </span>
                                <Badge className={`text-xs ${getTypeBadge(suggestion.type)}`}>
                                  {suggestion.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-moss leading-relaxed">
                                {suggestion.description}
                              </p>
                              {suggestion.action && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 mt-1 text-xs text-french-blue"
                                  onClick={() => {
                                    if (suggestion.action?.href) {
                                      window.location.href = suggestion.action.href;
                                    }
                                    suggestion.action?.onClick?.();
                                  }}
                                >
                                  {suggestion.action.label} →
                                </Button>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-moss/50 hover:text-moss"
                              onClick={() => setDismissedSuggestions(prev => new Set([...prev, suggestion.id]))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Quick Actions */}
                <div className="mt-3 pt-3 border-t border-sage/10">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => window.location.href = '/interactive-notes'}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      New Note
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => setShowChat(true)}
                    >
                      <Mic className="h-3 w-3 mr-1" />
                      Ask AI
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}

        {!isExpanded && (
          <CardContent className="py-2">
            <p className="text-xs text-moss">
              {visibleSuggestions.length} suggestions available
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default AIContextualHelper;
