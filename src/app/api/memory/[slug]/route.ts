import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import {
  readMemory,
  writeMemory,
  listMemoryFiles,
  readPersona,
} from "@/lib/agents/persona-manager";
import { DATA_DIR } from "@/lib/storage/path-utils";

const MEMORY_DIR = path.join(DATA_DIR, ".agents", ".memory");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const persona = await readPersona(slug);
    if (!persona) {
      return NextResponse.json({ error: `Agent '${slug}' not found` }, { status: 404 });
    }

    const url = new URL(req.url);
    const isExport = url.searchParams.get("export") === "true";

    if (isExport) {
      // Full export — all memory files
      const files = await listMemoryFiles(slug);
      const exports: Record<string, string> = {};
      for (const file of files) {
        exports[file] = await readMemory(slug, file);
      }
      return NextResponse.json({
        slug,
        exportedAt: new Date().toISOString(),
        files: exports,
      });
    }

    // List files with metadata
    const files = await listMemoryFiles(slug);
    const memDir = path.join(MEMORY_DIR, slug);
    const fileDetails = await Promise.all(
      files.map(async (name) => {
        const filePath = path.join(memDir, name);
        const stat = await fs.stat(filePath).catch(() => null);
        return {
          name,
          size: stat?.size ?? 0,
          modified: stat?.mtime.toISOString() ?? null,
        };
      })
    );

    return NextResponse.json({
      slug,
      files: fileDetails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const persona = await readPersona(slug);
    if (!persona) {
      return NextResponse.json({ error: `Agent '${slug}' not found` }, { status: 404 });
    }

    const body = await req.json();

    // Append mode: { file: "context.md", entry: "..." }
    if (body.file && body.entry) {
      const file = body.file as string;
      if (!file.endsWith(".md") && !file.endsWith(".txt")) {
        return NextResponse.json({ error: "Only .md and .txt files supported for append" }, { status: 400 });
      }

      const timestamp = new Date().toISOString();
      const existing = await readMemory(slug, file);
      const appendBlock = existing
        ? `\n\n## ${timestamp}\n${body.entry}`
        : `## ${timestamp}\n${body.entry}`;

      await writeMemory(slug, file, existing + appendBlock);

      return NextResponse.json({
        ok: true,
        slug,
        file,
        timestamp,
        appended: body.entry.length,
      });
    }

    return NextResponse.json(
      { error: "Missing 'file' and 'entry' fields for append" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
