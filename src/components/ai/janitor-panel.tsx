"use client";

import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Play, 
  Pause, 
  RefreshCw, 
  Settings, 
  FileText, 
  Tag, 
  FileText as SummaryIcon,
  BarChart3,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface JanitorConfig {
  enabled: boolean;
  model: string;
  schedule: string;
  maxFilesPerRun: number;
  maxTokensPerRun: number;
  tasks: {
    cleanup: boolean;
    tagging: boolean;
    summarization: boolean;
    ranking: boolean;
  };
}

interface JanitorTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  stats: {
    filesProcessed: number;
    filesModified: number;
    tokensUsed: number;
  };
}

export function JanitorPanel() {
  const [config, setConfig] = useState<JanitorConfig | null>(null);
  const [stats, setStats] = useState<JanitorTask[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    filesProcessed: number;
    filesModified: number;
    tokensUsed: number;
    errors: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/janitor");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load janitor state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setLastResult(null);
    
    try {
      const res = await fetch("/api/ai/janitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      
      if (res.ok) {
        const result = await res.json();
        setLastResult(result);
        await loadState(); // Reload stats
      }
    } catch (error) {
      console.error("Failed to run janitor:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggle = async () => {
    if (!config) return;
    
    const action = config.enabled ? "disable" : "enable";
    
    try {
      const res = await fetch("/api/ai/janitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      
      if (res.ok) {
        await loadState();
      }
    } catch (error) {
      console.error("Failed to toggle janitor:", error);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    if (!config) return;
    
    const newTasks = {
      ...config.tasks,
      [taskId]: !config.tasks[taskId as keyof typeof config.tasks],
    };
    
    try {
      const res = await fetch("/api/ai/janitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-config",
          config: { tasks: newTasks },
        }),
      });
      
      if (res.ok) {
        await loadState();
      }
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Failed to load janitor configuration
      </div>
    );
  }

  const totalStats = stats.reduce(
    (acc, task) => ({
      filesProcessed: acc.filesProcessed + task.stats.filesProcessed,
      filesModified: acc.filesModified + task.stats.filesModified,
      tokensUsed: acc.tokensUsed + task.stats.tokensUsed,
    }),
    { filesProcessed: 0, filesModified: 0, tokensUsed: 0 }
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Janitor Service</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered knowledge base cleanup
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={isRunning || !config.enabled}
            className="gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Now
          </Button>
          <Button
            variant={config.enabled ? "default" : "outline"}
            size="sm"
            onClick={handleToggle}
            className="gap-2"
          >
            {config.enabled ? (
              <>
                <Pause className="h-4 w-4" />
                Enabled
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Disabled
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              config.enabled ? "bg-green-500" : "bg-gray-400"
            )} />
            <span className="text-sm font-medium">
              {config.enabled ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Model: {config.model}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalStats.filesProcessed}</div>
            <div className="text-xs text-muted-foreground">Files Processed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{totalStats.filesModified}</div>
            <div className="text-xs text-muted-foreground">Files Modified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {(totalStats.tokensUsed / 1000).toFixed(1)}k
            </div>
            <div className="text-xs text-muted-foreground">Tokens Used</div>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="p-4">
        <h4 className="font-medium mb-3">Tasks</h4>
        <div className="space-y-3">
          {stats.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  config.tasks[task.id as keyof typeof config.tasks]
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {task.id === "cleanup" && <FileText className="h-4 w-4" />}
                  {task.id === "tagging" && <Tag className="h-4 w-4" />}
                  {task.id === "summarization" && <SummaryIcon className="h-4 w-4" />}
                  {task.id === "ranking" && <BarChart3 className="h-4 w-4" />}
                </div>
                <div>
                  <div className="font-medium">{task.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {task.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <div>{task.stats.filesProcessed} processed</div>
                  <div className="text-muted-foreground">
                    {task.stats.filesModified} modified
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleTask(task.id)}
                  className="h-8 w-8 p-0"
                >
                  {config.tasks[task.id as keyof typeof config.tasks] ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Last Run</h4>
            <div className={cn(
              "text-sm",
              lastResult.success ? "text-green-600" : "text-red-600"
            )}>
              {lastResult.success ? "Success" : "Failed"}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Files Processed</div>
              <div className="font-medium">{lastResult.filesProcessed}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Files Modified</div>
              <div className="font-medium">{lastResult.filesModified}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Tokens Used</div>
              <div className="font-medium">{lastResult.tokensUsed}</div>
            </div>
          </div>
          {lastResult.errors.length > 0 && (
            <div className="mt-2">
              <div className="text-sm text-red-600 font-medium">Errors:</div>
              <ul className="text-sm text-red-600 list-disc list-inside">
                {lastResult.errors.slice(0, 3).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {lastResult.errors.length > 3 && (
                  <li>... and {lastResult.errors.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
