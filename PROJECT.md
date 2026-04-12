# PROJECT.md

> **This file is the single source of truth for project state.**
> Update it BEFORE you push. The next person to pull this repo reads this first.

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
