import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Target, Calendar, User, CheckCircle, Circle, Edit } from 'lucide-react';

interface TreatmentGoal {
  id: string;
  description: string;
  targetDate: string;
  status: 'active' | 'completed' | 'paused';
  priority: 'high' | 'medium' | 'low';
}

interface TreatmentPlan {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  startDate: string;
  targetEndDate: string;
  status: 'active' | 'completed' | 'paused';
  goals: TreatmentGoal[];
  modality: string;
  frequency: string;
}

export default function TreatmentPlans() {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    targetEndDate: '',
    modality: '',
    frequency: ''
  });

  // Get clients for dropdown
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  // Get treatment plans
  const { data: treatmentPlans = [], refetch } = useQuery<TreatmentPlan[]>({
    queryKey: ['/api/treatment-plans'],
    enabled: true
  });

  const filteredPlans = selectedClientId 
    ? treatmentPlans.filter((plan) => plan.clientId === selectedClientId)
    : treatmentPlans;

  const createTreatmentPlan = async () => {
    if (!selectedClientId || !newPlan.title.trim()) return;
    
    try {
      const response = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          ...newPlan,
          startDate: new Date().toISOString(),
          status: 'active'
        }),
      });
      
      if (response.ok) {
        setIsCreateDialogOpen(false);
        setNewPlan({
          title: '',
          description: '',
          targetEndDate: '',
          modality: '',
          frequency: ''
        });
        refetch();
      }
    } catch (error) {
      console.error('Failed to create treatment plan:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6" data-testid="treatment-plans-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Treatment Plans</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Manage therapeutic treatment plans and track progress towards goals
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan">
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Treatment Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Client</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger data-testid="select-plan-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Treatment plan title"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  data-testid="input-plan-title"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe the treatment approach and objectives"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  data-testid="textarea-plan-description"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Modality</label>
                  <Select 
                    value={newPlan.modality} 
                    onValueChange={(value) => setNewPlan({ ...newPlan, modality: value })}
                  >
                    <SelectTrigger data-testid="select-modality">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cbt">CBT</SelectItem>
                      <SelectItem value="dbt">DBT</SelectItem>
                      <SelectItem value="act">ACT</SelectItem>
                      <SelectItem value="psychodynamic">Psychodynamic</SelectItem>
                      <SelectItem value="humanistic">Humanistic</SelectItem>
                      <SelectItem value="systemic">Systemic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Frequency</label>
                  <Select 
                    value={newPlan.frequency} 
                    onValueChange={(value) => setNewPlan({ ...newPlan, frequency: value })}
                  >
                    <SelectTrigger data-testid="select-frequency">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="asneeded">As needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Target End Date</label>
                <Input
                  type="date"
                  value={newPlan.targetEndDate}
                  onChange={(e) => setNewPlan({ ...newPlan, targetEndDate: e.target.value })}
                  data-testid="input-target-date"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={createTreatmentPlan} className="flex-1" data-testid="button-save-plan">
                  Create Plan
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel-plan"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filter by Client:</label>
            <div className="w-64">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger data-testid="select-filter-client">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All clients</SelectItem>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Treatment Plans */}
      <div className="space-y-4">
        {filteredPlans.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Treatment Plans
              </h3>
              <p className="text-gray-500 mb-4">
                Get started by creating a treatment plan for your clients.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPlans.map((plan: TreatmentPlan) => (
            <Card key={plan.id} data-testid={`plan-${plan.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {plan.title}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {plan.clientName}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Started {new Date(plan.startDate).toLocaleDateString()}
                      </div>
                      {plan.targetEndDate && (
                        <div className="flex items-center gap-1">
                          Target: {new Date(plan.targetEndDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(plan.status)}>
                      {plan.status}
                    </Badge>
                    <Button variant="ghost" size="sm" data-testid={`button-edit-${plan.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {plan.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="font-medium">Modality:</span> {plan.modality || 'Not specified'}
                  </div>
                  <div>
                    <span className="font-medium">Frequency:</span> {plan.frequency || 'Not specified'}
                  </div>
                </div>

                {/* Goals */}
                {plan.goals && plan.goals.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Goals ({plan.goals.length})
                    </h4>
                    <div className="space-y-2">
                      {plan.goals.map((goal: TreatmentGoal) => (
                        <div key={goal.id} className="flex items-start gap-3 p-2 rounded border">
                          <div className="mt-1">
                            {goal.status === 'completed' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">{goal.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="secondary" 
                                className={getPriorityColor(goal.priority)}
                              >
                                {goal.priority}
                              </Badge>
                              {goal.targetDate && (
                                <span className="text-xs text-gray-500">
                                  Target: {new Date(goal.targetDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}