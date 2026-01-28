import { useState, useCallback, useId } from "react";
import { useQuery } from "@tanstack/react-query";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchId = useId();
  const resultsId = `${searchId}-results`;

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

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleFocus = useCallback(() => setShowResults(true), []);
  const handleBlur = useCallback(() => setTimeout(() => setShowResults(false), 200), []);

  const hasResults = Array.isArray(searchResults) && searchResults.length > 0;

  return (
    <div className="relative" data-testid="search-container" role="search">
      <label htmlFor={searchId} className="sr-only">Search notes, clients, and insights</label>
      <input
        id={searchId}
        type="search"
        placeholder="Search notes, clients, insights..."
        className="w-96 pl-10 pr-4 py-2 border border-teal/30 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
        value={query}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid="search-input"
        aria-autocomplete="list"
        aria-controls={resultsId}
        aria-expanded={showResults && query.length > 2}
        aria-describedby={`${searchId}-hint`}
      />
      <span id={`${searchId}-hint`} className="sr-only">
        Type at least 3 characters to search
      </span>
      <i className="fas fa-search absolute left-3 top-3 text-teal" aria-hidden="true"></i>
      <div className="absolute right-3 top-2">
        <span className="inline-flex items-center px-2 py-1 text-xs bg-primary/10 text-primary rounded">
          <i className="fas fa-magic mr-1"></i>
          AI
        </span>
      </div>

      {/* Search Results Dropdown */}
      {showResults && query.length > 2 && (
        <div
          id={resultsId}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-teal/20 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {isLoading ? (
            <div className="p-4 text-center text-sepia/80" role="status" aria-live="polite">
              <i className="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>
              Searching...
            </div>
          ) : hasResults ? (
            <div className="py-2">
              {searchResults.map((result: any) => (
                <div
                  key={result.id}
                  className="px-4 py-3 hover:bg-parchment/80 cursor-pointer border-b border-teal/10 last:border-b-0"
                  data-testid={`search-result-${result.id}`}
                  role="option"
                  aria-selected="false"
                  tabIndex={0}
                >
                  <div className="flex items-start space-x-3">
                    <i className="fas fa-notes-medical text-primary mt-1" aria-hidden="true"></i>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {result.client?.name || "Unknown Client"}
                      </p>
                      <p className="text-xs text-sepia/80 mb-1">
                        {new Date(result.sessionDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-sepia line-clamp-2">
                        {result.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sepia/80" role="status">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
