import { describe, it, expect } from "vitest";
import {
  htmlToBlocks,
  textToBlocks,
  blocksToMarkdown,
  blocksToText,
  buildDocx,
  buildPdf,
} from "../../app/lib/exportBuilders";
import { readDocxParagraphs } from "../../app/lib/docxPatch";

describe("htmlToBlocks", () => {
  it("maps headings, paragraphs, and list items to typed blocks", () => {
    const html =
      "<h1>Title</h1><p>Intro paragraph.</p><h2>Section</h2><ul><li>First</li><li>Second</li></ul>";
    const blocks = htmlToBlocks(html);
    expect(blocks).toEqual([
      { kind: "h1", text: "Title" },
      { kind: "p", text: "Intro paragraph." },
      { kind: "h2", text: "Section" },
      { kind: "li", text: "First" },
      { kind: "li", text: "Second" },
    ]);
  });

  it("decodes entities and converts <br> to newlines", () => {
    const blocks = htmlToBlocks("<p>Fish &amp; chips<br>line two</p>");
    expect(blocks[0].text).toBe("Fish & chips\nline two");
  });

  it("skips empty blocks", () => {
    expect(htmlToBlocks("<p></p><p>   </p><p>real</p>")).toEqual([{ kind: "p", text: "real" }]);
  });

  it("collapses h4-h6 down to h3", () => {
    expect(htmlToBlocks("<h5>Deep</h5>")).toEqual([{ kind: "h3", text: "Deep" }]);
  });
});

describe("textToBlocks", () => {
  it("splits on blank lines and optionally prepends a title", () => {
    expect(textToBlocks("My Title", "Para one.\n\nPara two.")).toEqual([
      { kind: "h1", text: "My Title" },
      { kind: "p", text: "Para one." },
      { kind: "p", text: "Para two." },
    ]);
    expect(textToBlocks(null, "Solo.")).toEqual([{ kind: "p", text: "Solo." }]);
  });
});

describe("blocksToMarkdown", () => {
  it("renders each block kind with the right prefix", () => {
    const md = blocksToMarkdown([
      { kind: "h1", text: "Title" },
      { kind: "h2", text: "Sub" },
      { kind: "h3", text: "SubSub" },
      { kind: "li", text: "Item" },
      { kind: "p", text: "Body" },
    ]);
    expect(md).toBe("# Title\n\n## Sub\n\n### SubSub\n\n- Item\n\nBody");
  });
});

describe("blocksToText", () => {
  it("bullets list items and joins with blank lines", () => {
    expect(
      blocksToText([
        { kind: "h1", text: "Title" },
        { kind: "li", text: "Item" },
        { kind: "p", text: "Body" },
      ]),
    ).toBe("Title\n\n• Item\n\nBody");
  });
});

describe("buildDocx / buildPdf", () => {
  it("builds a docx whose paragraphs match the input blocks", async () => {
    const blocks = [
      { kind: "h1" as const, text: "Report" },
      { kind: "p" as const, text: "Body text here." },
    ];
    const buffer = await buildDocx(blocks);
    const paragraphs = await readDocxParagraphs(buffer);
    expect(paragraphs.map((p) => p.text)).toEqual(["Report", "Body text here."]);
  });

  it("builds a non-empty PDF with a valid header", async () => {
    const bytes = await buildPdf([{ kind: "p", text: "Hello PDF" }]);
    expect(bytes.length).toBeGreaterThan(100);
    // %PDF- magic
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  });
});
