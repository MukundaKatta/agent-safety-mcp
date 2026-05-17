/**
 * Splunk HEC (HTTP Event Collector) sink for agent-safety-mcp.
 *
 * Every safety tool call (validate_args, check_egress, etc.) can be forwarded
 * to a Splunk instance as a structured event so SOC/SRE teams can search,
 * alert, and dashboard agent behavior.
 *
 * Enable by setting SPLUNK_HEC_URL + SPLUNK_HEC_TOKEN at server startup.
 * Disabled if either is unset — tools still work locally, the sink is a no-op.
 */

const HEC_URL = process.env.SPLUNK_HEC_URL;
const HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;
const HEC_INDEX = process.env.SPLUNK_HEC_INDEX;
const HEC_SOURCE = process.env.SPLUNK_HEC_SOURCE ?? "agent-safety-mcp";
const HEC_SOURCETYPE = process.env.SPLUNK_HEC_SOURCETYPE ?? "agent_safety";

export interface SplunkEvent {
  tool: string;
  outcome: "allow" | "deny" | "valid" | "invalid" | "ok" | "drift" | "passed";
  detail?: Record<string, unknown>;
  latency_ms?: number;
}

export function splunkEnabled(): boolean {
  return Boolean(HEC_URL && HEC_TOKEN);
}

export async function emitSplunkEvent(event: SplunkEvent): Promise<void> {
  if (!splunkEnabled()) return;
  const payload = {
    time: Date.now() / 1000,
    host: process.env.HOSTNAME ?? "agent-safety-mcp",
    source: HEC_SOURCE,
    sourcetype: HEC_SOURCETYPE,
    ...(HEC_INDEX ? { index: HEC_INDEX } : {}),
    event,
  };
  try {
    const res = await fetch(`${HEC_URL!.replace(/\/$/, "")}/services/collector/event`, {
      method: "POST",
      headers: {
        Authorization: `Splunk ${HEC_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[splunk-hec] non-2xx: ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[splunk-hec] post failed:", err instanceof Error ? err.message : err);
  }
}

export async function withSplunkTimer<T>(
  tool: string,
  fn: () => Promise<T>,
  outcomeOf: (result: T) => SplunkEvent["outcome"],
  detailOf?: (result: T) => Record<string, unknown>,
): Promise<T> {
  if (!splunkEnabled()) return fn();
  const start = Date.now();
  const result = await fn();
  void emitSplunkEvent({
    tool,
    outcome: outcomeOf(result),
    detail: detailOf?.(result),
    latency_ms: Date.now() - start,
  });
  return result;
}
