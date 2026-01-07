import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["/api/progress-notes", { search: query }],
    queryFn: async () => {
      if (query.length <= 2) return [];
      const response = await fetch(`/api/progress-notes?search=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: query.length > 2,
  });

  return (
    <div className="relative" data-testid="search-container">
      <input
        type="text"
        placeholder="Search notes, clients, insights..."
        className="w-96 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        data-testid="search-input"
      />
      <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
      <div className="absolute right-3 top-2">
        <span className="inline-flex items-center px-2 py-1 text-xs bg-primary/10 text-primary rounded">
          <i className="fas fa-magic mr-1"></i>
          AI
        </span>
      </div>

      {/* Search Results Dropdown */}
      {showResults && query.length > 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Searching...
            </div>
          ) : Array.isArray(searchResults) && searchResults.length > 0 ? (
            <div className="py-2">
              {searchResults.map((result: any) => (
                <div
                  key={result.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  data-testid={`search-result-${result.id}`}
                >
                  <div className="flex items-start space-x-3">
                    <i className="fas fa-notes-medical text-primary mt-1"></i>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.client?.name || "Unknown Client"}
                      </p>
                      <p className="text-xs text-gray-500 mb-1">
                        {new Date(result.sessionDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {result.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
