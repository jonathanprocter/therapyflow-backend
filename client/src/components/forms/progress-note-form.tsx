import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { SessionPreparation } from "@/types/clinical";

const progressNoteSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  sessionId: z.string().optional(),
  content: z.string().min(50, "Progress note must be at least 50 characters"),
  sessionDate: z.string().min(1, "Session date is required"),
  tags: z.array(z.string()).default([]),
  riskLevel: z.enum(["low", "moderate", "high", "critical"]).default("low"),
  progressRating: z.number().min(1).max(10).optional(),
});

type ProgressNoteFormData = z.infer<typeof progressNoteSchema>;

interface ProgressNoteFormProps {
  onSuccess?: () => void;
  initialData?: Partial<ProgressNoteFormData>;
}

export default function ProgressNoteForm({ onSuccess, initialData }: ProgressNoteFormProps) {
  const [customTag, setCustomTag] = useState("");
  const [sessionPrep, setSessionPrep] = useState<SessionPreparation | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProgressNoteFormData>({
    resolver: zodResolver(progressNoteSchema),
    defaultValues: {
      clientId: "",
      sessionId: "",
      content: "",
      sessionDate: new Date().toISOString().split('T')[0],
      tags: [],
      riskLevel: "low",
      progressRating: 5,
      ...initialData,
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: sessions } = useQuery({
    queryKey: ["/api/sessions", { clientId: form.watch("clientId") }],
    enabled: !!form.watch("clientId"),
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: ProgressNoteFormData) => {
      const response = await apiRequest("/api/progress-notes", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress-notes"] });
      toast({
        title: "Success",
        description: "Progress note created successfully",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create progress note",
        variant: "destructive",
      });
    },
  });

  const sessionPrepMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest(`/api/ai/session-prep/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSessionPrep(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to generate session preparation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProgressNoteFormData) => {
    createNoteMutation.mutate(data);
  };

  const addCustomTag = () => {
    if (customTag.trim()) {
      const currentTags = form.getValues("tags");
      if (!currentTags.includes(customTag.trim())) {
        form.setValue("tags", [...currentTags, customTag.trim()]);
        setCustomTag("");
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags");
    form.setValue("tags", currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleSessionChange = (sessionId: string) => {
    form.setValue("sessionId", sessionId);
    if (sessionId) {
      sessionPrepMutation.mutate(sessionId);
    }
  };

  return (
    <div className="space-y-6" data-testid="progress-note-form">
      {/* Session Preparation Panel */}
      {sessionPrep && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <i className="fas fa-robot text-primary"></i>
              <span>AI Session Preparation</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionPrep.keyTopics.length > 0 && (
              <div>
                <h4 className="font-medium text-evergreen mb-2">Key Topics to Address</h4>
                <div className="flex flex-wrap gap-2">
                  {sessionPrep.keyTopics.map((topic, index) => (
                    <Badge key={index} variant="outline">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {sessionPrep.therapeuticQuestions.length > 0 && (
              <div>
                <h4 className="font-medium text-evergreen mb-2">Therapeutic Questions</h4>
                <ul className="space-y-1 text-sm text-moss">
                  {sessionPrep.therapeuticQuestions.map((question, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-primary">•</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sessionPrep.riskAssessment && (
              <div>
                <h4 className="font-medium text-evergreen mb-2">Risk Assessment</h4>
                <p className="text-sm text-moss">{sessionPrep.riskAssessment}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Selection */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="client-select">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(clients) && clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Session Selection */}
            <FormField
              control={form.control}
              name="sessionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Session</FormLabel>
                  <Select onValueChange={handleSessionChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="session-select">
                        <SelectValue placeholder="Select a session (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(sessions) && sessions.map((session: any) => (
                        <SelectItem key={session.id} value={session.id}>
                          {new Date(session.scheduledAt).toLocaleDateString()} - {session.sessionType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Session Date */}
          <FormField
            control={form.control}
            name="sessionDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Date *</FormLabel>
                <FormControl>
                  <input
                    type="date"
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="session-date-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Progress Note Content */}
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Progress Note Content *</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={8}
                    placeholder="Document the session details, client progress, interventions used, and observations..."
                    className="resize-none"
                    data-testid="content-textarea"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk Level */}
            <FormField
              control={form.control}
              name="riskLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="risk-level-select">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="moderate">Moderate Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="critical">Critical Risk</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Progress Rating */}
            <FormField
              control={form.control}
              name="progressRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Progress Rating (1-10)</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={field.value ? [field.value] : [5]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                        data-testid="progress-rating-slider"
                      />
                      <div className="text-center text-sm text-moss">
                        Current rating: {field.value || 5}/10
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Tags Section */}
          <div className="space-y-4">
            <FormLabel>Tags</FormLabel>
            
            {/* Custom Tag Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add a custom tag..."
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag())}
                data-testid="custom-tag-input"
              />
              <Button type="button" onClick={addCustomTag} variant="outline" data-testid="add-tag-button">
                Add Tag
              </Button>
            </div>

            {/* Display Current Tags */}
            {form.watch("tags").length > 0 && (
              <div className="flex flex-wrap gap-2" data-testid="current-tags">
                {form.watch("tags").map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-sage/20">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onSuccess?.()}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createNoteMutation.isPending}
              data-testid="save-button"
            >
              {createNoteMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  Save Progress Note
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
