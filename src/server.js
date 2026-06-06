import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SupermavenClient } from './client.js';
import { loadConfig, getConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = loadConfig();
const app = express();
const client = new SupermavenClient();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, '..'), { extensions: ['html'] }));

// Redirect root to demo
app.get('/', (req, res) => {
  res.redirect('/demo');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'supermaven-proxy' });
});

// Models endpoint
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'supermaven-free',
        object: 'model',
        created: Date.now(),
        owned_by: 'supermaven',
        permission: [],
        root: 'supermaven-free',
        parent: null
      },
      {
        id: 'gpt-4o-mini',
        object: 'model',
        created: Date.now(),
        owned_by: 'supermaven',
        permission: [],
        root: 'gpt-4o-mini',
        parent: null
      },
      {
        id: 'gpt-4o',
        object: 'model',
        created: Date.now(),
        owned_by: 'supermaven',
        permission: [],
        root: 'gpt-4o',
        parent: null
      },
      {
        id: 'claude-3-5-sonnet',
        object: 'model',
        created: Date.now(),
        owned_by: 'supermaven',
        permission: [],
        root: 'claude-3-5-sonnet',
        parent: null
      }
    ]
  });
});

// Chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model, stream, temperature, max_tokens, n } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: {
          message: 'messages is required and must be an array',
          type: 'invalid_request_error',
          code: 'invalid_request_error'
        }
      });
    }
    
    const options = {
      model: model || 'supermaven-free',
      stream: stream || false,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens || 4096
    };
    
    if (stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const id = `chatcmpl-${uuidv4()}`;
      const created = Math.floor(Date.now() / 1000);
      
      try {
        const response = await client.chatCompletionStream(messages, options);
        
        if (response.ok && response.stream) {
          let buffer = '';
          
          response.stream.on('data', (chunk) => {
            buffer += chunk.toString();
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                  res.end();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          });
          
          response.stream.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
          });
          
          response.stream.on('error', (err) => {
            console.error('Stream error:', err);
            res.end();
          });
        } else {
          // Fallback to non-streaming
          const result = await client.chatCompletion(messages, options);
          res.write(`data: ${JSON.stringify(result)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } catch (err) {
        console.error('Streaming error:', err);
        res.end();
      }
    } else {
      // Non-streaming response
      const result = await client.chatCompletion(messages, options);
      res.json(result);
    }
  } catch (err) {
    console.error('Chat completions error:', err);
    res.status(500).json({
      error: {
        message: err.message || 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

// Completions endpoint (legacy)
app.post('/v1/completions', async (req, res) => {
  try {
    const { prompt, model, stream, temperature, max_tokens } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: {
          message: 'prompt is required',
          type: 'invalid_request_error',
          code: 'invalid_request_error'
        }
      });
    }
    
    const messages = [{ role: 'user', content: prompt }];
    const options = {
      model: model || 'supermaven-free',
      stream: false,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens || 4096
    };
    
    const result = await client.chatCompletion(messages, options);
    
    // Convert to completions format
    const completion = {
      id: result.id,
      object: 'text_completion',
      created: result.created,
      model: result.model,
      choices: result.choices.map((c, i) => ({
        text: c.message?.content || '',
        index: i,
        logprobs: null,
        finish_reason: c.finish_reason
      })),
      usage: result.usage
    };
    
    res.json(completion);
  } catch (err) {
    console.error('Completions error:', err);
    res.status(500).json({
      error: {
        message: err.message || 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

// Embeddings endpoint (stub)
app.post('/v1/embeddings', (req, res) => {
  res.status(501).json({
    error: {
      message: 'Embeddings not supported by Supermaven proxy',
      type: 'not_implemented',
      code: 'not_implemented'
    }
  });
});

// Catch all other routes
app.all('*', (req, res) => {
  res.status(404).json({
    error: {
      message: `Unknown endpoint: ${req.method} ${req.path}`,
      type: 'invalid_request_error',
      code: 'not_found'
    }
  });
});

// Kill existing process on port
function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf-8' });
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { encoding: 'utf-8' });
    }
  } catch (e) {
    // No process found, that's fine
  }
}

// Start server
async function start() {
  const { port, host } = config.server;
  
  // Kill any existing process on the port
  console.log(`Checking port ${port}...`);
  killPort(port);
  await new Promise(r => setTimeout(r, 500));
  
  console.log('=== Supermaven Proxy Server ===');
  console.log('');
  
  // Initialize client
  await client.initialize();
  
  app.listen(port, host, () => {
    console.log(`Server running at http://127.0.0.1:${port}`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  GET  http://127.0.0.1:${port}/health`);
    console.log(`  GET  http://127.0.0.1:${port}/v1/models`);
    console.log(`  POST http://127.0.0.1:${port}/v1/completions`);
  });
}

start().catch(console.error);
