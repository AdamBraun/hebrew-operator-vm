export type NormalizationOptions = {
  unicodeForm: "NFC" | "NFKD" | "none";
  normalizeFinals: boolean;
  stripControlChars: boolean;
  preservePunctuation: boolean;
  errorOnUnknownMark: boolean;
};

const ALLOWED_UNICODE_FORMS = new Set<NormalizationOptions["unicodeForm"]>(["NFC", "NFKD", "none"]);

const OPTION_KEYS = [
  "unicodeForm",
  "normalizeFinals",
  "stripControlChars",
  "preservePunctuation",
  "errorOnUnknownMark"
] as const;

type OptionKey = (typeof OPTION_KEYS)[number];

const OPTION_KEY_SET = new Set<string>(OPTION_KEYS);

function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("normalizeOptions: expected options object");
  }
}

function assertNoUnknownKeys(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (!OPTION_KEY_SET.has(key)) {
      throw new Error(`normalizeOptions: unknown option '${key}'`);
    }
  }
}

function assertBooleanOption(name: OptionKey, value: unknown): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`normalizeOptions: ${name} must be boolean`);
  }
}

function assertUnicodeForm(value: unknown): asserts value is NormalizationOptions["unicodeForm"] {
  if (
    typeof value !== "string" ||
    !ALLOWED_UNICODE_FORMS.has(value as NormalizationOptions["unicodeForm"])
  ) {
    throw new Error("normalizeOptions: unicodeForm must be one of 'NFC' | 'NFKD' | 'none'");
  }
}

export function defaultNormalizationOptions(): NormalizationOptions {
  return {
    unicodeForm: "NFC",
    normalizeFinals: false,
    stripControlChars: true,
    preservePunctuation: true,
    errorOnUnknownMark: false
  };
}

export function normalizeOptions(opts: Partial<NormalizationOptions>): NormalizationOptions {
  const defaults = defaultNormalizationOptions();
  if (opts === undefined || opts === null) {
    return defaults;
  }
  assertObject(opts);
  assertNoUnknownKeys(opts);

  const out: NormalizationOptions = { ...defaults };

  if ("unicodeForm" in opts && opts.unicodeForm !== undefined) {
    assertUnicodeForm(opts.unicodeForm);
    out.unicodeForm = opts.unicodeForm;
  }
  if ("normalizeFinals" in opts && opts.normalizeFinals !== undefined) {
    assertBooleanOption("normalizeFinals", opts.normalizeFinals);
    out.normalizeFinals = opts.normalizeFinals;
  }
  if ("stripControlChars" in opts && opts.stripControlChars !== undefined) {
    assertBooleanOption("stripControlChars", opts.stripControlChars);
    out.stripControlChars = opts.stripControlChars;
  }
  if ("preservePunctuation" in opts && opts.preservePunctuation !== undefined) {
    assertBooleanOption("preservePunctuation", opts.preservePunctuation);
    out.preservePunctuation = opts.preservePunctuation;
  }
  if ("errorOnUnknownMark" in opts && opts.errorOnUnknownMark !== undefined) {
    assertBooleanOption("errorOnUnknownMark", opts.errorOnUnknownMark);
    out.errorOnUnknownMark = opts.errorOnUnknownMark;
  }

  return out;
}
