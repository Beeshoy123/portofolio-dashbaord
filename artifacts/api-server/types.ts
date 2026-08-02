// Shared types — comparison_watchlist table shape
//
// STRUCTURAL FIX (senior-dev integration review): previously,
// scraper/types.ts and judge/comparisonJudge.ts each independently
// declared their own version of "what a comparison_watchlist row looks
// like" (WatchlistEntity vs. an inline WatchlistRow). They had already
// silently drifted — judge's version was missing source_code — with
// nothing to catch it, since TypeScript has no way to know two
// separately-declared interfaces are "supposed to" represent the same
// table. This file is now the SINGLE definition, imported by every
// engine that touches comparison_watchlist, so a future column change
// only needs to happen once and every engine sees it (or fails to
// compile if it doesn't match, which is the point).

export type EntityType = "fund" | "stock" | "index";

export interface WatchlistEntity {
  id: number;
  ticker: string;
  name: string;
  entity_type: EntityType;
  source_code: string | null; // FoudaLens fund code e.g. MUB-6203 (funds only)
  sector: string;
  manager: string | null;
  is_held: boolean;
}
