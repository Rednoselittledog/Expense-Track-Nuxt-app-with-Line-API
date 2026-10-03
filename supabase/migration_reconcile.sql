-- Run once against an existing database (schema.sql already reflects the end state).
--
-- 1. budget_rates gains 'savings' so a monthly top-up can be set for all three funds.
-- 2. transactions gains source='system' as the stable identity for the auto cycle top-up.
--    It used to be identified by description + exact cycle-start date, which broke in three
--    ways: renaming the row made it reappear, moving cycle_start_day could double it, and the
--    amount was never brought in line when the budget changed mid-cycle.
-- 3. Existing auto top-ups MUST be tagged, or the new code treats them as missing and inserts
--    a second one — doubling the current cycle's money.

alter table budget_rates drop constraint if exists budget_rates_fund_check;
alter table budget_rates add constraint budget_rates_fund_check check (fund in ('daily','fixed','savings'));

alter table transactions drop constraint if exists transactions_source_check;
alter table transactions add constraint transactions_source_check check (source in ('web','line','system'));

update transactions set source = 'system' where description = 'เติมเงินต้นเดือน';

-- No unique index to go with this: the fund lives in transaction_allocations, so any index on
-- transactions alone would also forbid the legitimate case of one top-up per fund sharing a
-- cycle-start date. The duplicate race is instead self-healed on the next read by
-- planCycleTopUp(), which keeps the first row and deletes the rest.
