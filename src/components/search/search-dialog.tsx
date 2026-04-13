"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, FileText, Tag, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";

interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  tags: string[];
  modified?: string;
}

export function SearchDialog() {
  const { isSearchOpen, closeSearch } = useAppStore();
  const { loadPage } = useEditorStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isSearchOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSearchOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeSearch();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, results, selectedIndex, closeSearch]);

  // Perform search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const handleSelectResult = (result: SearchResult) => {
    loadPage(result.path);
    closeSearch();
  };

  const handleResultClick = (result: SearchResult) => {
    handleSelectResult(result);
  };

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeSearch}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-background border rounded-lg shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search knowledge base..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuery("")}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={result.path}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors",
                    index === selectedIndex && "bg-muted"
                  )}
                >
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {result.path}
                    </div>
                    {result.snippet && (
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {result.snippet}
                      </div>
                    )}
                    {result.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {result.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {result.modified && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(result.modified).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Search className="h-8 w-8 mb-2" />
              <div>No results found for "{query}"</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Search className="h-8 w-8 mb-2" />
              <div>Start typing to search...</div>
              <div className="text-sm mt-1">Search pages, titles, and content</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground">
            {results.length > 0 ? (
              `${results.length} result${results.length === 1 ? "" : "s"} found`
            ) : (
              "Full-text search across all pages"
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
