import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  readMemory,
  listMemoryFiles,
  readPersona,
} from "@/lib/memory/memory-api";

interface SearchResult {
  file: string;
  line: number;
  match: string;
  context: string;
  score: number;
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

    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Query 'q' must be at least 2 characters" }, { status: 400 });
    }

    const files = await listMemoryFiles(slug);
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);

    for (const file of files) {
      const content = await readMemory(slug, file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        let score = 0;
        let matches = false;

        // Check for exact phrase match (highest score)
        if (lineLower.includes(queryLower)) {
          score += 10;
          matches = true;
        }

        // Check for individual term matches
        for (const term of queryTerms) {
          if (lineLower.includes(term)) {
            score += 2;
            matches = true;
          }
        }

        if (matches) {
          // Get surrounding context (2 lines before/after)
          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(lines.length - 1, i + 2);
          const contextLines = lines.slice(contextStart, contextEnd + 1);
          
          // Highlight matches in context
          const highlightedContext = contextLines.map((line, idx) => {
            const lineNum = contextStart + idx + 1;
            const prefix = lineNum === i + 1 ? ">" : " ";
            return `${prefix}${lineNum}: ${line}`;
          }).join("\n");

          results.push({
            file,
            line: i + 1,
            match: lines[i],
            context: highlightedContext,
            score,
          });
        }
      }
    }

    // Sort by score (highest first), then by file name, then by line number
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });

    // Limit to top 50 results
    const limitedResults = results.slice(0, 50);

    return NextResponse.json({
      slug,
      query,
      totalMatches: results.length,
      returned: limitedResults.length,
      results: limitedResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
