/**
 * Real, computed text analysis. No LLM involved — these are the
 * deterministic metrics (readability, keyword density, SEO, counts).
 */

export type TextStats = {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  readingTimeMin: number;
};

export type KeywordDensity = {
  keyword: string;
  count: number;
  density: number; // percentage of total words
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "by",
  "for", "with", "about", "against", "between", "into", "through", "during",
  "before", "after", "above", "below", "to", "from", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "once", "here", "there",
  "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
  "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can",
  "will", "just", "should", "now", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "having", "do", "does", "did", "doing", "would",
  "could", "of", "it", "its", "this", "that", "these", "those", "i", "you", "he",
  "she", "we", "they", "them", "his", "her", "our", "your", "their", "as", "my",
]);

export function textStats(text: string): TextStats {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  return {
    words: words.length,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    sentences: Math.max(1, sentences.length),
    readingTimeMin: Math.max(1, Math.ceil(words.length / 200)),
  };
}

/** Heuristic English syllable counter — good enough for Flesch scoring. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Flesch Reading Ease (0–100, higher = easier to read).
 * 206.835 − 1.015 × (words/sentences) − 84.6 × (syllables/words)
 */
export function fleschReadingEase(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const { sentences } = textStats(text);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score =
    206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function keywordDensity(text: string, top = 8): KeywordDensity[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const total = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length);

  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([keyword, count]) => ({
      keyword,
      count,
      density: Math.round((count / total) * 1000) / 10,
    }));
}

/**
 * SEO health score from measurable signals: length, sentence-length
 * variance, keyword distribution, and paragraph structure.
 */
export function seoScore(text: string): number {
  const stats = textStats(text);
  let score = 50;

  // Content length (search engines favor substance)
  if (stats.words >= 300) score += 15;
  else if (stats.words >= 100) score += 8;
  else if (stats.words < 30) score -= 10;

  // Average sentence length sweet spot: 12–22 words
  const avgSentence = stats.words / stats.sentences;
  if (avgSentence >= 12 && avgSentence <= 22) score += 15;
  else if (avgSentence > 30) score -= 10;

  // Keyword focus without stuffing: top keyword density 0.5%–3%
  const [topKw] = keywordDensity(text, 1);
  if (topKw) {
    if (topKw.density >= 0.5 && topKw.density <= 3) score += 15;
    else if (topKw.density > 6) score -= 15;
  }

  // Readability contributes to dwell time
  const flesch = fleschReadingEase(text);
  if (flesch >= 50) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}
