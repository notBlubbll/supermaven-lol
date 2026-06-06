# Supermaven Proxy

OpenAI-compatible proxy for Supermaven free tier code completions.

## Usage

1. Double-click `start.cmd` or run `npm start`
2. Server runs at `http://127.0.0.1:3000`
3. Use in any OpenAI-compatible client

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/models` | GET | List available models |
| `/v1/completions` | POST | Code completions |

## Example

```bash
curl http://127.0.0.1:3000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"prompt":"function hello() { return ","model":"supermaven-free"}'
```

## Config

Edit `.config/config.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "127.0.0.1"
  }
}
```

## How it works

- Uses bundled `sm-agent` binary from Supermaven VSCode extension
- Binary communicates with Supermaven servers for free tier completions
- Auto-downloads updates on startup
