import { existsSync } from 'fs';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createLogger } from '../logger';

const log = createLogger('bot');

/** Common Chrome/Edge install locations (Windows + Linux). */
const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((p): p is string => !!p);

/**
 * Resolves a system Chrome/Chromium executable for Puppeteer.
 * whatsapp-web.js bundles puppeteer-core, which does not download a browser automatically.
 */
function resolveBrowserExecutable(): string | undefined {
  for (const candidate of BROWSER_CANDIDATES) {
    if (existsSync(candidate)) {
      log.info(`Using browser: ${candidate}`);
      return candidate;
    }
  }
  log.warn('No system Chrome/Edge found — install Chrome or set CHROME_PATH in .env');
  return undefined;
}

/**
 * Creates and initialises a whatsapp-web.js client with persistent session storage.
 * @param sessionPath - Directory for LocalAuth session data
 */
export async function createClient(sessionPath: string): Promise<Client> {
  const executablePath = resolveBrowserExecutable();

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    log.info('Scan this QR code with WhatsApp (Linked Devices):');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    log.info('WhatsApp client ready');
  });

  client.on('auth_failure', (msg) => {
    log.error('WhatsApp authentication failure:', msg);
  });

  client.on('disconnected', (reason) => {
    log.warn('WhatsApp disconnected:', reason);
    setTimeout(() => {
      log.info('Attempting to re-initialise WhatsApp client...');
      client.initialize().catch((err) => {
        log.error('Re-initialisation failed:', err);
      });
    }, 10_000);
  });

  await client.initialize();
  return client;
}
