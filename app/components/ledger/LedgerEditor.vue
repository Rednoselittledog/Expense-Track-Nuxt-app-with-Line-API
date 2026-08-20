<script setup lang="ts">
import type { CategoryContext } from '~~/server/utils/types'
import type { Fund, LedgerRow } from '~/types/ledger'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Minus, Plus, X } from '@lucide/vue'

const props = defineProps<{
  modelValue: LedgerRow[]
  categories: CategoryContext[]
  single?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [LedgerRow[]] }>()

const { t } = useI18n()

function updateRow(index: number, patch: Partial<LedgerRow>) {
  const rows = props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row))
  emit('update:modelValue', rows)
}

function updateAmount(index: number, amount: number) {
  const row = props.modelValue[index]
  if (!row) return
  const patch: Partial<LedgerRow> = { amount }
  if (row.allocations.length === 1) {
    patch.allocations = [{ ...row.allocations[0], amount }]
  }
  updateRow(index, patch)
}

function toggleType(index: number) {
  const row = props.modelValue[index]
  if (!row) return
  if (row.type === 'expense') {
    updateRow(index, {
      type: 'income',
      category: null,
      allocations: [{ fund: 'savings', amount: row.amount }]
    })
  } else {
    const firstMajor = props.categories[0]
    updateRow(index, {
      type: 'expense',
      category: { major: firstMajor?.major ?? '', sub: firstMajor?.subs[0] ?? '' },
      allocations: [{ fund: 'daily', amount: row.amount }]
    })
  }
}

// income: exactly one fund, picked via radio
function incomeFund(row: LedgerRow) {
  return row.allocations[0]?.fund ?? 'savings'
}
function setIncomeFund(index: number, fund: Fund) {
  const row = props.modelValue[index]
  if (!row) return
  updateRow(index, { allocations: [{ fund, amount: row.amount }] })
}

// expense: one or more funds, picked via checkbox — split-amount inputs only show once more than one is checked
function isFundChecked(row: LedgerRow, fund: Fund) {
  return row.allocations.some((a) => a.fund === fund)
}
function hasSplitFunds(row: LedgerRow) {
  return row.allocations.length > 1
}
function toggleFundCheckbox(index: number, fund: Fund, checked: boolean) {
  const row = props.modelValue[index]
  if (!row) return

  if (checked) {
    if (isFundChecked(row, fund)) return
    const allocations = row.allocations.length === 0 ? [{ fund, amount: row.amount }] : [...row.allocations, { fund, amount: 0 }]
    updateRow(index, { allocations })
  } else {
    const remaining = row.allocations.filter((a) => a.fund !== fund)
    if (remaining.length === 0) return // must keep at least one fund checked
    const allocations = remaining.length === 1 ? [{ fund: remaining[0]!.fund, amount: row.amount }] : remaining
    updateRow(index, { allocations })
  }
}

function setAllocationAmount(index: number, fund: Fund, amount: number) {
  const row = props.modelValue[index]
  if (!row) return
  updateRow(index, { allocations: row.allocations.map((a) => (a.fund === fund ? { ...a, amount } : a)) })
}

function allocationAmount(row: LedgerRow, fund: Fund) {
  return row.allocations.find((a) => a.fund === fund)?.amount ?? 0
}

function allocationMismatch(row: LedgerRow) {
  const sum = row.allocations.reduce((s, a) => s + a.amount, 0)
  return Math.abs(sum - row.amount) > 0.01
}

function categoryValue(row: LedgerRow) {
  return row.category ? `${row.category.major}|${row.category.sub}` : ''
}

function setCategory(index: number, value: string) {
  const [major = '', sub = ''] = value.split('|')
  updateRow(index, { category: { major, sub } })
}

function removeRow(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index)
  )
}

function addRow() {
  const firstMajor = props.categories[0]
  const row: LedgerRow = {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: 0,
    description: '',
    occurred_on: todayInTimezone(),
    category: { major: firstMajor?.major ?? '', sub: firstMajor?.subs[0] ?? '' },
    allocations: [{ fund: 'daily', amount: 0 }]
  }
  emit('update:modelValue', [...props.modelValue, row])
}
</script>

<template>
  <div class="min-w-0">
    <Table class="min-w-200">
      <TableHeader>
        <TableRow>
          <TableHead class="w-36">{{ t('ledger.columnDate') }}</TableHead>
          <TableHead class="min-w-40">{{ t('ledger.columnDescription') }}</TableHead>
          <TableHead class="w-36">{{ t('ledger.columnAmount') }}</TableHead>
          <TableHead class="w-48">{{ t('ledger.columnCategory') }}</TableHead>
          <TableHead class="w-40">{{ t('ledger.columnFund') }}</TableHead>
          <TableHead v-if="!single" class="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in modelValue" :key="row.id">
          <TableCell>
            <Input
              type="date"
              class="w-32"
              :model-value="row.occurred_on"
              @update:model-value="(v: unknown) => updateRow(index, { occurred_on: String(v) })"
            />
          </TableCell>
          <TableCell>
            <Input
              class="min-w-35"
              :model-value="row.description"
              @update:model-value="(v: unknown) => updateRow(index, { description: String(v) })"
            />
          </TableCell>
          <TableCell>
            <div class="flex items-center gap-1">
              <button
                type="button"
                :title="row.type === 'income' ? t('ledger.toggleToExpense') : t('ledger.toggleToIncome')"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-lg font-bold"
                :class="row.type === 'income' ? 'text-success border-success' : 'text-destructive border-destructive'"
                @click="toggleType(index)"
              >
                <Plus v-if="row.type === 'income'" class="size-4" />
                <Minus v-else class="size-4" />
              </button>
              <Input
                type="number"
                class="w-20"
                :model-value="row.amount"
                @update:model-value="(v: unknown) => updateAmount(index, Number(v))"
              />
            </div>
          </TableCell>
          <TableCell>
            <Select
              v-if="row.type === 'expense'"
              :model-value="categoryValue(row)"
              @update:model-value="(v: unknown) => setCategory(index, String(v))"
            >
              <SelectTrigger class="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup v-for="cat in categories" :key="cat.major">
                  <SelectLabel>{{ cat.major }}</SelectLabel>
                  <SelectItem v-for="sub in cat.subs" :key="sub" :value="`${cat.major}|${sub}`">
                    {{ sub }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <span v-else class="text-caption">{{ t('ledger.noCategoryForIncome') }}</span>
          </TableCell>
          <TableCell>
            <!-- income: pick exactly one fund -->
            <RadioGroup
              v-if="row.type === 'income'"
              :model-value="incomeFund(row)"
              class="gap-1"
              @update:model-value="(v) => setIncomeFund(index, v as Fund)"
            >
              <label class="text-small flex items-center gap-1">
                <RadioGroupItem value="daily" />
                {{ t('ledger.fundDaily') }}
              </label>
              <label class="text-small flex items-center gap-1">
                <RadioGroupItem value="fixed" />
                {{ t('ledger.fundFixed') }}
              </label>
              <label class="text-small flex items-center gap-1">
                <RadioGroupItem value="savings" />
                {{ t('ledger.fundSavings') }}
              </label>
            </RadioGroup>
            <!-- expense: pick one or more funds, split amount shown only when more than one checked -->
            <div v-else class="text-small flex flex-col gap-1">
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="isFundChecked(row, 'daily')"
                  @change="(e) => toggleFundCheckbox(index, 'daily', (e.target as HTMLInputElement).checked)"
                />
                {{ t('ledger.fundDaily') }}
                <Input
                  v-if="hasSplitFunds(row) && isFundChecked(row, 'daily')"
                  type="number"
                  class="w-16"
                  :model-value="allocationAmount(row, 'daily')"
                  @update:model-value="(v: unknown) => setAllocationAmount(index, 'daily', Number(v))"
                />
              </label>
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="isFundChecked(row, 'fixed')"
                  @change="(e) => toggleFundCheckbox(index, 'fixed', (e.target as HTMLInputElement).checked)"
                />
                {{ t('ledger.fundFixed') }}
                <Input
                  v-if="hasSplitFunds(row) && isFundChecked(row, 'fixed')"
                  type="number"
                  class="w-16"
                  :model-value="allocationAmount(row, 'fixed')"
                  @update:model-value="(v: unknown) => setAllocationAmount(index, 'fixed', Number(v))"
                />
              </label>
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="isFundChecked(row, 'savings')"
                  @change="(e) => toggleFundCheckbox(index, 'savings', (e.target as HTMLInputElement).checked)"
                />
                {{ t('ledger.fundSavings') }}
                <Input
                  v-if="hasSplitFunds(row) && isFundChecked(row, 'savings')"
                  type="number"
                  class="w-16"
                  :model-value="allocationAmount(row, 'savings')"
                  @update:model-value="(v: unknown) => setAllocationAmount(index, 'savings', Number(v))"
                />
              </label>
            </div>
          </TableCell>
          <TableCell v-if="!single">
            <Button variant="ghost" size="icon" :aria-label="t('ledger.removeRow')" @click="removeRow(index)">
              <X class="size-4" />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <p v-if="modelValue.some(allocationMismatch)" class="text-alert mt-2">
      {{ t('ledger.allocationMismatch') }}
    </p>

    <Button v-if="!single" variant="link" class="mt-2 px-0" @click="addRow">{{ t('ledger.addRow') }}</Button>
  </div>
</template>
