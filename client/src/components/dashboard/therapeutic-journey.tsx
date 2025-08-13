import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const journeyMilestones = [
  {
    title: "Initial Assessment Complete",
    description: "Michael Chen - Completed comprehensive intake and established treatment goals focusing on anxiety management and work-life balance.",
    date: "Dec 1, 2024",
    type: "assessment",
    allianceScore: 8.2,
    goalsSet: 3,
    color: "primary"
  },
  {
    title: "Mid-Treatment Review", 
    description: "Significant progress noted in anxiety management. Client reporting 40% reduction in panic episodes and improved sleep quality.",
    date: "Dec 8, 2024",
    type: "milestone",
    allianceScore: 9.1,
    goalsMet: 2,
    goalsTotal: 3,
    color: "secondary"
  },
  {
    title: "Treatment Adjustment",
    description: "Incorporated EMDR techniques for trauma processing. Updated treatment plan to address underlying childhood experiences.",
    date: "Dec 14, 2024", 
    type: "adjustment",
    newModality: "EMDR",
    color: "accent"
  }
];

export default function TherapeuticJourney() {
  return (
    <Card data-testid="therapeutic-journey">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900" data-testid="journey-title">
            Therapeutic Journey Overview
          </h3>
          <div className="flex items-center space-x-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-40" data-testid="client-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="michael-chen">Michael Chen</SelectItem>
                <SelectItem value="emma-rodriguez">Emma Rodriguez</SelectItem>
                <SelectItem value="david-kim">David Kim</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" data-testid="generate-report">
              Generate Report
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="relative" data-testid="timeline-container">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          {journeyMilestones.map((milestone, index) => (
            <div 
              key={index}
              className="relative flex items-start space-x-6 pb-8 last:pb-0"
              data-testid={`milestone-${index}`}
            >
              <div className={`relative z-10 w-4 h-4 bg-${milestone.color} rounded-full border-4 border-white shadow-md`}></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900" data-testid={`milestone-title-${index}`}>
                    {milestone.title}
                  </h4>
                  <span className="text-xs text-gray-500" data-testid={`milestone-date-${index}`}>
                    {milestone.date}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2" data-testid={`milestone-description-${index}`}>
                  {milestone.description}
                </p>
                <div className="flex items-center space-x-2" data-testid={`milestone-metrics-${index}`}>
                  {milestone.allianceScore && (
                    <span className="inline-flex items-center px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                      Alliance Score: {milestone.allianceScore}/10
                    </span>
                  )}
                  {milestone.goalsSet && (
                    <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Goals Set: {milestone.goalsSet}
                    </span>
                  )}
                  {milestone.goalsMet && milestone.goalsTotal && (
                    <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Goals Met: {milestone.goalsMet}/{milestone.goalsTotal}
                    </span>
                  )}
                  {milestone.newModality && (
                    <span className="inline-flex items-center px-2 py-1 text-xs bg-accent/10 text-accent rounded">
                      New Modality: {milestone.newModality}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
