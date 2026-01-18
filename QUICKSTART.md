# Forge Quickstart Guide

**How to run a SIRK loop from Ridge-Control**

---

## Prerequisites

Before starting, ensure these are running:

```bash
# Terminal 1: Start Spindles-Proxy
cd ~/projects/forge/spindles-proxy
npm start
# Should show: [spindles-proxy] HTTP server listening on port 8082

# Terminal 2: Verify Mandrel is accessible
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/mandrel_ping \
  -H "Content-Type: application/json" -d "{\"arguments\": {}}"'
# Should return: Pong or success message
```

---

## Step 1: Create a Seed Document

Create a markdown file that defines the task for all instances.

**Example**: `~/seeds/test-task.md`

```markdown
# Test Task

## Objective
This is a test run to verify the SIRK loop works.

## Instructions
1. Read this seed document
2. Check Mandrel for previous handoff context (context_get_recent)
3. Do a simple task (e.g., list files in ~/projects/forge)
4. Store a handoff to Mandrel with type "handoff"

## Handoff Template
Store to Mandrel:
- Instance N completed
- What I did: [brief description]
- Next instance should: [continue from here]
```

---

## Step 2: Start Ridge-Control

```bash
cd ~/projects/ridge-control
cargo run
```

---

## Step 3: Open the SIRK Panel

**Command Palette Method:**
1. Press `:` to open command palette
2. Type `sirk` to filter commands
3. Select **Toggle SIRK Panel** or **Show SIRK Panel**

**Or** use the direct keybinding if configured.

---

## Step 4: Configure the Run

The SIRK panel has 4 input fields:

```
┌─ SIRK ──────────────────────────────────────────────────┐
│                                                         │
│  Run Name:    [________________________]  ← Enter a name│
│  Seed Doc:    [________________________]  ← Full path   │
│  Instances:   [____]                      ← Number 1-100│
│  Project:     [________________________]  ← Mandrel proj│
│                                                         │
│  Status: Idle                                           │
│                                                         │
│  [Start]  [Stop]  [Resume]                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Navigation:**
- `j` / `↓` - Move down
- `k` / `↑` - Move up
- `Enter` - Edit selected field (or click button)
- `Esc` - Exit edit mode / close panel
- `q` - Close panel

**Fill in the fields:**

| Field | Example Value | Notes |
|-------|---------------|-------|
| Run Name | `test-run-v1` | Unique name for this run |
| Seed Doc | `/home/ridgetop/seeds/test-task.md` | **Full absolute path** |
| Instances | `3` | Start small for testing |
| Project | `forge` | Must exist in Mandrel |

**To edit a field:**
1. Navigate to the field with `j`/`k`
2. Press `Enter` to start editing
3. Type the value
4. Press `Enter` to confirm (or `Esc` to cancel)

---

## Step 5: Start the Run

1. Navigate to **[Start]** button with `j`/`k`
2. Press `Enter`

**What happens:**
1. Ridge-Control validates your config
2. Spawns Forge as a subprocess
3. Forge checks Mandrel health (fails fast if unreachable)
4. Forge spawns Claude Code instance 1
5. Activity stream shows real-time thinking/tool calls

**Status bar updates:**
```
Status: Running [1/3] ✓0 ✗0 | 0m 15s
```

---

## Step 6: Monitor Activity

Open the Activity Stream to see real-time CC activity:

1. Press `:` for command palette
2. Select **Toggle Activity Stream**

```
┌─ Activity Stream ───────────────────────────────────────┐
│ test-run-v1 | Instance 1/3                              │
├─────────────────────────────────────────────────────────┤
│ [10:32:15] 💭 Let me read the seed document first...    │
│ [10:32:16] 📖 Read ~/seeds/test-task.md                 │
│ [10:32:18] 💭 Now I'll check for previous handoff...    │
│ [10:32:19] 🔧 context_get_recent                        │
│ [10:32:20] ✅ No previous context found                 │
│ [10:32:22] 💭 I'm instance 1, so I'll start fresh...    │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

**Icons:**
- 💭 = Thinking block
- 📖 = Read tool
- ✏️ = Edit tool
- 🔧 = Other tool call
- ✅ = Tool success
- ❌ = Tool failure / error

---

## Step 7: Wait for Completion

Each instance runs, stores handoff to Mandrel, and exits. Forge then spawns the next instance.

**Final status:**
```
Status: Completed [3/3] ✓3 ✗0 | 5m 42s
```

---

## Stopping a Run

**To stop mid-run:**
1. Navigate to **[Stop]** button
2. Press `Enter`

Forge receives SIGTERM and saves state for resume.

---

## Resuming a Run

If a run was stopped or crashed:

1. Fill in the **same Run Name** as before
2. Navigate to **[Resume]** button
3. Press `Enter`

Forge loads state from `~/.forge/runs/{runName}/state.json` and continues from the last completed instance.

**Resume prompt:** If Forge asks for confirmation, press:
- `r` to confirm resume
- `a` to abort

---

## Troubleshooting

### "Mandrel is unreachable"

```bash
# Check SSH access
ssh hetzner 'echo ok'

# Check Mandrel service
ssh hetzner 'sudo systemctl status mandrel'

# Test Mandrel directly
ssh hetzner 'curl -X POST http://localhost:8080/mcp/tools/mandrel_ping \
  -H "Content-Type: application/json" -d "{\"arguments\": {}}"'
```

### "No activity appearing"

Spindles-proxy must be running:
```bash
curl http://localhost:8082/health
# Should return: {"status":"ok",...}
```

### "Instance keeps failing"

Check the seed document is readable:
```bash
cat /path/to/your/seed.md
```

Check Forge logs (stderr goes to Ridge-Control):
```bash
# Or run Forge directly to see errors
echo '{"runName":"debug","totalInstances":1,"project":"forge","seedPath":"/path/to/seed.md"}' | \
  cd ~/projects/forge && npm start
```

### "Validation error"

All fields are required:
- Run Name: non-empty string
- Seed Doc: non-empty path (must exist)
- Instances: 1-100
- Project: non-empty (must exist in Mandrel)

---

## Quick Test Checklist

```bash
# 1. Spindles-proxy running?
curl http://localhost:8082/health

# 2. Mandrel accessible?
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/mandrel_ping \
  -H "Content-Type: application/json" -d "{\"arguments\": {}}"'

# 3. Seed document exists?
cat ~/seeds/your-task.md

# 4. Mandrel project exists?
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/project_list \
  -H "Content-Type: application/json" -d "{\"arguments\": {}}"' | jq

# 5. Ridge-control built?
cd ~/projects/ridge-control && cargo build --release
```

---

## Example: 3-Instance Test Run

```
Run Name:   test-sirk-v1
Seed Doc:   /home/ridgetop/seeds/test-task.md
Instances:  3
Project:    forge

[Start]
```

Expected flow:
1. Instance 1: Reads seed, no previous handoff, does task, stores handoff
2. Instance 2: Reads seed, retrieves instance 1 handoff, continues, stores handoff
3. Instance 3: Reads seed, retrieves instance 2 handoff, finishes, stores final handoff

Total time: ~5-10 minutes for simple tasks

---

## Command Reference

| Command | Description |
|---------|-------------|
| `sirk_panel_toggle` | Show/hide SIRK config panel |
| `sirk_start` | Start run with current config |
| `sirk_stop` | Stop running Forge subprocess |
| `sirk_resume` | Resume interrupted run |
| `activity_stream_toggle` | Show/hide activity stream |
| `activity_stream_clear` | Clear activity messages |

**In-panel keys:**
| Key | Action |
|-----|--------|
| `j`/`↓` | Move down |
| `k`/`↑` | Move up |
| `Enter` | Edit field / click button |
| `Esc` | Cancel edit / close panel |
| `q` | Close panel |
| `r` | Confirm resume prompt |
| `a` | Abort resume prompt |

---

**End of Quickstart Guide**
