import { format } from 'date-fns';
import type { LookupResult } from '../lookup/register';
import type { ParsedRequest } from '../parser/inputParser';

const DATE_FMT = 'dd MMM yyyy';

/**
 * Formats a date for display, or returns "—" / "No expiry" as appropriate.
 */
function formatDate(date: Date | null | undefined, expired = false): string {
  if (!date) return expired ? '—' : 'No expiry';
  return format(date, DATE_FMT);
}

/**
 * Returns a display string for a field, using "—" for blank values.
 */
function field(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v || '—';
}

/**
 * Formats a lookup result as a WhatsApp-friendly plain-text reply.
 * @param result - Lookup verdict from the register
 * @param request - Original parsed request (for displaying requested SA_No)
 */
export function formatReply(result: LookupResult, request: ParsedRequest): string {
  const saNo = request.saNo ?? 'unknown';
  const record = result.record;

  if (result.status === 'APPROVED' && record) {
    const lines = [
      '✅ *APPROVED*',
      `SA No: ${record.saNo}`,
      `Submitter: ${field(record.submitter)}`,
      `Type: ${field(record.type)}`,
      `Class: ${field(record.class)}`,
      `Max/Min: ${field(record.maxMin)}`,
      `Software: ${field(record.softwareVersion)}`,
      `Expiry: ${formatDate(record.expiryDate)}`,
    ];

    if (result.specMismatches.length > 0) {
      lines.push(`⚠️ Spec note: ${result.specMismatches.join('; ')}`);
    }

    return lines.join('\n');
  }

  if (result.status === 'DENIED_EXPIRED' && record) {
    return [
      '❌ *DENIED — Expired*',
      `SA No: ${record.saNo}`,
      `Submitter: ${field(record.submitter)}`,
      `Expiry: ${formatDate(record.expiryDate, true)} (expired)`,
      'This type approval has expired. Contact WeighSoft for renewal.',
    ].join('\n');
  }

  return [
    '❌ *DENIED — Not Found*',
    `SA No: ${saNo}`,
    'No matching type approval found in the register.',
    'Please double-check the SA number or contact WeighSoft.',
  ].join('\n');
}
