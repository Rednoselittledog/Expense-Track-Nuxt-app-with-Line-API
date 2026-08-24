function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

// ponytail: only handles the "{item} {amount}" shape (matches the trailing number, fuzzy-matches
// everything before it against the vocabulary). Multi-item free-form sentences fall through
// untouched — upgrade to per-token matching if that turns out to matter in practice.
export function fuzzyMatchDescription(text: string, vocabulary: string[]): string {
  const match = text.match(/^(.*?)\s*([\d,]+(?:\.\d+)?)\s*$/)
  if (!match) return text

  const phrase = match[1].trim()
  const amountPart = match[2]
  if (!phrase || vocabulary.length === 0) return text

  let best: { word: string; distance: number } | null = null
  for (const word of vocabulary) {
    // compare against a same-length-ish prefix so a short typo'd input can still match a
    // longer canonical entry (e.g. "ย้ำแพค" vs "น้ำแพ็ค 1.5 ลิตร") without being penalized
    // for the extra detail on the end
    const candidate = word.slice(0, Math.min(word.length, phrase.length + 2))
    const distance = levenshtein(phrase, candidate)
    if (!best || distance < best.distance) best = { word, distance }
  }
  if (!best) return text

  const threshold = Math.max(1, Math.ceil(phrase.length * 0.4))
  if (best.distance > threshold) return text

  return `${best.word} ${amountPart}`
}
