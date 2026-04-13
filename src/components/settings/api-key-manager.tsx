"use client";

import { useState, useEffect } from "react";
import { 
  Key, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Shield,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApiKey {
  provider: string;
  name?: string;
  createdAt: string;
  hasKey: boolean;
}

const PROVIDERS = [
  { id: "openrouter", name: "OpenRouter", description: "Access to multiple AI models", url: "https://openrouter.ai/keys" },
  { id: "gemini", name: "Google Gemini", description: "Google's AI models", url: "https://aistudio.google.com/app/apikey" },
  { id: "openai", name: "OpenAI", description: "GPT-4, GPT-3.5, etc.", url: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic", description: "Claude models", url: "https://console.anthropic.com/account/keys" },
  { id: "mistral", name: "Mistral AI", description: "Mistral models", url: "https://console.mistral.ai/api-keys/" },
];

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState({
    provider: "",
    key: "",
    name: "",
    test: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (error) {
      console.error("Failed to load keys:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKey.provider || !newKey.key) {
      setError("Provider and key are required");
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`API key for ${newKey.provider} added successfully`);
        setNewKey({ provider: "", key: "", name: "", test: true });
        setShowAddDialog(false);
        await loadKeys();
      } else {
        setError(data.error || "Failed to add key");
      }
    } catch (error) {
      setError("Failed to add key");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveKey = async (provider: string) => {
    if (!confirm(`Remove API key for ${provider}?`)) return;

    try {
      const res = await fetch(`/api/keys?provider=${provider}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSuccess(`API key for ${provider} removed`);
        await loadKeys();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove key");
      }
    } catch (error) {
      setError("Failed to remove key");
    }
  };

  const toggleShowKey = (provider: string) => {
    setShowKey(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const getProviderInfo = (providerId: string) => {
    return PROVIDERS.find(p => p.id === providerId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            API Keys
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage API keys for AI providers. Keys are encrypted and stored securely.
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add API Key</DialogTitle>
              <DialogDescription>
                Add an API key for an AI provider. Keys are encrypted and stored securely on your machine.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={newKey.provider}
                  onValueChange={(value) => setNewKey({ ...newKey, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <span>{provider.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {provider.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newKey.provider && (
                  <div className="text-sm text-muted-foreground">
                    <a
                      href={getProviderInfo(newKey.provider)?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      Get your API key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name (optional)</Label>
                <Input
                  id="name"
                  placeholder="e.g., My OpenRouter Key"
                  value={newKey.name}
                  onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">API Key</Label>
                <div className="relative">
                  <Input
                    id="key"
                    type={showKey["new"] ? "text" : "password"}
                    placeholder="sk-..."
                    value={newKey.key}
                    onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowKey("new")}
                  >
                    {showKey["new"] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="test"
                  checked={newKey.test}
                  onChange={(e) => setNewKey({ ...newKey, test: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="test" className="text-sm">
                  Test key before saving
                </Label>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddKey} disabled={isAdding}>
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Key"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-green-600 text-sm p-3 bg-green-50 rounded-md">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {error && !showAddDialog && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-red-50 rounded-md">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No API keys configured</p>
            <p className="text-sm">Add an API key to enable AI features</p>
          </div>
        ) : (
          keys.map((key) => {
            const providerInfo = getProviderInfo(key.provider);
            return (
              <div
                key={key.provider}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {providerInfo?.name || key.provider}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {key.name || key.provider} • Added {new Date(key.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveKey(key.provider)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-2">Supported Providers</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {PROVIDERS.map((provider) => (
            <div key={provider.id} className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                keys.some(k => k.provider === provider.id) ? "bg-green-500" : "bg-gray-300"
              )} />
              <span>{provider.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
