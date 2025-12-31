import StatsOverview from "@/components/dashboard/stats-overview";
import AppointmentsPanel from "@/components/dashboard/appointments-panel";
import AIInsightsPanel from "@/components/dashboard/ai-insights-panel";
import RecentNotes from "@/components/dashboard/recent-notes";
import ClinicalWorkflows from "@/components/dashboard/clinical-workflows";
import TherapeuticJourney from "@/components/dashboard/therapeutic-journey";
import { TherapeuticDashboardWidget } from "@/components/therapeutic";

export default function Dashboard() {
  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Stats Overview */}
      <StatsOverview />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <AppointmentsPanel />
        <AIInsightsPanel />
        <TherapeuticDashboardWidget />
      </div>

      {/* Secondary Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentNotes />
        <ClinicalWorkflows />
      </div>

      {/* Therapeutic Journey Timeline */}
      <TherapeuticJourney />
    </div>
  );
}
