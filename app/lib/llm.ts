import "server-only";
import { fleschReadingEase, seoScore } from "./metrics";
import { checkDetectors, type DetectorVerdict } from "./detectors";
import { captureError } from "./observability";

export type Metrics = {
  humanScore: number;
  aiDetection: number;
  plagiarism: number;
  grammar: number;
  readability: number;
  seoScore: number;
  /** Independent third-party detector verdicts on the humanized text, when a
   *  detector API is configured. Omitted otherwise. */
  detectors?: DetectorVerdict[];
};

export type ToolName =
  | "detect"
  | "grammar"
  | "paraphrase"
  | "summarize"
  | "translate"
  | "tone"
  | "citation"
  | "plagiarism";

export type ToolResult = {
  output: string;
  /** Tool-specific structured data (scores, fix lists, …) */
  extra?: Record<string, unknown>;
};

const MODE_INSTRUCTIONS: Record<string, string> = {
  Humanize:
    "Rewrite so it reads like a real person wrote it in one sitting, not an AI. " +
    "Aggressively vary sentence length — mix short, blunt sentences with longer, winding ones; " +
    "an occasional fragment or a sentence starting with 'And' or 'But' is fine. " +
    "Cut every hedge and filler phrase (e.g. 'it is important to note', 'in today's landscape', " +
    "'furthermore', 'moreover', 'in conclusion') — humans just say the thing. " +
    "Replace abstract corporate nouns with plain, concrete wording (say what actually happens, " +
    "not 'operational efficiencies' or 'stakeholder value'). Avoid neat three-part lists and " +
    "perfectly parallel structure; real writing is a little lopsided. Use contractions where natural. " +
    "Never use em dashes. Do not invent new facts or details — only restyle what's already there.",
  Academic:
    "Rewrite in a clear academic register: precise terminology, measured claims, formal but readable.",
  Professional:
    "Rewrite in a polished professional tone suitable for workplace communication.",
  Business:
    "Rewrite for a business audience: direct, outcome-focused, plain language.",
  "SEO Optimized":
    "Rewrite to read naturally while keeping key topical phrases intact for search relevance.",
  Blog: "Rewrite in an engaging, conversational blog style with personality.",
  Email: "Rewrite as clear, courteous email prose. Get to the point quickly.",
  "Social Media":
    "Rewrite punchy and scannable for social media, keeping the core message.",
  "Native English":
    "Rewrite so it sounds like a fluent native English speaker wrote it, fixing awkward phrasing.",
  Simplify: "Rewrite in plain language a 9th-grader could follow. Short sentences.",
  Formal: "Rewrite in a formal register without sounding stiff or robotic.",
  Friendly: "Rewrite in a warm, friendly tone, like talking to a colleague you like.",
  Persuasive: "Rewrite to be persuasive: strong verbs, clear benefits, confident close.",
  Creative: "Rewrite with creative flair: vivid imagery, fresh phrasing, keep the meaning.",
};

function hasApiKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

async function groqChat(
  system: string,
  user: string,
  jsonMode = false,
  temperature?: number,
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: temperature ?? (jsonMode ? 0.2 : 0.7),
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq API returned an empty completion");
  return content;
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned) as T;
}

export async function rewriteText(text: string, mode: string): Promise<string> {
  if (!hasApiKey()) return mockRewrite(text);
  const instruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.Humanize;
  return groqChat(
    `You rewrite text. ${instruction} Preserve the original meaning and approximate length. Reply with ONLY the rewritten text — no preamble, no quotes, no explanations.`,
    text,
    false,
    mode === "Humanize" ? 0.95 : 0.7,
  );
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Streams a chat completion from a full message list (multi-turn), used by
 * the help assistant. Yields text deltas via Groq's OpenAI-compatible SSE.
 * Without an API key, yields a single canned message.
 */
export async function* streamChat(
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  if (!hasApiKey()) {
    yield "The assistant is offline right now (no API key configured). Please check the FAQ on the pricing page or contact support.";
    return;
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 500,
      stream: true,
      messages,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore malformed SSE fragments
      }
    }
  }
}

/**
 * Streaming variant of rewriteText — yields text deltas as Groq generates
 * them (OpenAI-compatible SSE), instead of waiting for the full completion.
 * Falls back to a single-chunk yield of the mock rewrite with no API key.
 */
export async function* streamRewriteText(
  text: string,
  mode: string,
): AsyncGenerator<string, void, unknown> {
  if (!hasApiKey()) {
    yield mockRewrite(text);
    return;
  }

  const instruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.Humanize;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: mode === "Humanize" ? 0.95 : 0.7,
      stream: true,
      messages: [
        {
          role: "system",
          content: `You rewrite text. ${instruction} Preserve the original meaning and approximate length. Reply with ONLY the rewritten text — no preamble, no quotes, no explanations.`,
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // last (possibly incomplete) line stays buffered

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const parsed = JSON.parse(payload) as {
          choices: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Ignore malformed SSE fragments (shouldn't happen mid-stream)
      }
    }
  }
}

/**
 * Rewrites an array of text blocks (e.g. DOCX paragraphs) in one LLM call
 * per chunk, preserving the 1:1 block mapping — the backbone of the
 * formatting-preserving DOCX patcher. Falls back to per-block mock rewrites
 * without an API key.
 */
export async function rewriteBlocks(blocks: string[], mode: string): Promise<string[]> {
  if (blocks.length === 0) return [];
  if (!hasApiKey()) return blocks.map((b) => mockRewrite(b));

  const instruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.Humanize;
  const out: string[] = new Array(blocks.length);

  // Chunk blocks so each request stays well under context/latency limits
  const chunks: { start: number; items: string[] }[] = [];
  let current: string[] = [];
  let currentWords = 0;
  let start = 0;
  blocks.forEach((block, i) => {
    const words = block.trim().split(/\s+/).length;
    if (current.length > 0 && (currentWords + words > 1200 || current.length >= 40)) {
      chunks.push({ start, items: current });
      current = [];
      currentWords = 0;
      start = i;
    }
    current.push(block);
    currentWords += words;
  });
  if (current.length > 0) chunks.push({ start, items: current });

  for (const chunk of chunks) {
    const raw = await groqChat(
      `You rewrite text blocks. ${instruction} Preserve each block's meaning and approximate length. You receive a JSON array of ${chunk.items.length} strings; respond with JSON only: {"blocks": [<exactly ${chunk.items.length} rewritten strings, same order>]}. Rewrite each block independently. Keep blocks that are just numbers, dates, names, or headings shorter than 6 words UNCHANGED.`,
      JSON.stringify(chunk.items),
      true,
    );
    const parsed = parseJson<{ blocks: string[] }>(raw);
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length !== chunk.items.length) {
      throw new Error(
        `Block rewrite returned ${parsed.blocks?.length ?? 0} blocks, expected ${chunk.items.length}`,
      );
    }
    parsed.blocks.forEach((b, j) => {
      out[chunk.start + j] = typeof b === "string" ? b : chunk.items[j];
    });
  }
  return out;
}

export async function runTool(
  tool: ToolName,
  text: string,
  options: Record<string, string> = {},
): Promise<ToolResult> {
  switch (tool) {
    case "detect": {
      if (!hasApiKey()) {
        const p = mockAiProbability(text);
        return {
          output: `Estimated ${p}% likely AI-generated (${p >= 60 ? "likely AI" : p >= 35 ? "mixed signals" : "likely human"}).`,
          extra: { aiProbability: p, humanScore: 100 - p },
        };
      }
      const raw = await groqChat(
        'You are an AI-writing detector. Analyze the text for hallmarks of AI generation (uniform sentence rhythm, buzzwords, hedging, generic phrasing, lack of specific detail). Respond with JSON only: {"aiProbability": <0-100 integer>, "verdict": "<one short sentence>", "signals": ["<up to 4 short observations>"]}',
        text,
        true,
      );
      const parsed = parseJson<{ aiProbability: number; verdict: string; signals?: string[] }>(raw);
      const p = Math.max(0, Math.min(100, Math.round(parsed.aiProbability)));
      return {
        output: parsed.verdict,
        extra: { aiProbability: p, humanScore: 100 - p, signals: parsed.signals ?? [] },
      };
    }

    case "grammar": {
      if (!hasApiKey()) {
        return {
          output: mockRewrite(text),
          extra: { fixes: ["Mock mode: connect a GROQ_API_KEY for detailed grammar fixes"] },
        };
      }
      const raw = await groqChat(
        'You are a grammar and spelling checker. Correct all grammar, spelling, and punctuation errors while changing nothing else. Respond with JSON only: {"corrected": "<the corrected text>", "fixes": ["<each fix described briefly, e.g. \'their → there\'>"]}',
        text,
        true,
      );
      const parsed = parseJson<{ corrected: string; fixes?: string[] }>(raw);
      return { output: parsed.corrected, extra: { fixes: parsed.fixes ?? [] } };
    }

    case "paraphrase":
      if (!hasApiKey()) return { output: mockRewrite(text) };
      return {
        output: await groqChat(
          "Paraphrase the text: keep the exact meaning but use different wording and sentence structure. Match the original tone and length. Reply with ONLY the paraphrased text.",
          text,
        ),
      };

    case "summarize": {
      const length = options.length ?? "short";
      if (!hasApiKey()) {
        const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
        return { output: sentences || text.slice(0, 200) };
      }
      const style =
        length === "bullets"
          ? "Summarize as 3-6 concise bullet points, one per line starting with '• '."
          : length === "medium"
            ? "Summarize in one solid paragraph."
            : "Summarize in 1-2 sentences.";
      return {
        output: await groqChat(
          `${style} Capture the essential points faithfully. Reply with ONLY the summary.`,
          text,
        ),
      };
    }

    case "translate": {
      const lang = options.targetLang ?? "Spanish";
      if (!hasApiKey()) {
        return {
          output: `[Mock translation to ${lang} — add a GROQ_API_KEY for real translation]\n\n${text}`,
        };
      }
      return {
        output: await groqChat(
          `Translate the text into ${lang} with native-quality fluency. Preserve tone, formatting, and meaning. Reply with ONLY the translation.`,
          text,
        ),
        extra: { targetLang: lang },
      };
    }

    case "tone": {
      const tone = options.tone ?? "Formal";
      if (!hasApiKey()) return { output: mockRewrite(text), extra: { tone } };
      return {
        output: await groqChat(
          `Rewrite the text in a ${tone.toLowerCase()} tone. Keep the meaning and approximate length. Reply with ONLY the rewritten text.`,
          text,
        ),
        extra: { tone },
      };
    }

    case "citation": {
      const style = options.style ?? "APA";
      if (!hasApiKey()) {
        return {
          output: `[Mock ${style} citation — add a GROQ_API_KEY for real citations]\n${text}`,
        };
      }
      return {
        output: await groqChat(
          `You are a citation generator. The user describes a source (book, article, website, …). Produce a correctly formatted ${style} citation for it. If details are missing, use standard placeholders like (n.d.). Reply with ONLY the citation.`,
          text,
        ),
        extra: { style },
      };
    }

    case "plagiarism": {
      // Honest estimate: a real provider (Copyleaks, Originality.ai) can be
      // swapped in here later — the response shape already fits.
      if (!hasApiKey()) {
        const originality = 100 - Math.min(40, mockAiProbability(text) / 3);
        return {
          output: `Estimated ${Math.round(originality)}% original. This is a heuristic estimate — connect a plagiarism provider for real source scanning.`,
          extra: { originalityScore: Math.round(originality), provider: "estimate", matches: [] },
        };
      }
      const raw = await groqChat(
        'You estimate how likely a text contains widely-published boilerplate or heavily reused phrasing (you cannot search the web, so this is a linguistic estimate only). Respond with JSON only: {"originalityScore": <0-100 integer, 100 = fully original phrasing>, "note": "<one sentence>"}',
        text,
        true,
      );
      const parsed = parseJson<{ originalityScore: number; note: string }>(raw);
      const score = Math.max(0, Math.min(100, Math.round(parsed.originalityScore)));
      return {
        output: `Estimated ${score}% original. ${parsed.note} (Linguistic estimate — not a web-scan.)`,
        extra: { originalityScore: score, provider: "estimate", matches: [] },
      };
    }
  }
}

/** Rule-based fallback used when no GROQ_API_KEY is configured. */
function mockRewrite(text: string): string {
  const swaps: [RegExp, string][] = [
    [/\bleverag(e|ing)\b/gi, "use"],
    [/\butiliz(e|ing|ation)\b/gi, "use"],
    [/\bsynergistic(ally)?\b/gi, "well together"],
    [/\bparadigms?\b/gi, "approaches"],
    [/\bcutting-edge\b/gi, "modern"],
    [/\bparamount\b/gi, "important"],
    [/\boptimize\b/gi, "improve"],
    [/\boperational efficiencies\b/gi, "how we work"],
    [/\bstakeholder value\b/gi, "results people care about"],
    [/\bin today's fast-paced landscape\b/gi, "These days"],
    [/\bseeking to\b/gi, "trying to"],
    [/\bfurthermore\b/gi, "also"],
    [/\bmoreover\b/gi, "and"],
    [/\bdelve into\b/gi, "look at"],
  ];
  let out = text;
  for (const [pattern, replacement] of swaps) out = out.replace(pattern, replacement);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Buzzword-density heuristic for the mock AI detector. */
function mockAiProbability(text: string): number {
  const buzzwords =
    /\b(leverage|leveraging|utilize|synergistic|paradigm|cutting-edge|paramount|optimize|efficiencies|stakeholder|furthermore|moreover|delve|landscape|robust|seamless|holistic)\b/gi;
  const hits = text.match(buzzwords)?.length ?? 0;
  const words = Math.max(1, text.trim().split(/\s+/).length);
  return Math.min(96, Math.round(20 + (hits / words) * 600));
}

/** Naive, deterministic issue count used only when no GROQ_API_KEY is set. */
function mockGrammarIssues(text: string): number {
  let issues = /\s{2,}/.test(text) ? 1 : 0;
  const repeated = text.match(/\b(\w+)\s+\1\b/gi);
  issues += repeated?.length ?? 0;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  for (const s of sentences) if (/^[a-z]/.test(s.trim())) issues += 1;
  return issues;
}

/**
 * Post-rewrite scores for the humanize flow. Readability and SEO are always
 * computed for real. When a GROQ_API_KEY is configured, human/AI/plagiarism/
 * grammar are also real — they reuse the same LLM-judged detector, grammar,
 * and plagiarism-estimate calls that back the standalone tools, run in
 * parallel against the rewritten text. Without a key, they fall back to
 * deterministic text heuristics instead of random jitter.
 */
export async function estimateMetrics(originalText: string, improvedText: string): Promise<Metrics> {
  const readability = fleschReadingEase(improvedText);
  const seo = seoScore(improvedText);

  // Independent of Groq — runs whenever a detector API is configured, even in
  // LLM-mock mode. Never throws (returns null when unconfigured).
  const detectors = await checkDetectors(improvedText);
  const withDetectors = (m: Metrics): Metrics => (detectors ? { ...m, detectors } : m);

  const heuristicFallback = (): Metrics => {
    const aiProbability = mockAiProbability(improvedText);
    const grammarScore = Math.max(50, 100 - mockGrammarIssues(improvedText) * 8);
    return withDetectors({
      humanScore: 100 - aiProbability,
      aiDetection: aiProbability,
      plagiarism: Math.min(40, Math.round(aiProbability / 3)),
      grammar: grammarScore,
      readability,
      seoScore: seo,
    });
  };

  if (!hasApiKey()) return heuristicFallback();

  try {
    const [detectResult, grammarResult, plagiarismResult] = await Promise.all([
      runTool("detect", improvedText),
      runTool("grammar", improvedText),
      runTool("plagiarism", improvedText),
    ]);

    const aiProbability = Number(detectResult.extra?.aiProbability ?? 5);
    const fixes = (grammarResult.extra?.fixes as string[] | undefined) ?? [];
    const originality = Number(plagiarismResult.extra?.originalityScore ?? 95);

    return withDetectors({
      humanScore: 100 - aiProbability,
      aiDetection: aiProbability,
      plagiarism: Math.max(0, 100 - originality),
      grammar: Math.max(50, 100 - fixes.length * 3),
      readability,
      seoScore: seo,
    });
  } catch (err) {
    captureError("estimateMetrics scoring calls failed, using heuristic fallback", err);
    return heuristicFallback();
  }
}
