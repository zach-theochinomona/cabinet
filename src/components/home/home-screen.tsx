"use client";

import { useState } from "react";
import { Search, FileText, Folder, Clock, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";

export function HomeScreen() {
  const setSection = useAppStore((s) => s.setSection);
  const { loadPage } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Open search dialog
      useAppStore.getState().openSearch();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      handleSearch(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            Welcome to Cabinet
          </h1>
          <p className="text-muted-foreground">
            Your AI-first knowledge base and startup OS
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative w-full">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search your knowledge base..."
              className={cn(
                "w-full rounded-xl border border-border bg-card pl-12 pr-4 py-3",
                "text-sm text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "shadow-sm"
              )}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Press Enter to search, or navigate using the sidebar
          </p>
        </form>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => setSection({ type: "tree" })}
          >
            <Folder className="h-6 w-6" />
            <span>Browse Files</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => useAppStore.getState().openSearch()}
          >
            <Search className="h-6 w-6" />
            <span>Search</span>
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-6 w-full pt-8 border-t">
          <div className="text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-medium">Knowledge Base</h3>
            <p className="text-xs text-muted-foreground">
              Markdown files on disk with WYSIWYG editing
            </p>
          </div>
          <div className="text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-medium">Memory API</h3>
            <p className="text-xs text-muted-foreground">
              Shared memory system for AI agents
            </p>
          </div>
          <div className="text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-medium">Git Integration</h3>
            <p className="text-xs text-muted-foreground">
              Version history and auto-commit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
