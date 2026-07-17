import Fuse from 'fuse.js';
import { startOfDay, isBefore } from 'date-fns';
import type { ApprovalRecord, RegisterMap } from '../loader/types';
import type { ParsedRequest } from '../parser/inputParser';

export type LookupStatus = 'APPROVED' | 'DENIED_EXPIRED' | 'DENIED_NOT_FOUND';

export interface LookupResult {
  status: LookupStatus;
  record: ApprovalRecord | null;
  reason: string;
  specMismatches: string[];
  checkedAt: Date;
}

const FUZZY_THRESHOLD = 0.2;

/**
 * Normalises an SA number for map lookup: uppercase, trimmed.
 */
function normalizeSaNo(saNo: string): string {
  return saNo.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Checks whether a requested spec value matches the register value (substring, case-insensitive).
 */
function specMatches(requested: string, recordValue: string): boolean {
  const req = requested.toUpperCase().trim();
  const rec = recordValue.toUpperCase().trim();
  return rec.includes(req) || req.includes(rec);
}

/**
 * Compares optional request specs against the matched record (informational only).
 */
function checkSpecMismatches(request: ParsedRequest, record: ApprovalRecord): string[] {
  const mismatches: string[] = [];

  if (request.specs.class && record.class) {
    if (!specMatches(request.specs.class, record.class)) {
      mismatches.push(`Class: requested '${request.specs.class}' but record shows '${record.class}'`);
    }
  }

  if (request.specs.maxMin && record.maxMin) {
    if (!specMatches(request.specs.maxMin, record.maxMin)) {
      mismatches.push(`Max/Min: requested '${request.specs.maxMin}' but record shows '${record.maxMin}'`);
    }
  }

  if (request.specs.softwareVersion && record.softwareVersion) {
    if (!specMatches(request.specs.softwareVersion, record.softwareVersion)) {
      mismatches.push(
        `Software: requested '${request.specs.softwareVersion}' but record shows '${record.softwareVersion}'`
      );
    }
  }

  return mismatches;
}

/**
 * Attempts a fuzzy SA_No match using fuse.js when exact lookup fails.
 */
function fuzzyLookup(register: RegisterMap, saNo: string): ApprovalRecord | null {
  const keys = Array.from(register.keys());
  if (keys.length === 0) return null;

  const fuse = new Fuse(keys, {
    threshold: FUZZY_THRESHOLD,
    includeScore: true,
    isCaseSensitive: false,
  });

  const results = fuse.search(saNo);
  if (results.length === 0 || results[0].score === undefined) return null;
  if (results[0].score >= FUZZY_THRESHOLD) return null;

  const matchedKey = results[0].item;
  return register.get(matchedKey) ?? null;
}

/**
 * Looks up an SA approval number in the register and returns a verdict.
 * @param register - In-memory approval register
 * @param request - Parsed WhatsApp request
 */
export function lookupApproval(register: RegisterMap, request: ParsedRequest): LookupResult {
  const checkedAt = new Date();

  if (!request.saNo) {
    return {
      status: 'DENIED_NOT_FOUND',
      record: null,
      reason: 'No SA number detected in request.',
      specMismatches: [],
      checkedAt,
    };
  }

  const saNo = normalizeSaNo(request.saNo);
  const noHyphen = saNo.replace(/-/g, '');
  let record = register.get(saNo) ?? register.get(noHyphen) ?? null;

  if (!record) {
    record = fuzzyLookup(register, saNo);
  }

  if (!record) {
    return {
      status: 'DENIED_NOT_FOUND',
      record: null,
      reason: `No matching type approval found for ${request.saNo}.`,
      specMismatches: [],
      checkedAt,
    };
  }

  const today = startOfDay(new Date());
  if (record.expiryDate !== null && isBefore(startOfDay(record.expiryDate), today)) {
    return {
      status: 'DENIED_EXPIRED',
      record,
      reason: `Type approval expired on ${record.expiryDate.toISOString().slice(0, 10)}.`,
      specMismatches: checkSpecMismatches(request, record),
      checkedAt,
    };
  }

  return {
    status: 'APPROVED',
    record,
    reason: 'Type approval is valid.',
    specMismatches: checkSpecMismatches(request, record),
    checkedAt,
  };
}

/**
 * Thread-safe wrapper around the in-memory register with hot-reload support.
 */
export class LiveRegister {
  private register: RegisterMap;

  constructor(initial: RegisterMap) {
    this.register = initial;
  }

  /** Replaces the in-memory register (called on Excel hot-reload). */
  update(newRegister: RegisterMap): void {
    this.register = newRegister;
  }

  /** Performs a lookup against the current register snapshot. */
  lookup(request: ParsedRequest): LookupResult {
    return lookupApproval(this.register, request);
  }

  /** Returns the number of records currently loaded. */
  get size(): number {
    return this.register.size;
  }
}
