# AGENTS.md

## Project Structure

- `src/server.js` - Express server with OpenAI-compatible API + static file serving
- `src/client.js` - Supermaven binary client for code completions
- `src/config.js` - Configuration loader
- `demo.html` - Interactive Monaco Editor demo (served at `/demo`)
- `.config/config.json` - Configuration file
- `.cache/supermaven-bin.exe` - Cached Supermaven binary
- `.cache/supermaven-version.json` - Binary version info
- `start.cmd` - Windows startup script

## Commands

- `npm start` - Start the server
- `npm run dev` - Start with auto-reload (requires nodemon)

## API

All endpoints accept JSON and return JSON.

### GET /
Redirects to `/demo`.

### GET /health
Returns `{"status":"ok","service":"supermaven-proxy"}`

### GET /v1/models
Returns list of available models.

### POST /v1/completions
Code completion endpoint. Send `{"prompt":"...","model":"supermaven-free"}`.

### POST /v1/chat/completions
Chat completions endpoint (OpenAI-compatible). Send `{"messages":[{"role":"user","content":"..."}]}`.

## Demo

Open `http://127.0.0.1:3000/demo` for the interactive demo. Features:
- Monaco Editor with inline ghost text completions
- Tab to accept, Escape to dismiss, Ctrl+Space to trigger manually
- Language dropdown, last 5 suggestions panel, clear buttons

## Architecture

1. Server starts and loads config from `.config/config.json`
2. Static files served from project root (demo.html available at `/demo`)
3. Client checks for cached binary in `.cache/`
4. If not found, copies from VSCode extension at `~/.vscode/extensions/supermaven.supermaven-*/`
5. Binary is spawned and communicates via stdin/stdout JSON
6. Completions are sent to binary, responses returned to client

## Binary Update Flow

1. Check if `.cache/supermaven-bin.exe` exists
2. If yes, use it
3. If no, copy from VSCode extension's bundled binary
4. Binary communicates with Supermaven servers for free tier completions

## Platform Support

- Windows x86_64: ✅ (bundled in extension)
- macOS ARM64: ✅ (API download available)
- Linux: ✅ (bundled in extension)
