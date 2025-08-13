import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Workflow tasks will be populated from API data
const workflowTasks: any[] = [];

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

        {/* Quick AI Workflow */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                <i className="fas fa-brain text-blue-600 dark:text-blue-400 text-sm"></i>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">AI-Assisted Progress Notes</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create notes with real-time AI suggestions
                </p>
              </div>
            </div>
            <Button 
              size="sm"
              onClick={() => window.location.href = '/interactive-notes'}
              data-testid="ai-workflow-button"
            >
              <i className="fas fa-wand-magic-sparkles mr-2"></i>
              Start
            </Button>
          </div>
        </div>

        {/* Workflow Tasks */}
        {workflowTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-500" data-testid="no-workflows">
            <i className="fas fa-tasks text-3xl mb-3 opacity-50"></i>
            <p className="text-sm">No additional workflows configured</p>
            <Button variant="outline" size="sm" className="mt-3" data-testid="setup-workflows">
              <i className="fas fa-plus mr-2"></i>
              Setup Workflows
            </Button>
          </div>
        ) : (
          workflowTasks.map((task) => (
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
          ))
        )}
      </CardContent>
    </Card>
  );
}
