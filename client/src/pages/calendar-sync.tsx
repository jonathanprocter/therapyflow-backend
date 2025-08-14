import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Calendar, CheckCircle, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CalendarSync() {
  const [syncInProgress, setSyncInProgress] = useState(false);
  const { toast } = useToast();

  // Get current sync status
  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ["/api/calendar/sync-status"],
  });

  // Get Google Calendar auth URL
  const { data: authData } = useQuery({
    queryKey: ["/api/calendar/auth-url"],
    enabled: !syncStatus?.isConnected,
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncInProgress(true);
      return apiRequest("/api/calendar/sync", {
        method: "POST",
        body: JSON.stringify({
          startDate: "2010-01-01", 
          endDate: "2030-12-31"
        })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/sync-status"] });
      toast({
        title: "Calendar sync complete",
        description: `Imported ${data.imported || 0} appointments successfully.`,
      });
      setSyncInProgress(false);
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error?.message || "Failed to sync calendar. Please try again.",
        variant: "destructive",
      });
      setSyncInProgress(false);
    }
  });

  const handleConnect = () => {
    if (authData?.authUrl) {
      window.open(authData.authUrl, '_blank', 'width=500,height=600');
    }
  };

  const formatLastSync = (dateString: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric', 
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F2F3F1' }} data-testid="calendar-sync-page">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#344C3D' }} data-testid="page-title">
              Calendar Integration
            </h1>
            <p style={{ color: '#738A6E' }} data-testid="page-subtitle">
              Connect your Google Calendar to automatically import appointments and sessions
            </p>
          </div>

          <div className="space-y-6">
            {/* Connection Status Card */}
            <Card data-testid="connection-status-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Google Calendar Connection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Checking connection status...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {syncStatus?.isConnected ? (
                        <CheckCircle className="h-5 w-5" style={{ color: '#8EA58C' }} />
                      ) : (
                        <AlertCircle className="h-5 w-5" style={{ color: '#88A5BC' }} />
                      )}
                      <div>
                        <p className="font-medium" data-testid="connection-status">
                          {syncStatus?.isConnected ? "Connected" : "Not Connected"}
                        </p>
                        <p className="text-sm" style={{ color: '#738A6E' }}>
                          {syncStatus?.isConnected 
                            ? `Last sync: ${formatLastSync(syncStatus.lastSync)}`
                            : "Connect to start importing appointments"
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-x-2">
                      {!syncStatus?.isConnected ? (
                        <Button 
                          onClick={handleConnect}
                          disabled={!authData?.authUrl}
                          data-testid="connect-calendar-button"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Connect Google Calendar
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => syncMutation.mutate()}
                          disabled={syncInProgress || syncMutation.isPending}
                          data-testid="sync-now-button"
                        >
                          {syncInProgress || syncMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sync Now
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sync Statistics */}
            {syncStatus?.isConnected && (
              <Card data-testid="sync-statistics-card">
                <CardHeader>
                  <CardTitle>Sync Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600" data-testid="total-appointments">
                        {syncStatus.totalAppointments || 0}
                      </div>
                      <div className="text-sm text-gray-500">Total Appointments</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600" data-testid="active-clients">
                        {syncStatus.activeClients || 0}
                      </div>
                      <div className="text-sm text-gray-500">Active Clients</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600" data-testid="this-month">
                        {syncStatus.thisMonth || 0}
                      </div>
                      <div className="text-sm text-gray-500">This Month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600" data-testid="upcoming-sessions">
                        {syncStatus.upcomingSessions || 0}
                      </div>
                      <div className="text-sm text-gray-500">Upcoming</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Setup Instructions */}
            {!syncStatus?.isConnected && (
              <Card data-testid="setup-instructions">
                <CardHeader>
                  <CardTitle>Setup Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">1</Badge>
                      <div>
                        <p className="font-medium">Click Connect Google Calendar</p>
                        <p className="text-sm text-gray-600">
                          You'll be redirected to Google's secure login page
                        </p>
                      </div>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">2</Badge>
                      <div>
                        <p className="font-medium">Grant calendar permissions</p>
                        <p className="text-sm text-gray-600">
                          Allow TherapyFlow to read your calendar events
                        </p>
                      </div>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">3</Badge>
                      <div>
                        <p className="font-medium">Automatic sync begins</p>
                        <p className="text-sm text-gray-600">
                          Your appointments will be imported and matched with client records
                        </p>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Privacy Notice:</strong> TherapyFlow only reads your calendar events and never modifies or deletes them. 
                      Your data remains secure and private.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Sync Settings */}
            {syncStatus?.isConnected && (
              <Card data-testid="sync-settings">
                <CardHeader>
                  <CardTitle>Sync Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-sync frequency</p>
                      <p className="text-sm text-gray-600">How often to check for calendar updates</p>
                    </div>
                    <Badge variant="secondary">Every 4 hours</Badge>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Date range</p>
                      <p className="text-sm text-gray-600">Historical and future appointment window</p>
                    </div>
                    <Badge variant="secondary">2010 - 2030</Badge>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Client matching</p>
                      <p className="text-sm text-gray-600">Automatically match appointments to client records</p>
                    </div>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}