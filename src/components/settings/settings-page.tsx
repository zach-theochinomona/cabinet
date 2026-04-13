"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  FolderOpen, 
  RefreshCw, 
  Download, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Server,
  Database,
  HardDrive,
  Settings,
  Palette,
  Bell,
  GitBranch,
  Shield,
  Info,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useTheme } from "next-themes";

type Tab = "storage" | "appearance" | "updates" | "about";

export function SettingsPage() {
  const [dataDir, setDataDir] = useState("");
  const [dataDirPending, setDataDirPending] = useState<string | null>(null);
  const [dataDirBrowsing, setDataDirBrowsing] = useState(false);
  const [dataDirSaving, setDataDirSaving] = useState(false);
  const [dataDirRestartNeeded, setDataDirRestartNeeded] = useState(false);
  const VALID_TABS: Tab[] = ["storage", "appearance", "updates", "about"];
  const [tab, setTabState] = useState<Tab>("storage");
  const initializedRef = useRef(false);
  const [activeThemeName, setActiveThemeName] = useState<string | null>(null);
  const { setTheme: setNextTheme } = useTheme();

  // Sync tab changes to hash
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    useAppStore.getState().setSection({ type: "settings", slug: t });
  }, []);

  // Listen for external hash changes (browser back/forward)
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      // Set hash on first render if it's just #/settings
      if (!useAppStore.getState().section.slug) {
        useAppStore.getState().setSection({ type: "settings", slug: tab });
      }
    }
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.section.type === "settings" && state.section.slug !== prev.section.slug) {
        const slug = state.section.slug as Tab | undefined;
        if (slug && VALID_TABS.includes(slug)) {
          setTabState(slug);
        }
      }
    });
    return unsub;
  }, []);

  // Load data directory
  useEffect(() => {
    let mounted = true;
    const loadDataDir = async () => {
      try {
        const res = await fetch("/api/system/data-dir");
        if (res.ok && mounted) {
          const data = await res.json();
          setDataDir(data.path || "");
        }
      } catch { /* ignore */ }
    };
    loadDataDir();
    return () => { mounted = false; };
  }, []);

  const handleBrowseDataDir = async () => {
    setDataDirBrowsing(true);
    try {
      const res = await fetch("/api/system/pick-directory", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.path) {
          setDataDirPending(data.path);
        }
      }
    } catch { /* ignore */ }
    finally {
      setDataDirBrowsing(false);
    }
  };

  const handleSaveDataDir = async () => {
    if (!dataDirPending) return;
    setDataDirSaving(true);
    try {
      const res = await fetch("/api/system/data-dir", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dataDirPending }),
      });
      if (res.ok) {
        setDataDir(dataDirPending);
        setDataDirPending(null);
        setDataDirRestartNeeded(true);
      }
    } catch { /* ignore */ }
    finally {
      setDataDirSaving(false);
    }
  };

  const handleOpenDataDir = async () => {
    try {
      await fetch("/api/system/open-data-dir", { method: "POST" });
    } catch { /* ignore */ }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
        <nav className="space-y-1">
          {[
            { id: "storage", label: "Storage", icon: Database },
            { id: "appearance", label: "Appearance", icon: Palette },
            { id: "updates", label: "Updates", icon: Download },
            { id: "about", label: "About", icon: Info },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as Tab)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                tab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {tab === "storage" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Storage Settings</h2>
              <p className="text-muted-foreground">
                Manage your knowledge base storage location and settings.
              </p>
            </div>

            {/* Data Directory */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">Data Directory</h3>
                  <p className="text-sm text-muted-foreground">
                    Location where your knowledge base files are stored.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenDataDir}
                  className="gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  Open Folder
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-muted rounded-md text-sm font-mono">
                  {dataDir || "Not set"}
                </div>
                <Button
                  variant="outline"
                  onClick={handleBrowseDataDir}
                  disabled={dataDirBrowsing}
                >
                  {dataDirBrowsing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Browse"
                  )}
                </Button>
              </div>

              {dataDirPending && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">New directory selected:</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {dataDirPending}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDataDirPending(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveDataDir}
                        disabled={dataDirSaving}
                      >
                        {dataDirSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {dataDirRestartNeeded && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <p className="text-sm">
                      Data directory changed. Please restart Cabinet for changes to take effect.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "appearance" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Appearance</h2>
              <p className="text-muted-foreground">
                Customize the look and feel of Cabinet.
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-4">Theme</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose your preferred color theme.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setNextTheme("light");
                    setActiveThemeName("light");
                  }}
                  className={cn(
                    "p-4 border rounded-lg text-left transition-colors",
                    activeThemeName === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-white border" />
                    <span className="font-medium">Light</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clean, bright interface
                  </p>
                </button>
                <button
                  onClick={() => {
                    setNextTheme("dark");
                    setActiveThemeName("dark");
                  }}
                  className={cn(
                    "p-4 border rounded-lg text-left transition-colors",
                    activeThemeName === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-gray-800 border border-gray-600" />
                    <span className="font-medium">Dark</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Easy on the eyes
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "updates" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Updates</h2>
              <p className="text-muted-foreground">
                Check for and install updates to Cabinet.
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">Check for Updates</h3>
                  <p className="text-sm text-muted-foreground">
                    See if there are any updates available.
                  </p>
                </div>
                <Button variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Check Now
                </Button>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">You're running the latest version.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "about" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">About Cabinet</h2>
              <p className="text-muted-foreground">
                Information about your Cabinet installation.
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">Cabinet</h3>
                  <p className="text-sm text-muted-foreground">
                    AI-first knowledge base and startup OS
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://github.com/hilash/cabinet", "_blank")}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  GitHub
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>0.2.12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">License</span>
                  <span>MIT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Framework</span>
                  <span>Next.js 16</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Memory API</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Cabinet provides a shared memory system for AI agents.
              </p>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Memory API endpoints available</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Agent memory storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Knowledge base integration</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
