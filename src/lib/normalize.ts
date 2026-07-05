/** Text normalization and similarity helpers used by the comparison engine. */

/** Replace curly quotes/apostrophes and unicode dashes with ASCII equivalents. */
export function normalizePunctuationVariants(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");
}

export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Canonical form for tolerant comparison: lowercase, ASCII punctuation variants,
 * punctuation stripped, whitespace collapsed.
 */
export function canonical(s: string): string {
  return collapseWhitespace(
    normalizePunctuationVariants(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " "),
  );
}

/** Case-and-punctuation-preserving cleanup (whitespace + unicode variants only). */
export function cleaned(s: string): string {
  return collapseWhitespace(normalizePunctuationVariants(s));
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Similarity in [0, 1]: 1 means identical. */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Word-level diff (LCS-based). Returns the expected/found words that differ,
 * in order, for display. Suitable for the short government warning text.
 */
export function wordDiff(
  expected: string[],
  found: string[],
): { expected: string[]; found: string[] } {
  const n = expected.length;
  const m = found.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        expected[i] === found[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const expDiff: string[] = [];
  const fndDiff: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === found[j]) {
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      expDiff.push(expected[i++]);
    } else {
      fndDiff.push(found[j++]);
    }
  }
  while (i < n) expDiff.push(expected[i++]);
  while (j < m) fndDiff.push(found[j++]);
  return { expected: expDiff, found: fndDiff };
}
