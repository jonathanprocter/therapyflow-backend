import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  method: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // For DELETE requests that return JSON, parse it
  if (method === 'DELETE' && res.headers.get('content-type')?.includes('application/json')) {
    return res.json();
  }
  
  // For other requests, try to parse JSON if available
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  
  return res;
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
        // If there are additional parameters, construct query string
        if (queryKey[1] && typeof queryKey[1] === 'object') {
          const params = new URLSearchParams(queryKey[1] as Record<string, string>);
          url += `?${params.toString()}`;
        }
      } else {
        url = String(queryKey);
      }

      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await res.json();
      } else {
        return null; // Return null for non-JSON responses
      }
    } catch (error) {
      console.error('Query error:', error);
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
