import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const workflowTasks = [
  {
    title: "Case Conceptualization",
    description: "5 P's Framework Analysis",
    icon: "fas fa-tasks",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    status: "Complete",
    statusColor: "bg-green-100 text-green-800"
  },
  {
    title: "Treatment Planning", 
    description: "Measurable objectives setup",
    icon: "fas fa-route",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    status: "In Progress",
    statusColor: "bg-yellow-100 text-yellow-800"
  },
  {
    title: "Risk Assessment",
    description: "Safety plan review due", 
    icon: "fas fa-shield-alt",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    status: "Urgent",
    statusColor: "bg-red-100 text-red-800"
  },
  {
    title: "Alliance Monitoring",
    description: "Therapeutic relationship scoring",
    icon: "fas fa-handshake", 
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    status: "Scheduled",
    statusColor: "bg-blue-100 text-blue-800"
  }
];

export default function ClinicalWorkflows() {
  return (
    <Card data-testid="clinical-workflows">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900" data-testid="workflows-title">
            Clinical Workflows
          </h3>
          <Button variant="outline" size="sm" data-testid="configure-workflows">
            <i className="fas fa-cog mr-2"></i>
            Configure
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File Upload Section */}
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg transition-colors hover:border-primary/50">
          <div className="text-center">
            <i className="fas fa-file-pdf text-4xl text-gray-400 mb-3"></i>
            <p className="text-sm text-gray-600 mb-2">Upload Clinical Documents</p>
            <Button 
              size="sm"
              data-testid="upload-documents-button"
            >
              <i className="fas fa-upload mr-2"></i>
              Choose Files
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              PDF files will be processed with AI text extraction
            </p>
          </div>
        </div>

        {/* Workflow Tasks */}
        {workflowTasks.map((task) => (
          <div 
            key={task.title}
            className="p-4 bg-gray-50 rounded-lg transition-colors hover:bg-gray-100"
            data-testid={`workflow-${task.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${task.iconBg} rounded-lg flex items-center justify-center`}>
                  <i className={`${task.icon} ${task.iconColor} text-sm`}></i>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900" data-testid={`task-title-${task.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {task.title}
                  </h4>
                  <p className="text-sm text-gray-500" data-testid={`task-description-${task.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {task.description}
                  </p>
                </div>
              </div>
              <span 
                className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${task.statusColor}`}
                data-testid={`task-status-${task.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {task.status}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
