---
name: Gold fee schedule & purity blending
description: How the Beeshoy portfolio app's gold DCA calculator treats manufacturing fees, cashback, and multi-karat averaging — read before touching gold PnL/DCA math.
---

- Manufacturing fee (buy side) is NOT a single number — it varies by product: 5g 24K bar, 10g 24K bar (bought as one unit), and the 21K "gold pound" (8g) each have their own dealer-published fee per gram. These are real fixed business constants explicitly asked to be hardcoded by the user (in `artifacts/portfolio/src/lib/goldFeeSchedule.ts`), which is a deliberate carve-out from the app's general "no hardcoded financial numbers" policy — that policy is about *spot prices* (which must be live/manual-entry, never fabricated), not about the dealer's fixed fee schedule.
- Cashback (sell side) also varies by karat, not just a flat rate: 21K general cashback and 24K cashback are different fixed values. 24K cashback stays sourced from the DB (`gold_settings.cashbackPerGram`) since that's the actual held position's karat and is already the single source of truth; 21K cashback has no DB column yet, so it's a hardcoded constant.
- **Why:** the user explicitly buys different bar sizes/karats at different fee rates and wanted scenario math (buy 1 bar, 2 bars, one bigger bar, or a 21K gold pound) that reflects the real fee schedule, not an average/flat rate.
- When blending positions of different karats into one average cost, convert to **pure gold grams** first: `pureGrams = physicalGrams × (karat / 24)`. Average cost = total EGP spent ÷ total pure grams. This is the user's own stated reconciliation rule — do not blend by physical grams across differing karats, it understates value of higher-karat gold.
- **How to apply:** any future gold cost/average/PnL calculation that mixes karats (e.g. adding 21K holdings to an existing 24K position) must go through the pure-gram conversion, not straight gram totals.
