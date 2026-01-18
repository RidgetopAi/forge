# Forge Contract

**Version**: 1.0.0
**Date**: 2025-01-17
**Status**: LOCKED - Ready for Implementation
**Repo**: `~/projects/forge/` | `git@github.com:RidgetopAi/forge.git`
**Mandrel Project**: `forge`

---

## 1. Overview

### 1.1 Purpose

Forge orchestrates Claude Code (CC) in iterative instance loops (SIRK pattern) with real-time thinking block visualization (Spindles), integrated into Ridge-Control.

### 1.2 Components

| Component | Language | Location | Role |
|-----------|----------|----------|------|
| Ridge-Control | Rust | `~/projects/ridge-control/` | UI, orchestration trigger, activity stream display |
| Forge | TypeScript | `~/projects/forge/` | Instance loop management, state, CC spawning |
| Spindles-Proxy | TypeScript | `~/projects/forge/spindles-proxy/` | API interception, activity extraction, WebSocket broadcast |
| Claude Code | N/A | System binary | AI execution (subscription-based, headless) |
| Mandrel | TypeScript | VPS (via HTTP bridge) | Context persistence across instances |

### 1.3 Execution Model

- **Headless CC**: Claude Code runs as a subprocess, not interactive terminal
- **Full Activity Stream**: Proxy captures thinking blocks + tool calls + results + text
- **Ridge-Control Visibility**: Users see real-time activity via WebSocket stream in TUI

### 1.4 Design Principles

1. **Fresh instances**: Each CC invocation is isolated - no `--continue`, no chat history
2. **Mandrel is memory**: All cross-instance continuity via Mandrel context
3. **Forge owns the loop**: Ridge-control triggers, Forge orchestrates
4. **Activity streams in real-time**: WebSocket broadcast, not polling
5. **Fail fast on Mandrel**: If Mandrel unavailable, abort run
6. **Retry on CC failure**: Single instance failure triggers retry, not abort

---

## 2. Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ USER ACTION: Clicks [Start] in Ridge-Control SIRK Panel                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. RIDGE-CONTROL                                                        │
│    a. Validates config (run name, seed path, instance count)            │
│    b. Connects to Spindles-Proxy WebSocket (ws://localhost:8083)        │
│    c. Spawns Forge subprocess with config JSON via stdin                │
│    d. Listens to Forge stdout for progress events                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. FORGE (per instance loop)                                            │
│    a. Reads config from stdin                                           │
│    b. Loads/increments StateManager counter                             │
│    c. Checks Mandrel health (fail fast if down)                         │
│    d. Constructs prompt with instance number, run name, seed path       │
│    e. Spawns CC subprocess with environment:                            │
│       - ANTHROPIC_BASE_URL=http://localhost:8082                        │
│       - Working dir: ~/projects/                                        │
│    f. Waits for CC completion                                           │
│    g. On success: emit progress event, continue loop                    │
│    h. On failure: retry once, then emit error event                     │
│    i. On loop complete: emit completion event                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. CLAUDE CODE                                                          │
│    a. Receives prompt via -p flag                                       │
│    b. Reads seed document from specified path                           │
│    c. Calls Mandrel tools (context_get_recent, context_store, etc.)     │
│    d. Performs task work                                                │
│    e. Stores handoff context to Mandrel                                 │
│    f. Exits                                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. SPINDLES-PROXY (concurrent with CC execution)                        │
│    a. Intercepts CC API calls                                           │
│    b. Extracts thinking blocks from SSE stream                          │
│    c. Enriches with metadata (run name, instance number from header)    │
│    d. Broadcasts to all WebSocket clients                               │
│    e. Writes to spindles.jsonl (existing behavior preserved)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. RIDGE-CONTROL (receives)                                             │
│    a. WebSocket receives spindle messages                               │
│    b. Updates Spindles pane in TUI                                      │
│    c. Forge stdout receives progress events                             │
│    d. Updates SIRK panel status                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Schemas

### 3.1 Forge Config (stdin JSON)

Ridge-control sends this to Forge via stdin when spawning.

```typescript
interface ForgeConfig {
  mode: "cc";                    // "cc" for Claude Code, "api" for existing API mode
  run: {
    name: string;                // User-provided run name, e.g., "auth-refactor-v2"
    seedDocPath: string;         // Absolute path to seed document
    instanceCount: number;       // Total instances to run (1-100)
    project: string;             // Mandrel project name
  };
  cc: {
    workingDir: string;          // Working directory for CC, default "~/projects/"
    flags: string[];             // Additional CC flags, default ["--dangerously-skip-permissions"]
    model?: string;              // Optional model override (uses CC default if omitted)
  };
  proxy: {
    baseUrl: string;             // Spindles proxy URL, default "http://localhost:8082"
  };
  mandrel: {
    baseUrl: string;             // Mandrel HTTP bridge, default "http://localhost:8080"
    healthCheckRequired: boolean; // Fail fast if Mandrel down, default true
  };
}
```

**Example:**
```json
{
  "mode": "cc",
  "run": {
    "name": "auth-refactor-v2",
    "seedDocPath": "/home/ridgetop/docs/auth-seed.md",
    "instanceCount": 10,
    "project": "ridge-control"
  },
  "cc": {
    "workingDir": "/home/ridgetop/projects/",
    "flags": ["--dangerously-skip-permissions"]
  },
  "proxy": {
    "baseUrl": "http://localhost:8082"
  },
  "mandrel": {
    "baseUrl": "http://localhost:8080",
    "healthCheckRequired": true
  }
}
```

### 3.2 Forge Progress Events (stdout JSONL)

Forge emits newline-delimited JSON to stdout. Ridge-control parses these.

```typescript
type ForgeEvent =
  | ForgeRunStarted
  | ForgeInstanceStarted
  | ForgeInstanceCompleted
  | ForgeInstanceFailed
  | ForgeInstanceRetrying
  | ForgeRunCompleted
  | ForgeRunFailed
  | ForgeRunAborted;

interface ForgeRunStarted {
  type: "run_started";
  timestamp: string;           // ISO 8601
  runName: string;
  instanceCount: number;
  seedDocPath: string;
  project: string;
}

interface ForgeInstanceStarted {
  type: "instance_started";
  timestamp: string;
  runName: string;
  instanceNumber: number;      // 1-indexed
  totalInstances: number;
}

interface ForgeInstanceCompleted {
  type: "instance_completed";
  timestamp: string;
  runName: string;
  instanceNumber: number;
  totalInstances: number;
  durationMs: number;
  ccExitCode: number;
  ccOutput?: string;           // Final CC output (truncated if > 10KB)
}

interface ForgeInstanceFailed {
  type: "instance_failed";
  timestamp: string;
  runName: string;
  instanceNumber: number;
  totalInstances: number;
  error: string;
  willRetry: boolean;
}

interface ForgeInstanceRetrying {
  type: "instance_retrying";
  timestamp: string;
  runName: string;
  instanceNumber: number;
  totalInstances: number;
  attempt: number;             // 1 = first retry
  maxAttempts: number;         // Default 2 (original + 1 retry)
}

interface ForgeRunCompleted {
  type: "run_completed";
  timestamp: string;
  runName: string;
  instancesCompleted: number;
  totalDurationMs: number;
}

interface ForgeRunFailed {
  type: "run_failed";
  timestamp: string;
  runName: string;
  instanceNumber: number;      // Which instance caused failure
  error: string;
  reason: "max_retries" | "mandrel_unavailable" | "unknown";
}

interface ForgeRunAborted {
  type: "run_aborted";
  timestamp: string;
  runName: string;
  instanceNumber: number;      // Which instance was running
  reason: "user_requested" | "signal";
}
```

### 3.3 Activity Stream WebSocket Messages

Spindles-proxy broadcasts a simplified activity stream to all connected WebSocket clients.
This captures the full CC execution: thinking, tool calls, results, and text output.

```typescript
// Activity message types - one union for all CC activity
type ActivityMessage =
  | ThinkingActivity
  | ToolCallActivity
  | ToolResultActivity
  | TextActivity
  | ErrorActivity;

interface ThinkingActivity {
  type: "thinking";
  text: string;                  // Thinking block content
  timestamp: string;             // ISO 8601
  runName: string;
  instance: number;              // 1-indexed
}

interface ToolCallActivity {
  type: "tool_call";
  name: string;                  // Tool name (e.g., "edit_file", "Read", "Bash")
  params: object;                // Tool input parameters
  timestamp: string;
  runName: string;
  instance: number;
}

interface ToolResultActivity {
  type: "tool_result";
  name: string;                  // Tool name
  success: boolean;              // Did the tool succeed?
  output?: string;               // Truncated output (max 1KB)
  timestamp: string;
  runName: string;
  instance: number;
}

interface TextActivity {
  type: "text";
  text: string;                  // Assistant text response
  timestamp: string;
  runName: string;
  instance: number;
}

interface ErrorActivity {
  type: "error";
  message: string;               // Error description
  timestamp: string;
  runName: string;
  instance: number;
}

// Connection acknowledgment
interface ActivityConnectionAck {
  type: "connected";
  timestamp: string;
  clientId: string;              // Server-assigned client ID
  message: string;               // "Connected to Activity Stream"
}
```

**Ridge-Control Rendering:**

| Activity Type | Display Format |
|---------------|----------------|
| `thinking` | Italic, muted color, with timestamp |
| `tool_call` | Icon + tool name + collapsed params |
| `tool_result` | Success/failure icon + output preview |
| `text` | Normal text, primary color |
| `error` | Error icon, red, bold |

### 3.4 CC Invocation

Forge spawns CC as a headless subprocess with this pattern:

```bash
ANTHROPIC_BASE_URL=http://localhost:8082 \
claude \
  --dangerously-skip-permissions \
  -p "<prompt content here>"
```

**Prompt Template (LOCKED):**

```
You are instance {n} of {total} in SIRK run "{runName}".

Read the seed document at: {seedPath}

## Your Protocol
1. Call Mandrel context_get_recent to retrieve handoff from previous instance
2. Continue work as defined in the seed document
3. Store your handoff to Mandrel (context_store with type "handoff") before finishing

Project: {project}
```

**Template Variables:**

| Variable | Source | Example |
|----------|--------|---------|
| `{n}` | Current instance number (1-indexed) | `5` |
| `{total}` | Total instances in run | `10` |
| `{runName}` | From ForgeConfig.run.name | `auth-refactor-v2` |
| `{seedPath}` | From ForgeConfig.run.seedDocPath | `/home/ridgetop/projects/forge/seeds/my-task.md` |
| `{project}` | From ForgeConfig.run.project | `ridge-control` |

**SIRK Session Context:**

Before spawning each CC instance, Forge calls the proxy to set session context:

```
POST http://localhost:8082/sirk/session
{
  "runName": "auth-refactor-v2",
  "instanceNumber": 5,
  "totalInstances": 10,
  "project": "ridge-control"
}
```

This context is attached to all activity messages broadcast via WebSocket.

### 3.5 Mandrel Context Tags Convention

When CC stores context to Mandrel, it should use these tags:

```typescript
// Handoff context
context_store({
  content: "Instance 5 completed: Implemented token refresh...",
  type: "handoff",
  tags: [
    "sirk",
    "run:auth-refactor-v2",
    "instance:5"
  ]
});

// Other context types
context_store({
  content: "Decided to use JWT refresh tokens because...",
  type: "decision",
  tags: [
    "sirk",
    "run:auth-refactor-v2",
    "instance:5"
  ]
});
```

---

## 4. Endpoints

### 4.1 Spindles-Proxy Additions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `ws://localhost:8083/spindles` | WebSocket | Real-time spindle broadcast |
| `POST /sirk/session` | HTTP | Set current SIRK session context |
| `GET /sirk/session` | HTTP | Get current SIRK session context |
| `DELETE /sirk/session` | HTTP | Clear SIRK session context |

#### WebSocket: `/spindles`

- **Connection**: Client connects, receives `SpindleConnectionAck`
- **Messages**: Server broadcasts `SpindleMessage` for each thinking block
- **No client-to-server messages required** (unidirectional)
- **Reconnection**: Client should implement auto-reconnect

#### POST `/sirk/session`

Sets the current SIRK session context. All subsequent spindles are tagged with this.

**Request:**
```json
{
  "runName": "auth-refactor-v2",
  "instanceNumber": 5,
  "totalInstances": 10,
  "project": "ridge-control"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "uuid-here"
}
```

#### GET `/sirk/session`

Returns current SIRK session context.

**Response:**
```json
{
  "active": true,
  "runName": "auth-refactor-v2",
  "instanceNumber": 5,
  "totalInstances": 10,
  "project": "ridge-control",
  "startedAt": "2025-01-16T10:30:00Z"
}
```

#### DELETE `/sirk/session`

Clears SIRK session context (call when run completes or aborts).

**Response:**
```json
{
  "success": true
}
```

### 4.2 Mandrel Health Check

Forge calls this before starting a run:

```
POST http://localhost:8080/mcp/tools/mandrel_ping
{"arguments": {}}
```

Expected response indicates Mandrel is healthy. Any error = abort run.

---

## 5. State Management

### 5.1 Forge StateManager

Location: `~/forge/state/{project}-{runName}.json`

```typescript
interface SirkState {
  runName: string;
  project: string;
  lastInstanceCompleted: number;  // 0 if none completed
  totalInstances: number;
  status: "running" | "completed" | "failed" | "aborted";
  startedAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
  instances: InstanceRecord[];
}

interface InstanceRecord {
  instanceNumber: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  retryCount: number;
}
```

### 5.2 Recovery Flow

On crash recovery (user restarts ridge-control):

1. User selects "Resume Run" in SIRK panel
2. Ridge-control spawns Forge with `resume: true` in config
3. Forge loads state file
4. Forge prompts ridge-control (via stdout event) with recovery options
5. Ridge-control displays to user: "Run 'auth-refactor-v2' was interrupted at instance 5/10. Resume from instance 6?"
6. User confirms
7. Forge continues from `lastInstanceCompleted + 1`

**Resume config addition:**
```typescript
interface ForgeConfig {
  // ... existing fields
  resume?: boolean;              // If true, attempt to resume existing run
}
```

**Resume event:**
```typescript
interface ForgeResumePrompt {
  type: "resume_prompt";
  timestamp: string;
  runName: string;
  lastInstanceCompleted: number;
  totalInstances: number;
  question: string;              // "Resume from instance 6?"
}

// Ridge-control responds via stdin:
interface ForgeResumeResponse {
  type: "resume_response";
  resume: boolean;               // true = continue, false = abort
}
```

---

## 6. Error Handling

### 6.1 Error Categories

| Category | Behavior |
|----------|----------|
| Mandrel unavailable | Fail fast, abort run |
| CC crash/timeout | Retry once, then fail instance |
| Instance retry exhausted | Fail run (don't continue to next instance) |
| Spindles-proxy down | Log warning, continue run (spindles not critical) |
| WebSocket disconnect | Ridge-control auto-reconnects, no impact on run |
| User abort (Ctrl+C) | Graceful shutdown, save state, emit aborted event |

### 6.2 Retry Logic

```typescript
const RETRY_CONFIG = {
  maxAttempts: 2,        // Original + 1 retry
  delayMs: 5000,         // 5 second delay before retry
  backoffMultiplier: 1,  // No exponential backoff (fixed delay)
};
```

### 6.3 Timeout

CC execution timeout: **30 minutes** per instance (configurable)

```typescript
interface ForgeConfig {
  // ... existing fields
  timeouts?: {
    instanceMs?: number;   // Default 1800000 (30 min)
  };
}
```

---

## 7. Ridge-Control UI Specification

### 7.1 SIRK Panel

```
┌─ SIRK ──────────────────────────────────────────────────┐
│                                                         │
│  Run Name:    [auth-refactor-v2____________]            │
│  Seed Doc:    [~/docs/auth-seed.md_________] [Browse]   │
│  Instances:   [10__]                                    │
│  Project:     [ridge-control_______________]            │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Status: Instance 5/10 running                   │    │
│  │ Duration: 12m 34s                               │    │
│  │ Current instance: 2m 15s                        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [Start]  [Stop]  [Resume]                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Activity Stream Pane

```
┌─ Activity Stream ───────────────────────────────────────┐
│ auth-refactor-v2 | Instance 5/10                        │
├─────────────────────────────────────────────────────────┤
│ [10:32:15] 💭 Let me analyze the handoff from instance  │
│               4. The previous instance completed the    │
│               JWT validation logic...                   │
│                                                         │
│ [10:32:18] 📖 Read src/auth/tokens.rs (245 lines)       │
│                                                         │
│ [10:32:20] 💭 The current implementation has a race     │
│               condition. I need to add a mutex...       │
│                                                         │
│ [10:32:24] ✏️  edit_file src/auth/tokens.rs             │
│            - let token = cache.get()                    │
│            + let token = cache.get_or_refresh()         │
│                                                         │
│ [10:32:25] ✅ edit_file succeeded                        │
│                                                         │
│ [10:32:26] 🔧 Bash: cargo check                         │
│                                                         │
│ ▼ Auto-scroll enabled                                   │
└─────────────────────────────────────────────────────────┘
```

**Legend:**
- 💭 = Thinking block (italic, muted)
- 📖 = Read tool call
- ✏️ = edit_file tool call (shows diff preview)
- 🔧 = Bash tool call
- ✅ = Tool result success
- ❌ = Tool result failure

### 7.3 Commands (Command Palette)

| Command | Action |
|---------|--------|
| `sirk_start` | Start SIRK run with current config |
| `sirk_stop` | Stop current SIRK run |
| `sirk_resume` | Resume interrupted run |
| `sirk_panel_toggle` | Toggle SIRK panel visibility |
| `activity_stream_toggle` | Toggle Activity Stream pane visibility |
| `activity_stream_clear` | Clear Activity Stream pane |
| `activity_stream_scroll_toggle` | Toggle auto-scroll |

---

## 8. Implementation Phases

### Phase 1: Spindles-Proxy (Build from Scratch)

**Location:** `~/projects/forge/spindles-proxy/`
**Reference:** `~/aidis/spindles-proxy/PHASE_2_DESIGN.md` (design docs only)

1. Create TypeScript project with Express + ws
2. Implement Anthropic API proxy (intercept & forward)
3. Parse SSE stream for content blocks (thinking, tool_use, tool_result, text)
4. Implement `/sirk/session` REST endpoints
5. Implement WebSocket server on port 8083
6. Broadcast ActivityMessage for each parsed block
7. Test with curl and simple WebSocket client

**Acceptance criteria:**
- [ ] Proxy forwards requests to Anthropic API correctly
- [ ] SSE stream parsing extracts all content block types
- [ ] POST `/sirk/session` sets context for broadcasts
- [ ] WebSocket server accepts connections on 8083
- [ ] Activity messages include runName, instance from session
- [ ] Multiple clients receive broadcasts simultaneously

### Phase 2: Forge Core

**Location:** `~/projects/forge/`

1. Initialize TypeScript project
2. Implement config parsing (stdin JSON)
3. Implement Mandrel health check (HTTP bridge)
4. Implement prompt template rendering
5. Implement CC subprocess spawning with env vars
6. Implement progress event emission (stdout JSONL)
7. Implement SIRK session API calls to proxy
8. Implement retry logic (1 retry, 5s delay)
9. Implement StateManager (JSON file persistence)
10. Implement resume flow

**Acceptance criteria:**
- [ ] Reads config from stdin correctly
- [ ] Fails fast if Mandrel unavailable
- [ ] Spawns CC with `ANTHROPIC_BASE_URL` and `--dangerously-skip-permissions`
- [ ] Emits all ForgeEvent types to stdout
- [ ] Retries failed instances once
- [ ] Saves/loads state for recovery
- [ ] Resume continues from correct instance

### Phase 3: Ridge-Control Integration

**Location:** `~/projects/ridge-control/`
**Leverages:** Existing `StreamClient`, `StreamViewer`, `LLM types`

1. Add SIRK panel component (config inputs + status)
2. Extend StreamViewer for activity stream rendering
3. Add stream definition for spindles-proxy WebSocket
4. Add Forge subprocess management
5. Add command palette commands (sirk_start, sirk_stop, sirk_resume)
6. Wire Forge stdout events to SIRK panel status

**Acceptance criteria:**
- [ ] SIRK panel displays config inputs and run status
- [ ] Start button spawns Forge subprocess
- [ ] Activity stream displays thinking, tool calls, results in real-time
- [ ] Progress events update SIRK panel status
- [ ] Stop button terminates run gracefully
- [ ] Resume works after crash recovery

---

## 9. Testing Strategy

### 9.1 Unit Tests

- Forge: StateManager persistence
- Forge: Progress event emission
- Spindles-proxy: WebSocket broadcast
- Spindles-proxy: SIRK session management

### 9.2 Integration Tests

- Forge spawns CC successfully
- CC calls Mandrel tools
- Spindles flow from CC → Proxy → WebSocket
- Ridge-control receives spindles
- Retry logic on CC failure

### 9.3 Manual Test Scenarios

1. **Happy path**: 3 instances complete successfully
2. **CC failure**: Instance 2 fails, retries, succeeds
3. **Mandrel down**: Run aborts immediately
4. **User abort**: Ctrl+C during instance 2, state saved
5. **Resume**: After abort, resume from instance 3
6. **Long run**: 10 instances, verify memory/stability

---

## 10. Resolved Questions

| Question | Decision |
|----------|----------|
| CC model override | Default Opus 4.5 with thinking enabled; model selectable in Ridge-Control settings |
| Spindles-proxy port | 8083 for WebSocket, 8082 for API proxy |
| Spindles-proxy location | `~/projects/forge/spindles-proxy/` (build from scratch, reference `~/aidis/spindles-proxy/` for design docs) |
| Seed doc | File path passed to CC - CC reads it (not injected into prompt) |
| CC output capture | Final output (~10KB) for debugging; Mandrel is source of truth for handoff |
| Activity stream format | Option B - Simplified ActivityMessage types (thinking, tool_call, tool_result, text, error) |
| CC execution mode | Headless subprocess (not interactive terminal) |
| Mandrel access | Forge runs locally, uses HTTP bridge at `http://localhost:8080` |
| Instance timeout | 30 minutes per instance |
| Concurrent runs | Single run only (for now) |
| SIRK context injection | REST endpoint (`POST /sirk/session`) |
| Prompt template | Locked - includes variables {n}, {total}, {runName}, {seedPath}, {project} |

---

## 11. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0-draft | 2025-01-16 | Claude | Initial contract draft |
| 1.0.0 | 2025-01-17 | Claude | Locked after interview - added activity stream schema, prompt template, component locations, execution model |

---

**END OF CONTRACT**