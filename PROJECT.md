# PROJECT.md

> **This file is the single source of truth for project state.**
> Update it BEFORE you push. The next person to pull this repo reads this first.

## Cleanup (2026-04-13)

### Removed Misleading Documentation
- CLAUDE.md previously mentioned Claude CLI integration for AI editing
- This functionality doesn't exist in the codebase
- Updated CLAUDE.md to reflect actual current state
- Cabinet is now correctly documented as a knowledge base with Memory API

### Current State
- **Knowledge Base**: Markdown files on disk with WYSIWYG editing
- **Memory API**: REST endpoints for agent memory (read/write/search)
- **Git Integration**: Version history and auto-commit
- **NO AI Editing**: No Claude CLI or other AI integration for page editing
- **NO Agent Execution**: Agents connect via Memory API, not built-in execution
## What Is This?

**Cabinet** — The AI-first startup OS where everything lives as markdown files on disk. No database. No vendor lock-in. Self-hosted. Your data never leaves your machine.

Files on disk + AI workspaces + agents with memory. Built by Hila Shmuel, former Engineering Manager at Apple.

Website: runcabinet.com

## Quick Start

```bash
git clone https://github.com/zach-theochinomona/cabinet.git
cd cabinet

# Option A: DevContainer (recommended — Node 22)
# Open in VS Code / Cursor — auto-builds

# Option B: Manual
npm install
npm run dev

# Or use create-cabinet
npx create-cabinet@latest
```

## Current Status

| What | Status | Notes |
|------|--------|-------|
| Core file-based OS | DONE | Markdown files on disk |
| AI workspaces | DONE | |
| Agent memory system | DONE | skills-lock.json |
| CLI | DONE | cli/ |
| Electron desktop | DONE | electron/ |
| Next.js web UI | DONE | src/, next.config.ts |
| Server | DONE | server/ |
| Notifications | DONE | notifications.md |
| Deployment packaging | DONE | deployment-packaging-versioning.md |
| Agent integration | DONE | run-agent.sh, .agents/ |

### Last Agent Working On This
- **Who:** hermes
- **When:** 2026-04-12
- **What:** Made provider UI agent-agnostic — removed hardcoded Claude/Codex references from settings and onboarding; setup steps now come from provider.installSteps

### What Needs To Happen Next
1. 
2. 

## Architecture

```
.
├── src/                    # Next.js web UI
├── server/                 # Backend server
├── cli/                    # CLI tool
├── electron/               # Electron desktop app
├── components.json         # UI component config
├── data/                   # Data storage
├── public/                 # Static assets
├── assets/                 # Branding/assets
├── scripts/                # Build/utility scripts
├── test/                   # Tests
├── next.config.ts          # Next.js config
├── tsconfig.json           # TypeScript config
├── eslint.config.mjs       # ESLint config
├── postcss.config.mjs      # PostCSS config
├── PRD.md                  # Product requirements
├── PROGRESS.md             # Development progress
├── CLAUDE.md               # Claude agent instructions
└── AI-claude-editor.md     # AI editor integration
```

### Key Decisions
- **File-based** — Everything is markdown files on disk, no database
- **Next.js** — Web UI framework
- **Electron** — Desktop app wrapper
- **Self-hosted** — Data never leaves your machine
- **AI-native** — Built-in agent workspaces with memory

## Environment

| Setting | Value |
|---------|-------|
| Node.js | 22 |
| Framework | Next.js + Electron |
| Data | Markdown files on disk |
| Docker | Yes (devcontainer) |

---

> **RULE: Never leave this file stale. If you touched the code, update this file.**

## Recent Changes (2026-04-13)

### Memory API Enhancements

#### New Structured Endpoints
- `GET/PUT /api/memory/:slug/context` - Agent context memory (read/write)
- `GET/PUT /api/memory/:slug/decisions` - Agent decisions memory (read/write)
- `GET/PUT /api/memory/:slug/learnings` - Agent learnings memory (read/write)

These endpoints provide structured access to the three core memory types defined in the integration plan:
- **Context**: Recent context entries (timestamped)
- **Decisions**: Key decisions with reasoning
- **Learnings**: Long-term insights

#### Improved Search API
- Added relevance scoring system:
  - Exact phrase match: 10 points
  - Individual term match: 2 points each
- Added multi-term search support (searches for all terms)
- Added highlighted context with line numbers
- Results sorted by score (highest first), then file name, then line number
- Limited to top 50 results for performance
- Added `returned` field to show how many results were returned vs total matches

#### Search Response Format
```json
{
  "slug": "agent-name",
  "query": "search terms",
  "totalMatches": 42,
  "returned": 50,
  "results": [
    {
      "file": "context.md",
      "line": 15,
      "match": "The actual matching line",
      "context": ">14: Previous line
>15: The actual matching line
>16: Next line",
      "score": 10
    }
  ]
}
```

### Integration Progress
These changes align with Phase 1 of the Cabinet integration plan: "Make Memory System Agent-agnostic". External agents (Hermes, OpenClaw, etc.) can now:
1. Read/write structured memory files via API
2. Search memory with improved relevance ranking
3. Use dedicated endpoints for context, decisions, and learnings
