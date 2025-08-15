import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";

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
      return apiRequest(`/api/clients/${clientId}`, 'DELETE');
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
    <div className="flex-1 overflow-y-auto p-6" data-testid="clients-page">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 
                className="text-2xl font-bold" 
                style={{ color: '#344C3D' }}
                data-testid="clients-title"
              >
                Client Management
              </h1>
              <p 
                style={{ color: '#738A6E' }}
                data-testid="clients-subtitle"
              >
                Manage your client roster and treatment plans
              </p>
            </div>
            <Button 
              data-testid="add-client-button"
              style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
              className="hover:bg-opacity-90"
            >
              <i className="fas fa-plus mr-2"></i>
              Add Client
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card 
                  key={i} 
                  className="animate-pulse"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}
                >
                  <CardContent className="p-6">
                    <div 
                      className="h-4 rounded w-3/4 mb-4"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                    ></div>
                    <div 
                      className="h-3 rounded w-1/2 mb-2"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                    ></div>
                    <div 
                      className="h-3 rounded w-2/3"
                      style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                    ></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !clients || !Array.isArray(clients) || clients.length === 0 ? (
            <div className="text-center py-12" data-testid="no-clients">
              <i 
                className="fas fa-users text-6xl mb-4" 
                style={{ color: 'rgba(115, 138, 110, 0.3)' }}
              ></i>
              <h3 
                className="text-lg font-medium mb-2" 
                style={{ color: '#344C3D' }}
              >
                No clients yet
              </h3>
              <p 
                className="mb-4" 
                style={{ color: '#738A6E' }}
              >
                Start by adding your first client to begin therapy management
              </p>
              <Button 
                data-testid="add-first-client"
                style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
                className="hover:bg-opacity-90"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Your First Client
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(clients) && clients.map((client: any) => (
                <Card 
                  key={client.id} 
                  className="hover:shadow-md transition-shadow" 
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}
                  data-testid={`client-card-${client.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Link href={`/clients/${client.id}`}>
                        <h3 
                          className="font-semibold cursor-pointer transition-colors hover:text-[#88A5BC]" 
                          style={{ 
                            color: '#344C3D'
                          }}
                          data-testid={`client-name-${client.id}`}
                        >
                          {client.name}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={client.status === 'active' ? 'default' : 'secondary'}
                          data-testid={`client-status-${client.id}`}
                          style={{ 
                            backgroundColor: client.status === 'active' ? '#8EA58C' : 'rgba(115, 138, 110, 0.1)',
                            color: client.status === 'active' ? 'white' : '#738A6E',
                            border: client.status === 'active' ? 'none' : '1px solid rgba(115, 138, 110, 0.3)'
                          }}
                        >
                          {client.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`client-menu-${client.id}`}>
                              <MoreVertical className="h-4 w-4" style={{ color: '#738A6E' }} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border" style={{ borderColor: 'rgba(115, 138, 110, 0.2)' }}>
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${client.id}`} className="flex items-center" style={{ color: '#344C3D' }}>
                                <Eye className="h-4 w-4 mr-2" style={{ color: '#88A5BC' }} />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setClientToDelete(client)}
                              className="focus:text-current"
                              style={{ color: '#738A6E' }}
                              data-testid={`delete-client-${client.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" style={{ color: '#738A6E' }} />
                              Delete Client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    {client.email && (
                      <p 
                        className="text-sm mb-2" 
                        style={{ color: '#738A6E' }}
                        data-testid={`client-email-${client.id}`}
                      >
                        <i className="fas fa-envelope mr-2" style={{ color: '#88A5BC' }}></i>
                        {client.email}
                      </p>
                    )}
                    
                    {client.phone && (
                      <p 
                        className="text-sm mb-2" 
                        style={{ color: '#738A6E' }}
                        data-testid={`client-phone-${client.id}`}
                      >
                        <i className="fas fa-phone mr-2" style={{ color: '#88A5BC' }}></i>
                        {client.phone}
                      </p>
                    )}

                    {client.tags && client.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {client.tags.slice(0, 3).map((tag: string, index: number) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              borderColor: 'rgba(136, 165, 188, 0.3)', 
                              color: '#88A5BC',
                              backgroundColor: 'rgba(136, 165, 188, 0.05)'
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {client.tags.length > 3 && (
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              borderColor: 'rgba(136, 165, 188, 0.3)', 
                              color: '#88A5BC',
                              backgroundColor: 'rgba(136, 165, 188, 0.05)'
                            }}
                          >
                            +{client.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(115, 138, 110, 0.2)' }}>
                      <Link href={`/clients/${client.id}`}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full" 
                          data-testid={`view-client-${client.id}`}
                          style={{ 
                            borderColor: '#8EA58C', 
                            color: '#8EA58C',
                            backgroundColor: 'rgba(142, 165, 140, 0.05)'
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" style={{ color: '#88A5BC' }} />
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
              <AlertDialogContent className="bg-white">
                <AlertDialogHeader>
                  <AlertDialogTitle style={{ color: '#344C3D' }}>Delete Client</AlertDialogTitle>
                  <AlertDialogDescription style={{ color: '#738A6E' }}>
                    Are you sure you want to delete <strong style={{ color: '#344C3D' }}>{clientToDelete.name}</strong>? 
                    This will permanently remove the client and all associated sessions, progress notes, and documents. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel 
                    style={{ 
                      borderColor: 'rgba(115, 138, 110, 0.3)', 
                      color: '#738A6E' 
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteClientMutation.mutate(clientToDelete.id)}
                    style={{ backgroundColor: '#738A6E' }}
                    className="hover:bg-opacity-90"
                    disabled={deleteClientMutation.isPending}
                  >
                    {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
    </div>
  );
}
