# Cabinet Integration Plan

> Making Cabinet a generic, agent-agnostic memory and knowledge base system.

## Vision

Cabinet becomes the **shared memory layer** for all AI agents. Not tied to Claude, not tied to any runtime. It's a filing cabinet — structured markdown files on disk that any agent can read and write.

```
┌─────────────────────────────────────────────────┐
│                  Cabinet                         │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Pages/   │  │ Agent    │  │ Memory       │  │
│  │ Knowledge│  │ Workspaces│ │ System       │  │
│  │ Base     │  │          │  │ (context,    │  │
│  │ (MD files│  │ (per-    │  │  decisions,  │  │
│  │  on disk)│  │  agent)  │  │  learnings)  │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │         API Layer (agent-agnostic)        │   │
│  │  /api/pages/    /api/agents/  /api/memory/│   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
           ▲              ▲              ▲
           │              │              │
     ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴──────┐
     │  Hermes   │ │  OpenClaw │ │   Codex    │
     │  Agent    │ │  Agent    │ │   Agent    │
     └───────────┘ └───────────┘ └────────────┘
```

## Current Architecture (What Exists)

### Memory System
- **Location:** `.agents/.memory/{slug}/`
- **Files per agent:**
  - `context.md` — recent context entries (timestamped)
  - `decisions.md` — key decisions with reasoning
  - `learnings.md` — long-term insights
- **Heartbeat:** Agents run periodic heartbeats that update memory
- **Persona:** Each agent has a persona (name, emoji, goals, focus areas, channels)

### Knowledge Base
- **Location:** `data/` directory
- **Structure:** Markdown files with YAML frontmatter
- **API:** `/api/pages/[...path]` — CRUD for pages
- **Search:** Full-text search via `/api/search/`

### Provider System (Already Generic)
- **Interface:** `src/lib/agents/provider-interface.ts`
- **Types:** CLI providers (command + args) and API providers
- **Registry:** Dynamic provider registration
- **Current implementations:** claude-code, codex-cli

## What Needs To Change

### Phase 1: Make Memory System Agent-Agnostic

**Current:** Memory is tied to Cabinet's heartbeat/agent system.
**Target:** Any external agent can read/write memory via API.

#### 1.1 Memory API Endpoints

Create REST API for memory operations:

```
GET    /api/memory/:slug/context       — Read agent context
PUT    /api/memory/:slug/context       — Write/update context
GET    /api/memory/:slug/decisions     — Read decisions
PUT    /api/memory/:slug/decisions     — Add decision
GET    /api/memory/:slug/learnings     — Read learnings
PUT    /api/memory/:slug/learnings     — Add learning
GET    /api/memory/:slug               — Full memory dump
POST   /api/memory/:slug/search        — Search agent memory
```

#### 1.2 Memory Sync Protocol

External agents (Hermes, OpenClaw) maintain their own memory locally but sync to Cabinet:

```
Agent (local)                Cabinet (shared)
┌─────────────┐    push     ┌─────────────┐
│ ~/.hermes/  │ ──────────► │ .agents/    │
│ memory/     │             │ .memory/    │
│             │ ◄────────── │             │
│             │    pull     │             │
└─────────────┘             └─────────────┘
```

- **Push:** Agent writes memory entries to Cabinet via API after each session
- **Pull:** Agent reads shared memory from Cabinet at session start
- **Conflict:** Last-write-wins with timestamps (memory entries are append-only)

#### 1.3 Cross-Agent Memory Visibility

Agents can read other agents' memories (configurable per-agent):

```
GET /api/memory/:slug/context?readable_by=other-agent-slug
```

This enables:
- Agent A learns something → Agent B can see it
- Shared context across the team
- Audit trail of all agent knowledge

### Phase 2: Decouple from Claude Runtime

#### 2.1 Provider System

The provider system is already generic. Add new providers:

| Provider ID | Implementation | Purpose |
|-------------|---------------|---------|
| `hermes_local` | CLI wrapper | Runs hermes agent |
| `openclaw_local` | CLI/HTTP | Runs OpenClaw agent |
| `http_agent` | HTTP calls | Any agent with HTTP API |

#### 2.2 Remove Claude-Specific UI

- Settings page should show available providers, not "Claude" specifically
- Onboarding should detect available providers
- Agent creation should list all registered providers

### Phase 3: Multi-Server Support

#### 3.1 Remote Agent Registration

Cabinet can register agents running on other servers:

```json
{
  "slug": "hermes-prod",
  "name": "Hermes Production",
  "provider": "http_agent",
  "endpoint": "http://192.168.1.50:18789",
  "authToken": "...",
  "memorySync": "bidirectional"
}
```

#### 3.2 Memory Federation

Multiple Cabinet instances can sync:

```
Cabinet (main)          Cabinet (remote)
┌────────────┐         ┌────────────┐
│ data/      │ ◄─────► │ data/      │
│ .agents/   │  sync   │ .agents/   │
└────────────┘         └────────────┘
```

## Implementation Order

1. **Memory API** — REST endpoints for read/write/search memory
2. **Hermes provider** — `hermes_local` provider implementation
3. **OpenClaw provider** — `openclaw_local` provider implementation
4. **Memory sync** — Agent ↔ Cabinet bidirectional sync
5. **Multi-server** — Remote agent registration + memory federation

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/agents/provider-interface.ts` | Provider interface (already generic) |
| `src/lib/agents/provider-registry.ts` | Provider registry |
| `src/lib/agents/persona-manager.ts` | Memory read/write functions |
| `src/lib/agents/heartbeat.ts` | Heartbeat + memory update processing |
| `src/app/api/agents/` | Agent API endpoints |
| `src/lib/storage/path-utils.ts` | Path management |

## Principles

1. **Files on disk are the source of truth** — not a database
2. **Markdown is the format** — human and machine readable
3. **Agent-agnostic** — no Claude/OpenAI/Hermes specific code in the core
4. **API-first** — everything accessible via REST
5. **Append-only memory** — never delete, always append with timestamps
6. **Auditable** — every memory change is logged with who/when/what
