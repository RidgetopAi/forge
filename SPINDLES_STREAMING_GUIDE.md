# 🎡 Spindles Streaming Guide - Forge Factory

## What This Is

Real-time viewer for AI thinking blocks from Forge runs. See your AI's thoughts as they happen, with a beautiful blue techy interface perfect for OBS streaming!

---

## Quick Start (2 Steps)

### Step 1: Start the Spindles Viewer

```bash
cd ~/aidis/spindles-viewer
./start.sh
```

**Opens at:** http://localhost:3737

### Step 2: Run Forge with Spindles Enabled

```bash
cd ~/forge
npm start
```

That's it! Thinking blocks will stream to the viewer in real-time.

---

## How It Works

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│  Forge Run   ├────────►│  Spindles    ├────────►│   Browser    │
│  (AI Model)  │  POST   │   Viewer     │   SSE   │   Display    │
│              │         │  (Port 3737) │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
```

1. **Forge** extracts `<thinking>...</thinking>` blocks from AI responses
2. **SpindlesStreamer** POSTs them to viewer at `http://localhost:3737/spindles/post`
3. **Viewer server** broadcasts to all browser clients via Server-Sent Events (SSE)
4. **Browser** displays thinking blocks in real-time with beautiful animations

---

## Configuration

### Enable/Disable Spindles Streaming

Edit `~/forge/config/default.yaml`:

```yaml
spindles:
  enabled: true                          # Set to false to disable
  viewer_url: "http://localhost:3737"    # Change if viewer is on different port
```

---

## Files Added/Modified

### New Files

1. **`~/forge/src/core/SpindlesStreamer.ts`**
   - Handles streaming thinking blocks to viewer
   - POSTs spindle JSON to viewer's `/spindles/post` endpoint
   - Graceful failure (doesn't interrupt Forge if viewer is down)

2. **`~/aidis/spindles-viewer/`**
   - `server.js` - Node.js server with SSE + POST endpoints
   - `viewer.html` - Beautiful web UI
   - `start.sh` - Quick start script
   - `README.md` - Viewer documentation

### Modified Files

1. **`~/forge/src/types.ts`**
   - Added `spindles` config section

2. **`~/forge/src/core/Runner.ts`**
   - Creates SpindlesStreamer if enabled
   - Passes to TurnExecutor

3. **`~/forge/src/core/TurnExecutor.ts`**
   - Streams thinking blocks after extraction
   - Calls `spindlesStreamer.streamThinkingBlocks()`

4. **`~/forge/config/default.yaml`**
   - Added spindles config (enabled by default)

---

## Spindle Data Format

```json
{
  "spindle": {
    "id": "spindle-uuid-here",
    "timestamp": "2025-11-08T02:00:00.000Z",
    "sessionId": "unique-session-id",
    "type": "thinking",
    "content": "The actual thinking block text here...",
    "tokenCount": 145,
    "runId": "20251108-0200-forge-live-build-abc123",
    "turnNumber": 3
  }
}
```

---

## Using with OBS

### Add Browser Source

1. **Sources** → **Add** → **Browser**
2. **URL:** `http://localhost:3737`
3. **Width:** 1920
4. **Height:** 1080
5. **Done!**

The viewer is optimized for OBS with:
- Transparent background
- Blue glowing borders
- Smooth animations
- Auto-scrolling (newest first)
- Professional dark theme

---

## Features

### Spindles Viewer

- 🎨 Blue sleek design (matches OBS overlays)
- 📡 Real-time SSE streaming
- ✨ Glowing borders with pulse animation
- 📊 Live stats (total count, session ID, status)
- 🔄 Auto-scroll (newest spindles at top)
- 🎥 OBS-ready (1920×1080)
- 💾 Keeps last 20 spindles

### Forge Integration

- 🧠 Auto-extracts `<thinking>` blocks
- 📤 Streams in real-time
- 🛡️ Graceful failure (continues if viewer is down)
- ⚙️ Configurable (enable/disable, custom URL)
- 📁 Still saves to `output/` directory

---

## Testing

### Test Viewer with Fake Data

```bash
cd ~/aidis/spindles-viewer
./start.sh
# Opens browser to http://localhost:3737
# You'll see fake thinking blocks streaming every 3-8 seconds
```

### Test Forge Integration

```bash
# Terminal 1: Start viewer
cd ~/aidis/spindles-viewer
./start.sh

# Terminal 2: Run Forge
cd ~/forge
npm start

# Terminal 3: Watch the viewer
open http://localhost:3737
```

---

## Troubleshooting

### Viewer Not Connecting

```bash
# Check if viewer is running
curl http://localhost:3737

# Check what's on port 3737
lsof -i:3737

# Kill and restart
cd ~/aidis/spindles-viewer
pkill -f "node server.js"
./start.sh
```

### Spindles Not Appearing

1. **Check Forge config** - Make sure `spindles.enabled: true` in `config/default.yaml`
2. **Check viewer is running** - Visit http://localhost:3737
3. **Check Forge logs** - Look for `🎡 Spindles streaming ENABLED` message
4. **Check AI model** - Some models don't output `<thinking>` blocks (Grok, Claude usually do)

### Viewer Shows "DISCONNECTED"

- Refresh the browser page
- Restart the viewer server
- Check browser console for errors

---

## Models with Thinking Blocks

✅ **Has Thinking Blocks:**
- Claude (Anthropic) - Always
- DeepSeek - Always
- Grok (xAI) - Usually

❌ **No Thinking Blocks:**
- GPT-4/GPT-3.5 (OpenAI) - Rarely
- Most open-source models - Depends

If no thinking blocks appear, the AI model may not support them.

---

## Next Steps

### Ideas for Enhancement

1. **Filtering** - Filter by runId, turnNumber, keyword
2. **Search** - Full-text search through thinking blocks
3. **Export** - Download as JSON or markdown
4. **Analytics** - Track thinking patterns over time
5. **Multi-session** - View multiple Forge runs simultaneously
6. **Replay** - Replay thinking blocks from past runs

---

## Architecture Notes

### Why SSE (Server-Sent Events)?

- **Simple** - Browser's built-in EventSource API
- **Reliable** - Auto-reconnects
- **Real-time** - Sub-second latency
- **Efficient** - One-way stream (we don't need bidirectional)

### Why Not WebSockets?

- Overkill for one-way streaming
- SSE is simpler and more reliable for this use case
- Can always upgrade later if needed

---

## Summary

You now have **real-time AI thinking visualization** for your Forge runs!

**To use:**
1. Start viewer: `cd ~/aidis/spindles-viewer && ./start.sh`
2. Run Forge: `cd ~/forge && npm start`
3. Watch at: http://localhost:3737

Perfect for:
- Debugging AI behavior
- Understanding reasoning process
- Live streaming development
- Showcasing AI capabilities
- Building in public

🎉 **Enjoy your spindles!**
