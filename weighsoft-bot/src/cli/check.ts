import 'dotenv/config';
import { config } from '../config';
import { createLogger } from '../logger';
import { loadRegister } from '../loader/excelLoader';
import { isCheckRequest, parseRequest } from '../parser/inputParser';
import { lookupApproval } from '../lookup/register';
import { formatReply } from '../reply/formatter';

const log = createLogger('cli');

/**
 * Runs a single message through the full parse → lookup → reply pipeline (no WhatsApp).
 * @param message - Simulated WhatsApp message text
 */
export function runCheck(message: string): void {
  console.log('\n--- Input ---');
  console.log(message);

  if (!isCheckRequest(message)) {
    console.log('\n--- Result ---');
    console.log('IGNORED (no SA approval number detected)\n');
    return;
  }

  const parsed = parseRequest(message);
  if (!parsed) {
    console.log('\n--- Result ---');
    console.log('IGNORED (could not parse SA number)\n');
    return;
  }

  const register = loadRegister(config.EXCEL_PATH, config.EXCEL_SHEET, config.HEADER_ROW);
  const result = lookupApproval(register, parsed);
  const reply = formatReply(result, parsed);

  console.log('\n--- Parsed ---');
  console.log(`SA No: ${parsed.saNo}`);
  if (Object.keys(parsed.specs).length > 0) {
    console.log(`Specs: ${JSON.stringify(parsed.specs)}`);
  }

  console.log('\n--- Verdict ---');
  console.log(`Status: ${result.status}`);
  console.log(`Reason: ${result.reason}`);

  console.log('\n--- WhatsApp Reply ---');
  console.log(reply);
  console.log('');
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
WeighSoft Bot — offline lookup test (no WhatsApp)

Usage:
  npm run check -- "check SA-0001/05"
  npm run check -- "verify SA-0002 class III max 60kg"
  npm run check -- --demo

Options:
  --demo    Run a few built-in example messages against your Excel file
`);
    process.exit(0);
  }

  if (args[0] === '--demo') {
    log.info(`Demo mode — register: ${config.EXCEL_PATH} (${config.EXCEL_SHEET})`);
    const demos = [
      'check SA-0001/05',
      'verify SA-0002 class III max 60kg',
      'SA-9999/99',
      'Good morning everyone',
      'The weather is nice today SA road is busy',
    ];
    for (const msg of demos) {
      runCheck(msg);
    }
    return;
  }

  const message = args.join(' ');
  log.info(`Checking against ${config.EXCEL_PATH}`);
  runCheck(message);
}

main();
