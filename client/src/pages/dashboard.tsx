import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import StatsOverview from "@/components/dashboard/stats-overview";
import AppointmentsPanel from "@/components/dashboard/appointments-panel";
import AIInsightsPanel from "@/components/dashboard/ai-insights-panel";
import RecentNotes from "@/components/dashboard/recent-notes";
import ClinicalWorkflows from "@/components/dashboard/clinical-workflows";
import TherapeuticJourney from "@/components/dashboard/therapeutic-journey";
import { TherapeuticDashboardWidget } from "@/components/therapeutic";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-50" data-testid="dashboard-page">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
      </main>
    </div>
  );
}
