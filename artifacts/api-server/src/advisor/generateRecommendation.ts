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

import { SYSTEM_INSTRUCTIONS, buildDataBlock, type AdvisorAlertContext } from "./buildPrompt";
import type { HoldingVerdict } from "../judge/types";
import type { AdvisorRecommendation } from "./types";

function envNumber(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
const GEMINI_TEMPERATURE = envNumber("GEMINI_TEMPERATURE", 0.4, 0, 2);
const GEMINI_MAX_OUTPUT_TOKENS = envNumber("GEMINI_MAX_OUTPUT_TOKENS", 650, 128, 4096);
const GEMINI_TIMEOUT_MS = envNumber("GEMINI_TIMEOUT_MS", 45_000, 5_000, 120_000);

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
    decision: { type: "STRING", enum: ["hold", "watch", "research"] },
    confidence: { type: "INTEGER", minimum: 0, maximum: 100 },
    summary: { type: "STRING" },
    evidence: { type: "ARRAY", items: { type: "STRING" } },
    risks: { type: "ARRAY", items: { type: "STRING" } },
    next_review_days: { type: "INTEGER", minimum: 1, maximum: 365 },
  },
  required: ["decision", "confidence", "summary", "evidence", "risks", "next_review_days"],
};

function parseStructuredResponse(text: string): StructuredAdvisorResult {
  const candidate = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
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
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const isTextArray = (entry: unknown, maxLength: number) =>
    Array.isArray(entry) && entry.length <= maxLength
      && entry.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 400);
  return (result.decision === "hold" || result.decision === "watch" || result.decision === "research")
    && typeof result.confidence === "number" && Number.isInteger(result.confidence)
    && result.confidence >= 0 && result.confidence <= 100
    && typeof result.summary === "string" && result.summary.trim().length > 0 && result.summary.length <= 1200
    && isTextArray(result.evidence, 6)
    && isTextArray(result.risks, 6)
    && typeof result.next_review_days === "number" && Number.isInteger(result.next_review_days)
    && result.next_review_days >= 1 && result.next_review_days <= 365;
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
{"decision":"hold|watch|research","confidence":0,"summary":"...","evidence":["..."],"risks":["..."],"next_review_days":30}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `[generateRecommendation] Gemini API error ${res.status}: ${errorBody}`
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

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
    model_used: GEMINI_MODEL,
    structured,
  };
}
