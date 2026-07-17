import 'dotenv/config';
import { config } from './config';
import { createLogger } from './logger';
import { loadRegister, watchAndReload } from './loader/excelLoader';
import { LiveRegister } from './lookup/register';
import { createClient } from './bot/client';
import { attachMessageHandler } from './bot/messageHandler';

const log = createLogger('main');

/**
 * Application entry point — loads register, starts file watcher, connects WhatsApp.
 */
async function main(): Promise<void> {
  log.info('Starting WeighSoft Legal Metrology Bot...');

  const register = loadRegister(config.EXCEL_PATH, config.EXCEL_SHEET, config.HEADER_ROW);
  const liveRegister = new LiveRegister(register);

  watchAndReload(config.EXCEL_PATH, config.EXCEL_SHEET, config.HEADER_ROW, (newRegister) => {
    liveRegister.update(newRegister);
    log.info(`Register updated — ${newRegister.size} records loaded`);
  });

  log.info(`Startup summary — records: ${liveRegister.size}, excel: ${config.EXCEL_PATH}, group: ${config.GROUP_NAME}`);

  const client = await createClient(config.SESSION_PATH);
  attachMessageHandler(client, liveRegister, config.GROUP_NAME);
}

main().catch((err) => {
  log.error('Fatal startup error:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err);
});
