import { z } from 'zod'
import { buildCalibratePrompt as buildCalibratePromptTh } from '../../prompts/calibrate.th'
import { buildCalibratePrompt as buildCalibratePromptEn } from '../../prompts/calibrate.en'

const requestSchema = z.object({
  profileId: z.string().min(1),
  focusOlds: z.array(z.string().min(1)).optional(),
  correction: z.string().optional()
})

const groqResponseSchema = z.object({
  groups: z.array(
    z.object({
      new: z.string().min(1),
      olds: z.array(z.string().min(1)).min(1)
    })
  )
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, focusOlds, correction } = parsedBody.data

  const supabase = useSupabase()

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('description, occurred_on, amount')
    .eq('profile_id', profileId)
    .eq('is_transfer', false)
    .order('occurred_on', { ascending: false })
  if (txError) {
    throw createError({ statusCode: 500, statusMessage: txError.message })
  }

  const byDescription = new Map<string, { occurred_on: string; amount: number }[]>()
  for (const tx of transactions ?? []) {
    const list = byDescription.get(tx.description) ?? []
    list.push({ occurred_on: tx.occurred_on, amount: tx.amount })
    byDescription.set(tx.description, list)
  }

  const allDescriptions = [...byDescription.keys()]
  const targetDescriptions = focusOlds ? allDescriptions.filter((d) => focusOlds.includes(d)) : allDescriptions

  if (targetDescriptions.length === 0) {
    return { groups: [] }
  }

  // decide prompt language from the descriptions themselves, not profiles.locale —
  // same reasoning as parse.post.ts: locale can drift out of sync with actual data
  const isEn = !targetDescriptions.some((d) => /[฀-๿]/.test(d))
  const buildCalibratePrompt = isEn ? buildCalibratePromptEn : buildCalibratePromptTh
  const systemPrompt = buildCalibratePrompt(targetDescriptions, !!focusOlds)
  const userMessage = correction?.trim() || (isEn ? 'Analyze the list and propose groups.' : 'วิเคราะห์ลิสต์แล้วเสนอกลุ่ม')

  const rawContent = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ])

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Groq returned invalid JSON' })
  }

  const result = groqResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw createError({ statusCode: 502, statusMessage: 'Groq returned unexpected shape' })
  }

  const validSet = new Set(targetDescriptions)
  const groups = result.data.groups
    .map((g) => ({
      new: g.new.trim(),
      olds: g.olds.filter((o) => validSet.has(o))
    }))
    .filter((g) => g.olds.length > 0)
    .map((g) => ({
      new: g.new,
      olds: g.olds.map((old) => ({
        old,
        affectedCount: byDescription.get(old)?.length ?? 0,
        affectedSample: (byDescription.get(old) ?? []).slice(0, 3)
      }))
    }))

  return { groups }
})
