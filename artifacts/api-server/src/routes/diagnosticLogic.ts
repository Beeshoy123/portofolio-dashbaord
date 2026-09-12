export type DiagnosticEntityRow = {
  id: number;
  ticker: string;
  name: string;
  entity_type: string;
  is_held: boolean;
  yahoo_ticker: string | null;
  snapshot_id: number | null;
  snapshot_raw_fetch_ok: boolean | null;
  snapshot_value: string | number | null;
  technical_id: number | null;
  technical_raw_fetch_ok: boolean | null;
  technical_trend: string | null;
  verdict_id: number | null;
  raw_verdict: Record<string, unknown> | null;
  advisor_id: number | null;
  advisor_status: string | null;
  advisor_text: string | null;
};

type DiagnosticState = "complete" | "partial" | "missing" | "dash";
type DiagnosticSeverity = "complete" | "expected_unavailable" | "needs_review";

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function diagnoseEntity(row: DiagnosticEntityRow, stageMessages: string[]) {
  const missingFields: string[] = [];
  const dashFields: string[] = [];
  const rawVerdict = row.raw_verdict ?? {};
  const entityMessages = stageMessages.filter((message) => message.startsWith(`${row.ticker}:`));

  if (row.snapshot_id === null) missingFields.push("snapshot");
  else {
    if (row.snapshot_raw_fetch_ok !== true) missingFields.push("snapshot.raw_fetch_ok");
    if (!hasValue(row.snapshot_value)) dashFields.push("snapshot.nav_or_price");
  }

  const technicalApplicable = row.yahoo_ticker !== null;
  if (technicalApplicable) {
    if (row.technical_id === null) missingFields.push("technical_signal");
    else {
      if (row.technical_raw_fetch_ok !== true) missingFields.push("technical_signal.raw_fetch_ok");
      if (!row.technical_trend || row.technical_trend === "unknown") missingFields.push("technical_signal.trend");
    }
  }

  const verdictApplicable = row.is_held;
  if (verdictApplicable) {
    if (row.verdict_id === null) missingFields.push("verdict");
    else {
      for (const field of ["signal", "performance_grade", "technical_grade", "financial_health_grade"]) {
        if (!hasValue(rawVerdict[field])) missingFields.push(`verdict.${field}`);
      }
      if (!hasValue(rawVerdict.holding_return_percent)) dashFields.push("verdict.holding_return_percent");
      if (!hasValue(rawVerdict.coverage_percent)) dashFields.push("verdict.coverage_percent");
      if (!hasValue(rawVerdict.holding_current_value_egp)) dashFields.push("verdict.holding_current_value_egp");
    }
  }

  const advisorApplicable = row.is_held;
  if (advisorApplicable) {
    if (row.advisor_id === null) missingFields.push("advisor");
    else {
      if (row.advisor_status !== "succeeded") missingFields.push("advisor.generation_status");
      if (!hasValue(row.advisor_text)) missingFields.push("advisor.recommendation_text");
    }
  }

  const hasAnyOutput = row.snapshot_id !== null || row.technical_id !== null || row.verdict_id !== null || row.advisor_id !== null;
  const state: DiagnosticState = missingFields.length === 0 && dashFields.length === 0
    ? "complete"
    : !hasAnyOutput
      ? "missing"
      : dashFields.length > 0
        ? "dash"
        : "partial";

  const reason = entityMessages.length > 0
    ? entityMessages.join(" ")
    : state === "complete"
      ? "All tracked stages produced usable output."
      : state === "missing"
        ? "No downstream output was recorded for this entity."
        : state === "dash"
          ? "A downstream row exists, but one or more business values are unavailable and render as a dash."
          : "Some downstream stages or required fields are missing or unusable.";
    const severity: DiagnosticSeverity = missingFields.length > 0
      ? "needs_review"
      : dashFields.length > 0 || entityMessages.length > 0
        ? "expected_unavailable"
        : "complete";

  return {
    ticker: row.ticker,
    name: row.name,
    entity_type: row.entity_type,
    is_held: row.is_held,
    yahoo_ticker: row.yahoo_ticker,
    state,
    severity,
    reason,
    diagnostic_messages: entityMessages,
    missing_fields: missingFields,
    dash_fields: dashFields,
    stages: {
      snapshot: { applicable: true, present: row.snapshot_id !== null, usable: row.snapshot_id !== null && row.snapshot_raw_fetch_ok === true && hasValue(row.snapshot_value) },
      technical: { applicable: technicalApplicable, present: row.technical_id !== null, usable: !technicalApplicable || (row.technical_id !== null && row.technical_raw_fetch_ok === true && Boolean(row.technical_trend && row.technical_trend !== "unknown")) },
      verdict: { applicable: verdictApplicable, present: row.verdict_id !== null, usable: !verdictApplicable || (row.verdict_id !== null && ["signal", "performance_grade", "technical_grade", "financial_health_grade"].every((field) => hasValue(rawVerdict[field]))) },
      advisor: { applicable: advisorApplicable, present: row.advisor_id !== null, usable: !advisorApplicable || (row.advisor_id !== null && row.advisor_status === "succeeded" && hasValue(row.advisor_text)) },
    },
  };
}