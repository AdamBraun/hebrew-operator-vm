const FINAL_MAP: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ"
};

const HEBREW_LETTERS = new Set([
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "כ",
  "ך",
  "ל",
  "מ",
  "ם",
  "נ",
  "ן",
  "ס",
  "ע",
  "פ",
  "ף",
  "צ",
  "ץ",
  "ק",
  "ר",
  "ש",
  "ת"
]);

const ALLOWED_MARKS = new Set([
  "\u05B0",
  "\u05B1",
  "\u05B2",
  "\u05B3",
  "\u05B4",
  "\u05B5",
  "\u05B6",
  "\u05B7",
  "\u05B8",
  "\u05B9",
  "\u05BB",
  "\u05BC",
  "\u05C1",
  "\u05C2"
]);

const TEAMIM_MIN = 0x0591;
const TEAMIM_MAX = 0x05af;
const MAQQEF = "\u05BE";
const SOF_PASUQ = "\u05C3";
const PARASHA_MARKER = /\{\s*[פס]\s*\}/gu;
const EDITORIAL_NOTE_WITH_MARKER = /\*\s*\([^)]*\)/gu;
const EDITORIAL_NOTE_PAREN = /\([^)]*\)/gu;
const ORPHANED_EDITORIAL_NOTE = /בספרי[^׃\n]{0,200}?(?:גדולה|קטנה|רגילה|זעירא|קטיעא|בתיבה\s+אחת)/gu;
const ORPHANED_NO_PARASHA_NOTE = /אין\s+פרשה\s+בספרי[^׃\n]*/gu;
const FOOTNOTE_MARKER = /\*/gu;
const STRUCTURAL_TAGS = new Set([
  "br",
  "p",
  "div",
  "li",
  "tr",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
]);
const SPACE_ENTITIES = new Set(["&nbsp;", "&thinsp;", "&ensp;", "&emsp;"]);

export type HebrewSanitizerOptions = {
  keepTeamim: boolean;
  normalizeFinals: boolean;
};

function isTeamim(ch: string): boolean {
  const codepoint = ch.codePointAt(0);
  if (codepoint === undefined) {
    return false;
  }
  return codepoint >= TEAMIM_MIN && codepoint <= TEAMIM_MAX;
}

function extractTagName(markupTag: string): string | null {
  const match = String(markupTag ?? "").match(/^<\s*\/?\s*([A-Za-z0-9:-]+)/u);
  return match?.[1]?.toLowerCase() ?? null;
}

function stripMarkupAndEntities(text: string): string {
  let out = String(text ?? "").replace(EDITORIAL_NOTE_WITH_MARKER, " ");
  out = out.replace(EDITORIAL_NOTE_PAREN, " ");
  out = out.replace(/<[^>]*>/g, (match) => {
    const tagName = extractTagName(match);
    if (tagName && STRUCTURAL_TAGS.has(tagName)) {
      return " ";
    }
    return "";
  });
  out = out.replace(/&[^;\s]+;/g, (match) => (SPACE_ENTITIES.has(match.toLowerCase()) ? " " : ""));
  out = out.replace(/[\u00A0\u2009]/g, " ");
  out = out.replace(ORPHANED_EDITORIAL_NOTE, " ");
  out = out.replace(ORPHANED_NO_PARASHA_NOTE, " ");
  out = out.replace(FOOTNOTE_MARKER, " ");
  return out.replace(PARASHA_MARKER, " ");
}

export function sanitizeHebrewText(text: unknown, opts: HebrewSanitizerOptions): string {
  if (!text) {
    return "";
  }
  let cleaned = stripMarkupAndEntities(String(text));
  cleaned = cleaned.normalize("NFD");

  cleaned = cleaned.replace(/\u05C7/g, "\u05B8");
  cleaned = cleaned.replace(/\u05C0/g, " ");
  cleaned = cleaned.replace(/\u05F3|\u05F4/g, "");
  if (!opts.keepTeamim) {
    cleaned = cleaned.replace(/\u05BE/g, " ");
    cleaned = cleaned.replace(/\u05C3/g, " ");
  }

  let out = "";
  let lastWasLetter = false;
  for (const ch of cleaned) {
    if (HEBREW_LETTERS.has(ch) || FINAL_MAP[ch]) {
      const normalized = opts.normalizeFinals && FINAL_MAP[ch] ? FINAL_MAP[ch] : ch;
      if (!HEBREW_LETTERS.has(normalized)) {
        continue;
      }
      out += normalized;
      lastWasLetter = true;
      continue;
    }
    if (ALLOWED_MARKS.has(ch) || (opts.keepTeamim && isTeamim(ch))) {
      if (lastWasLetter) {
        out += ch;
      }
      continue;
    }
    if (opts.keepTeamim && (ch === MAQQEF || ch === SOF_PASUQ)) {
      out += ch;
      lastWasLetter = false;
      continue;
    }
    if (/\s/u.test(ch)) {
      out += " ";
      lastWasLetter = false;
    }
  }

  let normalized = out;
  if (opts.keepTeamim) {
    normalized = normalized.replace(/\s*־\s*/gu, "־");
    normalized = normalized.replace(/\s*׃\s*/gu, "׃ ");
  }
  return normalized.replace(/\s+/g, " ").trim();
}
