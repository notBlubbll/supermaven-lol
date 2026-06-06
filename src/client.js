import { getConfig } from './config.js';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, chmodSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform, arch, homedir } from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SupermavenClient {
  constructor() {
    this.binaryPath = null;
    this.binaryProcess = null;
    this.initialized = false;
    this.stateId = 0;
    this.stateMap = new Map();
    this.buffer = '';
    this.versionFile = join(homedir(), '.supermaven', 'version.json');
    this.binaryDir = join(homedir(), '.supermaven', 'binary', 'v20');
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('[Supermaven] Checking for updates...');
    
    // Check and download latest binary
    await this.updateBinary();
    
    // Find the binary
    this.binaryPath = this.findBinary();
    
    if (!this.binaryPath) {
      console.log('[Supermaven] Binary not found');
      return;
    }
    
    console.log('[Supermaven] Using binary:', this.binaryPath);
    
    // Start the binary
    this.startBinary();
    
    this.initialized = true;
    console.log('[Supermaven] Ready');
  }

  getPlatform() {
    const p = platform();
    if (p === 'win32') return 'windows';
    if (p === 'darwin') return 'darwin';
    return 'linux';
  }

  getArch() {
    const a = arch();
    if (a === 'arm64' || a === 'aarch64') return 'aarch64';
    return 'x86_64';
  }

  getBinaryDir() {
    return join(this.binaryDir, `${this.getPlatform()}-${this.getArch()}`);
  }

  getBinaryPath() {
    const ext = this.getPlatform() === 'windows' ? '.exe' : '';
    return join(this.getBinaryDir(), `sm-agent${ext}`);
  }

  getVersionInfo() {
    try {
      if (existsSync(this.versionFile)) {
        return JSON.parse(readFileSync(this.versionFile, 'utf-8'));
      }
    } catch (e) {}
    return { version: 0 };
  }

  saveVersionInfo(info) {
    try {
      mkdirSync(dirname(this.versionFile), { recursive: true });
      writeFileSync(this.versionFile, JSON.stringify(info, null, 2));
    } catch (e) {}
  }

  async updateBinary() {
    const currentVersion = this.getVersionInfo();
    
    try {
      // Check latest version from API
      const platform_ = this.getPlatform();
      const arch_ = this.getArch();
      
      const url = `https://supermaven.com/api/download-path-v2?platform=${platform_}&arch=${arch_}&editor=vscode`;
      
      const response = await this.makeRequest(url);
      
      if (!response.ok) {
        console.log('[Supermaven] Version check failed, using existing binary');
        return;
      }
      
      const data = JSON.parse(response.body);
      
      if (data.error) {
        console.log('[Supermaven] API error:', data.error);
        return;
      }
      
      const latestVersion = data.version || 0;
      const downloadUrl = data.downloadUrl;
      const sha256Hash = data.sha256Hash;
      
      if (!downloadUrl) {
        console.log('[Supermaven] No download URL available');
        return;
      }
      
      // Check if update needed
      if (currentVersion.version >= latestVersion && currentVersion.sha256Hash === sha256Hash) {
        console.log(`[Supermaven] Binary up to date (v${latestVersion})`);
        return;
      }
      
      console.log(`[Supermaven] Updating binary: v${currentVersion.version} -> v${latestVersion}`);
      
      // Download new binary
      await this.downloadBinary(downloadUrl, sha256Hash, latestVersion);
      
    } catch (e) {
      console.log('[Supermaven] Update check failed:', e.message);
    }
  }

  async downloadBinary(url, expectedHash, version) {
    const binaryPath = this.getBinaryPath();
    const tempPath = binaryPath + '.tmp';
    
    console.log('[Supermaven] Downloading from:', url);
    
    try {
      mkdirSync(dirname(binaryPath), { recursive: true });
      
      await new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        
        client.get(url, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // Follow redirect
            this.downloadBinary(res.headers.location, expectedHash, version)
              .then(resolve)
              .catch(reject);
            return;
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode}`));
            return;
          }
          
          const fileStream = createWriteStream(tempPath);
          res.pipe(fileStream);
          
          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
          
          fileStream.on('error', (err) => {
            reject(err);
          });
        }).on('error', reject);
      });
      
      // Make executable on non-Windows
      if (this.getPlatform() !== 'windows') {
        chmodSync(tempPath, 0o755);
      }
      
      // Replace old binary
      if (existsSync(binaryPath)) {
        const fs = await import('fs');
        fs.unlinkSync(binaryPath);
      }
      
      const fs = await import('fs');
      fs.renameSync(tempPath, binaryPath);
      
      // Save version info
      this.saveVersionInfo({ version, sha256Hash: expectedHash });
      
      console.log(`[Supermaven] Binary updated to v${version}`);
      
    } catch (e) {
      console.log('[Supermaven] Download failed:', e.message);
      // Clean up temp file
      try {
        const fs = await import('fs');
        if (existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e) {}
    }
  }

  findBinary() {
    // Check cached binary first
    const cachedPath = this.getBinaryPath();
    if (existsSync(cachedPath)) {
      return cachedPath;
    }
    
    // Search VSCode extensions
    const vscodeExtDir = join(homedir(), '.vscode', 'extensions');
    if (existsSync(vscodeExtDir)) {
      try {
        const { readdirSync, copyFileSync } = require('fs');
        const dirs = readdirSync(vscodeExtDir).filter(d => d.startsWith('supermaven.supermaven'));
        for (const dir of dirs) {
          const extPath = join(vscodeExtDir, dir);
          const binDirs = ['bin/win32-x64', 'bin/linux-x64', 'bin/darwin-arm64', 'bin/darwin-x64'];
          for (const binDir of binDirs) {
            const ext = this.getPlatform() === 'windows' ? '.exe' : '';
            const agentPath = join(extPath, binDir, `sm-agent${ext}`);
            if (existsSync(agentPath)) {
              mkdirSync(dirname(cachedPath), { recursive: true });
              copyFileSync(agentPath, cachedPath);
              return cachedPath;
            }
          }
        }
      } catch (e) {}
    }
    
    return null;
  }

  startBinary() {
    if (!this.binaryPath || !existsSync(this.binaryPath)) {
      throw new Error('Binary not found');
    }
    
    console.log('[Supermaven] Starting binary...');
    
    this.binaryProcess = spawn(this.binaryPath, ['stdio'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.binaryProcess.stdout.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });
    
    this.binaryProcess.stderr.on('data', (data) => {
      // Ignore stderr
    });
    
    this.binaryProcess.on('exit', (code) => {
      console.log(`[Supermaven] Binary exited: ${code}`);
      this.binaryProcess = null;
    });
    
    // Send greeting
    this.sendJson({ kind: 'greeting', allowGitignore: false });
    
    // Use free version
    this.sendJson({ kind: 'use_free_version' });
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('SM-MESSAGE ')) {
        try {
          const msg = JSON.parse(line.slice(11));
          this.processMessage(msg);
        } catch (e) {}
      }
    }
  }

  processMessage(msg) {
    if (msg.kind === 'response') {
      const state = this.stateMap.get(msg.stateId);
      if (state) {
        state.completion = msg.items || [];
        if (state.resolve) state.resolve();
      }
    } else if (msg.kind === 'service_tier') {
      console.log(`[Supermaven] Tier: ${msg.display || msg.service_tier}`);
    }
  }

  sendJson(msg) {
    if (this.binaryProcess && this.binaryProcess.stdin) {
      this.binaryProcess.stdin.write(JSON.stringify(msg) + '\n');
    }
  }

  async getCompletion(documentText, cursorOffset, filePath = 'untitled') {
    if (!this.binaryProcess) {
      await this.initialize();
    }
    
    if (!this.binaryProcess) {
      return '';
    }
    
    this.stateId++;
    const stateIdStr = this.stateId.toString();
    
    const completionPromise = new Promise((resolve) => {
      this.stateMap.set(stateIdStr, { completion: [], resolve });
      setTimeout(() => {
        const state = this.stateMap.get(stateIdStr);
        if (state && state.resolve) state.resolve();
      }, 2000);
    });
    
    this.sendJson({
      kind: 'state_update',
      newId: stateIdStr,
      updates: [
        { kind: 'file_update', path: filePath, content: documentText },
        { kind: 'cursor_update', path: filePath, offset: cursorOffset }
      ]
    });
    
    await completionPromise;
    
    const state = this.stateMap.get(stateIdStr);
    this.stateMap.delete(stateIdStr);
    
    if (!state || !state.completion) return '';
    
    let text = '';
    for (const item of state.completion) {
      if (item.kind === 'text') text += item.text;
    }
    
    return text;
  }

  makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Supermaven-VSCode/1.1.12',
          'Content-Type': 'application/json',
          ...options.headers
        }
      };
      
      const req = client.request(reqOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            body
          });
        });
      });
      
      req.on('error', reject);
      
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  async chatCompletion(messages, options = {}) {
    await this.initialize();
    
    const lastMsg = messages[messages.length - 1];
    const prompt = lastMsg?.content || '';
    
    const completion = await this.getCompletion(prompt, prompt.length);
    
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options.model || 'supermaven-free',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: completion || 'No completion available' },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
  }

  async chatCompletionStream(messages, options = {}) {
    throw new Error('Streaming not supported');
  }

  cleanup() {
    if (this.binaryProcess) {
      this.binaryProcess.kill();
      this.binaryProcess = null;
    }
  }
}
