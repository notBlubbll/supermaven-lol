import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config in .config folder relative to project
const CONFIG_DIR = join(__dirname, '..', '.config');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  server: {
    port: 3000,
    host: '127.0.0.1'
  }
};

let config = null;

export function loadConfig() {
  if (config) return config;
  
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (e) {
      console.warn('Failed to load config, using defaults');
      config = DEFAULT_CONFIG;
    }
  } else {
    config = DEFAULT_CONFIG;
    // Create .config directory if it doesn't exist
    try {
      mkdirSync(CONFIG_DIR, { recursive: true });
    } catch (e) {}
  }
  
  return config;
}

export function getConfig() {
  return config || loadConfig();
}
