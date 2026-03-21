import React, { useId } from 'react';
import { Search } from 'lucide-react';

interface FilterPill {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}

interface SortOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterPill[];
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  sortOptions,
  sortValue,
  onSortChange,
}) => {
  const id = useId();
  const searchId = `${id}-search`;
  const sortId = `${id}-sort`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      {/* Search input */}
      <div className="relative flex-1 sm:min-w-[180px]">
        <label htmlFor={searchId} className="sr-only">
          {searchPlaceholder}
        </label>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        <input
          id={searchId}
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-lg pl-8 pr-3 py-2.5 sm:py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>

      {/* Filter pills */}
      {filters && filters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={f.onClick}
              className={`px-2.5 py-1.5 sm:py-1 rounded-md text-xs font-medium transition-colors ${
                f.active
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Sort dropdown */}
      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <div className="relative">
          <label htmlFor={sortId} className="sr-only">
            Sort by
          </label>
          <select
            id={sortId}
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none bg-zinc-900 border border-zinc-700/60 rounded-lg px-3 py-2.5 sm:py-1.5 pr-7 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-300">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
      )}
    </div>
  );
};

/** Tiny chevron overlay for the native select */
function ChevronIcon() {
  return (
    <svg
      className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default FilterBar;
