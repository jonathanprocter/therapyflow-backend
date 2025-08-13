import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  syncedCount: number;
  sessions: any[];
  dateRange: { startDate: string; endDate: string };
}

export default function CalendarSync() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const { data: calendars, isLoading: calendarsLoading } = useQuery({
    queryKey: ['/api/calendar/calendars'],
    enabled: false, // Only fetch when user is authenticated
  });

  const syncMutation = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
      const response = await apiRequest('/api/calendar/sync', 'POST', {
        startDate,
        endDate
      });
      return response.json() as Promise<SyncResult>;
    },
    onSuccess: (data) => {
      toast({
        title: "Calendar Sync Complete",
        description: `Successfully synced ${data.syncedCount} appointments from ${data.dateRange.startDate} to ${data.dateRange.endDate}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSyncProgress(100);
      // Reset progress after a delay
      setTimeout(() => setSyncProgress(0), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar events",
        variant: "destructive",
      });
      setSyncProgress(0);
    },
  });

  const authMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/calendar/auth-url', 'GET');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to get auth URL`);
      }
      const data = await response.json();
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      console.log('Opening Google OAuth popup:', authUrl);
      
      // Check if popup blockers might be preventing this
      const authWindow = window.open(authUrl, 'google-auth', 'width=500,height=600,scrollbars=yes,resizable=yes');
      
      if (!authWindow) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site and try again",
          variant: "destructive",
        });
        return;
      }
      
      setIsAuthenticating(true);

      // Listen for messages from the popup window
      const handleMessage = (event: MessageEvent) => {
        console.log('Received message from popup:', event.data);
        
        // Only accept messages from our domain
        if (event.origin !== window.location.origin) {
          console.log('Ignoring message from different origin:', event.origin);
          return;
        }

        if (event.data.success) {
          toast({
            title: "Calendar Connected!",
            description: "Google Calendar is now connected to TherapyFlow",
          });
          setIsAuthenticating(false);
          setIsConnected(true);
          queryClient.invalidateQueries({ queryKey: ['/api/calendar/calendars'] });
        } else if (event.data.error) {
          console.error('Auth error from popup:', event.data.error);
          toast({
            title: "Authentication Failed",
            description: event.data.error,
            variant: "destructive",
          });
          setIsAuthenticating(false);
        }

        // Clean up the event listener
        window.removeEventListener('message', handleMessage);
        authWindow?.close();
      };

      window.addEventListener('message', handleMessage);

      // Handle case where user closes popup manually
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          console.log('Auth popup was closed manually');
          clearInterval(checkClosed);
          setIsAuthenticating(false);
          window.removeEventListener('message', handleMessage);
          
          if (isAuthenticating) {
            toast({
              title: "Authentication Cancelled",
              description: "The authentication window was closed",
              variant: "destructive",
            });
          }
        }
      }, 1000);
    },
    onError: (error: any) => {
      console.error('Auth URL error:', error);
      toast({
        title: "Authentication Setup Failed",
        description: error.message || "Failed to get authorization URL. Check your Google OAuth credentials in Secrets.",
        variant: "destructive",
      });
      setIsAuthenticating(false);
    },
  });

  const handleSync = () => {
    setSyncProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);

    syncMutation.mutate({
      startDate: '2015-01-01',
      endDate: '2030-12-31'
    });
  };

  const handleAuthenticate = () => {
    authMutation.mutate();
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="calendar-sync-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">
            Google Calendar Sync
          </h1>
          <p className="text-gray-600 mt-2">
            Sync your Google Calendar appointments with TherapyFlow (2015-2030)
          </p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700">
          <i className="fas fa-sync mr-2"></i>
          SimplePractice Compatible
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Status Card */}
        <Card data-testid="sync-status-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <i className="fas fa-calendar-alt text-primary"></i>
              <span>Calendar Sync Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <Alert className="border-green-200 bg-green-50">
                <i className="fas fa-check-circle text-green-600"></i>
                <AlertDescription className="text-green-800">
                  <strong>Connected:</strong> Google Calendar is successfully connected to TherapyFlow.
                  <br />You can now sync your calendar appointments.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-blue-200 bg-blue-50">
                <i className="fas fa-info-circle text-blue-600"></i>
                <AlertDescription className="text-blue-800">
                  <strong>OAuth2 Ready:</strong> Google Calendar credentials are configured.
                  <br />Complete the authentication flow below to start syncing.
                  <br /><small className="text-blue-600">Make sure popups are allowed for this site.</small>
                </AlertDescription>
              </Alert>
            )}

            {syncProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Syncing appointments...</span>
                  <span>{syncProgress}%</span>
                </div>
                <Progress value={syncProgress} className="w-full" />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <i className="fas fa-clock text-blue-600"></i>
                  <div>
                    <p className="font-medium">Sync Range</p>
                    <p className="text-sm text-gray-600">2015 - 2030 (15 years)</p>
                  </div>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <i className="fas fa-shield-alt text-green-600"></i>
                  <div>
                    <p className="font-medium">OAuth2 Security</p>
                    <p className="text-sm text-gray-600">Google verified</p>
                  </div>
                </div>
                <Badge variant="secondary">Secure</Badge>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                onClick={handleAuthenticate}
                disabled={authMutation.isPending || isAuthenticating || isConnected}
                className="w-full"
                data-testid="authenticate-button"
              >
                {authMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Getting Auth URL...
                  </>
                ) : isAuthenticating ? (
                  <>
                    <i className="fas fa-external-link-alt mr-2"></i>
                    Complete Auth in Popup
                  </>
                ) : isConnected ? (
                  <>
                    <i className="fas fa-check-circle mr-2"></i>
                    Connected to Google
                  </>
                ) : (
                  <>
                    <i className="fab fa-google mr-2"></i>
                    Authenticate with Google
                  </>
                )}
              </Button>

              <Button 
                onClick={handleSync}
                disabled={!isConnected || syncMutation.isPending || syncProgress > 0}
                variant="outline"
                className="w-full"
                data-testid="sync-button"
              >
                {syncMutation.isPending || syncProgress > 0 ? (
                  <>
                    <i className="fas fa-sync fa-spin mr-2"></i>
                    Syncing Calendar...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sync mr-2"></i>
                    Sync Calendar (2015-2030)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Results Card */}
        <Card data-testid="sync-results-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <i className="fas fa-chart-line text-secondary"></i>
              <span>Sync Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {syncMutation.data ? (
              <div className="space-y-4">
                <Alert>
                  <i className="fas fa-check-circle"></i>
                  <AlertDescription>
                    Successfully synced {syncMutation.data.syncedCount} appointments
                    from {syncMutation.data.dateRange.startDate} to {syncMutation.data.dateRange.endDate}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {syncMutation.data.syncedCount}
                    </div>
                    <div className="text-sm text-blue-600">Appointments Synced</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">15</div>
                    <div className="text-sm text-green-600">Years of Data</div>
                  </div>
                </div>

                {syncMutation.data.sessions.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium">Recent Synced Sessions:</p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {syncMutation.data.sessions.slice(0, 5).map((session, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="font-medium">{session.clientName || 'Unknown Client'}</div>
                          <div className="text-gray-600">
                            {new Date(session.scheduledAt).toLocaleDateString()} - {session.duration}min
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <i className="fas fa-calendar-plus text-4xl mb-4 opacity-50"></i>
                <p>No sync results yet</p>
                <p className="text-sm mt-2">
                  {!isConnected ? "Authenticate first, then sync" : "Click 'Sync Calendar' to begin"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions Card */}
      <Card data-testid="instructions-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <i className="fas fa-info-circle text-blue-600"></i>
            <span>How Calendar Sync Works</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Supported Formats</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-600"></i>
                  <span>SimplePractice appointments</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-600"></i>
                  <span>Manual therapy sessions</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-600"></i>
                  <span>Client names auto-extracted</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-check text-green-600"></i>
                  <span>15-year historical sync (2015-2030)</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Security & Privacy</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <i className="fas fa-shield-alt text-green-600"></i>
                  <span>OAuth2 secure authentication</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-lock text-green-600"></i>
                  <span>Read-only calendar access</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-user-shield text-green-600"></i>
                  <span>HIPAA-compliant data handling</span>
                </li>
                <li className="flex items-center space-x-2">
                  <i className="fas fa-sync text-green-600"></i>
                  <span>Real-time synchronization</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}