export interface DashboardStats {
  activeClients: number;
  weeklySchedule: number;
  totalNotes: number;
  aiInsights: number;
}

export interface SessionWithClient {
  id: string;
  clientId: string;
  therapistId: string;
  scheduledAt: Date;
  duration: number;
  sessionType: string;
  status: string;
  notes?: string;
  client?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface ProgressNoteWithClient {
  id: string;
  clientId: string;
  sessionId?: string;
  therapistId: string;
  content: string;
  sessionDate: Date;
  tags: string[];
  aiTags: string[];
  riskLevel?: string;
  progressRating?: number;
  createdAt: Date;
  client?: {
    id: string;
    name: string;
  };
}

export interface AiInsight {
  id: string;
  clientId?: string;
  therapistId: string;
  type: "pattern_recognition" | "progress_milestone" | "risk_alert" | "resource_match";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface SessionPreparation {
  keyTopics: string[];
  therapeuticQuestions: string[];
  riskAssessment: string;
  interventionSuggestions: string[];
  goals: string[];
}

export interface TherapeuticJourneyMilestone {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: "assessment" | "milestone" | "adjustment" | "goal_met";
  allianceScore?: number;
  goalsCount?: number;
  metadata?: Record<string, any>;
}
