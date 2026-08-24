import { z } from 'zod'

const requestSchema = z.object({
  profileId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId } = parsedBody.data

  const supabase = useSupabase()
  const description_vocabulary = await refreshVocabulary(supabase, profileId)

  return { description_vocabulary }
})
