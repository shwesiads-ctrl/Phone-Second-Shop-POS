# Operational accounting policy

This is an operational inventory/cashbook system, not certified statutory accounting or a double-entry general ledger. Have a local accountant validate the policy before tax filing.

## Money and currencies

Amounts are integer **minor units** in SQLite. MMK precision is one kyat; THB/USD precision is 0.01. Decimal input is parsed using BigInt without binary floating-point financial arithmetic. Individual monetary values and invoice totals are limited to 1,000,000,000,000 minor units. Multiplication and totals are checked before persistence. Separate rows report MMK, THB and USD; they are never summed as if interchangeable. Changing the default currency never changes historical invoices. Signed profit/cash aggregations use BigInt and reject an unsafe bridge result instead of losing integer precision.

New authorized exchange rates mean **target major units / source major units**. Example: USD → MMK, numerator 3000, denominator 1 means USD 1.00 = MMK 3000. Owner/Admin records pair, integer ratio, source and author/time; stored rates cannot be updated or deleted. Choose an explicit matching rate ID; there is no automatic inversion, external feed or inferred rate. Schema-7 reference rates retain their old minor-unit meaning through a `basis=minor` marker.

Conversion uses BigInt: source minor units × numerator × target precision ÷ (denominator × source precision), rounded HALF_UP once to a target minor unit. Each payment stores canonical invoice credit plus original amount/currency, original cash handed over/change and the applied pair/ratio/source/actor/timestamps. Each foreign stock line freezes its per-unit catalogue, minimum and COGS quotes. Changing the rate/default currency never recalculates posted transactions. Foreign repair parts freeze per-unit converted cost before quantity multiplication.

The tender amount means money applied, in the tender's own currency. Optional Cash handed over must be at least that amount; the difference is change in that same currency. Credited conversion may not exceed the invoice balance, and nonzero tender conversions rounding to zero are rejected. Other methods do not record physical cash change. Supplier payments follow the same original-tender policy; paid refurbishment remains a separate cost/outflow.

Refunds reduce invoice debt first, then consume original non-trade tenders FIFO, preserving each original method/currency/rate even after a rate or method changes. A partial refund releases floor(original tender units × cumulative refunded invoice units / original credited invoice units), less units already refunded. The final refund releases every residual original minor unit: a source unit is never invented or refunded twice. The `payment_refunds` table links both legs. Legacy refunds are allocated before new refunds during migration. A refund too small to release a source minor unit may legitimately release zero native cash units until later refunds. Refund ratios do not use today's rate.

Profit/receivables use canonical invoice units. Actual collections and physical cash use **original tender units**, excluding Trade-in. Cash USD and invoice MMK credit are separate measures. The native cashbook also includes purchase/refurbishment/replenishment outflows, expenses and explicit floats/withdrawals. Never add the three currency balances without an explicit conversion.

Optional converted reports require approved explicit rates for all nonzero source aggregates. Conversion rounds each currency aggregate HALF_UP, then sums exactly and derives gross/net from converted components. Original report rows, applied rates, period and timestamp are saved in `report_runs`; this is a reference-currency presentation, not an FX gain/loss or statutory revaluation journal. Aggregate conversion retains the per-quote 1,000,000,000,000 minor-unit limit and rejects overflow rather than silently truncating.

## Phone purchases and sales

Each phone is its own unit. Its cost basis is purchase cost plus paid refurbishment. The initial purchase payment and refurbishment cash outflow are recorded separately, so the unpaid supplier balance is correctly limited to the unpaid purchase portion. Eligible refurbishment is capitalized and subsequently included in COGS, not expensed again.

Posted invoices recognize sales revenue at finalization. Phone COGS uses that unit's recorded cost. Accessory opening quantities represent pre-existing stock and do not create cash payments. Paid accessory replenishments record cash outflow and update integer weighted-average unit cost (rounded down to one minor unit; possible rounding differences should be reconciled by an accountant). Quantity adjustments require a reason but do not automatically create cash entries.

Partial/credit sales recognize revenue while collections reflect only actual recorded payments. Customer balances are invoice value minus return credits minus net collections. Supplier balances are capitalized phone cost minus net purchase payments. Accessory replenishment currently requires full payment. Payment direction and method are immutable ledger facts.

## Discounts, returns and trade-ins

Only Owner/Admin may discount. Invoice discounts are allocated deterministically across invoice lines using cumulative integer prorating. The backend also enforces each phone's minimum after an invoice discount. Return quantities cannot exceed quantities sold less prior returns.

A return first reduces outstanding debt. Required cash refund is the net amount collected above the remaining invoice value. For example, a 300-unit invoice paid 150 with 100 units returned requires no refund and leaves 50 due. Returning another 100 requires a 50-unit refund. Refund amount must exactly match this policy. A full return refunds all net collections.

Return revenue/COGS reversals are recognized on the return date, preserving the original sales period. Restocked phones are quarantined for inspection. A return without restocking reverses revenue but retains COGS (the item has been written off). Accessory restocking is an explicit choice. Historical sale, payment and movement records are retained.

Trade-ins atomically create an inbound purchase and stock unit, an outgoing sale, and matching noncash Trade-in payment entries. Cash collections exclude these noncash credits. A full reversal returns both devices together and requires the acquired trade-in device still to be available. Partial returns on a linked trade-in invoice are blocked for manual manager review. Owner/Admin can finalize a replacement cart with an atomic exchange: original return/refund and replacement sale/tenders commit together, or both roll back. The exchange links their IDs and is idempotent. Both gross tender legs are recorded; this is not a silent net-cash shortcut.

## Repairs and expenses

Repair deposits are collections, not repair revenue. Delivered repair tickets recognize their final bill as repair revenue and consumed parts as repair cost. Operating expenses are recorded separately; repair parts are not expensed twice. Cancelled repair deposits are refunded and consumed parts are charged as repair cost on cancellation. Parts already used are not automatically restocked by cancellation. Reopening a closed repair creates a linked new ticket instead of rewriting delivered revenue.

Gross profit = net merchandise sales revenue − net merchandise COGS.

Net operational profit = gross profit + delivered repair revenue − repair parts cost − operating expenses.

## Cash drawers and periods

Cash drawer reconciliation is **shop-wide per currency**, with one open drawer per currency. Expected cash = opening balance + Cash collections − Cash refunds − Cash purchase/replenishment/refurbishment outflows − Cash expenses after opening. Other payment methods never count as physical cash. Closing retains counted, expected and variance with an audit event. Owner/Admin can record explicit cash-in/cash-out entries (for example owner floats and withdrawals). These adjust cash without affecting sales revenue or operating profit. Accountant-approved stock valuation adjustment journals are not implemented.

Timestamps are UTC ISO strings. Display follows configured language, timezone and date/time formats. Report date filters are explicitly UTC and include both selected dates. Receivables/payables are balances **as of the selected UTC end date**, including prior-period invoices and only payments/return credits/reversals posted by that date. Refunds remain visible in the period when they occurred. Purchase-period totals recognize acquisition value on purchase date and the negative value on the reversal date, including linked trade reversals. A full statutory ledger is not implemented.

Purchase reversal accepts the actual refund and payment method. The default proposal is the net amount previously paid, which an owner must verify rather than assume was returned by the seller. A shortfall is recognized as a noncash purchase-reversal loss expense, avoiding a second cash outflow while recording the economic loss. The reversed purchase no longer creates a supplier payable.
