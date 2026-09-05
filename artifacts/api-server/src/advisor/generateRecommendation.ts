// Smart Advisor — Gemini Caller
//
// ⚠️ IMPORTANT — CHECK THIS AGAINST YOUR EXISTING GEMINI SETUP ⚠️
// You mentioned your app already has a working Gemini API key/integration
// elsewhere (Part 1 of your app). This file is written standalone since I
// don't have visibility into that existing code's exact pattern (env var
// name, SDK vs plain fetch, model version used, etc.).
//
// BEFORE USING THIS FILE: check how your existing Gemini call is wired and
// either (a) replace the fetch logic below with a call to your existing
// wrapper/function, or (b) at minimum, make sure GEMINI_API_KEY below
// matches whatever environment variable name your existing integration
// already uses — using a different key name would mean managing two
// separate keys for one API, which is unnecessary duplication.
//
// FILE STRUCTURE:
// ├── Configuration & Schema (GEMINI_RESPONSE_SCHEMA, env config)
// ├── Gemini API Callers (callGemini, callGeminiWithSchema)
// ├── Response Parsing (parseStructuredResponse, parsePortfolioResponse)
// ├── Recommendation Builders (generateRecommendation, generatePortfolioSummary)
// └── Entry Points (exported functions for route handlers)

import {
  SYSTEM_INSTRUCTIONS,
  PORTFOLIO_SUMMARY_SYSTEM_INSTRUCTIONS,
  buildDataBlock,
  buildPortfolioSummaryPrompt,
  type AdvisorAlertContext,
} from "./buildPrompt";
import type { HoldingVerdict } from "../judge/types";
import type { AdvisorRecommendation, PortfolioSummaryResult } from "./types";

function envNumber(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
const GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const QWEN_MODEL = process.env.QWEN_MODEL?.trim() || "qwen-plus-latest";
const GEMINI_TEMPERATURE = envNumber("GEMINI_TEMPERATURE", 0.4, 0, 2);
const GEMINI_MAX_OUTPUT_TOKENS = envNumber("GEMINI_MAX_OUTPUT_TOKENS", 2048, 128, 8192);
const GEMINI_TIMEOUT_MS = envNumber("GEMINI_TIMEOUT_MS", 45_000, 5_000, 120_000);


interface ModelsListResponse {
  models?: Array<{
    name: string;
    displayName?: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

type StructuredAdvisorResult = AdvisorRecommendation["structured"];

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    decision: {
      type: "STRING",
      enum: ["consider_entry", "consider_rotation", "watch_and_wait", "hold"],
    },
    confidence: { type: "INTEGER", minimum: 0, maximum: 100 },
    summary: { type: "STRING" },
    thesis_risk: { type: "STRING" },
    evidence: { type: "ARRAY", items: { type: "STRING" } },
    risks: { type: "ARRAY", items: { type: "STRING" } },
    next_review_days: { type: "INTEGER", minimum: 1, maximum: 365 },
    watch_trigger: { type: "STRING" },
    do_not_act_reasons: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "decision",
    "confidence",
    "summary",
    "thesis_risk",
    "evidence",
    "risks",
    "next_review_days",
    "watch_trigger",
    "do_not_act_reasons",
  ],
};

const PORTFOLIO_SUMMARY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    decision: {
      type: "STRING",
      enum: ["hold", "watch", "rebalance"],
    },
    confidence: { type: "INTEGER", minimum: 0, maximum: 100 },
    summary: { type: "STRING" },
    evidence: { type: "ARRAY", items: { type: "STRING" } },
    risks: { type: "ARRAY", items: { type: "STRING" } },
    next_review_days: { type: "INTEGER", minimum: 1, maximum: 365 },
  },
  required: ["decision", "confidence", "summary", "evidence", "risks", "next_review_days"],
};

/**
 * Startup validation: verify that GEMINI_MODEL is available via the Google Generative AI API.
 * Makes a lightweight call to list available models and checks if the configured model exists.
 * Logs a warning (but doesn't crash) if the model is not found, listing 2-3 alternatives.
 * 
 * Call this function once when the server boots: await verifyGeminiModel()
 */
export async function verifyGeminiModel(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[Smart Advisor] ⚠️  GEMINI_API_KEY not found in environment. Model validation skipped. " +
      "If Gemini calls fail at runtime, check that GEMINI_API_KEY is set and valid."
    );
    return;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      console.warn(
        `[Smart Advisor] ⚠️  Failed to validate Gemini model (HTTP ${res.status}). ` +
        `Continuing with GEMINI_MODEL="${GEMINI_MODEL}". If Gemini calls fail, ` +
        `check that GEMINI_API_KEY is valid.`
      );
      return;
    }

    const data = (await res.json()) as ModelsListResponse;
    const availableModels = data.models ?? [];
    
    // Models in the response have names like "models/gemini-2.0-flash", so we check
    // against the full "models/" prefix name and also without it.
    const configuredModelFullName = `models/${GEMINI_MODEL}`;
    const modelExists = availableModels.some(
      (model) => model.name === configuredModelFullName || model.name === GEMINI_MODEL
    );

    if (!modelExists) {
      // Extract 2-3 valid alternatives: prefer ones with "gemini" in the name, newest first
      const geminiModels = availableModels
        .filter((m) => m.name.includes("gemini") || m.displayName?.includes("gemini"))
        .slice(0, 3);
      
      const alternatives = geminiModels
        .map((m) => {
          const modelId = m.name.replace(/^models\//, "");
          return m.displayName ? `${modelId} (${m.displayName})` : modelId;
        })
        .join(", ");

      console.warn(
        `[Smart Advisor] ⚠️  GEMINI_MODEL="${GEMINI_MODEL}" not found in available models. ` +
        `This model may be retired, unavailable in your region, or the name may be incorrect. ` +
        `Available alternatives: ${alternatives || "[no Gemini models found]"}. ` +
        `To fix, set GEMINI_MODEL to one of the valid model IDs above.`
      );
    } else {
      console.log(`[Smart Advisor] ✓ Gemini model "${GEMINI_MODEL}" verified and available.`);
    }
  } catch (error) {
    console.warn(
      `[Smart Advisor] ⚠️  Could not validate Gemini model (${error instanceof Error ? error.message : String(error)}). ` +
      `Continuing with GEMINI_MODEL="${GEMINI_MODEL}". ` +
      `If Gemini calls fail at runtime, check your GEMINI_API_KEY and internet connection.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE PARSING & VALIDATION
// parseStructuredResponse() — JSON schema validation for single recommendations
// parsePortfolioResponse() — JSON schema validation for portfolio summaries
// ═══════════════════════════════════════════════════════════════════════════

function parseStructuredResponse(text: string): StructuredAdvisorResult {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  const candidate = objectStart >= 0 && objectEnd > objectStart
    ? cleaned.slice(objectStart, objectEnd + 1)
    : cleaned;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new Error("[generateRecommendation] Gemini returned invalid JSON", { cause: error });
  }

  if (!isStructuredAdvisorResult(parsed)) {
    throw new Error("[generateRecommendation] Gemini JSON failed schema validation");
  }
  return parsed;
}

function isStructuredAdvisorResult(value: unknown): value is StructuredAdvisorResult {
  // NOTE: The confidence field has a prompt-enforced ceiling based on data quality
  // (see rule 13 in SYSTEM_INSTRUCTIONS: 0-2 comparables => ≤40, 3-5 comparables => ≤65,
  // 6+ comparables => no ceiling). Similarly, consider_entry is only for unheld holdings
  // as instructed in prompt rules. This validation only checks schema shape and ranges.
  // Gemini may still violate prompt-level constraints — consider adding post-parse clamps
  // if violations become a problem, but for now we rely on prompt enforcement.
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const isTextArray = (entry: unknown, maxLength: number) =>
    Array.isArray(entry) && entry.length <= maxLength
      && entry.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 400);
  return (
    (result.decision === "consider_entry" ||
      result.decision === "consider_rotation" ||
      result.decision === "watch_and_wait" ||
      result.decision === "hold")
    && typeof result.confidence === "number" && Number.isInteger(result.confidence)
    && result.confidence >= 0 && result.confidence <= 100
    && typeof result.summary === "string" && result.summary.trim().length > 0 && result.summary.length <= 1200
    && typeof result.thesis_risk === "string" && result.thesis_risk.trim().length > 0 && result.thesis_risk.length <= 600
    && isTextArray(result.evidence, 6)
    && isTextArray(result.risks, 6)
    && typeof result.next_review_days === "number" && Number.isInteger(result.next_review_days)
    && result.next_review_days >= 1 && result.next_review_days <= 365
    && typeof result.watch_trigger === "string" && result.watch_trigger.length <= 600
    && isTextArray(result.do_not_act_reasons, 6)
  );
}

export async function generateRecommendation(
  verdict: HoldingVerdict,
  alerts?: AdvisorAlertContext,
): Promise<AdvisorRecommendation> {
  const apiKey = process.env.GEMINI_API_KEY; // ⚠️ confirm this matches your existing env var name

  if (!apiKey) {
    throw new Error(
      "[generateRecommendation] GEMINI_API_KEY not found in environment. If your existing Gemini integration uses a different variable name, update this file to match it."
    );
  }

  // FIX (per Gemini audit): previously concatenated instructions + data
  // into one plain string via buildPrompt(). Now uses Gemini's dedicated
  // systemInstruction field to separate constraints from data — models
  // generally follow rules more reliably when they aren't mixed into the
  // same content stream as the user-facing data.
  const dataBlock = `${buildDataBlock(verdict, alerts)}

Return ONLY valid JSON matching this exact shape. Do not use Markdown fences:
{"decision":"consider_entry|consider_rotation|watch_and_wait|hold","confidence":0,"summary":"...","thesis_risk":"...","evidence":["..."],"risks":["..."],"next_review_days":30,"watch_trigger":"...","do_not_act_reasons":["..."]}`;

  const qwenApiKey = process.env.QWEN_API_KEY;
  let res: Response | undefined;
  let selectedModel = GEMINI_MODEL;
  let lastErrorBody = "";
  if (qwenApiKey) {
    try {
      const qwenResponse = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qwenApiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          model: QWEN_MODEL,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTIONS },
            { role: "user", content: dataBlock },
          ],
          temperature: GEMINI_TEMPERATURE,
          max_tokens: GEMINI_MAX_OUTPUT_TOKENS,
          response_format: { type: "json_object" },
        }),
      });
      if (qwenResponse.ok) {
        res = qwenResponse;
        selectedModel = QWEN_MODEL;
      } else {
        lastErrorBody = await qwenResponse.text();
        console.warn(`[Smart Advisor] Qwen returned ${qwenResponse.status}; trying Gemini fallback.`);
      }
    } catch (error) {
      console.warn(`[Smart Advisor] Qwen attempt failed; trying Gemini fallback: ${error}`);
    }
  }

  if (!res) {
    const models = [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS])];
    for (const model of models) {
      selectedModel = model;
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
            contents: [{ parts: [{ text: dataBlock }] }],
            generationConfig: {
              temperature: GEMINI_TEMPERATURE,
              maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
              responseMimeType: "application/json",
              responseSchema: GEMINI_RESPONSE_SCHEMA,
            },
          }),
        },
      );
      if (res.ok) break;
      lastErrorBody = await res.text();
      if (res.status !== 429 && res.status !== 503) break;
      console.warn(`[Smart Advisor] ${model} returned ${res.status}; trying the next configured model.`);
    }
  }

  if (!res || !res.ok) {
    throw new Error(
      `[generateRecommendation] Gemini API error ${res?.status ?? "unknown"}: ${lastErrorBody}`
    );
  }

  const data = (await res.json()) as GeminiResponse & {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    ?? data?.choices?.[0]?.message?.content;

  if (!text) {
    // FIX (bug #1 from audit): previously threw a generic "had no text"
    // error regardless of why. Gemini's API provides specific diagnostic
    // fields for the common real failure modes — most plausibly here,
    // a safety filter blocking financial-advice-adjacent content. Check
    // those fields first so the thrown error tells you WHY, not just
    // THAT it failed — this matters for debugging in Replit, since "check
    // your prompt" and "check your API key" and "safety filter blocked
    // this" are three different fixes.
    const blockReason: string | undefined = data?.promptFeedback?.blockReason;
    const finishReason: string | undefined = data?.candidates?.[0]?.finishReason;

    if (blockReason) {
      throw new Error(
        `[generateRecommendation] Gemini blocked the prompt itself before generating a response. Reason: ${blockReason}. This usually means the prompt content (holding names, numbers) tripped a safety filter — check promptFeedback in the full response if this persists. Full response: ${JSON.stringify(data)}`
      );
    }

    if (finishReason && finishReason !== "STOP") {
      throw new Error(
        `[generateRecommendation] Gemini did not finish normally. Reason: ${finishReason} (e.g. SAFETY = content filter blocked the response, MAX_TOKENS = ran out of room before finishing, RECITATION = flagged as too close to training data). Full response: ${JSON.stringify(data)}`
      );
    }

    throw new Error(
      `[generateRecommendation] Gemini response had no text and no recognizable block/finish reason — unexpected response shape. Full response: ${JSON.stringify(data)}`
    );
  }

  const structured = parseStructuredResponse(text);
  const recommendationText = structured.summary;

  return {
    holding_ticker: verdict.holding_ticker,
    recommendation_text: recommendationText,
    generated_at: new Date().toISOString(),
    model_used: selectedModel,
    structured,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINTS — Exported recommendation generators
// generateRecommendation() — Single holding recommendation via Gemini
// generatePortfolioSummary() — Portfolio-wide summary via Gemini
// ═══════════════════════════════════════════════════════════════════════════

function isStructuredPortfolioResult(value: unknown): value is PortfolioSummaryResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const isTextArray = (entry: unknown, maxLength: number) =>
    Array.isArray(entry) && entry.length <= maxLength
      && entry.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 400);
  return (
    (result.decision === "hold" || result.decision === "watch" || result.decision === "rebalance")
    && typeof result.confidence === "number" && Number.isInteger(result.confidence)
    && result.confidence >= 0 && result.confidence <= 100
    && typeof result.summary === "string" && result.summary.trim().length > 0 && result.summary.length <= 1200
    && isTextArray(result.evidence, 6)
    && isTextArray(result.risks, 6)
    && typeof result.next_review_days === "number" && Number.isInteger(result.next_review_days)
    && result.next_review_days >= 1 && result.next_review_days <= 365
  );
}

export async function generatePortfolioSummary(
  verdicts: HoldingVerdict[],
  opportunities?: { strong_unheld: HoldingVerdict[]; underrepresented_sectors: Array<{ sector: string; portfolio_allocation_percent: number; strong_candidates: HoldingVerdict[] }> },
  evaluationScope?: { totalExpected: number; evaluated: number }
): Promise<PortfolioSummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("[generatePortfolioSummary] GEMINI_API_KEY not found in environment");
  }

  const portfolioPrompt = buildPortfolioSummaryPrompt(verdicts, opportunities, evaluationScope);
  const qwenApiKey = process.env.QWEN_API_KEY;
  let res: Response | undefined;
  let selectedModel = GEMINI_MODEL;
  let lastErrorBody = "";

  if (qwenApiKey) {
    try {
      const qwenResponse = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qwenApiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          model: QWEN_MODEL,
          messages: [
            { role: "system", content: PORTFOLIO_SUMMARY_SYSTEM_INSTRUCTIONS },
            { role: "user", content: portfolioPrompt },
          ],
          temperature: GEMINI_TEMPERATURE,
          max_tokens: GEMINI_MAX_OUTPUT_TOKENS,
          response_format: { type: "json_object" },
        }),
      });
      if (qwenResponse.ok) {
        res = qwenResponse;
        selectedModel = QWEN_MODEL;
      } else {
        lastErrorBody = await qwenResponse.text();
        console.warn(`[Smart Advisor] Qwen portfolio summary returned ${qwenResponse.status}; trying Gemini fallback.`);
      }
    } catch (error) {
      console.warn(`[Smart Advisor] Qwen portfolio summary failed; trying Gemini fallback: ${error}`);
    }
  }

  if (!res) {
    for (const model of [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS])]) {
      selectedModel = model;
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: PORTFOLIO_SUMMARY_SYSTEM_INSTRUCTIONS }] },
            contents: [{ parts: [{ text: portfolioPrompt }] }],
            generationConfig: {
              temperature: GEMINI_TEMPERATURE,
              maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
              responseMimeType: "application/json",
              responseSchema: PORTFOLIO_SUMMARY_RESPONSE_SCHEMA,
            },
          }),
        },
      );
      if (res.ok) break;
      lastErrorBody = await res.text();
      if (res.status !== 429 && res.status !== 503) break;
      console.warn(`[Smart Advisor] ${model} portfolio summary returned ${res.status}; trying the next configured model.`);
    }
  }

  if (!res || !res.ok) {
    throw new Error(`[generatePortfolioSummary] AI API error ${res?.status ?? "unknown"}: ${lastErrorBody}`);
  }

  const data = (await res.json()) as GeminiResponse & {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    ?? data?.choices?.[0]?.message?.content;

  if (!text) {
    const blockReason: string | undefined = data?.promptFeedback?.blockReason;
    const finishReason: string | undefined = data?.candidates?.[0]?.finishReason;

    if (blockReason) {
      throw new Error(
        `[generatePortfolioSummary] Gemini blocked the prompt. Reason: ${blockReason}. Full response: ${JSON.stringify(data)}`
      );
    }

    if (finishReason && finishReason !== "STOP") {
      throw new Error(
        `[generatePortfolioSummary] Gemini did not finish normally. Reason: ${finishReason}. Full response: ${JSON.stringify(data)}`
      );
    }

    throw new Error(
      `[generatePortfolioSummary] Gemini response had no text and no recognizable block/finish reason. Full response: ${JSON.stringify(data)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch (error) {
    throw new Error("[generatePortfolioSummary] Gemini returned invalid JSON", { cause: error });
  }

  if (!isStructuredPortfolioResult(parsed)) {
    throw new Error(
      `[generatePortfolioSummary] Gemini JSON failed schema validation. Got: ${JSON.stringify(parsed)}`
    );
  }

  return {
    decision: parsed.decision,
    confidence: parsed.confidence,
    summary: parsed.summary,
    evidence: parsed.evidence,
    risks: parsed.risks,
    next_review_days: parsed.next_review_days,
    model_used: selectedModel,
  };
}
