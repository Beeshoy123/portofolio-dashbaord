// ── GOLD FEE SCHEDULE (dealer-published, fixed) ─────────────────────────
// These are NOT placeholder/sample numbers — they are the dealer's real,
// published manufacturing-fee schedule, which varies by product (bar size)
// rather than by the moment-to-moment spot price. Unlike spot gold prices
// (buying/selling EGP per gram), which must come from the live price feed
// or a manual entry until that feed exists, these fee-schedule figures are
// stable business constants set by the user and are intentionally
// hardcoded here. If the dealer changes their fee schedule, update these
// constants directly — do not move them into a "live" data source.
// ─────────────────────────────────────────────────────────────────────────

/** Manufacturing fee (EGP/g) when buying a single 5g, 24K bar. */
export const MFG_FEE_5G_24K_PER_GRAM = 87;

/** Manufacturing fee (EGP/g) when buying a single 10g, 24K bar (bought as
 * one unit — cheaper per gram than buying two separate 5g bars). */
export const MFG_FEE_10G_24K_PER_GRAM = 84;

/** Manufacturing fee (EGP/g) when buying a gold pound (جنيه ذهب), a 21K,
 * 8g unit. */
export const MFG_FEE_GOLD_POUND_21K_PER_GRAM = 77;

/** Sell-side cashback (EGP/g) the dealer refunds on 21K gold, in general. */
export const CASHBACK_21K_PER_GRAM = 24;

/** Standard purity fraction by karat, relative to 24K pure gold. Used to
 * convert physical grams into "pure grams" so positions of different
 * karats can be blended into one average-cost figure. */
export function purityFraction(karat: 21 | 24): number {
  return karat / 24;
}

export const GOLD_POUND_GRAMS = 8;
export const BAR_5G_GRAMS = 5;
export const BAR_10G_GRAMS = 10;
