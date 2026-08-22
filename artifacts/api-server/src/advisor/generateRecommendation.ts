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

import { buildPrompt, SYSTEM_INSTRUCTIONS, buildDataBlock, type AdvisorAlertContext } from "./buildPrompt";
import type { HoldingVerdict } from "../judge/types";
import type { AdvisorRecommendation } from "./types";

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
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
  const dataBlock = buildDataBlock(verdict, alerts);

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
      contents: [{ parts: [{ text: dataBlock }] }],
      generationConfig: {
        temperature: 0.4, // lower temperature — this is a factual/structured task, not creative writing
        maxOutputTokens: 650, // room for rotation-split EGP breakdowns when rule 6 applies
      },
    }),
  });

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

  return {
    holding_ticker: verdict.holding_ticker,
    recommendation_text: text.trim(),
    generated_at: new Date().toISOString(),
    model_used: GEMINI_MODEL,
  };
}
