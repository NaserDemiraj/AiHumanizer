import { describe, it, expect } from "vitest";
import { textStats, fleschReadingEase } from "../../app/lib/metrics";

describe("textStats", () => {
  it("counts words, characters, and characters without spaces", () => {
    const s = textStats("Hello world");
    expect(s.words).toBe(2);
    expect(s.characters).toBe(11);
    expect(s.charactersNoSpaces).toBe(10);
  });

  it("counts sentences and paragraphs", () => {
    const text = "First sentence. Second one!\n\nA new paragraph? Yes.";
    const s = textStats(text);
    expect(s.sentences).toBe(4);
    expect(s.paragraphs).toBe(2);
  });

  it("computes reading time at ~200 wpm and speaking time at ~130 wpm", () => {
    // 260 words: reading ceil(260/200)=2, speaking ceil(260/130)=2
    const text = Array(260).fill("word").join(" ");
    const s = textStats(text);
    expect(s.readingTimeMin).toBe(2);
    expect(s.speakingTimeMin).toBe(2);
  });

  it("speaking time is always >= reading time for the same text (slower than reading)", () => {
    const text = Array(1000).fill("word").join(" ");
    const s = textStats(text);
    expect(s.speakingTimeMin).toBeGreaterThanOrEqual(s.readingTimeMin);
  });

  it("never reports zero for any count, even on empty input", () => {
    const s = textStats("");
    expect(s.sentences).toBeGreaterThanOrEqual(1);
    expect(s.paragraphs).toBeGreaterThanOrEqual(1);
    expect(s.readingTimeMin).toBeGreaterThanOrEqual(1);
    expect(s.speakingTimeMin).toBeGreaterThanOrEqual(1);
  });
});

describe("fleschReadingEase", () => {
  it("returns a score within the clamped 0-100 range", () => {
    const simple = fleschReadingEase("The cat sat on the mat. It was a good day.");
    expect(simple).toBeGreaterThanOrEqual(0);
    expect(simple).toBeLessThanOrEqual(100);
  });

  it("rates simple prose as more readable than dense prose", () => {
    const simple = fleschReadingEase("I run. You run. We run fast. It is fun.");
    const dense = fleschReadingEase(
      "Notwithstanding the aforementioned considerations, the multifaceted implementation necessitates comprehensive deliberation.",
    );
    expect(simple).toBeGreaterThan(dense);
  });
});
