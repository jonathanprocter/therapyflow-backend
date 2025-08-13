import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreVertical, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Clients() {
  const [clientToDelete, setClientToDelete] = useState<any>(null);
  const { toast } = useToast();
  
  const { data: clients, isLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      return apiRequest(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client deleted",
        description: "The client and all associated data have been removed.",
      });
      setClientToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting client",
        description: "Failed to delete the client. Please try again.",
        variant: "destructive",
      });
    }
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
                <Card key={client.id} className="hover:shadow-md transition-shadow" data-testid={`client-card-${client.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900" data-testid={`client-name-${client.id}`}>
                        {client.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={client.status === 'active' ? 'default' : 'secondary'}
                          data-testid={`client-status-${client.id}`}
                        >
                          {client.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`client-menu-${client.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${client.id}`} className="flex items-center">
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setClientToDelete(client)}
                              className="text-red-600 focus:text-red-600"
                              data-testid={`delete-client-${client.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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

                    {client.tags && client.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {client.tags.slice(0, 3).map((tag: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {client.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{client.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t">
                      <Link href={`/clients/${client.id}`}>
                        <Button variant="outline" size="sm" className="w-full" data-testid={`view-client-${client.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Complete Record
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {/* Delete Confirmation Dialog */}
          {clientToDelete && (
            <AlertDialog open={true} onOpenChange={() => setClientToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Client</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete <strong>{clientToDelete.name}</strong>? 
                    This will permanently remove the client and all associated sessions, progress notes, and documents. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteClientMutation.mutate(clientToDelete.id)}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleteClientMutation.isPending}
                  >
                    {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </main>
    </div>
  );
}
