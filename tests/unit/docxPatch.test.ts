import { describe, it, expect } from "vitest";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import {
  readDocxParagraphs,
  patchDocxParagraphs,
  paragraphText,
} from "../../app/lib/docxPatch";

/** Builds a small but structurally real .docx for round-trip testing. */
async function makeDocx(): Promise<Buffer> {
  const doc = new DocxDocument({
    sections: [
      {
        children: [
          new Paragraph({ text: "The Quarterly Report", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [
              new TextRun("Leveraging cutting-edge paradigms enables organizations to "),
              new TextRun({ text: "optimize", bold: true }),
              new TextRun(" operational efficiencies."),
            ],
          }),
          new Paragraph({ text: "A second body paragraph with plain prose in it." }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("docxPatch", () => {
  it("reads every paragraph's text in document order", async () => {
    const buffer = await makeDocx();
    const paragraphs = await readDocxParagraphs(buffer);

    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0].text).toBe("The Quarterly Report");
    // Multi-run paragraph is concatenated back into one string
    expect(paragraphs[1].text).toBe(
      "Leveraging cutting-edge paradigms enables organizations to optimize operational efficiencies.",
    );
    expect(paragraphs[2].text).toBe("A second body paragraph with plain prose in it.");
    expect(paragraphs.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it("replaces only the targeted paragraph's text and leaves others intact", async () => {
    const buffer = await makeDocx();
    const patched = await patchDocxParagraphs(
      buffer,
      new Map([[1, "Modern methods let teams work far more effectively."]]),
    );
    const paragraphs = await readDocxParagraphs(patched);

    expect(paragraphs[0].text).toBe("The Quarterly Report"); // untouched
    expect(paragraphs[1].text).toBe("Modern methods let teams work far more effectively."); // replaced
    expect(paragraphs[2].text).toBe("A second body paragraph with plain prose in it."); // untouched
  });

  it("produces a still-valid docx (re-readable zip with document.xml)", async () => {
    const buffer = await makeDocx();
    const patched = await patchDocxParagraphs(buffer, new Map([[0, "Renamed Heading"]]));
    // If the zip or XML were corrupted, readDocxParagraphs would throw
    const paragraphs = await readDocxParagraphs(patched);
    expect(paragraphs[0].text).toBe("Renamed Heading");
  });

  it("escapes XML-significant characters in replacement text", async () => {
    const buffer = await makeDocx();
    const patched = await patchDocxParagraphs(
      buffer,
      new Map([[2, 'Fish & chips cost < $5 > nothing "cheap"']]),
    );
    const paragraphs = await readDocxParagraphs(patched);
    // Round-trips back to the literal string, proving escape+unescape is correct
    expect(paragraphs[2].text).toBe('Fish & chips cost < $5 > nothing "cheap"');
  });

  it("leaves the document unchanged when no replacements are given", async () => {
    const buffer = await makeDocx();
    const before = await readDocxParagraphs(buffer);
    const patched = await patchDocxParagraphs(buffer, new Map());
    const after = await readDocxParagraphs(patched);
    expect(after.map((p) => p.text)).toEqual(before.map((p) => p.text));
  });

  it("paragraphText extracts and unescapes a single paragraph's runs", () => {
    const xml =
      '<w:p><w:r><w:t>Hello &amp; </w:t></w:r><w:r><w:t xml:space="preserve">world &lt;3</w:t></w:r></w:p>';
    expect(paragraphText(xml)).toBe("Hello & world <3");
  });
});
