import { NextRequest, NextResponse } from "next/server";
import {
  readMemory,
  writeMemory,
  readPersona,
} from "@/lib/agents/persona-manager";

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
