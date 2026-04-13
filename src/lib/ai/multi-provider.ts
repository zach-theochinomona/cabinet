/**
 * Multi-Provider AI Service
 * 
 * Supports multiple AI providers (OpenRouter, Gemini, etc.)
 * with fallback and automatic provider selection.
 */

import { getApiKey, getAvailableProviders } from "@/lib/security/api-key-storage";
import { callOpenRouter } from "./openrouter";
import { callGemini, listGeminiModels } from "./gemini";

export interface ProviderConfig {
  provider: string;
  model: string;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  tokens: number;
  provider: string;
  model: string;
}

/**
 * Call AI with automatic provider selection
 */
export async function callAI(
  messages: Array<{ role: string; content: string }>,
  options: {
    provider?: string;
    model?: string;
    maxTokens?: number;
    preferFree?: boolean;
  } = {}
): Promise<AIResponse> {
  const { provider, model, maxTokens = 1000, preferFree = true } = options;

  // If specific provider requested, use it
  if (provider) {
    return await callProvider(provider, model || "auto", messages, maxTokens);
  }

  // Get available providers
  const availableProviders = await getAvailableProviders();
  
  if (availableProviders.length === 0) {
    throw new Error("No AI providers configured. Add an API key in Settings → AI & Janitor → API Keys.");
  }

  // Try providers in order of preference
  const providerOrder = preferFree
    ? ["openrouter", "gemini", "openai", "anthropic"]
    : ["openai", "anthropic", "openrouter", "gemini"];

  for (const providerName of providerOrder) {
    if (availableProviders.includes(providerName)) {
      try {
        return await callProvider(providerName, model || "auto", messages, maxTokens);
      } catch (error) {
        console.error(`Provider ${providerName} failed:`, error);
        // Continue to next provider
      }
    }
  }

  throw new Error("All AI providers failed. Check your API keys in Settings → AI & Janitor → API Keys.");
}

/**
 * Call a specific provider
 */
async function callProvider(
  provider: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<AIResponse> {
  switch (provider) {
    case "openrouter":
      const openrouterResponse = await callOpenRouter(model, messages, maxTokens);
      return {
        ...openrouterResponse,
        provider: "openrouter",
        model,
      };
    
    case "gemini":
      const geminiResponse = await callGemini(model, messages, maxTokens);
      return {
        ...geminiResponse,
        provider: "gemini",
        model,
      };
    
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Get available models for all providers
 */
export async function getAvailableModels(): Promise<Array<{
  provider: string;
  models: Array<{ id: string; name: string; description: string }>;
}>> {
  const results = [];
  
  // Check OpenRouter
  try {
    const openrouterKey = await getApiKey("openrouter");
    if (openrouterKey) {
      // OpenRouter models are fetched dynamically
      results.push({
        provider: "openrouter",
        models: [
          { id: "google/gemma-7b-it:free", name: "Gemma 7B (Free)", description: "Google's Gemma 7B - Free tier" },
          { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)", description: "Mistral 7B Instruct - Free tier" },
          { id: "meta-llama/llama-3-8b-instruct:free", name: "Llama 3 8B (Free)", description: "Meta's Llama 3 8B - Free tier" },
        ],
      });
    }
  } catch (error) {
    console.error("Failed to get OpenRouter models:", error);
  }
  
  // Check Gemini
  try {
    const geminiKey = await getApiKey("gemini");
    if (geminiKey) {
      const geminiModels = await listGeminiModels();
      results.push({
        provider: "gemini",
        models: geminiModels.length > 0 ? geminiModels : [
          { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Google's Gemini 1.5 Pro" },
          { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Google's Gemini 1.5 Flash" },
        ],
      });
    }
  } catch (error) {
    console.error("Failed to get Gemini models:", error);
  }
  
  return results;
}

/**
 * Test a provider connection
 */
export async function testProvider(
  provider: string,
  model: string = "auto"
): Promise<{ success: boolean; error?: string }> {
  try {
    const testMessages = [
      { role: "user", content: "Hello, this is a test message. Please respond with 'Test successful.'" },
    ];
    
    const response = await callProvider(provider, model, testMessages, 50);
    
    return {
      success: response.content.length > 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
