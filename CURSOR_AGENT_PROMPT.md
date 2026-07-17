# WeighSoft Legal Metrology WhatsApp Bot — Cursor AI Agent Master Prompt

> **How to use this file in Cursor:**
> Open Cursor, start a new chat with the AI Agent (Cmd/Ctrl+Shift+P → "New AI Chat", or use the sidebar Agent tab).
> Paste the contents of whichever section you need, or reference this file with `@CURSOR_AGENT_PROMPT.md` in your chat.
> Work through the phases in order. Each phase section is a self-contained prompt you can paste directly.

---

## PROJECT OVERVIEW (paste this first in every new Cursor session)

```
You are helping me build the WeighSoft Legal Metrology WhatsApp Bot.

Project: A WhatsApp group bot for scale technicians in South Africa. Technicians post an SA approval number (and optional specs) into a WhatsApp group. The bot looks it up in a master Excel register (~28,790 rows) and replies Approved / Denied with matched details.

Tech stack:
- Node.js + TypeScript (strict mode)
- whatsapp-web.js (with Puppeteer/Chromium) for WhatsApp
- SheetJS (xlsx package) for Excel reading
- chokidar for file-watch / hot-reload
- fuse.js for fuzzy matching
- date-fns for date handling
- zod for runtime validation
- PM2 for process management on Linux VPS
- (Stretch) pdf-parse for PDF certificates
- (Stretch) tesseract.js for OCR on data-plate photos

Project root: ./weighsoft-bot
All source in: ./weighsoft-bot/src
Config via .env (never commit secrets)

Always:
- Use TypeScript with strict: true
- Add JSDoc comments on exported functions
- Handle errors gracefully — the bot must never crash the process
- Log with a simple tagged logger (no external log lib needed, just console with timestamps)
```

---

## PHASE 1 — Project Scaffold

**Paste this prompt into Cursor Agent:**

```
Using the project overview above, scaffold the full project structure for weighsoft-bot.

Create these files and directories:
weighsoft-bot/
  src/
    loader/
      excelLoader.ts        ← loads + normalises the Excel register
      types.ts              ← all shared TypeScript types/interfaces
    bot/
      client.ts             ← whatsapp-web.js setup, QR/session persistence
      messageHandler.ts     ← listens, detects requests, dispatches
    parser/
      inputParser.ts        ← extracts SA_No + specs from free-form text
    lookup/
      register.ts           ← in-memory register, lookup logic, decision rule
    reply/
      formatter.ts          ← formats the WhatsApp reply message
    config.ts               ← loads .env values with zod validation
    index.ts                ← entry point
  data/
    .gitkeep               ← placeholder; real Excel file goes here
  sessions/
    .gitkeep               ← whatsapp-web.js session storage
  .env.example
  .gitignore
  package.json             ← all deps listed below
  tsconfig.json            ← strict mode
  pm2.config.js
  README.md

package.json dependencies:
  whatsapp-web.js, qrcode-terminal, xlsx, chokidar, fuse.js,
  date-fns, zod, dotenv
devDependencies:
  typescript, ts-node, @types/node, nodemon

tsconfig: target ES2020, module CommonJS, strict true, outDir dist, rootDir src.

.env.example should contain:
  EXCEL_PATH=./data/register.xlsx
  EXCEL_SHEET=Sheet1
  HEADER_ROW=2
  GROUP_NAME=WeighSoft Technicians
  SESSION_PATH=./sessions
  CHECK_PREFIX=check
  LOG_LEVEL=info

Generate every file with correct content, not just stubs. The package.json must have a build script (tsc), a dev script (ts-node src/index.ts), and a start script (node dist/index.js).
```

---

## PHASE 2 — Types & Excel Loader

**Paste this prompt:**

```
Using the project overview, implement src/loader/types.ts and src/loader/excelLoader.ts.

### types.ts
Define and export these interfaces:

interface RawRow {
  SA_No: string;
  AA: string;
  Amndm: string;
  Submitter: string;
  DateOfApproval: string;
  ExpiryDate: string;
  Type: string;
  MaxMin: string;
  ScaleInterval: string;
  Class: string;
  LMID: string;
  SoftwareVersion: string;
  LoadReceptor: string;
  LoadCells: string;
  JunctionBox: string;
  SiteSpecific: string;
}

interface ApprovalRecord {
  saNo: string;           // normalised: uppercase, trimmed
  aa: string;
  amendment: string;      // latest amendment string
  submitter: string;
  dateOfApproval: Date | null;
  expiryDate: Date | null;  // null = no expiry = valid forever
  type: string;
  maxMin: string;
  scaleInterval: string;
  class: string;
  lmid: string;
  softwareVersion: string;
  loadReceptor: string;
  loadCells: string;
  junctionBox: string;
  siteSpecific: string;
  rawAmendmentRows: RawRow[];  // all raw rows for this SA_No
}

type RegisterMap = Map<string, ApprovalRecord>;

### excelLoader.ts
Implement:

export function loadRegister(filePath: string, sheetName: string, headerRow: number): RegisterMap

Rules:
1. Use SheetJS: read file with xlsx.readFile, get the sheet, convert to array of arrays (not JSON) starting from row 1, manually map column indices to field names using row (headerRow - 1) as the header row (0-indexed). The sheet header is on row 2 (index 1).
2. Column mapping (0-indexed, map by header name not position — headers may shift):
   SA_No, AA, Amndm, Submitter, Date of Approval, Expiry Date, Type, Max/Min,
   Scale interval, Class, LMID, Software version Number, Load Receptor,
   No/Capacity/Description of Load Cells, Junction Box, Site Specific
3. Normalisation:
   - All string fields: trim whitespace, collapse internal multiple spaces to one
   - SA_No: uppercase, strip surrounding quotes
   - Dates: try parsing with multiple formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD,
     Excel serial number (if value is a number). Return null if unparseable.
   - Blank ExpiryDate = null (treated as no expiry).
   - Numeric-looking fields (Max/Min, Scale interval) kept as strings — too messy to coerce.
4. Grouping: group all rows by normalised SA_No. For each group, select the "latest amendment" row using this priority: (a) highest numeric Amndm value, (b) if tied or non-numeric, latest DateOfApproval, (c) last row in file. Store all raw rows in rawAmendmentRows.
5. Return a Map<string, ApprovalRecord>.

Also export:
export function watchAndReload(
  filePath: string,
  sheetName: string,
  headerRow: number,
  onReload: (register: RegisterMap) => void
): void

Uses chokidar to watch the file. On 'change' event, wait 1000ms (debounce), reload, call onReload. Log reload events.

Handle all errors — if the file is missing or corrupt, log the error and return an empty Map (don't crash).
```

---

## PHASE 3 — Input Parser

**Paste this prompt:**

```
Using the project overview, implement src/parser/inputParser.ts.

Export:
interface ParsedRequest {
  saNo: string | null;        // e.g. "SA-1234/05" or "SA1234"
  aa: string | null;
  amendment: string | null;
  specs: {
    maxMin?: string;
    class?: string;
    softwareVersion?: string;
    type?: string;
    submitter?: string;
  };
  rawText: string;
}

export function parseRequest(text: string): ParsedRequest | null

Rules:
1. Return null if no SA number pattern is detected (ignore unrelated chatter).
2. SA number patterns to detect (case-insensitive):
   - "SA-1234/05", "SA 1234/05", "SA1234/05"
   - "SA-1234", "SA 1234", "SA1234"
   - With optional prefix "check", "verify", "lookup", "?", "#"
   - The number part: 1–6 digits, optionally followed by "/" and 1–4 digits
3. Extract optional specs from the surrounding text using simple keyword patterns:
   - Class: "class [IIII|III|II|I|IIIL]" or just the class value near "class"
   - Max: "max [value][unit]" e.g. "max 60kg", "max 30t"
   - Software version: "sw [version]", "software [version]", "v[version]"
   - Type: anything after "type:" or "model:"
4. Normalise saNo: uppercase, collapse spaces, keep the slash if present.
5. Be tolerant: extra punctuation, newlines, emoji in messages are fine.

Also export:
export function isCheckRequest(text: string): boolean
Returns true if the message looks like a check request (contains SA pattern or starts with check/verify/lookup prefix).

Write unit-testable pure functions. Add 10 JSDoc examples in comments showing input → output.
```

---

## PHASE 4 — Register Lookup & Decision Logic

**Paste this prompt:**

```
Using the project overview, implement src/lookup/register.ts.

Export:
type LookupStatus = 'APPROVED' | 'DENIED_EXPIRED' | 'DENIED_NOT_FOUND';

interface LookupResult {
  status: LookupStatus;
  record: ApprovalRecord | null;
  reason: string;
  specMismatches: string[];   // list of spec fields that don't match (if any)
  checkedAt: Date;
}

export function lookupApproval(
  register: RegisterMap,
  request: ParsedRequest
): LookupResult

Decision logic:
1. If saNo is null → DENIED_NOT_FOUND, reason: "No SA number detected in request."
2. Normalise saNo: uppercase, trim.
3. Exact match in RegisterMap first.
4. If no exact match, try fuzzy: use fuse.js on all SA_No keys with threshold 0.2, return best match if score < 0.2, else NOT_FOUND.
5. If found:
   a. Check ExpiryDate: if not null AND expiryDate < today → DENIED_EXPIRED, reason includes expiry date.
   b. Otherwise → APPROVED.
6. Spec checking (informational, doesn't change APPROVED status but populates specMismatches):
   - If request.specs.class is given and record.class is non-blank:
     normalise both to uppercase, check for substring match.
   - If request.specs.maxMin is given and record.maxMin is non-blank:
     check substring match.
   - If request.specs.softwareVersion is given and record.softwareVersion is non-blank:
     check substring match.
   - For each mismatch add a string like: "Class: requested 'III' but record shows 'IIII'"

Also export:
export class LiveRegister {
  private register: RegisterMap;
  constructor(initial: RegisterMap) { ... }
  update(newRegister: RegisterMap): void { ... }
  lookup(request: ParsedRequest): LookupResult { ... }
}
```

---

## PHASE 5 — Reply Formatter

**Paste this prompt:**

```
Using the project overview, implement src/reply/formatter.ts.

Export:
export function formatReply(result: LookupResult, request: ParsedRequest): string

The reply must be plain text suitable for WhatsApp (no markdown, use emoji for visual status).
Format:

For APPROVED:
✅ *APPROVED*
SA No: SA-XXXX/XX
Submitter: [name]
Type: [type]
Class: [class]
Max/Min: [maxmin]
Software: [version or "—"]
Expiry: [date string or "No expiry"]
[if specMismatches.length > 0]
⚠️ Spec note: [list mismatches separated by "; "]

For DENIED_EXPIRED:
❌ *DENIED — Expired*
SA No: SA-XXXX/XX
Submitter: [name]
Expiry: [date] (expired)
This type approval has expired. Contact WeighSoft for renewal.

For DENIED_NOT_FOUND:
❌ *DENIED — Not Found*
SA No: [requested or "unknown"]
No matching type approval found in the register.
Please double-check the SA number or contact WeighSoft.

Rules:
- Dates formatted as DD MMM YYYY (e.g. 15 Jan 2024)
- Blank/null fields shown as "—"
- Keep it under 300 characters where possible — WhatsApp group messages should be concise
- No HTML, no markdown asterisks except for the status line bold (*APPROVED*)
```

---

## PHASE 6 — WhatsApp Bot Client & Message Handler

**Paste this prompt:**

```
Using the project overview, implement src/bot/client.ts and src/bot/messageHandler.ts.

### client.ts
Use whatsapp-web.js. Export:

export async function createClient(sessionPath: string): Promise<Client>

- Create a LocalAuth client with session stored at sessionPath.
- On 'qr' event: display QR in terminal using qrcode-terminal.
- On 'ready' event: log "WhatsApp client ready".
- On 'auth_failure': log error, do NOT exit process (let PM2 restart).
- On 'disconnected': log reason. Attempt client.initialize() again after 10s delay.
- Initialize and return the client.

### messageHandler.ts
Export:

export function attachMessageHandler(
  client: Client,
  liveRegister: LiveRegister,
  groupName: string
): void

Logic:
1. Listen to client.on('message', async (msg) => { ... })
2. Filter: only process messages from a group whose name contains groupName (case-insensitive). Get chat = await msg.getChat(); if (!chat.isGroup) return; if (!chat.name.toLowerCase().includes(groupName.toLowerCase())) return.
3. Call isCheckRequest(msg.body) — if false, return silently.
4. Call parseRequest(msg.body) — if null, return silently.
5. Call liveRegister.lookup(parsedRequest).
6. Call formatReply(result, parsedRequest).
7. msg.reply(replyText) — this quotes the original message in WhatsApp.
8. Wrap everything in try/catch — log errors, never crash.
9. Log each handled request: timestamp, sender, SA_No, verdict.
```

---

## PHASE 7 — Config, Entry Point & PM2

**Paste this prompt:**

```
Using the project overview, implement src/config.ts, src/index.ts, and pm2.config.js.

### config.ts
Use zod to validate process.env. Export a typed config object:

const ConfigSchema = z.object({
  EXCEL_PATH: z.string().default('./data/register.xlsx'),
  EXCEL_SHEET: z.string().default('Sheet1'),
  HEADER_ROW: z.coerce.number().default(2),
  GROUP_NAME: z.string().default('WeighSoft Technicians'),
  SESSION_PATH: z.string().default('./sessions'),
  CHECK_PREFIX: z.string().default('check'),
  LOG_LEVEL: z.enum(['debug','info','warn','error']).default('info'),
});

export const config = ConfigSchema.parse(process.env);

### index.ts
Wire everything together:
1. Load dotenv.
2. Parse config.
3. Load Excel register → create LiveRegister.
4. Start watchAndReload → on reload, call liveRegister.update(newRegister).
5. Create WhatsApp client.
6. Attach message handler.
7. Log startup summary: rows loaded, file path, group name.

### pm2.config.js
module.exports = {
  apps: [{
    name: 'weighsoft-bot',
    script: './dist/index.js',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    env: { NODE_ENV: 'production' }
  }]
};
```

---

## PHASE 8 — Test Cases

**Paste this prompt:**

```
Create src/__tests__/testCases.ts — a plain array of test cases (no test framework needed, just data) that can be run with a simple script.

Export:
interface TestCase {
  input: string;
  expectedSaNo: string | null;
  expectedStatus: 'APPROVED' | 'DENIED_EXPIRED' | 'DENIED_NOT_FOUND' | 'IGNORED';
  description: string;
}

export const testCases: TestCase[] = [ ... ]

Include at least these 15 cases:
1. "check SA-1234/05" → extract SA-1234/05
2. "SA 4521" → extract SA4521
3. "Please verify SA-0089/12 class III max 60kg" → extract SA-0089/12 + specs
4. "Check SA1234 software version 2.3.1" → extract SA1234 + sw version
5. "SA-9999/99" → NOT_FOUND (made-up number)
6. A message with emoji: "🔍 check SA-2201/18 please"
7. A multi-line message with SA number buried in it
8. "Good morning everyone" → IGNORED (no SA number)
9. "The weather is nice today SA road is busy" → IGNORED (SA not followed by digits)
10. "SA-0001" with a mock expiry in the past → DENIED_EXPIRED
11. "SA-0002" with no expiry date → APPROVED
12. "verify sa-1111/03" (lowercase) → extract SA-1111/03
13. "#SA-5555" → extract SA-5555
14. "check SA 3333 / 07" (spaces around slash) → extract SA-3333/07
15. A message with a South African phone number "+27821234567" but no SA approval number → IGNORED

Also create src/__tests__/runTests.ts that:
- Imports testCases
- Imports parseRequest and isCheckRequest
- Runs each case, prints PASS/FAIL with a diff on failure
- Can be run with: npx ts-node src/__tests__/runTests.ts
```

---

## PHASE 9 — README & Deployment Notes

**Paste this prompt:**

```
Write a complete README.md for the weighsoft-bot project. Include:

## WeighSoft Legal Metrology WhatsApp Bot

### Quick Start (Development)
1. Prerequisites: Node 18+, Chrome/Chromium installed
2. Clone repo, run npm install
3. Copy .env.example to .env, fill in EXCEL_PATH and GROUP_NAME
4. Place the register Excel file at the path in EXCEL_PATH
5. npm run dev
6. Scan QR code in terminal with the dedicated WhatsApp number

### Linking the WhatsApp Number
- The bot uses whatsapp-web.js which mirrors a real WhatsApp account via the Web API
- Use a dedicated SIM/number — NOT your personal number
- First run displays a QR code in terminal → open WhatsApp on the bot phone → Linked Devices → Link a Device → scan
- Session is saved to SESSION_PATH — subsequent starts don't need re-scanning

### VPS Deployment
1. SSH to VPS, clone repo, npm install, npm run build
2. Copy .env to server (never commit .env)
3. Install PM2 globally: npm install -g pm2
4. pm2 start pm2.config.js
5. pm2 save && pm2 startup (follow the printed command to auto-start on reboot)
6. pm2 logs weighsoft-bot — to tail logs
7. pm2 restart weighsoft-bot — after updating code

### Updating the Excel Register
- Replace the file at EXCEL_PATH on the VPS
- The bot auto-detects the change (chokidar watcher) and reloads within ~2 seconds
- No restart needed

### Bot Commands (in the WhatsApp group)
| Message example | What happens |
|---|---|
| check SA-1234/05 | Look up SA-1234/05, reply with verdict |
| SA 4521 | Same, no prefix needed |
| verify SA-0089/12 class III max 60kg | Look up + note spec details |
| Good morning | Ignored — no SA number detected |

### Environment Variables
| Variable | Default | Description |
|---|---|---|
| EXCEL_PATH | ./data/register.xlsx | Path to master register |
| EXCEL_SHEET | Sheet1 | Sheet tab name |
| HEADER_ROW | 2 | Row number containing headers |
| GROUP_NAME | WeighSoft Technicians | Must be substring of the actual group name |
| SESSION_PATH | ./sessions | WhatsApp session storage |
| LOG_LEVEL | info | debug/info/warn/error |

### Stretch Goals
- **PDF parsing**: npm install pdf-parse; implement src/stretch/pdfParser.ts to extract approval details from certificate PDFs
- **OCR**: npm install tesseract.js; implement src/stretch/ocrReader.ts to read data-plate photos sent in group

### Troubleshooting
- Bot not responding: check pm2 logs, verify GROUP_NAME matches exactly (case-insensitive substring)
- QR expired: pm2 restart weighsoft-bot, scan new QR within 60 seconds
- Session lost: delete sessions/ folder, restart, re-scan QR
- Excel not reloading: check EXCEL_PATH is absolute or correct relative to process cwd
```

---

## STRETCH GOAL A — PDF Certificate Parser

**Paste this prompt only when ready for stretch goals:**

```
Add PDF certificate parsing. Create src/stretch/pdfParser.ts.

Install: npm install pdf-parse @types/pdf-parse

Export:
interface PdfCertificateData {
  saNo: string | null;
  submitter: string | null;
  approvalDate: Date | null;
  expiryDate: Date | null;
  type: string | null;
  class: string | null;
  maxMin: string | null;
  softwareVersion: string | null;
  rawText: string;
}

export async function parseCertificatePdf(filePathOrBuffer: string | Buffer): Promise<PdfCertificateData>

Strategy:
1. Use pdf-parse to extract full text.
2. Run regex patterns to extract each field (SA number, dates, class, max, software version).
3. Return structured data with nulls for unextracted fields.
4. The function should be tolerant — partial extractions are fine.

Also update messageHandler.ts to handle PDF attachments: if a message has a PDF attachment and the text contains "check" or "certificate", download the attachment, run parseCertificatePdf, and reply with extracted details compared to the register.
```

---

## STRETCH GOAL B — Data Plate OCR

**Paste this prompt only when ready:**

```
Add data-plate photo OCR. Create src/stretch/ocrReader.ts.

Install: npm install tesseract.js

Export:
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string>
export async function parseDataPlateText(rawOcrText: string): Promise<ParsedRequest>

Strategy:
1. Use tesseract.js Worker with eng language to OCR the image buffer.
2. Run parseDataPlateText on the OCR output — reuse the existing inputParser logic.
3. In messageHandler.ts: if message has an image attachment and caption contains "check" or "plate", download image, OCR it, parse, look up register, reply.

Keep OCR as a best-effort feature — if tesseract fails or extracts no SA number, reply: "Could not read SA number from image. Please type the SA number directly."
```

---

## TIPS FOR USING THIS IN CURSOR

1. **Start a new Cursor Agent session** for each phase — paste the PROJECT OVERVIEW block first, then the phase prompt.

2. **Reference files** in Cursor with `@filename.ts` syntax so the agent can see existing code when building the next phase.

3. **After each phase**, ask Cursor: *"Review the code you just wrote and check for TypeScript errors, unhandled promise rejections, and any logic bugs."*

4. **Run incrementally**: After Phase 2, run `npx ts-node -e "const {loadRegister} = require('./src/loader/excelLoader'); console.log(loadRegister('./data/register.xlsx','Sheet1',2).size)"` to verify the loader works before building the bot.

5. **If Cursor gets confused**, paste this reset: *"Ignore previous context. Re-read @CURSOR_AGENT_PROMPT.md Phase [N] and the files listed. Now implement only what Phase [N] asks for."*

6. **For debugging WhatsApp connection issues**, ask: *"whatsapp-web.js is throwing [error]. The session is at ./sessions. How do I fix this without losing the session?"*
