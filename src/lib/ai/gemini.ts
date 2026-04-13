/**
 * Gemini AI Integration
 * 
 * Provides methods to call Google Gemini API for AI tasks.
 * Supports both Gemini API and Gemini CLI.
 */

import { getApiKey } from "@/lib/security/api-key-storage";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Call Gemini API
 */
export async function callGemini(
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 1000
): Promise<{ content: string; tokens: number }> {
  // Try to get API key from secure storage, then fall back to environment
  let apiKey = await getApiKey("gemini");
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  }
  
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Add it in Settings → AI & Janitor → API Keys.");
  }

  // Convert messages to Gemini format
  const contents: GeminiMessage[] = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const request: GeminiRequest = {
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: maxTokens,
    },
  };

  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data: GeminiResponse = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokens = data.usageMetadata?.totalTokenCount || 0;

  return { content, tokens };
}

/**
 * List available Gemini models
 */
export async function listGeminiModels(): Promise<Array<{ id: string; name: string; description: string }>> {
  try {
    // Try to get API key from secure storage, then fall back to environment
    let apiKey = await getApiKey("gemini");
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }
    
    if (!apiKey) {
      return [];
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    return (data.models || [])
      .filter((model: any) => model.name?.includes("gemini"))
      .map((model: any) => ({
        id: model.name.split('/').pop(),
        name: model.displayName || model.name,
        description: model.description || "Google Gemini model",
      }));
  } catch (error) {
    console.error("Failed to list Gemini models:", error);
    return [];
  }
}

/**
 * Check if Gemini CLI is available
 */
export async function isGeminiCLIAvailable(): Promise<boolean> {
  try {
    const { execSync } = require("child_process");
    execSync("gemini --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Gemini CLI with a prompt
 */
export async function runGeminiCLI(
  prompt: string,
  options: {
    model?: string;
    sandbox?: boolean;
    cwd?: string;
  } = {}
): Promise<{ output: string; error?: string }> {
  const { execSync } = require("child_process");
  const path = require("path");
  
  try {
    const args = [];
    
    if (options.model) {
      args.push("--model", options.model);
    }
    
    if (options.sandbox) {
      args.push("--sandbox=none");
    }
    
    args.push(prompt);
    
    const command = `gemini ${args.map(arg => `"${arg}"`).join(" ")}`;
    
    const output = execSync(command, {
      cwd: options.cwd || process.cwd(),
      encoding: "utf8",
      timeout: 60000, // 1 minute timeout
      maxBuffer: 1024 * 1024, // 1MB max buffer
    });
    
    return { output: output.toString() };
  } catch (error: any) {
    return {
      output: "",
      error: error.message || "Gemini CLI execution failed",
    };
  }
}
