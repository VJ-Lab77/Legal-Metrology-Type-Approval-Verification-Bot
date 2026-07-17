# WeighSoft Legal Metrology WhatsApp Bot

A WhatsApp group bot for scale technicians in South Africa. Technicians post an SA approval number (and optional specs) into a group; the bot looks it up in a master Excel register and replies **Approved** or **Denied** with matched details.

## Quick Start (Development)

1. **Prerequisites:** Node 18+, Chrome/Chromium installed
2. Clone the repo and install dependencies:
   ```bash
   cd weighsoft-bot
   npm install
   ```
3. Copy `.env.example` to `.env` and set `EXCEL_PATH` and `GROUP_NAME`
4. Place the register Excel file at the path in `EXCEL_PATH`
5. Run in development mode:
   ```bash
   npm run dev
   ```
6. Scan the QR code shown in the terminal with the dedicated WhatsApp number

## Linking the WhatsApp Number

- The bot uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), which mirrors a real WhatsApp account via the Web API
- Use a **dedicated SIM/number** — not your personal number
- On first run, a QR code appears in the terminal → open WhatsApp on the bot phone → **Linked Devices** → **Link a Device** → scan
- Session data is saved to `SESSION_PATH` — subsequent starts do not require re-scanning

## VPS Deployment

1. SSH to your VPS, clone the repo, then:
   ```bash
   npm install
   npm run build
   ```
2. Copy `.env` to the server (never commit `.env`)
3. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```
4. Start the bot:
   ```bash
   pm2 start pm2.config.js
   ```
5. Persist across reboots:
   ```bash
   pm2 save && pm2 startup
   ```
   Follow the printed command to enable auto-start on reboot.
6. Tail logs:
   ```bash
   pm2 logs weighsoft-bot
   ```
7. Restart after code updates:
   ```bash
   pm2 restart weighsoft-bot
   ```

## Updating the Excel Register

- Replace the file at `EXCEL_PATH` on the VPS
- The bot auto-detects the change (chokidar file watcher) and reloads within ~2 seconds
- No restart needed

## Bot Commands (in the WhatsApp group)

| Message example | What happens |
|---|---|
| `check SA-1234/05` | Look up SA-1234/05, reply with verdict |
| `SA 4521` | Same — no prefix needed |
| `verify SA-0089/12 class III max 60kg` | Look up + note spec details |
| `Good morning` | Ignored — no SA number detected |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `EXCEL_PATH` | `./data/register.xlsx` | Path to master register |
| `EXCEL_SHEET` | `Sheet1` | Sheet tab name |
| `HEADER_ROW` | `2` | Row number containing headers |
| `GROUP_NAME` | `WeighSoft Technicians` | Must be a substring of the actual group name |
| `SESSION_PATH` | `./sessions` | WhatsApp session storage |
| `CHECK_PREFIX` | `check` | Reserved for future prefix filtering |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## Running Tests

```bash
npm test
```

Runs 15 parser and lookup test cases without a test framework.

## Project Structure

```
weighsoft-bot/
  src/
    loader/       Excel register loading + hot-reload
    parser/       SA number extraction from messages
    lookup/       Approval decision logic
    reply/        WhatsApp reply formatting
    bot/          whatsapp-web.js client + message handler
    __tests__/    Test cases + runner
    config.ts     Environment validation (zod)
    index.ts      Entry point
  data/           Excel register (not committed)
  sessions/       WhatsApp session storage (not committed)
```

## Stretch Goals

- **PDF parsing:** `npm install pdf-parse` — extract approval details from certificate PDFs (`src/stretch/pdfParser.ts`)
- **OCR:** `npm install tesseract.js` — read data-plate photos sent in the group (`src/stretch/ocrReader.ts`)

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot not responding | Check `pm2 logs`, verify `GROUP_NAME` matches the group (case-insensitive substring) |
| QR expired | `pm2 restart weighsoft-bot`, scan new QR within 60 seconds |
| Session lost | Delete `sessions/` folder, restart, re-scan QR |
| Excel not reloading | Check `EXCEL_PATH` is correct relative to process cwd |
