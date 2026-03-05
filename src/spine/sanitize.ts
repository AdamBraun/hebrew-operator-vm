const PARASHA_MARKER = /\{\s*[פס]\s*\}/gu;
const EDITORIAL_NOTE_WITH_MARKER = /\*\s*\([^)]*\)/gu;
const EDITORIAL_NOTE_PAREN = /\([^)]*\)/gu;
const ORPHANED_EDITORIAL_NOTE = /בספרי[^׃\n]{0,200}?(?:גדולה|קטנה|רגילה|זעירא|קטיעא|בתיבה\s+אחת)/gu;
const ORPHANED_NO_PARASHA_NOTE = /אין\s+פרשה\s+בספרי[^׃\n]*/gu;
const FOOTNOTE_MARKER = /\*/gu;
const SPACE_ENTITIES = new Set(["&nbsp;", "&thinsp;"]);
const STRUCTURAL_TAGS = new Set(["br", "p", "div", "li", "tr", "td", "th", "hr"]);

function normalizeLineBreaks(text: string): string {
  return String(text ?? "").replace(/\r\n?/g, "\n");
}

function extractTagName(markupTag: string): string | null {
  const match = String(markupTag ?? "").match(/^<\s*\/?\s*([A-Za-z0-9:-]+)/u);
  return match?.[1]?.toLowerCase() ?? null;
}

function stripMarkupAndEntities(text: string): string {
  let out = text.replace(EDITORIAL_NOTE_WITH_MARKER, " ");
  out = out.replace(EDITORIAL_NOTE_PAREN, " ");

  out = out.replace(/<[^>]*>/g, (match) => {
    const tagName = extractTagName(match);
    if (tagName && STRUCTURAL_TAGS.has(tagName)) {
      return "\n";
    }
    return "";
  });

  out = out.replace(/&[^;\s]+;/g, (match) => (SPACE_ENTITIES.has(match.toLowerCase()) ? " " : ""));
  out = out.replace(/[\u00A0\u2009]/g, " ");
  out = out.replace(ORPHANED_EDITORIAL_NOTE, " ");
  out = out.replace(ORPHANED_NO_PARASHA_NOTE, " ");
  out = out.replace(FOOTNOTE_MARKER, " ");
  out = out.replace(PARASHA_MARKER, " ");
  out = out.replace(/[ \t\f\v]+/g, " ");
  out = out.replace(/ *\n */g, "\n");
  return out.trim();
}

export function sanitizeVerseText(text: string): string {
  return stripMarkupAndEntities(normalizeLineBreaks(text));
}
