# Plan: Cabinet Memory API Endpoints

> First step in making Cabinet a generic, agent-agnostic memory backend.

## Goal

Create REST API endpoints so any agent (Hermes, OpenClaw, etc.) can read and write memory to Cabinet via HTTP, without running inside Cabinet's process.

## Current State

- Memory functions exist internally in `src/lib/agents/persona-manager.ts`:
  - `readMemory(slug, file)` — reads a memory file
  - `writeMemory(slug, file, content)` — writes a memory file
  - `listMemoryFiles(slug)` — lists files in agent's memory dir
- Memory stored at `.agents/.memory/{slug}/` on disk
- Standard files: `context.md`, `decisions.md`, `learnings.md`
- **No API endpoints exist** — only called internally by heartbeat system
- Auth middleware already protects `/api/*` routes

## Proposed API

### Endpoints

```
GET    /api/memory/:slug                    — List memory files + metadata
GET    /api/memory/:slug/:file              — Read a specific memory file
PUT    /api/memory/:slug/:file              — Write/update a memory file
POST   /api/memory/:slug/append             — Append to a memory file (with timestamp)
GET    /api/memory/:slug/export             — Full memory dump (all files)
POST   /api/memory/:slug/search?q=keyword   — Search within memory files
```

### Request/Response Examples

**GET /api/memory/hermes-prod**
```json
{
  "slug": "hermes-prod",
  "files": [
    { "name": "context.md", "size": 2048, "modified": "2026-04-12T10:00:00Z" },
    { "name": "decisions.md", "size": 512, "modified": "2026-04-11T15:00:00Z" },
    { "name": "learnings.md", "size": 1024, "modified": "2026-04-10T12:00:00Z" }
  ]
}
```

**GET /api/memory/hermes-prod/context.md**
```json
{
  "slug": "hermes-prod",
  "file": "context.md",
  "content": "## 2026-04-12T10:00:00Z\nWorked on tender PDF filler...\n## 2026-04-11T10:00:00Z\nFixed auth bug...",
  "modified": "2026-04-12T10:00:00Z",
  "size": 2048
}
```

**PUT /api/memory/hermes-prod/context.md**
```json
Request: { "content": "## 2026-04-12T12:00:00Z\nNew entry..." }
Response: { "ok": true, "size": 2100, "modified": "2026-04-12T12:00:00Z" }
```

**POST /api/memory/hermes-prod/append**
```json
Request: { "file": "context.md", "entry": "Fixed bug in PDF alignment" }
Response: { "ok": true, "timestamp": "2026-04-12T12:00:00Z" }
```
Appends with automatic timestamp heading: `\n\n## {timestamp}\n{entry}`

**GET /api/memory/hermes-prod/export**
```json
{
  "slug": "hermes-prod",
  "exportedAt": "2026-04-12T12:00:00Z",
  "files": {
    "context.md": "...full content...",
    "decisions.md": "...full content...",
    "learnings.md": "...full content..."
  }
}
```

**POST /api/memory/hermes-prod/search?q=PDF**
```json
{
  "query": "PDF",
  "results": [
    { "file": "context.md", "line": 15, "match": "...worked on PDF filler..." },
    { "file": "learnings.md", "line": 3, "match": "...PyMuPDF is the only way..." }
  ]
}
```

## Step-by-Step Plan

### Step 1: Create memory read endpoint
- **File:** `src/app/api/memory/[slug]/[file]/route.ts`
- **Method:** GET
- **Logic:** Import `readMemory` + `listMemoryFiles` from persona-manager
- **Validation:** Sanitize file name (no path traversal), check slug exists
- **Auth:** Inherits from middleware (already protects /api/*)

### Step 2: Create memory write endpoint
- **File:** Same as above, add PUT handler
- **Method:** PUT
- **Logic:** Import `writeMemory` from persona-manager
- **Validation:** File name whitelist (context.md, decisions.md, learnings.md, or any .md)
- **Body:** `{ "content": "..." }`

### Step 3: Create memory list endpoint
- **File:** `src/app/api/memory/[slug]/route.ts`
- **Method:** GET
- **Logic:** List all memory files with size + modified timestamp
- **Returns:** File metadata array

### Step 4: Create memory append endpoint
- **File:** Same as step 3, add POST handler
- **Method:** POST
- **Logic:** Read existing content, append with timestamp heading, write back
- **Body:** `{ "file": "context.md", "entry": "..." }`
- **This is the most useful endpoint for agents** — single call to add a memory entry

### Step 5: Create memory export endpoint
- **File:** Same as step 3, add GET with `?export=true` or separate path
- **Logic:** Read all files, return as JSON object

### Step 6: Create memory search endpoint
- **File:** `src/app/api/memory/[slug]/search/route.ts`
- **Method:** POST or GET with query param
- **Logic:** Read all memory files, search for query string, return matches with context
- **Simple implementation:** Line-by-line string matching (no need for FTS5 here)

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/memory/[slug]/route.ts` | List files, export all |
| `src/app/api/memory/[slug]/[file]/route.ts` | Read/write single file |
| `src/app/api/memory/[slug]/search/route.ts` | Search memory |
| `src/app/api/memory/[slug]/append/route.ts` | Append with timestamp |

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/agents/persona-manager.ts` | Export `readMemory`, `writeMemory`, `listMemoryFiles` if not already exported |

## Validation & Security

- **File name sanitization:** Only allow alphanumeric, hyphens, dots, underscores. No `..`, no `/`
- **Slug validation:** Agent must exist (check persona exists)
- **Auth:** Already handled by middleware (KB_PASSWORD)
- **Rate limiting:** Consider adding for write endpoints

## Testing

1. Start Cabinet dev server: `npm run dev`
2. Create an agent: `POST /api/agents/personas`
3. Test read: `GET /api/memory/{slug}/context.md` — should return empty or existing content
4. Test write: `PUT /api/memory/{slug}/context.md` with `{ "content": "test" }`
5. Test append: `POST /api/memory/{slug}/append` with `{ "file": "context.md", "entry": "test entry" }`
6. Test search: `POST /api/memory/{slug}/search?q=test`
7. Test list: `GET /api/memory/{slug}` — should show files with metadata
8. Test export: `GET /api/memory/{slug}/export` — should return all files

## Risks & Open Questions

- **Concurrent writes:** If two agents write to the same file simultaneously, last write wins. Acceptable for now (memory is append-oriented).
- **Large files:** No size limits yet. Should add a reasonable cap (e.g., 1MB per file).
- **Auth granularity:** Currently all-or-nothing (KB_PASSWORD). Future: per-agent API tokens.
- **Path traversal:** Must validate file names strictly — this is a security boundary.

## What Comes After

Once Memory API is done, the next step is:
- Create a Hermes skill that syncs local memory to Cabinet via these endpoints
- Create an OpenClaw integration that does the same
- Wire Paperclip to show agent memory from Cabinet
