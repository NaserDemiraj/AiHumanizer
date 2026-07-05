import { describe, it, expect } from "vitest";
import { Document as DocxDocument, Packer, Paragraph } from "docx";
import { PDFDocument } from "pdf-lib";
import { detectFormat } from "../../app/lib/fileFormat";

describe("detectFormat", () => {
  it("detects a real PDF by magic bytes regardless of extension", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    // Even with a lying extension, the signature wins
    expect(await detectFormat(bytes, "notapdf.txt")).toBe("pdf");
  });

  it("detects a real DOCX (zip + extension) as docx", async () => {
    const doc = new DocxDocument({ sections: [{ children: [new Paragraph("hi")] }] });
    const bytes = await Packer.toBuffer(doc);
    expect(await detectFormat(bytes, "report.docx")).toBe("docx");
  });

  it("detects a PNG by signature", async () => {
    // A real, minimal 1x1 PNG — file-type validates structure past the magic bytes
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c620001000005000109 0a2db40000000049454e44ae426082".replace(/\s/g, ""),
      "hex",
    );
    expect(await detectFormat(png, "image.png")).toBe("png");
  });

  it("recognizes RTF from its text signature", async () => {
    const rtf = Buffer.from("{\\rtf1\\ansi Hello world}", "utf-8");
    expect(await detectFormat(rtf, "note.rtf")).toBe("rtf");
  });

  it("classifies plain text and markdown by extension", async () => {
    const txt = Buffer.from("just some plain words here", "utf-8");
    expect(await detectFormat(txt, "notes.txt")).toBe("txt");
    expect(await detectFormat(Buffer.from("# Heading\n\ntext", "utf-8"), "readme.md")).toBe("md");
  });

  it("falls back to txt for an unknown extension that looks like text", async () => {
    const buffer = Buffer.from("plain readable content with no signature", "utf-8");
    expect(await detectFormat(buffer, "data.unknownext")).toBe("txt");
  });

  it("returns null for an unsupported binary type", async () => {
    // A tiny MP4-ish header — recognized binary, but not a document type
    const mp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
      ...new Array(32).fill(0),
    ]);
    expect(await detectFormat(mp4, "clip.mp4")).toBeNull();
  });
});
