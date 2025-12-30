import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { transformApiResponse, transformApiRequest } from "./caseTransform";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text: string;
    try {
      text = await res.text();
    } catch {
      text = res.statusText || 'Unknown error';
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: RequestInit = {},
): Promise<any> {
  // Validate HTTP method
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  const method = (options.method || 'GET').toUpperCase();
  
  if (!validMethods.includes(method)) {
    throw new Error(`Invalid HTTP method: ${method}`);
  }

  // Set default headers, but don't override if headers are already provided
  const headers = new Headers(options.headers);
  
  // If body is FormData, don't set Content-Type (browser will set it with boundary)
  // If body is an object/string and no Content-Type is set, default to JSON
  if (options.body && !(options.body instanceof FormData) && !headers.get('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const res = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    await throwIfResNotOk(res);
    
    // For DELETE requests that return JSON, parse it
    if (method === 'DELETE' && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      return transformApiResponse(data);
    }
    
    // For other requests, try to parse JSON if available
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      // Transform snake_case to camelCase for frontend consumption
      return transformApiResponse(data);
    }
    
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout: The server took too long to respond');
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Handle query key properly - if it's an array, construct URL with parameters
      let url: string;
      if (Array.isArray(queryKey)) {
        url = queryKey[0] as string;
        // Validate URL format
        if (!url || typeof url !== 'string' || !url.startsWith('/')) {
          throw new Error(`Invalid query key URL: ${url}`);
        }
        // If there are additional parameters, construct query string
        if (queryKey[1] && typeof queryKey[1] === 'object') {
          const params = new URLSearchParams(queryKey[1] as Record<string, string>);
          url += `?${params.toString()}`;
        }
      } else {
        url = String(queryKey);
        if (!url || !url.startsWith('/')) {
          throw new Error(`Invalid query key URL: ${url}`);
        }
      }

      const res = await fetch(url, {
        method: 'GET',
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        // Transform snake_case to camelCase for frontend consumption
        return transformApiResponse(data);
      } else {
        return null; // Return null for non-JSON responses
      }
    } catch (error) {
      console.error('Query error for URL:', String(queryKey), error);
      
      // Don't throw for certain expected errors to prevent UI crashes
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          return null;
        }
        // Also handle network errors gracefully
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          console.warn('Network error, returning null for graceful handling');
          return null;
        }
      }
      
      throw error; // Re-throw to be handled by React Query
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
