import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel } from "docx";
import { extractDocument, textToHtml, UnsupportedFileError } from "../../app/lib/documentParse";

/** Minimal but valid ODT: a zip with a content.xml holding text:p nodes. */
async function makeOdt(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.text");
  const body = paragraphs.map((p) => `<text:p>${p}</text:p>`).join("");
  zip.file(
    "content.xml",
    `<?xml version="1.0"?><office:document-content xmlns:office="urn:office" xmlns:text="urn:text"><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("extractDocument", () => {
  it("extracts plain text", async () => {
    const buffer = Buffer.from("Hello world.\nSecond line.", "utf-8");
    const result = await extractDocument(buffer, "notes.txt");
    expect(result.format).toBe("txt");
    expect(result.text).toBe("Hello world.\nSecond line.");
  });

  it("extracts markdown into text and HTML", async () => {
    const buffer = Buffer.from("# Title\n\nSome **bold** body.", "utf-8");
    const result = await extractDocument(buffer, "doc.md");
    expect(result.format).toBe("md");
    expect(result.html).toContain("<h1");
    expect(result.text).toContain("Title");
    expect(result.text).toContain("bold");
  });

  it("extracts RTF text, stripping control words", async () => {
    const rtf =
      "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0 Hello \\b bold\\b0  world.\\par Second para.}";
    const result = await extractDocument(Buffer.from(rtf, "utf-8"), "note.rtf");
    expect(result.format).toBe("rtf");
    expect(result.text).toContain("Hello");
    expect(result.text).toContain("bold");
    expect(result.text).toContain("world");
    expect(result.text).toContain("Second para");
    // control words must not leak into the text
    expect(result.text).not.toContain("fonttbl");
    expect(result.text).not.toContain("\\par");
  });

  it("extracts ODT paragraphs", async () => {
    const buffer = await makeOdt(["First paragraph.", "Second paragraph."]);
    const result = await extractDocument(buffer, "doc.odt");
    expect(result.format).toBe("odt");
    expect(result.text).toContain("First paragraph.");
    expect(result.text).toContain("Second paragraph.");
  });

  it("extracts DOCX text and HTML", async () => {
    const doc = new DocxDocument({
      sections: [
        {
          children: [
            new Paragraph({ text: "Heading", heading: HeadingLevel.HEADING_1 }),
            new Paragraph("A body paragraph."),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    const result = await extractDocument(buffer, "report.docx");
    expect(result.format).toBe("docx");
    expect(result.text).toContain("Heading");
    expect(result.text).toContain("A body paragraph.");
    expect(result.html).toContain("Heading");
  });

  it("throws UnsupportedFileError for unknown binary types", async () => {
    const mp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
      ...new Array(32).fill(0),
    ]);
    await expect(extractDocument(mp4, "clip.mp4")).rejects.toBeInstanceOf(UnsupportedFileError);
  });
});

describe("textToHtml", () => {
  it("wraps paragraphs and escapes HTML", () => {
    expect(textToHtml("Para one.\n\nPara <two>.")).toBe(
      "<p>Para one.</p>\n<p>Para &lt;two&gt;.</p>",
    );
  });

  it("converts single newlines to <br>", () => {
    expect(textToHtml("line one\nline two")).toBe("<p>line one<br>line two</p>");
  });
});
