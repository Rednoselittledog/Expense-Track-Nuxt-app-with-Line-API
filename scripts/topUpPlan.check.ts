// Self-check for the cycle top-up sync logic. Lives outside server/utils so Nitro's
// auto-import scan never picks up a module with top-level assertions.
//
//   node --experimental-strip-types scripts/topUpPlan.check.ts
import assert from 'node:assert/strict'
import { planCycleTopUp, type ExistingTopUp } from '../server/utils/topUpPlan.ts'

const row = (id: string, amount: number): ExistingTopUp => ({ id, amount, allocationId: `a-${id}` })

// fresh cycle — no top-up recorded yet
assert.deepEqual(planCycleTopUp([], 10000), { insert: 10000, update: null, deleteIds: [] })

// already in line with the rate — leave it alone
assert.deepEqual(planCycleTopUp([row('t1', 10000)], 10000), { insert: null, update: null, deleteIds: [] })

// the reported bug: a budget raised mid-cycle must move the recorded top-up, not be ignored
assert.deepEqual(planCycleTopUp([row('t1', 10000)], 12000), {
  insert: null,
  update: { id: 't1', allocationId: 'a-t1', amount: 12000 },
  deleteIds: []
})

// lowering the budget works the same way
assert.deepEqual(planCycleTopUp([row('t1', 10000)], 8000), {
  insert: null,
  update: { id: 't1', allocationId: 'a-t1', amount: 8000 },
  deleteIds: []
})

// duplicates left behind by the old insert-only logic get cleaned up, not re-counted
assert.deepEqual(planCycleTopUp([row('t1', 10000), row('t2', 10000)], 10000), {
  insert: null,
  update: null,
  deleteIds: ['t2']
})

// ...and a duplicate plus a stale amount is both fixed and de-duped in one pass
assert.deepEqual(planCycleTopUp([row('t1', 10000), row('t2', 10000), row('t3', 10000)], 12000), {
  insert: null,
  update: { id: 't1', allocationId: 'a-t1', amount: 12000 },
  deleteIds: ['t2', 't3']
})

// budget cleared — the top-up has to go, since amount > 0 is a DB constraint
assert.deepEqual(planCycleTopUp([row('t1', 10000)], 0), { insert: null, update: null, deleteIds: ['t1'] })

// no budget and nothing recorded — do nothing at all
assert.deepEqual(planCycleTopUp([], 0), { insert: null, update: null, deleteIds: [] })

// rounding noise must not trigger a pointless write on every page load
assert.deepEqual(planCycleTopUp([row('t1', 10000.004)], 10000), { insert: null, update: null, deleteIds: [] })

console.log('topUpPlan: all checks passed')
