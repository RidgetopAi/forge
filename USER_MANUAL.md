# Forge User Manual

**Version**: 1.0.0
**Last Updated**: 2025-01-17

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Installation](#3-installation)
4. [Configuration](#4-configuration)
5. [Running Forge](#5-running-forge)
6. [Spindles-Proxy](#6-spindles-proxy)
7. [Activity Stream](#7-activity-stream)
8. [State Management](#8-state-management)
9. [Resume & Recovery](#9-resume--recovery)
10. [Troubleshooting](#10-troubleshooting)
11. [Development](#11-development)

---

## 1. Overview

Forge orchestrates Claude Code (CC) in iterative instance loops using the SIRK pattern (Seed → Instance → Run → Knowledge). Each instance runs as an isolated subprocess, with cross-instance continuity maintained through Mandrel context storage.

### Key Concepts

- **Run**: A named sequence of CC instances working on a task
- **Instance**: A single Claude Code invocation within a run
- **Seed Document**: A markdown file defining the task for all instances
- **Handoff**: Context stored to Mandrel at the end of each instance for the next to consume
- **Spindles**: Real-time activity stream (thinking blocks, tool calls, text output)

### Design Principles

1. **Fresh instances**: Each CC invocation starts clean (no `--continue`)
2. **Mandrel is memory**: All cross-instance state lives in Mandrel
3. **Fail fast on Mandrel**: If Mandrel is unreachable, abort immediately
4. **Retry on CC failure**: Single instance failures get one retry

---

## 2. Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Ridge-Control  │────▶│      Forge      │────▶│   Claude Code   │
│      (UI)       │     │  (Orchestrator) │     │   (Subprocess)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    WebSocket    │◀────│ Spindles-Proxy  │◀────│  Anthropic API  │
│    (Port 8083)  │     │   (Port 8082)   │     │    (via proxy)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │     Mandrel     │
                                                │   (VPS via SSH) │
                                                └─────────────────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Forge | `~/projects/forge/` | Orchestrates CC instance loop |
| Spindles-Proxy | `~/projects/forge/spindles-proxy/` | Intercepts API calls, extracts activity |
| Claude Code | System binary | AI execution engine |
| Mandrel | VPS (Hetzner) | Context persistence across instances |
| Ridge-Control | `~/projects/ridge-control/` | UI and orchestration trigger |

---

## 3. Installation

### Prerequisites

- Node.js 20+
- Claude Code CLI installed (`claude` command available)
- SSH access to Mandrel VPS (`ssh hetzner`)
- Anthropic API key configured

### Install Dependencies

```bash
# Main Forge project
cd ~/projects/forge
npm install

# Spindles-Proxy
cd ~/projects/forge/spindles-proxy
npm install
```

### Build

```bash
# Build Forge
cd ~/projects/forge
npm run build

# Build Spindles-Proxy
cd ~/projects/forge/spindles-proxy
npm run build
```

### Verify Installation

```bash
# Check Forge compiles
cd ~/projects/forge && npm run check

# Check Spindles-Proxy compiles and tests pass
cd ~/projects/forge/spindles-proxy && npm run check && npm test
```

---

## 4. Configuration

### Forge Config Schema

Forge reads JSON configuration from stdin:

```json
{
  "runName": "my-task-v1",
  "totalInstances": 10,
  "project": "my-project",
  "seedPath": "/home/user/seeds/task.md",
  "spindlesProxyUrl": "http://localhost:8082",
  "mandrelUrl": "http://localhost:8080",
  "timeoutMinutes": 30
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `runName` | string | Yes | - | Unique identifier for this run |
| `totalInstances` | number | Yes | - | How many CC instances to run |
| `project` | string | Yes | - | Mandrel project name |
| `seedPath` | string | Yes | - | Absolute path to seed document |
| `spindlesProxyUrl` | string | No | `http://localhost:8082` | Spindles proxy endpoint |
| `mandrelUrl` | string | No | `http://localhost:8080` | Mandrel HTTP bridge |
| `timeoutMinutes` | number | No | `30` | Max time per instance |

### Seed Document

The seed document is a markdown file defining the task. Each CC instance reads this file directly.

**Example**: `/home/user/seeds/auth-refactor.md`

```markdown
# Authentication Refactor

## Objective
Refactor the authentication system to use JWT refresh tokens.

## Files to Modify
- src/auth/tokens.rs
- src/auth/middleware.rs
- src/api/routes/login.rs

## Requirements
1. Add refresh token generation
2. Implement token rotation
3. Add expiry validation
4. Update API responses

## Handoff Protocol
After completing your work, store a handoff context to Mandrel:
- Summarize what you completed
- List any blockers or issues
- Identify next steps for the following instance
```

---

## 5. Running Forge

### Start Spindles-Proxy First

```bash
cd ~/projects/forge/spindles-proxy
npm start
```

Output:
```
[spindles-proxy] HTTP server listening on port 8082
```

The WebSocket server automatically starts on port 8083.

### Run Forge

Pipe configuration JSON to Forge via stdin:

```bash
cd ~/projects/forge

cat <<EOF | npm start
{
  "runName": "auth-refactor-v1",
  "totalInstances": 5,
  "project": "ridge-control",
  "seedPath": "/home/ridgetop/seeds/auth-refactor.md"
}
EOF
```

### Direct Execution

```bash
echo '{"runName":"test","totalInstances":3,"project":"myproj","seedPath":"/path/to/seed.md"}' | node dist/index.js
```

---

## 6. Spindles-Proxy

Spindles-Proxy intercepts Claude Code API calls, extracts activity (thinking, tool calls, results), and broadcasts them via WebSocket.

### Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 8082 | HTTP | Anthropic API proxy |
| 8083 | WebSocket | Activity stream broadcast |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_PORT` | `8082` | API proxy port |
| `WS_PORT` | `8083` | WebSocket port |
| `ANTHROPIC_UPSTREAM_URL` | `https://api.anthropic.com` | Upstream API |
| `LOG_FILE` | `spindles.jsonl` | Activity log file |

### Endpoints

#### Health Check
```bash
curl http://localhost:8082/health
```
Response:
```json
{"status": "ok", "timestamp": "2025-01-17T10:30:00Z", "wsClients": 2}
```

#### Set SIRK Session
```bash
curl -X POST http://localhost:8082/sirk/session \
  -H "Content-Type: application/json" \
  -d '{
    "runName": "auth-refactor-v1",
    "instanceNumber": 3,
    "totalInstances": 10,
    "project": "ridge-control"
  }'
```

#### Get Current Session
```bash
curl http://localhost:8082/sirk/session
```

#### Clear Session
```bash
curl -X DELETE http://localhost:8082/sirk/session
```

---

## 7. Activity Stream

### WebSocket Connection

Connect to `ws://localhost:8083/spindles` to receive real-time activity.

**Example (Node.js)**:
```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8083/spindles');

ws.on('message', (data) => {
  const activity = JSON.parse(data.toString());
  console.log(`[${activity.type}]`, activity);
});
```

### Message Types

#### Connection Acknowledgment
```json
{
  "type": "connection_ack",
  "timestamp": "2025-01-17T10:30:00Z"
}
```

#### Thinking Block
```json
{
  "type": "thinking",
  "content": "Let me analyze the authentication flow...",
  "timestamp": "2025-01-17T10:30:05Z",
  "session": {
    "runName": "auth-refactor-v1",
    "instanceNumber": 3,
    "totalInstances": 10,
    "project": "ridge-control"
  }
}
```

#### Tool Call
```json
{
  "type": "tool_call",
  "toolName": "Read",
  "toolId": "toolu_abc123",
  "input": {"file_path": "/src/auth/tokens.rs"},
  "timestamp": "2025-01-17T10:30:10Z",
  "session": {...}
}
```

#### Tool Result
```json
{
  "type": "tool_result",
  "toolId": "toolu_abc123",
  "content": "// file contents...",
  "isError": false,
  "timestamp": "2025-01-17T10:30:11Z",
  "session": {...}
}
```

#### Text Output
```json
{
  "type": "text",
  "content": "I've updated the token validation logic.",
  "timestamp": "2025-01-17T10:30:15Z",
  "session": {...}
}
```

#### Error
```json
{
  "type": "error",
  "message": "Rate limit exceeded",
  "code": "rate_limit_error",
  "timestamp": "2025-01-17T10:30:20Z",
  "session": {...}
}
```

### JSONL Log

All activity is also written to `spindles.jsonl` in the spindles-proxy directory. Each line is a JSON activity message.

---

## 8. State Management

Forge persists run state to enable resume after crashes or interruptions.

### State Location

```
~/.forge/runs/{runName}/state.json
```

### State Schema

```json
{
  "runName": "auth-refactor-v1",
  "currentInstance": 5,
  "totalInstances": 10,
  "completedInstances": [
    {"instanceNumber": 1, "success": true, "timestamp": "2025-01-17T10:00:00Z"},
    {"instanceNumber": 2, "success": true, "timestamp": "2025-01-17T10:15:00Z"},
    {"instanceNumber": 3, "success": false, "timestamp": "2025-01-17T10:30:00Z"},
    {"instanceNumber": 4, "success": true, "timestamp": "2025-01-17T10:45:00Z"}
  ],
  "status": "running"
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `running` | Run is in progress |
| `paused` | Run was paused (Ctrl+C or SIGTERM) |
| `completed` | All instances finished successfully |
| `failed` | Run failed (instance failures) |

---

## 9. Resume & Recovery

### Graceful Pause

Press `Ctrl+C` or send `SIGTERM` to pause a run. State is saved automatically.

```
[forge] Received SIGINT, pausing gracefully...
[forge] Run paused. State saved.
```

### Resume a Run

To resume a paused or failed run, start Forge with the same `runName`. Forge will detect the existing state and continue from the next instance.

```bash
echo '{"runName":"auth-refactor-v1","totalInstances":10,"project":"ridge-control","seedPath":"/path/to/seed.md"}' | npm start
```

Output:
```
[forge] Found existing state: paused, instance 5/10
[forge] Starting run: auth-refactor-v1
[forge] Instance 5 starting...
```

---

## 10. Troubleshooting

### Mandrel Unreachable

```
Error: Mandrel is unreachable. Ensure VPS is running and accessible via ssh hetzner.
```

**Solution**:
1. Verify SSH access: `ssh hetzner 'echo ok'`
2. Check Mandrel service: `ssh hetzner 'sudo systemctl status mandrel'`
3. Test Mandrel ping: `ssh hetzner 'curl -X POST http://localhost:8080/mcp/tools/mandrel_ping -H "Content-Type: application/json" -d "{\"arguments\": {}}"'`

### Spindles-Proxy Not Running

If CC runs but no activity appears:

1. Check proxy is running: `curl http://localhost:8082/health`
2. Verify `ANTHROPIC_BASE_URL` is set to `http://localhost:8082`

### CC Timeout

Default timeout is 30 minutes per instance. Increase with `timeoutMinutes`:

```json
{
  "runName": "long-task",
  "totalInstances": 5,
  "project": "myproj",
  "seedPath": "/path/to/seed.md",
  "timeoutMinutes": 60
}
```

### Instance Keeps Failing

Forge retries failed instances once (2 total attempts). If an instance fails twice:

1. Check seed document for clarity
2. Review activity log: `cat spindles-proxy/spindles.jsonl | tail -100`
3. Check CC output in stderr

### WebSocket Disconnects

Clients should implement auto-reconnect. The proxy disconnects slow clients exceeding 1MB backpressure.

---

## 11. Development

### Project Structure

```
forge/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration parsing (Zod)
│   ├── events.ts             # Progress event types & emission
│   ├── cc/
│   │   ├── claudeRunner.ts   # CC subprocess spawning
│   │   └── prompt.ts         # Prompt template rendering
│   ├── mandrel/
│   │   └── mandrelClient.ts  # Mandrel health check client
│   ├── orchestrator/
│   │   ├── runLoop.ts        # Main instance loop
│   │   └── resumeFlow.ts     # Pause/resume handlers
│   ├── proxy/
│   │   └── spindlesClient.ts # Spindles session API client
│   └── state/
│       └── stateManager.ts   # JSON state persistence
├── spindles-proxy/
│   └── src/
│       ├── index.ts          # Express app setup
│       ├── config.ts         # Environment config
│       ├── proxy/            # Anthropic API proxy
│       ├── session/          # SIRK session management
│       ├── sse/              # SSE parsing & block assembly
│       ├── ws/               # WebSocket broadcast
│       ├── logging/          # JSONL file writer
│       └── types/            # TypeScript interfaces
├── CONTRACT.md               # Specification document
└── USER_MANUAL.md            # This file
```

### Scripts

**Forge**:
```bash
npm run dev      # Watch mode with tsx
npm run build    # Compile TypeScript
npm run check    # Type-check without emit
npm start        # Run compiled code
```

**Spindles-Proxy**:
```bash
npm run dev      # Watch mode with tsx
npm run build    # Compile TypeScript
npm run check    # Type-check without emit
npm run test     # Run vitest
npm start        # Run compiled code
```

### Progress Events (stdout)

Forge emits newline-delimited JSON to stdout. Ridge-Control parses these.

| Event | Description |
|-------|-------------|
| `run_started` | Run has begun |
| `instance_started` | Instance N is starting |
| `instance_completed` | Instance N finished (success/fail) |
| `instance_failed` | Instance N failed (with error) |
| `run_completed` | All instances done |
| `error` | Fatal or non-fatal error |

**Example output**:
```json
{"type":"run_started","runName":"test","totalInstances":3,"timestamp":"2025-01-17T10:00:00Z"}
{"type":"instance_started","runName":"test","instanceNumber":1,"totalInstances":3,"timestamp":"2025-01-17T10:00:01Z"}
{"type":"instance_completed","runName":"test","instanceNumber":1,"success":true,"durationMs":45000,"timestamp":"2025-01-17T10:00:46Z"}
```

### Adding New Features

1. Update `CONTRACT.md` with specification changes
2. Implement in appropriate module
3. Add tests for spindles-proxy changes
4. Run `npm run check` in both projects
5. Update this manual

---

## Quick Reference

### Start a Run

```bash
# Terminal 1: Start proxy
cd ~/projects/forge/spindles-proxy && npm start

# Terminal 2: Run Forge
cd ~/projects/forge
echo '{"runName":"myrun","totalInstances":5,"project":"myproj","seedPath":"/path/to/seed.md"}' | npm start
```

### Monitor Activity

```bash
# WebSocket client
wscat -c ws://localhost:8083/spindles

# Or tail the log
tail -f ~/projects/forge/spindles-proxy/spindles.jsonl | jq
```

### Check State

```bash
cat ~/.forge/runs/myrun/state.json | jq
```

### Resume After Pause

Press Ctrl+C to pause, then run the same command again to resume.

---

**End of User Manual**
