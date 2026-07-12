import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Gold-specific settings that are NOT derivable from transaction history —
// currently just the manufacturing-fee cashback rate the dealer refunds on
// sell. Grams held, cost basis, and avg cost per gram are always computed
// live from goldTransactionsTable so they can never drift out of sync with
// the real purchase history.
export const goldSettingsTable = pgTable("gold_settings", {
  id: serial("id").primaryKey(),
  cashbackPerGram: numeric("cashback_per_gram", {
    precision: 12,
    scale: 2,
  }).notNull(),
});

export const insertGoldSettingsSchema = createInsertSchema(
  goldSettingsTable,
).omit({ id: true });
export type InsertGoldSettings = z.infer<typeof insertGoldSettingsSchema>;
export type GoldSettings = typeof goldSettingsTable.$inferSelect;

// One row per real physical-gold purchase. gramsHeld / costBasis /
// avgCostPerGram for the whole position are always derived by summing this
// table, never stored as a static snapshot — so adding a new purchase here
// automatically corrects every downstream figure.
export const goldTransactionsTable = pgTable("gold_transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  quantity: integer("quantity").notNull(),
  weightPerUnitGrams: numeric("weight_per_unit_grams", {
    precision: 10,
    scale: 3,
  }).notNull(),
  totalWeightGrams: numeric("total_weight_grams", {
    precision: 10,
    scale: 3,
  }).notNull(),
  karat: integer("karat").notNull(),
  spotPricePerGram: numeric("spot_price_per_gram", {
    precision: 12,
    scale: 2,
  }).notNull(),
  manufacturingFeePerGram: numeric("manufacturing_fee_per_gram", {
    precision: 12,
    scale: 2,
  }).notNull(),
  totalPaid: numeric("total_paid", { precision: 14, scale: 2 }).notNull(),
});

export const insertGoldTransactionSchema = createInsertSchema(
  goldTransactionsTable,
).omit({ id: true });
export type InsertGoldTransaction = z.infer<
  typeof insertGoldTransactionSchema
>;
export type GoldTransaction = typeof goldTransactionsTable.$inferSelect;

// Liquid fund positions (e.g. Bareeq money-market fund, Beltone real estate fund).
export const fundsTable = pgTable("funds", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  icon: text("icon").notNull(),
  unitsHeld: numeric("units_held", { precision: 14, scale: 4 }).notNull(),
  costBasisTotal: numeric("cost_basis_total", {
    precision: 14,
    scale: 2,
  }).notNull(),
  nav: numeric("nav", { precision: 14, scale: 4 }).notNull(),
  apyPercent: numeric("apy_percent", { precision: 6, scale: 2 }),
});

export const insertFundSchema = createInsertSchema(fundsTable).omit({
  id: true,
});
export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof fundsTable.$inferSelect;

// Individual fixed-income certificates (e.g. NBE certificates of deposit).
export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
  ratePercent: numeric("rate_percent", { precision: 6, scale: 2 }).notNull(),
  maturityDate: date("maturity_date").notNull(),
});

export const insertCertificateSchema = createInsertSchema(
  certificatesTable,
).omit({ id: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;

// Historical buy/sell activity across gold and liquid funds.
export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  assetType: text("asset_type", { enum: ["gold", "abr", "re"] }).notNull(),
  name: text("name").notNull(),
  meta: text("meta").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  txType: text("tx_type", { enum: ["buy", "sell"] }).notNull(),
});

export const insertTransactionSchema = createInsertSchema(
  transactionsTable,
).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

// Point-in-time snapshots of liquid savings, used for the growth sparkline.
export const growthSnapshotsTable = pgTable("growth_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
});

export const insertGrowthSnapshotSchema = createInsertSchema(
  growthSnapshotsTable,
).omit({ id: true });
export type InsertGrowthSnapshot = z.infer<typeof insertGrowthSnapshotSchema>;
export type GrowthSnapshot = typeof growthSnapshotsTable.$inferSelect;

// Singleton row of portfolio-wide settings (targets, manual rate overrides).
export const portfolioSettingsTable = pgTable("portfolio_settings", {
  id: serial("id").primaryKey(),
  emergencyFundTarget: numeric("emergency_fund_target", {
    precision: 14,
    scale: 2,
  }).notNull(),
  usdEgpRate: numeric("usd_egp_rate", { precision: 10, scale: 4 }).notNull(),
});

export const insertPortfolioSettingsSchema = createInsertSchema(
  portfolioSettingsTable,
).omit({ id: true });
export type InsertPortfolioSettings = z.infer<
  typeof insertPortfolioSettingsSchema
>;
export type PortfolioSettings = typeof portfolioSettingsTable.$inferSelect;
