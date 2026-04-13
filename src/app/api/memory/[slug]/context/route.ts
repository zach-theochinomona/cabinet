import { NextRequest, NextResponse } from "next/server";
import { readMemory, writeMemory, readPersona } from "@/lib/memory/memory-api";
import { canReadMemory, canWriteMemory } from "@/lib/memory/memory-permissions";

/**
 * GET /api/memory/:slug/context
 * Read agent context memory file
 * 
 * Query parameters:
 * - readable_by: Agent slug requesting to read this memory
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const readableBy = url.searchParams.get("readable_by");

    const persona = await readPersona(slug);
    if (!persona) {
      return NextResponse.json({ error: `Agent '${slug}' not found` }, { status: 404 });
    }

    // Check permissions if readable_by is specified
    if (readableBy) {
      const canRead = await canReadMemory(slug, readableBy);
      if (!canRead) {
        return NextResponse.json(
          { error: `Agent '${readableBy}' does not have permission to read '${slug}' memory` },
          { status: 403 }
        );
      }
    }

    const content = await readMemory(slug, "context.md");

    return NextResponse.json({
      slug,
      file: "context.md",
      content,
      size: content.length,
      readableBy: readableBy || slug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/memory/:slug/context
 * Write/update agent context memory file
 * 
 * Query parameters:
 * - written_by: Agent slug requesting to write to this memory
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const writtenBy = url.searchParams.get("written_by");

    const persona = await readPersona(slug);
    if (!persona) {
      return NextResponse.json({ error: `Agent '${slug}' not found` }, { status: 404 });
    }

    // Check permissions if written_by is specified
    if (writtenBy) {
      const canWrite = await canWriteMemory(slug, writtenBy);
      if (!canWrite) {
        return NextResponse.json(
          { error: `Agent '${writtenBy}' does not have permission to write to '${slug}' memory` },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "Missing 'content' field" }, { status: 400 });
    }

    await writeMemory(slug, "context.md", body.content);

    return NextResponse.json({
      ok: true,
      slug,
      file: "context.md",
      size: body.content.length,
      modified: new Date().toISOString(),
      writtenBy: writtenBy || slug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
