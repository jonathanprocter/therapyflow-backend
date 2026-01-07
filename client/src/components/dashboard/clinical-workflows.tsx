import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Workflow tasks will be populated from API data
const workflowTasks: any[] = [];

export default function ClinicalWorkflows() {
  return (
    <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid="clinical-workflows">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }} data-testid="workflows-title">
            Clinical Workflows
          </h3>
          <Button variant="outline" size="sm" style={{ borderColor: '#8EA58C', color: '#8EA58C' }} data-testid="configure-workflows">
            <i className="fas fa-cog mr-2"></i>
            Configure
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File Upload Section */}
        <div 
          className="p-4 border-2 border-dashed rounded-lg transition-colors hover:border-accent-blue"
          style={{ 
            borderColor: 'rgba(115, 138, 110, 0.3)'
          }}
        >
          <div className="text-center">
            <i className="fas fa-file-pdf text-4xl mb-3" style={{ color: '#88A5BC' }}></i>
            <p className="text-sm mb-2" style={{ color: '#738A6E' }}>Upload Clinical Documents</p>
            <Button 
              size="sm"
              className="hover:bg-opacity-90"
              style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
              data-testid="upload-documents-button"
            >
              <i className="fas fa-upload mr-2"></i>
              Choose Files
            </Button>
            <p className="text-xs mt-2" style={{ color: '#738A6E' }}>
              PDF files will be processed with AI text extraction
            </p>
          </div>
        </div>

        {/* Quick AI Workflow */}
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(to right, rgba(136, 165, 188, 0.05), rgba(142, 165, 140, 0.05))',
            borderColor: 'rgba(136, 165, 188, 0.2)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(136, 165, 188, 0.1)' }}
              >
                <i className="fas fa-brain text-sm" style={{ color: '#88A5BC' }}></i>
              </div>
              <div>
                <h4 className="font-medium" style={{ color: '#344C3D' }}>AI-Assisted Progress Notes</h4>
                <p className="text-sm" style={{ color: '#738A6E' }}>
                  Create notes with real-time AI suggestions
                </p>
              </div>
            </div>
            <Button 
              size="sm"
              className="hover:bg-opacity-90"
              style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
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
          <div className="text-center py-6" style={{ color: '#738A6E' }} data-testid="no-workflows">
            <i className="fas fa-tasks text-3xl mb-3 opacity-50" style={{ color: '#88A5BC' }}></i>
            <p className="text-sm">No additional workflows configured</p>
            <Button variant="outline" size="sm" className="mt-3" style={{ borderColor: '#8EA58C', color: '#8EA58C' }} data-testid="setup-workflows">
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
