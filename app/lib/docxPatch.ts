import "server-only";
import JSZip from "jszip";

/**
 * In-place DOCX text patching — the "Preserve formatting" mode.
 *
 * A .docx is a ZIP whose word/document.xml holds paragraphs (<w:p>) made of
 * runs (<w:r>) containing text nodes (<w:t>). We rewrite ONLY the text: the
 * new paragraph text goes into the paragraph's first <w:t>, the remaining
 * <w:t> nodes are emptied. Everything else — styles, tables, images,
 * headers, footers, numbering, margins — is untouched bytes.
 *
 * Known trade-off (industry-standard): paragraphs whose text the AI changed
 * lose intra-paragraph character formatting (e.g. one bold word mid-sentence
 * adopts the first run's formatting). Paragraph-level and document-level
 * formatting survive completely. Unchanged paragraphs keep everything.
 */

const PARAGRAPH_RE = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const TEXT_NODE_RE = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function paragraphText(paragraphXml: string): string {
  let text = "";
  let m: RegExpExecArray | null;
  TEXT_NODE_RE.lastIndex = 0;
  while ((m = TEXT_NODE_RE.exec(paragraphXml)) !== null) {
    text += xmlUnescape(m[2]);
  }
  return text;
}

function replaceParagraphText(paragraphXml: string, newText: string): string {
  let first = true;
  return paragraphXml.replace(TEXT_NODE_RE, (_match, attrs) => {
    if (first) {
      first = false;
      // xml:space="preserve" keeps leading/trailing spaces intact
      const keptAttrs = (attrs as string | undefined)?.includes("xml:space")
        ? attrs
        : `${attrs ?? ""} xml:space="preserve"`;
      return `<w:t${keptAttrs}>${xmlEscape(newText)}</w:t>`;
    }
    return `<w:t${attrs ?? ""}></w:t>`;
  });
}

export type DocxParagraph = { index: number; text: string };

/** Reads paragraph texts out of a DOCX buffer. */
export async function readDocxParagraphs(buffer: Buffer): Promise<DocxParagraph[]> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Not a valid DOCX (missing word/document.xml)");
  const xml = await docFile.async("string");

  const paragraphs: DocxParagraph[] = [];
  let index = 0;
  for (const match of xml.match(PARAGRAPH_RE) ?? []) {
    paragraphs.push({ index, text: paragraphText(match) });
    index++;
  }
  return paragraphs;
}

/**
 * Applies replacement texts by paragraph index and returns the rebuilt DOCX.
 * Indices not present in `replacements` are left byte-identical.
 */
export async function patchDocxParagraphs(
  buffer: Buffer,
  replacements: Map<number, string>,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Not a valid DOCX (missing word/document.xml)");
  const xml = await docFile.async("string");

  let index = 0;
  const patched = xml.replace(PARAGRAPH_RE, (paragraph) => {
    const replacement = replacements.get(index);
    index++;
    if (replacement === undefined) return paragraph;
    return replaceParagraphText(paragraph, replacement);
  });

  zip.file("word/document.xml", patched);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
