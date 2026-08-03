import { z } from 'zod'

const requestSchema = z
  .object({
    profileId: z.string().min(1),
    amount: z.coerce.number().positive(),
    from: z.enum(['daily', 'fixed', 'savings']),
    to: z.enum(['daily', 'fixed', 'savings']),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().optional()
  })
  .refine((data) => data.from !== data.to, { message: 'from and to must differ', path: ['to'] })

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const body = parsedBody.data
  const supabase = useSupabase()

  const fundLabel = { daily: 'รายวัน', fixed: 'ประจำ', savings: 'เงินเก็บ' } as const
  const description = body.note?.trim() || `โยกเงิน ${fundLabel[body.from]} → ${fundLabel[body.to]}`

  const { data: outTx, error: outTxError } = await supabase
    .from('transactions')
    .insert({
      profile_id: body.profileId,
      category_id: null,
      type: 'expense',
      is_transfer: true,
      amount: body.amount,
      description,
      occurred_on: body.occurred_on,
      source: 'web'
    })
    .select('id')
    .single()
  if (outTxError || !outTx) {
    throw createError({ statusCode: 500, statusMessage: outTxError?.message ?? 'failed to save transfer' })
  }

  const { error: outAllocError } = await supabase
    .from('transaction_allocations')
    .insert({ transaction_id: outTx.id, fund: body.from, amount: body.amount })
  if (outAllocError) {
    throw createError({ statusCode: 500, statusMessage: outAllocError.message })
  }

  const { data: inTx, error: inTxError } = await supabase
    .from('transactions')
    .insert({
      profile_id: body.profileId,
      category_id: null,
      type: 'income',
      is_transfer: true,
      amount: body.amount,
      description,
      occurred_on: body.occurred_on,
      source: 'web'
    })
    .select('id')
    .single()
  if (inTxError || !inTx) {
    throw createError({ statusCode: 500, statusMessage: inTxError?.message ?? 'failed to save transfer' })
  }

  const { error: inAllocError } = await supabase
    .from('transaction_allocations')
    .insert({ transaction_id: inTx.id, fund: body.to, amount: body.amount })
  if (inAllocError) {
    throw createError({ statusCode: 500, statusMessage: inAllocError.message })
  }

  return { outTransactionId: outTx.id, inTransactionId: inTx.id }
})
