# WeighSoft Bot — Cursor Quick Reference

## Phase Order
1. Scaffold       → package.json, tsconfig, folder structure
2. Types + Loader → excelLoader.ts (reads + normalises Excel)
3. Input Parser   → extracts SA_No from free-form WhatsApp messages
4. Lookup Logic   → decision rule: APPROVED / DENIED_EXPIRED / DENIED_NOT_FOUND
5. Reply Format   → WhatsApp-friendly message formatting
6. Bot Client     → whatsapp-web.js setup + message handler
7. Entry Point    → index.ts wiring + PM2 config
8. Test Cases     → 15 sample inputs with expected outputs
9. README         → deployment + VPS setup notes

## Key Decision Rules
| Condition                        | Status              |
|----------------------------------|---------------------|
| SA_No found + ExpiryDate in past | DENIED_EXPIRED      |
| SA_No found + no ExpiryDate      | APPROVED (no expiry)|
| SA_No found + future ExpiryDate  | APPROVED            |
| SA_No not in register            | DENIED_NOT_FOUND    |

## SA Number Patterns (regex)
  /\bSA[\s\-]?(\d{1,6})(\/\d{1,4})?\b/i

## Column Names in Excel (header row 2)
  SA_No | AA | Amndm | Submitter | Date of Approval | Expiry Date |
  Type | Max/Min | Scale interval | Class | LMID |
  Software version Number | Load Receptor |
  No/Capacity/Description of Load Cells | Junction Box | Site Specific

## Deployment Checklist
  [ ] Node 18+ on VPS
  [ ] npm install && npm run build
  [ ] .env filled in (never commit)
  [ ] Excel file at EXCEL_PATH
  [ ] pm2 start pm2.config.js
  [ ] pm2 save && pm2 startup
  [ ] Scan QR code with bot WhatsApp number
