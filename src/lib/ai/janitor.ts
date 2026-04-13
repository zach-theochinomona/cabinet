/**
 * Cabinet Janitor Service
 * 
 * Background service that uses OpenRouter AI to clean up and organize
 * knowledge base files. Runs periodically via cron.
 */

import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "@/lib/storage/path-utils";
import { readFileContent, writeFileContent, fileExists, listDirectory } from "@/lib/storage/fs-operations";
import { getApiKey } from "@/lib/security/api-key-storage";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface JanitorTask {
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

export interface JanitorConfig {
  enabled: boolean;
  model: string;
  schedule: string; // cron expression
  maxFilesPerRun: number;
  maxTokensPerRun: number;
  tasks: {
    cleanup: boolean;
    tagging: boolean;
    summarization: boolean;
    ranking: boolean;
  };
}

const DEFAULT_CONFIG: JanitorConfig = {
  enabled: true,
  model: "google/gemma-7b-it:free", // Free model
  schedule: "0 */2 * * *", // Every 2 hours
  maxFilesPerRun: 10,
  maxTokensPerRun: 50000,
  tasks: {
    cleanup: true,
    tagging: true,
    summarization: true,
    ranking: true,
  },
};

/**
 * Get janitor configuration
 */
export async function getJanitorConfig(): Promise<JanitorConfig> {
  const configPath = path.join(DATA_DIR, ".cabinet", "janitor-config.json");
  
  try {
    if (await fileExists(configPath)) {
      const content = await readFileContent(configPath);
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    }
  } catch (error) {
    console.error("Failed to read janitor config:", error);
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Save janitor configuration
 */
export async function saveJanitorConfig(config: JanitorConfig): Promise<void> {
  const configPath = path.join(DATA_DIR, ".cabinet", "janitor-config.json");
  const dirPath = path.dirname(configPath);
  
  try {
    await fs.mkdir(dirPath, { recursive: true });
    await writeFileContent(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Failed to save janitor config:", error);
    throw error;
  }
}

/**
 * Get janitor statistics
 */
export async function getJanitorStats(): Promise<JanitorTask[]> {
  const statsPath = path.join(DATA_DIR, ".cabinet", "janitor-stats.json");
  
  try {
    if (await fileExists(statsPath)) {
      const content = await readFileContent(statsPath);
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Failed to read janitor stats:", error);
  }
  
  return [
    {
      id: "cleanup",
      name: "Cleanup",
      description: "Fix formatting, remove duplicates, clean up markdown",
      enabled: true,
      stats: { filesProcessed: 0, filesModified: 0, tokensUsed: 0 },
    },
    {
      id: "tagging",
      name: "Tagging",
      description: "Add relevant tags and categories to files",
      enabled: true,
      stats: { filesProcessed: 0, filesModified: 0, tokensUsed: 0 },
    },
    {
      id: "summarization",
      name: "Summarization",
      description: "Generate summaries for long documents",
      enabled: true,
      stats: { filesProcessed: 0, filesModified: 0, tokensUsed: 0 },
    },
    {
      id: "ranking",
      name: "Ranking",
      description: "Score and rank content by quality and relevance",
      enabled: true,
      stats: { filesProcessed: 0, filesModified: 0, tokensUsed: 0 },
    },
  ];
}

/**
 * Save janitor statistics
 */
export async function saveJanitorStats(stats: JanitorTask[]): Promise<void> {
  const statsPath = path.join(DATA_DIR, ".cabinet", "janitor-stats.json");
  const dirPath = path.dirname(statsPath);
  
  try {
    await fs.mkdir(dirPath, { recursive: true });
    await writeFileContent(statsPath, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error("Failed to save janitor stats:", error);
  }
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 1000
): Promise<{ content: string; tokens: number }> {
  // Try to get API key from secure storage first, then fall back to environment
  let apiKey = await getApiKey("openrouter");
  if (!apiKey) {
    apiKey = process.env.OPENROUTER_API_KEY;
  }
  
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Add it in Settings → AI & Janitor → API Keys.");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Cabinet Janitor",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "";
  const tokens = data.usage?.total_tokens || 0;

  return { content, tokens };
}

/**
 * Clean up markdown file
 */
export async function cleanupMarkdown(
  filePath: string,
  model: string
): Promise<{ modified: boolean; tokens: number }> {
  try {
    const content = await readFileContent(filePath);
    
    const messages = [
      {
        role: "system",
        content: `You are a markdown cleanup assistant. Clean up the following markdown file:
- Fix formatting issues
- Remove duplicate content
- Improve structure and readability
- Keep the original meaning and content
- Return ONLY the cleaned markdown, no explanations`,
      },
      {
        role: "user",
        content: content,
      },
    ];

    const { content: cleaned, tokens } = await callOpenRouter(model, messages, 2000);
    
    if (cleaned && cleaned !== content) {
      await writeFileContent(filePath, cleaned);
      return { modified: true, tokens };
    }
    
    return { modified: false, tokens };
  } catch (error) {
    console.error(`Failed to cleanup ${filePath}:`, error);
    return { modified: false, tokens: 0 };
  }
}

/**
 * Add tags to markdown file
 */
export async function addTags(
  filePath: string,
  model: string
): Promise<{ modified: boolean; tokens: number }> {
  try {
    const content = await readFileContent(filePath);
    
    // Check if file already has tags in frontmatter
    if (content.startsWith("---")) {
      const endOfFrontmatter = content.indexOf("---", 3);
      if (endOfFrontmatter > 0) {
        const frontmatter = content.substring(0, endOfFrontmatter);
        if (frontmatter.includes("tags:")) {
          return { modified: false, tokens: 0 };
        }
      }
    }
    
    const messages = [
      {
        role: "system",
        content: `Analyze this markdown file and suggest 3-5 relevant tags.
Return ONLY a JSON array of tags, like: ["tag1", "tag2", "tag3"]
Tags should be lowercase, single words or hyphenated phrases.`,
      },
      {
        role: "user",
        content: content,
      },
    ];

    const { content: tagsJson, tokens } = await callOpenRouter(model, messages, 100);
    
    try {
      const tags = JSON.parse(tagsJson);
      if (Array.isArray(tags) && tags.length > 0) {
        // Add tags to frontmatter
        let newContent: string;
        if (content.startsWith("---")) {
          const endOfFrontmatter = content.indexOf("---", 3);
          if (endOfFrontmatter > 0) {
            const frontmatter = content.substring(0, endOfFrontmatter);
            const rest = content.substring(endOfFrontmatter);
            newContent = `${frontmatter}tags: ${JSON.stringify(tags)}\n${rest}`;
          } else {
            newContent = `---\ntags: ${JSON.stringify(tags)}\n---\n${content}`;
          }
        } else {
          newContent = `---\ntags: ${JSON.stringify(tags)}\n---\n${content}`;
        }
        
        await writeFileContent(filePath, newContent);
        return { modified: true, tokens };
      }
    } catch (e) {
      // Failed to parse tags
    }
    
    return { modified: false, tokens };
  } catch (error) {
    console.error(`Failed to add tags to ${filePath}:`, error);
    return { modified: false, tokens: 0 };
  }
}

/**
 * Generate summary for markdown file
 */
export async function generateSummary(
  filePath: string,
  model: string
): Promise<{ modified: boolean; tokens: number }> {
  try {
    const content = await readFileContent(filePath);
    
    // Skip short files
    if (content.length < 500) {
      return { modified: false, tokens: 0 };
    }
    
    // Check if file already has a summary
    if (content.toLowerCase().includes("## summary") || 
        content.toLowerCase().includes("## abstract")) {
      return { modified: false, tokens: 0 };
    }
    
    const messages = [
      {
        role: "system",
        content: `Generate a concise summary (2-3 sentences) for this document.
Return ONLY the summary text, no additional formatting or explanations.`,
      },
      {
        role: "user",
        content: content,
      },
    ];

    const { content: summary, tokens } = await callOpenRouter(model, messages, 200);
    
    if (summary) {
      // Add summary at the top of the file
      const newContent = `## Summary\n\n${summary}\n\n---\n\n${content}`;
      await writeFileContent(filePath, newContent);
      return { modified: true, tokens };
    }
    
    return { modified: false, tokens };
  } catch (error) {
    console.error(`Failed to generate summary for ${filePath}:`, error);
    return { modified: false, tokens: 0 };
  }
}

/**
 * Rank content quality
 */
export async function rankContent(
  filePath: string,
  model: string
): Promise<{ score: number; tokens: number }> {
  try {
    const content = await readFileContent(filePath);
    
    const messages = [
      {
        role: "system",
        content: `Rate the quality of this content on a scale of 1-10.
Consider: clarity, completeness, organization, usefulness.
Return ONLY a number (1-10), no explanations.`,
      },
      {
        role: "user",
        content: content,
      },
    ];

    const { content: scoreStr, tokens } = await callOpenRouter(model, messages, 10);
    
    const score = parseInt(scoreStr.trim(), 10);
    if (!isNaN(score) && score >= 1 && score <= 10) {
      return { score, tokens };
    }
    
    return { score: 5, tokens }; // Default score
  } catch (error) {
    console.error(`Failed to rank ${filePath}:`, error);
    return { score: 5, tokens: 0 };
  }
}

/**
 * Get files to process
 */
export async function getFilesToProcess(limit: number): Promise<string[]> {
  const files: string[] = [];
  
  async function scanDir(dirPath: string) {
    if (files.length >= limit) return;
    
    try {
      const entries = await listDirectory(dirPath);
      
      for (const entry of entries) {
        if (files.length >= limit) break;
        
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip hidden directories and special directories
        if (entry.isDirectory) {
          if (!entry.name.startsWith(".") && 
              entry.name !== "node_modules" &&
              entry.name !== ".agents") {
            await scanDir(fullPath);
          }
        } else if (entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Failed to scan ${dirPath}:`, error);
    }
  }
  
  await scanDir(DATA_DIR);
  return files;
}

/**
 * Run janitor tasks
 */
export async function runJanitor(): Promise<{
  success: boolean;
  filesProcessed: number;
  filesModified: number;
  tokensUsed: number;
  errors: string[];
}> {
  const config = await getJanitorConfig();
  if (!config.enabled) {
    return {
      success: false,
      filesProcessed: 0,
      filesModified: 0,
      tokensUsed: 0,
      errors: ["Janitor is disabled"],
    };
  }

  const stats = await getJanitorStats();
  const files = await getFilesToProcess(config.maxFilesPerRun);
  
  let filesProcessed = 0;
  let filesModified = 0;
  let tokensUsed = 0;
  const errors: string[] = [];

  for (const file of files) {
    if (tokensUsed >= config.maxTokensPerRun) break;
    
    try {
      filesProcessed++;
      
      // Run enabled tasks
      if (config.tasks.cleanup) {
        const result = await cleanupMarkdown(file, config.model);
        if (result.modified) filesModified++;
        tokensUsed += result.tokens;
        
        // Update stats
        const cleanupStat = stats.find(s => s.id === "cleanup");
        if (cleanupStat) {
          cleanupStat.stats.filesProcessed++;
          if (result.modified) cleanupStat.stats.filesModified++;
          cleanupStat.stats.tokensUsed += result.tokens;
        }
      }
      
      if (config.tasks.tagging && tokensUsed < config.maxTokensPerRun) {
        const result = await addTags(file, config.model);
        if (result.modified) filesModified++;
        tokensUsed += result.tokens;
        
        const taggingStat = stats.find(s => s.id === "tagging");
        if (taggingStat) {
          taggingStat.stats.filesProcessed++;
          if (result.modified) taggingStat.stats.filesModified++;
          taggingStat.stats.tokensUsed += result.tokens;
        }
      }
      
      if (config.tasks.summarization && tokensUsed < config.maxTokensPerRun) {
        const result = await generateSummary(file, config.model);
        if (result.modified) filesModified++;
        tokensUsed += result.tokens;
        
        const summaryStat = stats.find(s => s.id === "summarization");
        if (summaryStat) {
          summaryStat.stats.filesProcessed++;
          if (result.modified) summaryStat.stats.filesModified++;
          summaryStat.stats.tokensUsed += result.tokens;
        }
      }
      
      if (config.tasks.ranking && tokensUsed < config.maxTokensPerRun) {
        const result = await rankContent(file, config.model);
        tokensUsed += result.tokens;
        
        const rankingStat = stats.find(s => s.id === "ranking");
        if (rankingStat) {
          rankingStat.stats.filesProcessed++;
          rankingStat.stats.tokensUsed += result.tokens;
        }
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to process ${file}: ${message}`);
    }
  }

  // Save updated stats
  await saveJanitorStats(stats);

  return {
    success: errors.length === 0,
    filesProcessed,
    filesModified,
    tokensUsed,
    errors,
  };
}
