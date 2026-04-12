import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  readMemory,
  listMemoryFiles,
  readPersona,
} from "@/lib/memory/memory-api";

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

    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Query 'q' must be at least 2 characters" }, { status: 400 });
    }

    const files = await listMemoryFiles(slug);
    const results: Array<{ file: string; line: number; match: string }> = [];
    const queryLower = query.toLowerCase();

    for (const file of files) {
      const content = await readMemory(slug, file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          // Include surrounding context (1 line before/after)
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 1);
          const context = lines.slice(start, end + 1).join("\n");
          results.push({
            file,
            line: i + 1,
            match: context,
          });
        }
      }
    }

    return NextResponse.json({
      slug,
      query,
      totalMatches: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
