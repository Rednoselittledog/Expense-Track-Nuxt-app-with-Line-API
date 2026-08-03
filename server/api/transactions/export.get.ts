import { z } from 'zod'

const querySchema = z.object({
  profileId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

interface ExportRow {
  type: 'expense' | 'income'
  is_transfer: boolean
  amount: number
  description: string
  occurred_on: string
  categories: { name: string } | null
  transaction_allocations: { fund: 'daily' | 'fixed' | 'savings'; amount: number }[]
}

export default defineEventHandler(async (event) => {
  const parsedQuery = querySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    throw createError({ statusCode: 400, statusMessage: parsedQuery.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, from, to } = parsedQuery.data

  const supabase = useSupabase()

  let query = supabase
    .from('transactions')
    .select('type, is_transfer, amount, description, occurred_on, categories(name), transaction_allocations(fund, amount)')
    .eq('profile_id', profileId)
    .order('occurred_on', { ascending: false })

  if (from) query = query.gte('occurred_on', from)
  if (to) query = query.lte('occurred_on', to)

  const { data, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const header = ['วันที่', 'ประเภท', 'รายการ', 'ยอด', 'หมวดหมู่', 'กองทุน', 'โยกเงิน']
  const fundLabel = { daily: 'รายวัน', fixed: 'ประจำ', savings: 'เงินเก็บ' } as const
  const rows = ((data ?? []) as unknown as ExportRow[]).map((tx) => [
    tx.occurred_on,
    tx.type === 'income' ? 'รายรับ' : 'รายจ่าย',
    tx.description,
    String(tx.amount),
    tx.categories?.name ?? '',
    tx.transaction_allocations.map((a) => `${fundLabel[a.fund]} ${a.amount}`).join(' + '),
    tx.is_transfer ? 'ใช่' : ''
  ])

  const csv = String.fromCharCode(0xfeff) + toCsv([header, ...rows])

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="transactions_${from ?? 'all'}_${to ?? 'all'}.csv"`)
  return csv
})
