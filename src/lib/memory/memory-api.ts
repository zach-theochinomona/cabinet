/**
 * Memory API — pure filesystem operations for agent memory files.
 * Extracted from persona-manager.ts (agent runtime removed).
 */
import path from "path";
import matter from "gray-matter";
import { DATA_DIR } from "@/lib/storage/path-utils";
import {
  readFileContent,
  writeFileContent,
  fileExists,
  ensureDirectory,
  listDirectory,
} from "@/lib/storage/fs-operations";

const AGENTS_DIR = path.join(DATA_DIR, ".agents");
const MEMORY_DIR = path.join(AGENTS_DIR, ".memory");

// ---------------------------------------------------------------------------
// Persona (lightweight — only what memory API needs for existence checks)
// ---------------------------------------------------------------------------

export interface AgentPersona {
  name: string;
  slug: string;
  body: string;
}

export async function readPersona(slug: string): Promise<AgentPersona | null> {
  // Try directory-based first: {slug}/persona.md
  let filePath = path.join(AGENTS_DIR, slug, "persona.md");
  if (!(await fileExists(filePath))) {
    // Fall back to legacy flat file: {slug}.md
    filePath = path.join(AGENTS_DIR, `${slug}.md`);
    if (!(await fileExists(filePath))) return null;
  }

  const raw = await readFileContent(filePath);
  const { data, content } = matter(raw);

  return {
    name: (data.name as string) || slug,
    slug,
    body: content.trim(),
  };
}

export async function writePersona(
  slug: string,
  persona: Partial<AgentPersona> & { body?: string }
): Promise<void> {
  await ensureDirectory(AGENTS_DIR);
  const agentDir = path.join(AGENTS_DIR, slug);
  await ensureDirectory(agentDir);
  const filePath = path.join(agentDir, "persona.md");

  const existing = await readPersona(slug);
  const merged = { ...existing, ...persona };

  const frontmatter: Record<string, unknown> = {
    name: merged.name || slug,
  };

  const md = matter.stringify(merged.body || "", frontmatter);
  await writeFileContent(filePath, md);
}

// ---------------------------------------------------------------------------
// Memory files
// ---------------------------------------------------------------------------

export async function readMemory(slug: string, file: string): Promise<string> {
  const memDir = path.join(MEMORY_DIR, slug);
  await ensureDirectory(memDir);
  const filePath = path.join(memDir, file);
  if (!(await fileExists(filePath))) return "";
  return readFileContent(filePath);
}

export async function writeMemory(
  slug: string,
  file: string,
  content: string
): Promise<void> {
  const memDir = path.join(MEMORY_DIR, slug);
  await ensureDirectory(memDir);
  await writeFileContent(path.join(memDir, file), content);
}

export async function listMemoryFiles(slug: string): Promise<string[]> {
  const memDir = path.join(MEMORY_DIR, slug);
  await ensureDirectory(memDir);
  const entries = await listDirectory(memDir);
  return entries.filter((e) => !e.isDirectory).map((e) => e.name);
}

export { AGENTS_DIR, MEMORY_DIR };
