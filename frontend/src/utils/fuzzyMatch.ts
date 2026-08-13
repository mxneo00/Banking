/**
 * Lightweight, dependency-free fuzzy subsequence matcher (same family of
 * algorithm as fzf/VS Code's command palette): every character of `query`
 * must appear in `text`, in order, but not necessarily contiguously;
 * "grcry" matches "Groceries". Case-insensitive. An empty query always
 * matches (nothing typed yet = show everything).
 *
 * `score` rewards contiguous runs and matches nearer the start of the
 * string, so callers that want relevance-ranked results (not just a
 * pass/fail filter) can sort by it.
 */

export type FuzzyMatchResult = {
  matched: boolean
  score: number
}

export function fuzzyMatch(query: string, text: string): FuzzyMatchResult {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()

  if (!q) {
    return { matched: true, score: 0 }
  }

  let score = 0
  let textIndex = 0
  let queryIndex = 0
  let consecutiveRun = 0

  while (queryIndex < q.length && textIndex < t.length) {
    if (q[queryIndex] === t[textIndex]) {
      consecutiveRun += 1
      // Contiguous runs score super-linearly so a solid chunk of matching
      // text beats the same characters scattered across the string.
      score += 1 + consecutiveRun
      // Small bonus for matches nearer the start of the string.
      score += Math.max(0, 5 - textIndex) * 0.2
      queryIndex += 1
    } else {
      consecutiveRun = 0
    }
    textIndex += 1
  }

  return { matched: queryIndex === q.length, score }
}

/** Convenience: filter `items` down to fuzzy matches of `query`, most relevant first. */
export function fuzzySearch<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  const q = query.trim()
  if (!q) {
    return items
  }

  return items
    .map((item) => ({ item, result: fuzzyMatch(q, getText(item)) }))
    .filter(({ result }) => result.matched)
    .sort((a, b) => b.result.score - a.result.score)
    .map(({ item }) => item)
}
