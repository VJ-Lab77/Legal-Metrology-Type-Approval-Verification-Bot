/**
 * Parses free-form WhatsApp messages to extract SA approval numbers and optional specs.
 *
 * @example parseRequest("check SA-1234/05") → { saNo: "SA-1234/05", ... }
 * @example parseRequest("SA 4521") → { saNo: "SA4521", ... }
 * @example parseRequest("Please verify SA-0089/12 class III max 60kg") → saNo + class + maxMin
 * @example parseRequest("Check SA1234 software version 2.3.1") → saNo + softwareVersion
 * @example parseRequest("🔍 check SA-2201/18 please") → { saNo: "SA-2201/18", ... }
 * @example parseRequest("verify sa-1111/03") → { saNo: "SA-1111/03", ... }
 * @example parseRequest("#SA-5555") → { saNo: "SA-5555", ... }
 * @example parseRequest("check SA 3333 / 07") → { saNo: "SA-3333/07", ... }
 * @example parseRequest("Good morning everyone") → null
 * @example parseRequest("The weather is nice today SA road is busy") → null
 */

/** SA number pattern: SA followed by 1–6 digits, optional /suffix. */
const SA_PATTERN = /\b(?:check|verify|lookup|[?#])?\s*SA[\s\-]?(\d{1,6})(?:\s*\/\s*(\d{1,4}))?\b/i;

/** Alternative pattern when message starts with a command prefix. */
const SA_PATTERN_LOOSE = /SA[\s\-]?(\d{1,6})(?:\s*\/\s*(\d{1,4}))?/i;

export interface ParsedRequest {
  saNo: string | null;
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

/**
 * Normalises a matched SA number to uppercase with optional slash suffix.
 * Preserves a hyphen when present in the original text (e.g. SA-1234/05).
 */
function buildSaNo(main: string, suffix: string | undefined, hadHyphen: boolean): string {
  const useHyphen = hadHyphen || !!suffix;
  const base = useHyphen ? `SA-${main}` : `SA${main}`;
  return suffix ? `${base}/${suffix}` : base;
}

/**
 * Extracts optional specification fields from surrounding message text.
 */
function extractSpecs(text: string): ParsedRequest['specs'] {
  const specs: ParsedRequest['specs'] = {};

  const classMatch = text.match(/\bclass\s+(IIIL|IIII|III|II|I)\b/i);
  if (classMatch) specs.class = classMatch[1].toUpperCase();

  const maxMatch = text.match(/\bmax\s+([\d.,]+\s*(?:kg|g|t|tonnes?|lb|lbs)?)\b/i);
  if (maxMatch) specs.maxMin = maxMatch[1].trim();

  const swMatch =
    text.match(/\b(?:sw|software)\s+(?:version\s+)?([^\s,;]+)/i) ??
    text.match(/\bv([\d.]+)\b/i);
  if (swMatch) specs.softwareVersion = swMatch[1].trim();

  const typeMatch = text.match(/\b(?:type|model)\s*:\s*([^\n,;]+)/i);
  if (typeMatch) specs.type = typeMatch[1].trim();

  const submitterMatch = text.match(/\bsubmitter\s*:\s*([^\n,;]+)/i);
  if (submitterMatch) specs.submitter = submitterMatch[1].trim();

  return specs;
}

/**
 * Returns true if the message looks like an approval check request.
 * @param text - Raw WhatsApp message body
 */
export function isCheckRequest(text: string): boolean {
  if (!text || !text.trim()) return false;

  const trimmed = text.trim();
  const prefixPattern = /^(?:check|verify|lookup|[?#])\b/i;
  if (prefixPattern.test(trimmed)) return true;

  return SA_PATTERN.test(text) || SA_PATTERN_LOOSE.test(text);
}

/**
 * Parses a WhatsApp message for an SA approval number and optional specs.
 * @param text - Raw message body
 * @returns ParsedRequest or null if no SA number detected
 */
export function parseRequest(text: string): ParsedRequest | null {
  if (!text || !text.trim()) return null;

  const match = text.match(SA_PATTERN) ?? text.match(SA_PATTERN_LOOSE);
  if (!match) return null;

  const hadHyphen = /SA[\s]*-/i.test(match[0]);
  const saNo = buildSaNo(match[1], match[2], hadHyphen);
  const specs = extractSpecs(text);

  return {
    saNo,
    aa: null,
    amendment: null,
    specs,
    rawText: text,
  };
}
