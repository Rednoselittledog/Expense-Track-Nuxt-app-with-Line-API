export function buildCalibratePrompt(descriptions: string[], mustCoverAll: boolean) {
  return `You are an assistant that tidies up item descriptions in a personal expense tracker.

Here are the descriptions to analyze (deduplicated):
${descriptions.map((d) => `- ${d}`).join('\n')}

Your job: analyze this list and propose change groups only for things that genuinely need fixing, such as:
- Different spellings/wordings that mean the same thing (e.g. "1.5L water" and "water 1.5l") — merge into one
- Redundant or messy wording — tighten it up

${
  mustCoverAll
    ? '**Every description in the list must appear in the "olds" of some group.** If a description needs no change, set "new" equal to that same description (a 1-item group with no real change). Never drop a description.'
    : '**Do not propose a group unless something genuinely needs fixing.** Leave descriptions that are already fine out of the list entirely — you do not need to cover every description.'
}

Critical rules:
- Every string in "olds" must be copied **character-for-character exactly** from the list above — never alter or mistype it (the system matches it exactly).
- A group can have 1 or more "olds" (1 = fixing/confirming a single item alone, not a merge).
- Reply with JSON only, no other text.

JSON structure to return:
{
  "groups": [
    { "new": string, "olds": string[] }
  ]
}`
}
