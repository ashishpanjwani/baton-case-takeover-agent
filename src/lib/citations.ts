/**
 * Citation matching. Pure functions, used on the server (to verify a report)
 * and in the browser (to highlight the cited excerpt in the document viewer).
 *
 * Matching is deliberately strict: after normalising case, whitespace, quote
 * marks and dashes, the quoted text must appear verbatim in the cited document.
 * A quote may use "..." to join fragments, which must appear in order on the same page.
 */

const MIN_SEGMENT = 8; // normalised chars; avoids trivially matching short words
const MIN_TOTAL = 12;

interface Normalised {
  norm: string;
  /** map[i] = index in the raw string of normalised char i */
  map: number[];
}

const CHAR_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "“": '"', "”": '"', "„": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
  " ": " ",
};

export function normalise(raw: string): Normalised {
  let norm = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < raw.length; i++) {
    let ch = raw[i];
    ch = CHAR_MAP[ch] ?? ch;
    if (/\s/.test(ch)) {
      pendingSpace = norm.length > 0;
      continue;
    }
    if (pendingSpace) {
      norm += " ";
      map.push(i);
      pendingSpace = false;
    }
    norm += ch.toLowerCase();
    map.push(i);
  }
  return { norm, map };
}

function splitQuote(quote: string): string[] {
  return quote
    .replace(/…/g, "...")
    .split(/\.\.\.+/)
    .map((s) => normalise(s).norm.replace(/^[\s"']+|[\s"']+$/g, ""))
    .filter((s) => s.length > 0);
}

export interface QuoteMatch {
  /** 1-based page number (1 for text documents) */
  page: number;
  /** Character ranges in the raw page text, one per quote fragment */
  ranges: Array<{ start: number; end: number }>;
}

/** Find a quote in a document's pages. Returns null if it cannot be matched. */
export function locateQuote(quote: string, pages: string[]): QuoteMatch | null {
  const segments = splitQuote(quote);
  if (segments.length === 0) return null;
  const total = segments.reduce((n, s) => n + s.length, 0);
  if (total < MIN_TOTAL || segments.some((s) => s.length < MIN_SEGMENT && segments.length > 1)) return null;

  // Prefer a match fully on one page.
  for (let p = 0; p < pages.length; p++) {
    const m = matchSegments(segments, normalise(pages[p]));
    if (m) return { page: p + 1, ranges: m };
  }

  // Fall back to a match that spans a page break.
  const joined = pages.join("\n");
  const n = normalise(joined);
  const m = matchSegments(segments, n);
  if (!m) return null;
  const starts: number[] = [];
  let acc = 0;
  for (const pg of pages) {
    starts.push(acc);
    acc += pg.length + 1;
  }
  const first = m[0].start;
  let pageIdx = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= first) pageIdx = i;
  // Clip ranges to the starting page for highlighting purposes.
  const pageStart = starts[pageIdx];
  const pageEnd = pageStart + pages[pageIdx].length;
  const ranges = m
    .filter((r) => r.start < pageEnd)
    .map((r) => ({ start: r.start - pageStart, end: Math.min(r.end, pageEnd) - pageStart }));
  return { page: pageIdx + 1, ranges };
}

function matchSegments(segments: string[], hay: Normalised): Array<{ start: number; end: number }> | null {
  const ranges: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (const seg of segments) {
    const idx = hay.norm.indexOf(seg, from);
    if (idx < 0) return null;
    const end = idx + seg.length - 1;
    ranges.push({ start: hay.map[idx], end: hay.map[end] + 1 });
    from = idx + seg.length;
  }
  return ranges;
}
