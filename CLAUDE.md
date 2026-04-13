# CLAUDE.md — Cabinet

## What is this project?

Cabinet is an AI-first self-hosted knowledge base and startup OS. All content lives as markdown files on disk. The web UI provides WYSIWYG editing, a collapsible tree sidebar, drag-and-drop page organization, and an AI panel.

**Core philosophy:** Humans define intent. Agents do the work. The knowledge base is the shared memory between both.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **UI:** Tailwind CSS + shadcn/ui (base-ui based, NOT Radix — no `asChild` prop)
- **Editor:** Tiptap (ProseMirror-based) with markdown roundtrip via HTML intermediate
- **State:** Zustand (tree-store, editor-store, ai-panel-store, app-store)
- **Fonts:** Inter (sans) + JetBrains Mono (code)
- **Icons:** Lucide (no emoji in system chrome)
- **Markdown:** gray-matter (frontmatter), unified/remark (MD→HTML), turndown (HTML→MD)

## Architecture

```
src/
  app/api/tree/              → GET tree structure from /data
  app/api/pages/[...path]/   → GET/PUT/POST/DELETE/PATCH pages
  app/api/upload/[...path]/  → POST file upload to page directory
  app/api/assets/[...path]/  → GET/PUT static file serving + raw file writes
  app/api/search/            → GET full-text search
  app/api/git/               → Git log, diff, commit endpoints
  app/api/ai/render-md/      → POST markdown → HTML conversion
  app/api/memory/            → Agent memory API (read/write/search)
  stores/                    → Zustand (tree, editor, ai-panel, app)
  components/sidebar/        → Tree navigation, drag-and-drop, context menu
  components/editor/         → Tiptap WYSIWYG + toolbar, website/PDF/CSV viewers
  components/ai-panel/       → Right-side AI chat panel (UI only)
  components/search/         → Cmd+K search dialog
  components/layout/         → App shell, header
  lib/storage/               → Filesystem ops (path-utils, page-io, tree-builder)
  lib/markdown/              → MD↔HTML conversion
  lib/git/                   → Git service (auto-commit, history, diff)
  lib/memory/                → Agent memory system (persona, memory files)
server/
  cabinet-daemon.ts          → Background daemon for file watching
data/                        → Content directory (KB pages, agent memory)
```

## Key Rules

1. **No database** — everything is files on disk under `/data`
2. **Pages** are directories with `index.md` + assets, or standalone `.md` files. PDFs and CSVs are also first-class content types.
3. **Frontmatter** (YAML) stores metadata: title, created, modified, tags, icon, order
4. **Path traversal prevention** — all resolved paths must start with DATA_DIR
5. **shadcn/ui uses base-ui** (not Radix) — DialogTrigger, ContextMenuTrigger etc. do NOT have `asChild`
6. **Dark mode default** — theme toggle available, use `next-themes` with `attribute="class"`
7. **Auto-save** — debounced 500ms after last keystroke in editor-store
8. **Version restore** — users can restore any page to a previous git commit via the Version History panel
9. **Embedded apps** — dirs with `index.html` + no `index.md` render as iframes. Add `.app` marker for full-screen mode (sidebar + AI panel auto-collapse)
10. **Linked repos** — `.repo.yaml` in a data dir links it to a Git repo (local path + remote URL). Agents use this to read/search source code in context. See `data/CLAUDE.md` for full spec.

## Memory API

Cabinet provides a shared memory system for AI agents. Memory is stored as markdown files on disk at `data/.agents/.memory/{slug}/`.

### Memory Endpoints

```
GET    /api/memory/:slug               → List memory files
GET    /api/memory/:slug/:file         → Read memory file
PUT    /api/memory/:slug/:file         → Write memory file
POST   /api/memory/:slug/append        → Append to memory file
POST   /api/memory/:slug/search?q=     → Search memory files

# Structured endpoints
GET/PUT /api/memory/:slug/context       → Agent context memory
GET/PUT /api/memory/:slug/decisions     → Agent decisions memory
GET/PUT /api/memory/:slug/learnings     → Agent learnings memory
```

### Memory Structure

```
data/.agents/
  .memory/
    {slug}/
      context.md      → Recent context entries (timestamped)
      decisions.md    → Key decisions with reasoning
      learnings.md    → Long-term insights
  {slug}/
    persona.md        → Agent persona (name, emoji, goals, focus areas)
```

## Commands

```bash
npm run dev          # Start Next.js dev server on localhost:3000
npm run dev:daemon   # Start background daemon for file watching
npm run dev:all      # Start both servers
npm run debug:chrome # Launch Chrome with CDP on localhost:9222 for frontend debugging
npm run build        # Production build
npm run lint         # ESLint
```

## Frontend Debugging

Use `npm run debug:chrome` when you need a debuggable browser session. It launches Chrome or Chromium with `--remote-debugging-port=9222`, opens Cabinet at `http://localhost:3000` by default, and prints the DevTools endpoints:

- `http://127.0.0.1:9222/json/version`
- `http://127.0.0.1:9222/json/list`

This makes it possible to attach over CDP and inspect real DOM, network, and screenshots instead of guessing at frontend state.

## Progress Tracking

After every change you make to this project, append an entry to `PROGRESS.md` using this format:

```
[YYYY-MM-DD] Brief description of what changed in 1-3 sentences.
```

This is mandatory. Do not skip it. The PROGRESS.md file is the changelog for this project.
