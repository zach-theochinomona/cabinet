import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readMemory, writeMemory, readPersona } from "@/lib/agents/persona-manager";
import { readFileContent, fileExists } from "@/lib/storage/fs-operations";

const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml"]);

function sanitizeFileName(file: string): string {
  // No path traversal, no hidden files
  const base = path.basename(file);
  if (base.startsWith(".") || base.includes("..") || base !== file) {
    throw new Error("Invalid file name");
  }
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File extension '${ext}' not allowed. Use: ${[...ALLOWED_EXTENSIONS].join(", ")}`);
  }
  return base;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; file: string }> }
) {
  try {
    const { slug, file } = await params;
    const safeFile = sanitizeFileName(file);

    const persona = await readPersona(slug);
    if (!persona) {
      return NextResponse.json({ error: `Agent '${slug}' not found` }, { status: 404 });
    }

    const content = await readMemory(slug, safeFile);
    const filePath = path.join(".agents", ".memory", slug, safeFile);
    const exists = await fileExists(filePath);

    return NextResponse.json({
      slug,
      file: safeFile,
      content,
      exists,
      size: content.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; file: string }> }
) {
  try {
    const { slug, file } = await params;
    const safeFile = sanitizeFileName(file);

    const persona = await readPersona(slug);
    if (!persona) {
      return NextResponse.json({ error: `Agent '${slug}' not found` }, { status: 404 });
    }

    const body = await req.json();
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "Missing 'content' field" }, { status: 400 });
    }

    await writeMemory(slug, safeFile, body.content);

    return NextResponse.json({
      ok: true,
      slug,
      file: safeFile,
      size: body.content.length,
      modified: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
