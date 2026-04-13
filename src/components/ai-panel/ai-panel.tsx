"use client";

import { useState } from "react";
import { X, Sparkles, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAIPanelStore } from "@/stores/ai-panel-store";

export function AIPanel() {
  const { isOpen, close } = useAIPanelStore();

  if (!isOpen) return null;

  return (
    <div className="w-96 border-l bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">AI Assistant</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={close}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">AI Assistant</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The AI assistant is currently unavailable.
        </p>
        <p className="text-xs text-muted-foreground">
          This feature requires additional configuration.
        </p>
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            // Could open settings
          }}
        >
          <Settings className="h-4 w-4" />
          Configure AI
        </Button>
      </div>
    </div>
  );
}
