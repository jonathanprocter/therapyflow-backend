import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to external error monitoring service in production
    if (import.meta.env.PROD) {
      // Example: Send to error monitoring service
    } else {
      // Only log in development
      console.error('Uncaught error:', error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: '#F2F3F1'}}>
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: '#738A6E' }} />
              <CardTitle style={{ color: '#344C3D' }}>Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-center" style={{ color: '#738A6E' }}>
                An unexpected error occurred. Please refresh the page and try again.
              </p>
              {this.state.error && (
                <details className="text-xs" style={{ color: '#738A6E' }}>
                  <summary className="cursor-pointer mb-2">Error details</summary>
                  <pre className="whitespace-pre-wrap break-words p-2 bg-parchment/80 rounded">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <div className="flex justify-center space-x-2">
                <Button 
                  onClick={() => window.location.reload()}
                  style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C' }}
                  className="hover:bg-opacity-90"
                >
                  Refresh Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => this.setState({ hasError: false, error: undefined })}
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;