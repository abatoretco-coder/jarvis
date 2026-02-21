export function stripDiacritics(input: string): string {
  // NFD splits letters and their diacritics, then we drop diacritic marks.
  // Example: "lumière" -> "lumiere".
  return input.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
}

export function normalizeText(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
