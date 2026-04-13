import { NextRequest, NextResponse } from "next/server";
import { readMemory, writeMemory, readPersona } from "@/lib/memory/memory-api";

/**
 * GET /api/memory/:slug/context
 * Read agent context memory file
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const persona = await readPersona(slug);
    if (!persona) {
      return NextResponse.json({ error: `Agent '${slug}' not found` }, { status: 404 });
    }

    const content = await readMemory(slug, "context.md");

    return NextResponse.json({
      slug,
      file: "context.md",
      content,
      size: content.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/memory/:slug/context
 * Write/update agent context memory file
 */
export async function PUT(
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
