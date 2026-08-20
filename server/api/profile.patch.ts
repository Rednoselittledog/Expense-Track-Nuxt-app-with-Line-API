import { z } from 'zod'

const requestSchema = z.object({
  profileId: z.string().min(1),
  locale: z.enum(['th', 'en']).optional(),
  cycle_start_day: z.number().int().min(1).max(28).optional(),
  description_vocabulary: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, ...patch } = parsedBody.data
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'no fields to update' })
  }

  const supabase = useSupabase()
  const { error } = await supabase.from('profiles').update(patch).eq('id', profileId)
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true }
})
