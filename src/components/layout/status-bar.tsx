"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  GitBranch, 
  GitCommit, 
  GitPullRequest,
  ExternalLink,
  Server,
  Wifi,
  WifiOff,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editor-store";
import { useTreeStore } from "@/stores/tree-store";
import { useAppStore } from "@/stores/app-store";

const GITHUB_STARS_FALLBACK = 1200;

export function StatusBar() {
  const { saveStatus, currentPath } = useEditorStore();
  const loadTree = useTreeStore((s) => s.loadTree);
  const setSection = useAppStore((s) => s.setSection);
  const [uncommitted, setUncommitted] = useState(0);
  const [pullStatus, setPullStatus] = useState<"idle" | "pulling" | "pulled" | "up-to-date" | "error">("idle");
  const [pulling, setPulling] = useState(false);
  const [githubStars, setGithubStars] = useState(GITHUB_STARS_FALLBACK);
  const didAutoPullRef = useRef(false);
  const [appAlive, setAppAlive] = useState(true);
  const [daemonAlive, setDaemonAlive] = useState(true);
  const [installKind, setInstallKind] = useState<"source-managed" | "source-custom" | "electron-macos">("source-custom");
  const [showServerPopup, setShowServerPopup] = useState(false);
  const { update } = useCabinetUpdate();

  // Poll server health endpoints
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      const [appRes, daemonRes] = await Promise.allSettled([
        fetch("/api/health", { cache: "no-store" }),
        fetch("/api/health/daemon", { cache: "no-store" }),
      ]);
      if (!mounted) return;
      const appOk = appRes.status === "fulfilled" && appRes.value.ok;
      setAppAlive(appOk);
      setDaemonAlive(daemonRes.status === "fulfilled" && daemonRes.value.ok);
      if (appOk && appRes.status === "fulfilled") {
        try {
          const data = await appRes.value.json();
          if (data.installKind) setInstallKind(data.installKind);
        } catch { /* ignore */ }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch uncommitted count
  const fetchUncommitted = useCallback(async () => {
    try {
      const res = await fetch("/api/git/log?limit=0&uncommitted=true", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUncommitted(data.uncommittedCount ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUncommitted();
    const interval = setInterval(fetchUncommitted, 60_000);
    return () => clearInterval(interval);
  }, [fetchUncommitted]);

  // Auto-pull on first load
  useEffect(() => {
    if (didAutoPullRef.current) return;
    didAutoPullRef.current = true;
    handlePull(true);
  }, []);

  // Fetch GitHub stars
  useEffect(() => {
    let mounted = true;
    const fetchStars = async () => {
      try {
        const res = await fetch("https://api.github.com/repos/hilash/cabinet", { cache: "no-store" });
        if (!mounted || !res.ok) return;
        const data = await res.json();
        if (typeof data.stargazers_count === "number") {
          setGithubStars(data.stargazers_count);
        }
      } catch { /* ignore */ }
    };
    fetchStars();
    const interval = setInterval(fetchStars, 300_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handlePull = useCallback(async (silent = false) => {
    if (pulling) return;
    setPulling(true);
    setPullStatus("pulling");
    try {
      const res = await fetch("/api/git/pull", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.changes && data.changes > 0) {
          setPullStatus("pulled");
          loadTree();
          fetchUncommitted();
        } else {
          setPullStatus("up-to-date");
        }
      } else {
        setPullStatus("error");
      }
    } catch {
      setPullStatus("error");
    } finally {
      setPulling(false);
      if (!silent) {
        setTimeout(() => setPullStatus("idle"), 3000);
      }
    }
  }, [pulling, loadTree, fetchUncommitted]);

  const handleOpenInFinder = useCallback(async () => {
    try {
      await fetch("/api/system/reveal", { method: "POST" });
    } catch { /* ignore */ }
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open("https://github.com/hilash/cabinet", "_blank");
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.hasUpdate) {
          update.mutate();
        }
      }
    } catch { /* ignore */ }
  }, [update]);

  return (
    <div className="flex items-center justify-between h-7 px-3 text-xs bg-muted/50 border-t">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Health indicators */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {appAlive ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-500" />
            )}
            <span className="text-muted-foreground">App</span>
          </div>
          <div className="flex items-center gap-1">
            {daemonAlive ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-yellow-500" />
            )}
            <span className="text-muted-foreground">Daemon</span>
          </div>
        </div>

        {/* Git status */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => handlePull()}
            disabled={pulling}
          >
            {pulling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GitPullRequest className="h-3 w-3" />
            )}
            <span className="text-xs">
              {pullStatus === "pulling" ? "Pulling..." :
               pullStatus === "pulled" ? "Pulled" :
               pullStatus === "up-to-date" ? "Up to date" :
               pullStatus === "error" ? "Error" : "Pull"}
            </span>
          </Button>
          {uncommitted > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 gap-1 text-yellow-600 hover:text-yellow-700"
              onClick={() => setSection("git")}
            >
              <GitCommit className="h-3 w-3" />
              <span className="text-xs">{uncommitted}</span>
            </Button>
          )}
        </div>

        {/* Save status */}
        {saveStatus && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <span className="text-xs">{saveStatus}</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* GitHub stars */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 gap-1 text-muted-foreground hover:text-foreground"
          onClick={handleOpenExternal}
        >
          <ExternalLink className="h-3 w-3" />
          <span className="text-xs">{githubStars.toLocaleString()} stars</span>
        </Button>

        {/* Data directory */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 gap-1 text-muted-foreground hover:text-foreground"
          onClick={handleOpenInFinder}
        >
          <Server className="h-3 w-3" />
          <span className="text-xs">Data</span>
        </Button>

        {/* Update button */}
        {installKind === "source-managed" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleCheckUpdate}
            disabled={update.isPending}
          >
            {update.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            <span className="text-xs">Update</span>
          </Button>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1">
          {appAlive ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-500" />
          )}
        </div>
      </div>
    </div>
  );
}

// Simple update hook (placeholder)
function useCabinetUpdate() {
  return {
    update: {
      isPending: false,
      mutate: () => {},
    },
  };
}
