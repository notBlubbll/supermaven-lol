# AGENTS.md

## Project Structure

- `src/server.js` - Express server with OpenAI-compatible API
- `src/client.js` - Supermaven binary client for code completions
- `src/config.js` - Configuration loader
- `.config/config.json` - Configuration file
- `start.cmd` - Windows startup script

## Commands

- `npm start` - Start the server
- `npm run dev` - Start with auto-reload (requires nodemon)

## API

All endpoints accept JSON and return JSON.

### GET /health
Returns `{"status":"ok"}`

### GET /v1/models
Returns list of available models.

### POST /v1/completions
Code completion endpoint. Send `{"prompt":"...","model":"supermaven-free"}`.

## Architecture

1. Server starts and loads config from `.config/config.json`
2. Client initializes and finds `sm-agent` binary
3. Binary is spawned and communicates via stdin/stdout JSON
4. Completions are sent to binary, responses returned to client
