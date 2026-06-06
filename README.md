# Supermaven Proxy

OpenAI-compatible proxy for Supermaven free tier code completions.

## Features

- **Code completions** via Supermaven's free tier
- **OpenAI-compatible API** - works with any client supporting `/v1/completions`
- **Auto-setup** - copies binary from VSCode extension if not cached
- **Local only** - runs on `127.0.0.1` by default

## Quick Start

1. Install Supermaven extension in VSCode
2. Double-click `start.cmd` or run `npm start`
3. Server runs at `http://127.0.0.1:3000`

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/models` | GET | List available models |
| `/v1/completions` | POST | Code completions |

## Usage

### curl

```bash
curl http://127.0.0.1:3000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"prompt":"function hello() { return ","model":"supermaven-free"}'
```

### OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:3000/v1"
)

response = client.completions.create(
    model="supermaven-free",
    prompt="function fibonacci(n) { return "
)

print(response.choices[0].text)
```

### OpenAI Node.js SDK

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://127.0.0.1:3000/v1'
});

const response = await client.completions.create({
    model: 'supermaven-free',
    prompt: 'function fibonacci(n) { return '
});

console.log(response.choices[0].text);
```

## Configuration

Edit `.config/config.json`:

```json
{
    "server": {
        "port": 3000,
        "host": "127.0.0.1"
    }
}
```

## How It Works

1. Uses Supermaven's `sm-agent` binary for code completions
2. Binary is either:
   - Found in `.cache/` (previously downloaded)
   - Copied from VSCode extension at `~/.vscode/extensions/supermaven.supermaven-*/`
3. Binary communicates with Supermaven servers for free tier completions
4. Server translates OpenAI API requests to binary protocol

## Binary Location

The `sm-agent` binary is cached at:
- Windows: `.cache/supermaven-bin.exe`
- Linux/macOS: `.cache/supermaven-bin`

## Troubleshooting

### "Binary not found"
Install the Supermaven extension in VSCode first. The proxy copies the binary from there.

### "Connection refused"
Make sure no other process is using port 3000. The server auto-kills existing processes on startup.

### Completions not working
Ensure the binary exists in `.cache/` and is not corrupted. Delete it and restart to re-copy from VSCode extension.
