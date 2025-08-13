import SearchBar from "@/components/ui/search-bar";

export default function TopBar() {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4" data-testid="topbar">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Clinical Dashboard
          </h2>
          <div className="text-sm text-gray-500" data-testid="current-date">
            {currentDate}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <SearchBar />
          
          <button 
            className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
            data-testid="notifications-button"
          >
            <i className="fas fa-bell text-lg"></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>
    </header>
  );
}
