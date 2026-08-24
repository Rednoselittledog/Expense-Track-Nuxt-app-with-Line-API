import { z } from 'zod'

const requestSchema = z.object({
  profileId: z.string().min(1),
  groups: z
    .array(
      z.object({
        new: z.string().min(1),
        olds: z.array(z.string().min(1)).min(1)
      })
    )
    .min(1)
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, groups } = parsedBody.data

  const supabase = useSupabase()

  for (const group of groups) {
    for (const old of group.olds) {
      if (old === group.new) continue
      const { error } = await supabase
        .from('transactions')
        .update({ description: group.new })
        .eq('profile_id', profileId)
        .eq('description', old)
      if (error) {
        throw createError({ statusCode: 500, statusMessage: error.message })
      }
    }
  }

  const description_vocabulary = await refreshVocabulary(supabase, profileId)

  return { updated: true, description_vocabulary }
})
