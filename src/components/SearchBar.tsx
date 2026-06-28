import React, { useState } from 'react';
import { Search, ArrowRight, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (handle: string) => void;
  isLoading: boolean;
  error: string | null;
}

export default function SearchBar({ onSearch, isLoading, error }: SearchBarProps) {
  const [handle, setHandle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) {
      onSearch(handle);
    }
  };

  return (
    <div className="w-full max-w-[500px] flex flex-col items-center">
      <form onSubmit={handleSubmit} className="w-full relative">
        <div className="flex items-center bg-white p-2 pl-6 rounded-full border border-neutral-200/80 shadow-[0_4px_30px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-black/5 focus-within:border-neutral-300 transition-all">
          <Search className="text-neutral-400 mr-3 w-5 h-5" />
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 text-neutral-800 placeholder-neutral-400 text-base"
            placeholder="@your_x_handle"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !handle.trim()}
            className="bg-black text-white px-7 min-h-[44px] rounded-full hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all flex items-center gap-2 cursor-pointer font-sans text-xs uppercase tracking-widest font-bold select-none"
          >
            {isLoading ? (
              <>
                Scanning <Loader2 className="w-4 h-4 animate-spin" />
              </>
            ) : (
              <>
                Scan <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
      
      {error && (
        <p className="text-red-500 text-xs font-semibold font-mono mt-3 animate-fade-in uppercase tracking-wider">
          {error}
        </p>
      )}
    </div>
  );
}
