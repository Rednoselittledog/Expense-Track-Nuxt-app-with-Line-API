export interface ExistingTopUp {
  id: string
  amount: number
  allocationId: string
}

export interface TopUpPlan {
  insert: number | null
  update: { id: string; allocationId: string; amount: number } | null
  deleteIds: string[]
}

const EPSILON = 0.01

// Decides how to bring the cycle's system-generated top-up in line with the budget rate.
// Kept pure because every wrong branch here is wrong money: skipping an update strands the
// old amount (changing the budget "effective now" then does nothing), and a missed duplicate
// doubles the cycle's pot. See topUpPlan.check.ts.
export function planCycleTopUp(existing: ExistingTopUp[], monthlyAmount: number): TopUpPlan {
  // anything beyond the first row is a duplicate from an earlier insert-only run — drop it
  const deleteIds = existing.slice(1).map((e) => e.id)

  if (monthlyAmount <= 0) {
    return { insert: null, update: null, deleteIds: existing.map((e) => e.id) }
  }

  const keep = existing[0]
  if (!keep) {
    return { insert: monthlyAmount, update: null, deleteIds }
  }

  if (Math.abs(keep.amount - monthlyAmount) < EPSILON) {
    return { insert: null, update: null, deleteIds }
  }

  return {
    insert: null,
    update: { id: keep.id, allocationId: keep.allocationId, amount: monthlyAmount },
    deleteIds
  }
}
