import { z } from 'zod'
import { buildParsePrompt as buildParsePromptTh, buildUserReminder as buildUserReminderTh } from '../prompts/parse.th'
import { buildParsePrompt as buildParsePromptEn, buildUserReminder as buildUserReminderEn } from '../prompts/parse.en'
import { transactionDraftSchema, type CategoryContext } from '../utils/types'

const requestSchema = z.object({
  profileId: z.string().min(1),
  text: z.string().trim().min(1),
  previousItems: z.array(transactionDraftSchema).optional()
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const body = parsedBody.data

  const supabase = useSupabase()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('locale, description_vocabulary')
    .eq('id', body.profileId)
    .single()
  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'profile not found' })
  }

  const recentDescriptions = profile.description_vocabulary
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const { data: rawCategories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, parent_id, name')
    .eq('profile_id', body.profileId)
    .eq('is_active', true)
  if (categoriesError) {
    throw createError({ statusCode: 500, statusMessage: categoriesError.message })
  }

  const majors = (rawCategories ?? []).filter((c) => !c.parent_id)
  const categories: CategoryContext[] = majors.map((major) => ({
    major: major.name,
    subs: (rawCategories ?? []).filter((c) => c.parent_id === major.id).map((c) => c.name)
  }))

  const today = todayInTimezone()
  const isEn = profile.locale === 'en'
  const buildParsePrompt = isEn ? buildParsePromptEn : buildParsePromptTh
  const systemPrompt = buildParsePrompt(today, categories, recentDescriptions)
  const userReminder = isEn ? buildUserReminderEn() : buildUserReminderTh()

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(body.previousItems?.length
      ? [{ role: 'assistant' as const, content: JSON.stringify({ items: body.previousItems }) }]
      : []),
    { role: 'user' as const, content: body.text + userReminder }
  ]

  const rawContent = await callGroq(messages)

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Groq returned invalid JSON' })
  }

  const items = normalizeDraftItems(parsed, categories)
  if (items.length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'No valid items could be extracted' })
  }

  return { items }
})
