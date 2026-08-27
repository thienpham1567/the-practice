const INFLECTION_SUFFIXES = ["s", "es", "ed", "ing", "d"] as const;

/** Shared normalizer for all vocab write paths: lowercase + trim. */
export function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Surface forms for a single token: base + simple suffixes + drop-final-e. */
function inflectionForms(token: string): string[] {
  const forms = new Set<string>([token]);

  for (const suffix of INFLECTION_SUFFIXES) {
    forms.add(token + suffix);
  }

  if (token.length > 1 && token.endsWith("e")) {
    const stem = token.slice(0, -1);
    forms.add(stem + "ing");
    forms.add(stem + "ed");
  }

  return [...forms];
}

function phrasePattern(parts: string[]): RegExp {
  const segments = parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    if (isLast) {
      const alternatives = inflectionForms(part)
        .map(escapeRegExp)
        .join("|");
      return `(?:${alternatives})`;
    }
    return escapeRegExp(part);
  });

  return new RegExp(`\\b${segments.join("\\s+")}\\b`, "i");
}

/**
 * Returns the normalized vocab words that appear in plainText.
 * Word-boundary, case-insensitive; simple -s/-es/-ed/-ing/-d (incl. drop-e);
 * multi-word phrases match consecutive tokens.
 */
export function matchVocab(plainText: string, words: string[]): Set<string> {
  const matched = new Set<string>();

  for (const raw of words) {
    const normalized = normalizeWord(raw);
    if (!normalized) continue;

    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;

    if (phrasePattern(parts).test(plainText)) {
      matched.add(normalized);
    }
  }

  return matched;
}
