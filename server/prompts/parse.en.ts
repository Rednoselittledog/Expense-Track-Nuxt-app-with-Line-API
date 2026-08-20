import type { CategoryContext } from '../utils/types'

// no-op for English locale — the Thai variant's reminder exists to stop the model
// translating Thai input to English; that failure mode doesn't apply here
export function buildUserReminder() {
  return ''
}

export function buildParsePrompt(today: string, categories: CategoryContext[], recentDescriptions: string[] = []) {
  return `Today's date is ${today} (YYYY-MM-DD format).
You are an assistant that extracts money line items from free-form English text the user typed. Reply with JSON matching the given structure only. No text outside the JSON.

Existing major categories (never invent a new major category, pick only from this list):
${categories.map((c) => `- ${c.major}`).join('\n')}

Existing sub-categories under each major (reuse one if it fits, otherwise you may invent a new sub-category name):
${categories.map((c) => `- ${c.major}: ${c.subs.join(', ') || '(no sub-categories yet)'}`).join('\n')}
${recentDescriptions.length > 0 ? `\nDescriptions used before (if the new item matches or is close to one of these, reuse the exact same wording — don't invent new phrasing):\n${recentDescriptions.map((d) => `- ${d}`).join('\n')}\n` : ''}

JSON structure to return (never rename the keys):
{
  "items": [
    {
      "type": "expense" | "income",
      "amount": number,
      "description": string,
      "occurred_on": "YYYY-MM-DD",
      "category": { "major": string, "sub": string } | null,
      "allocations": [ { "fund": "daily" | "fixed" | "savings", "amount": number } ]
    }
  ]
}

Rules:
- "type": "expense" = money going out (purchases, bills, etc.), "income" = money coming in (topping up savings, salary, receiving money, etc.) — infer from wording like "add to savings", "salary came in", "got paid". If unclear, default to "expense".
- "category" is only required when type is "expense". When type is "income", set it to null — don't guess a category.
- Resolve words like "today"/"yesterday"/"Aug 1" relative to the date given above.
- If the user didn't specify a fund split, put the full amount into a single allocation [{ "fund": ..., "amount": amount }] and guess the fund from what the item is:
  - Known recurring expenses with a predictable amount, e.g. laundry, gas/fuel → "fixed"
  - Social or entertainment activities, e.g. movies, drinks, hanging out, going out with friends/club members → "savings"
  - Everyday life expenses otherwise, e.g. meals, drinks, stationery, general supplies → "daily" (the default when nothing else matches)
  - If the text clearly names savings explicitly, always use "savings" as stated (no need to guess from the item).
- allocations must sum exactly to amount.
- If the message describes multiple items, split them into multiple entries in "items".
- If the latest message is a correction to a previous JSON (see the prior assistant message), only fix what's wrong and keep unrelated items unchanged.
- Rewrite "description" into a clean, natural short phrase — don't echo the user's raw typing verbatim. Drop redundant filler ("bought", "paid for") when it just repeats the category, and capitalize proper nouns/movie titles/brand names correctly. E.g. "bought a spiderman ticket" → "Spider-Man movie ticket", "chicken rice near home" → "Chicken rice", "paid home internet bill" → "Internet bill".`
}
