import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Clients() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  return (
    <div className="flex h-screen bg-gray-50" data-testid="clients-page">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="clients-title">
                Client Management
              </h1>
              <p className="text-gray-600" data-testid="clients-subtitle">
                Manage your client roster and treatment plans
              </p>
            </div>
            <Button data-testid="add-client-button">
              <i className="fas fa-plus mr-2"></i>
              Add Client
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !clients || !Array.isArray(clients) || clients.length === 0 ? (
            <div className="text-center py-12" data-testid="no-clients">
              <i className="fas fa-users text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
              <p className="text-gray-500 mb-4">Start by adding your first client to begin therapy management</p>
              <Button data-testid="add-first-client">
                <i className="fas fa-plus mr-2"></i>
                Add Your First Client
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(clients) && clients.map((client: any) => (
                <Card key={client.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`client-card-${client.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900" data-testid={`client-name-${client.id}`}>
                        {client.name}
                      </h3>
                      <Badge 
                        variant={client.status === 'active' ? 'default' : 'secondary'}
                        data-testid={`client-status-${client.id}`}
                      >
                        {client.status}
                      </Badge>
                    </div>
                    
                    {client.email && (
                      <p className="text-sm text-gray-600 mb-2" data-testid={`client-email-${client.id}`}>
                        <i className="fas fa-envelope mr-2"></i>
                        {client.email}
                      </p>
                    )}
                    
                    {client.phone && (
                      <p className="text-sm text-gray-600 mb-2" data-testid={`client-phone-${client.id}`}>
                        <i className="fas fa-phone mr-2"></i>
                        {client.phone}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <span className="text-xs text-gray-500" data-testid={`client-created-${client.id}`}>
                        Since {new Date(client.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" data-testid={`view-client-${client.id}`}>
                          <i className="fas fa-eye"></i>
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`edit-client-${client.id}`}>
                          <i className="fas fa-edit"></i>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
