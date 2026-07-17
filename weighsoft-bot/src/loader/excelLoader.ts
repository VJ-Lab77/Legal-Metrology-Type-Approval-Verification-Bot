import * as XLSX from 'xlsx';
import chokidar from 'chokidar';
import { parse, isValid } from 'date-fns';
import { createLogger } from '../logger';
import type { ApprovalRecord, RawRow, RegisterMap } from './types';

const log = createLogger('loader');

type RawRowField = keyof RawRow;

/** Extra fields used only during row parsing (combined into LoadCells). */
type ParseField = RawRowField | 'LoadCellsCount' | 'LoadCellsCapacity' | 'LoadCellsDescription';

/** Normalised header text → parse field name. */
const HEADER_ALIASES: Record<string, ParseField> = {
  sa_no: 'SA_No',
  aa: 'AA',
  amndm: 'Amndm',
  submitter: 'Submitter',
  'date of approval': 'DateOfApproval',
  'expiry date': 'ExpiryDate',
  type: 'Type',
  'max/min': 'MaxMin',
  'max: , min:': 'MaxMin',
  'scale interval': 'ScaleInterval',
  class: 'Class',
  lmid: 'LMID',
  'software version number': 'SoftwareVersion',
  'load receptor': 'LoadReceptor',
  'no/capacity/description of load cells': 'LoadCells',
  'no of load cells': 'LoadCellsCount',
  'capacity of load cells': 'LoadCellsCapacity',
  'description of load cell': 'LoadCellsDescription',
  'junction box': 'JunctionBox',
  'site specific': 'SiteSpecific',
};

const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'M/d/yyyy'];

/**
 * Trims whitespace and collapses internal runs of spaces to a single space.
 */
function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

/**
 * Normalises a header cell for alias lookup.
 */
function normalizeHeaderName(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

/**
 * Normalises an SA approval number key: uppercase, trimmed, quotes stripped.
 */
function normalizeSaNo(value: unknown): string {
  return normalizeString(value).replace(/^["']|["']$/g, '').toUpperCase();
}

/**
 * Parses a date from various string formats or an Excel serial number.
 * @returns Parsed Date or null if unparseable / blank.
 */
function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && !Number.isNaN(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const d = new Date(parsed.y, parsed.m - 1, parsed.d);
      return isValid(d) ? d : null;
    }
  }

  const str = normalizeString(value);
  if (!str) return null;

  for (const fmt of DATE_FORMATS) {
    const d = parse(str, fmt, new Date());
    if (isValid(d)) return d;
  }

  const fallback = new Date(str);
  return isValid(fallback) ? fallback : null;
}

/**
 * Builds a RawRow field → column-index map from the header row.
 */
function buildFieldColumnMap(headerRow: unknown[]): Map<ParseField, number> {
  const map = new Map<ParseField, number>();

  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeaderName(cell);
    if (!norm) return;

    const field = HEADER_ALIASES[norm];
    if (field && !map.has(field)) {
      map.set(field, idx);
    }
  });

  return map;
}

/**
 * Reads a cell value by field from a data row.
 */
function cellByField(row: unknown[], fieldMap: Map<ParseField, number>, field: ParseField): string {
  const idx = fieldMap.get(field);
  if (idx === undefined) return '';
  return normalizeString(row[idx]);
}

/**
 * Converts a raw sheet row into a typed RawRow object.
 */
function rowToRawRow(row: unknown[], fieldMap: Map<ParseField, number>): RawRow {
  let loadCells = cellByField(row, fieldMap, 'LoadCells');
  if (!loadCells) {
    const parts = [
      cellByField(row, fieldMap, 'LoadCellsCount'),
      cellByField(row, fieldMap, 'LoadCellsCapacity'),
      cellByField(row, fieldMap, 'LoadCellsDescription'),
    ].filter(Boolean);
    loadCells = parts.join('; ');
  }

  return {
    SA_No: cellByField(row, fieldMap, 'SA_No'),
    AA: cellByField(row, fieldMap, 'AA'),
    Amndm: cellByField(row, fieldMap, 'Amndm'),
    Submitter: cellByField(row, fieldMap, 'Submitter'),
    DateOfApproval: cellByField(row, fieldMap, 'DateOfApproval'),
    ExpiryDate: cellByField(row, fieldMap, 'ExpiryDate'),
    Type: cellByField(row, fieldMap, 'Type'),
    MaxMin: cellByField(row, fieldMap, 'MaxMin'),
    ScaleInterval: cellByField(row, fieldMap, 'ScaleInterval'),
    Class: cellByField(row, fieldMap, 'Class'),
    LMID: cellByField(row, fieldMap, 'LMID'),
    SoftwareVersion: cellByField(row, fieldMap, 'SoftwareVersion'),
    LoadReceptor: cellByField(row, fieldMap, 'LoadReceptor'),
    LoadCells: loadCells,
    JunctionBox: cellByField(row, fieldMap, 'JunctionBox'),
    SiteSpecific: cellByField(row, fieldMap, 'SiteSpecific'),
  };
}

/**
 * Parses the AA column to a numeric amendment value (null when 0 / blank).
 */
function parseAaNumber(aa: string): number | null {
  const cleaned = aa.replace(/`/g, '').trim();
  if (!cleaned || cleaned === '0') return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : Math.floor(n);
}

/**
 * Builds a display SA number from numeric SA_No and AA columns.
 */
function formatDisplaySaNo(saNoBase: string, aa: string): string {
  const aaNum = parseAaNumber(aa);
  if (aaNum !== null) {
    return `SA-${saNoBase}/${String(aaNum).padStart(2, '0')}`;
  }
  return `SA-${saNoBase}`;
}

/**
 * Generates lookup keys for a register row (multiple formats technicians may type).
 */
function generateLookupKeys(saNoBase: string, aa: string, includeBaseKeys: boolean): string[] {
  const keys = new Set<string>();
  const aaNum = parseAaNumber(aa);

  if (includeBaseKeys) {
    keys.add(`SA${saNoBase}`);
    keys.add(`SA-${saNoBase}`);
  }

  if (aaNum !== null) {
    const padded = String(aaNum).padStart(2, '0');
    keys.add(`SA${saNoBase}/${padded}`);
    keys.add(`SA-${saNoBase}/${padded}`);
    keys.add(`SA-${saNoBase.padStart(4, '0')}/${padded}`);
  }

  return [...keys].map(normalizeSaNo);
}

/**
 * Scores a row for "latest amendment" selection within an SA_No group.
 */
function rowAmendmentScore(row: RawRow): number {
  const aa = parseAaNumber(row.AA) ?? 0;
  const amndm = parseFloat(row.Amndm) || 0;
  const date = parseDate(row.DateOfApproval);
  return aa * 1_000_000 + amndm * 1_000 + (date ? date.getTime() / 1e12 : 0);
}

/**
 * Selects the latest amendment row from a group of rows for one SA_No.
 * Priority: highest AA, then highest Amndm, then latest DateOfApproval, then last row.
 */
function selectLatestRow(rows: RawRow[]): RawRow {
  let best = rows[rows.length - 1];
  let bestScore = rowAmendmentScore(best);

  for (let i = rows.length - 2; i >= 0; i--) {
    const score = rowAmendmentScore(rows[i]);
    if (score > bestScore) {
      best = rows[i];
      bestScore = score;
    }
  }

  return best;
}

/**
 * Converts a RawRow into a normalised ApprovalRecord.
 */
function rawRowToRecord(saNo: string, row: RawRow, allRows: RawRow[]): ApprovalRecord {
  return {
    saNo,
    aa: row.AA,
    amendment: row.Amndm || row.AA,
    submitter: row.Submitter,
    dateOfApproval: parseDate(row.DateOfApproval),
    expiryDate: parseDate(row.ExpiryDate),
    type: row.Type,
    maxMin: row.MaxMin,
    scaleInterval: row.ScaleInterval,
    class: row.Class,
    lmid: row.LMID,
    softwareVersion: row.SoftwareVersion,
    loadReceptor: row.LoadReceptor,
    loadCells: row.LoadCells,
    junctionBox: row.JunctionBox,
    siteSpecific: row.SiteSpecific,
    rawAmendmentRows: allRows,
  };
}

/**
 * Loads and normalises the Excel register into an in-memory map keyed by SA_No.
 * @param filePath - Path to the .xlsx register file
 * @param sheetName - Worksheet tab name
 * @param headerRow - 1-based row number containing column headers
 * @returns RegisterMap — empty map on error (never throws)
 */
export function loadRegister(filePath: string, sheetName: string, headerRow: number): RegisterMap {
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      log.error(`Sheet "${sheetName}" not found in ${filePath}`);
      return new Map();
    }

    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headerIdx = headerRow - 1;
    if (headerIdx < 0 || headerIdx >= rows.length) {
      log.error(`Header row ${headerRow} out of range in ${filePath}`);
      return new Map();
    }

    const fieldMap = buildFieldColumnMap(rows[headerIdx]);
    if (!fieldMap.has('SA_No')) {
      log.error(`SA_No column not found in header row ${headerRow} of ${filePath}`);
      return new Map();
    }

    const grouped = new Map<string, RawRow[]>();

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const raw = rowToRawRow(row, fieldMap);
      const saNoBase = normalizeString(raw.SA_No);
      if (!saNoBase) continue;

      const existing = grouped.get(saNoBase) ?? [];
      existing.push(raw);
      grouped.set(saNoBase, existing);
    }

    const register: RegisterMap = new Map();

    for (const [saNoBase, rawRows] of grouped) {
      const latest = selectLatestRow(rawRows);
      const latestRecord = rawRowToRecord(formatDisplaySaNo(saNoBase, latest.AA), latest, rawRows);

      for (const key of generateLookupKeys(saNoBase, latest.AA, true)) {
        register.set(key, latestRecord);
      }

      for (const raw of rawRows) {
        const record = rawRowToRecord(formatDisplaySaNo(saNoBase, raw.AA), raw, rawRows);
        for (const key of generateLookupKeys(saNoBase, raw.AA, false)) {
          register.set(key, record);
        }
      }
    }

    log.info(`Loaded ${grouped.size} SA numbers (${register.size} lookup keys) from ${filePath}`);
    return register;
  } catch (err) {
    log.error(`Failed to load register from ${filePath}:`, err);
    return new Map();
  }
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Watches the Excel file for changes and hot-reloads the register.
 * @param filePath - Path to the .xlsx register file
 * @param sheetName - Worksheet tab name
 * @param headerRow - 1-based header row number
 * @param onReload - Callback invoked with the freshly loaded register
 */
export function watchAndReload(
  filePath: string,
  sheetName: string,
  headerRow: number,
  onReload: (register: RegisterMap) => void
): void {
  const watcher = chokidar.watch(filePath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  const doReload = () => {
    log.info(`Register file changed — reloading ${filePath}`);
    const register = loadRegister(filePath, sheetName, headerRow);
    onReload(register);
  };

  watcher.on('change', () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(doReload, 1000);
  });

  watcher.on('error', (err) => {
    log.error('File watcher error:', err);
  });

  log.info(`Watching ${filePath} for changes`);
}
