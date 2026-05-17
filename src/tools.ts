import { z } from "zod";
import { validate as vetValidate, adapters as vetAdapters } from "@mukundakatta/agentvet";
import { policy as makePolicy, check as guardCheck } from "@mukundakatta/agentguard";
import { extractJson } from "@mukundakatta/agentcast";
import { count as fitCount, fit as fitMessages } from "@mukundakatta/agentfit";
import { diff as snapDiff } from "@mukundakatta/agentsnap";

const shapeFieldType = z.enum([
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "string?",
  "number?",
  "boolean?",
  "array?",
  "object?",
]);

export const validateArgsSchema = z.object({
  tool_name: z.string().describe("Name of the tool being called. Surfaces in error messages."),
  args: z.unknown().describe("The actual args object the LLM produced for this tool call."),
  schema: z.record(shapeFieldType).describe(
    'Shape spec, e.g. {"city":"string","limit":"number?"}. Suffix "?" means optional.',
  ),
});

export type ValidateArgsInput = z.infer<typeof validateArgsSchema>;

export function validateArgs(input: ValidateArgsInput) {
  const validator = vetAdapters.shape(input.schema as Record<string, string>);
  const result = vetValidate(input.tool_name, validator, input.args);
  if (result.valid) {
    return { valid: true as const, value: result.value };
  }
  return {
    valid: false as const,
    tool: input.tool_name,
    error: result.error.validationError,
    retry_hint: `The tool '${input.tool_name}' rejected your args: ${result.error.validationError}. Re-emit the tool call with corrected arguments.`,
  };
}

export const checkEgressSchema = z.object({
  url: z.string().describe("URL the agent is about to fetch."),
  method: z.string().optional().describe("HTTP method (GET/POST/etc.). Default any."),
  allow: z.array(z.string()).optional().describe('Allowlist of host patterns, e.g. ["api.openai.com","*.googleapis.com"]'),
  deny: z.array(z.string()).optional().describe("Denylist of host patterns. Wins over allow."),
});

export type CheckEgressInput = z.infer<typeof checkEgressSchema>;

export function checkEgress(input: CheckEgressInput) {
  const p = makePolicy({
    network: {
      allow: input.allow,
      deny: input.deny,
    },
    violations: "throw",
  });
  const decision = guardCheck(p, input.url, { method: input.method });
  if (decision.action === "allow") {
    return { allowed: true as const, url: input.url };
  }
  return {
    allowed: false as const,
    url: input.url,
    reason: decision.reason,
    detail: decision.detail,
    retry_hint: `Egress to ${input.url} blocked (${decision.reason}). Pick a URL that matches the allowlist, or stop and report the policy violation.`,
  };
}

export const extractJsonSchema = z.object({
  text: z.string().describe("Raw LLM output that may contain JSON wrapped in prose, markdown fences, etc."),
});

export type ExtractJsonInput = z.infer<typeof extractJsonSchema>;

export function extractJsonTool(input: ExtractJsonInput) {
  const parsed = extractJson(input.text);
  if (parsed === null) {
    return { extracted: false as const, value: null };
  }
  return { extracted: true as const, value: parsed };
}

const messageSchema = z.object({
  role: z.string().optional(),
  content: z.string().optional(),
  priority: z.number().optional(),
}).passthrough();

export const fitMessagesSchema = z.object({
  messages: z.array(messageSchema).describe("Chat history to fit into the budget."),
  max_tokens: z.number().int().positive().describe("Token budget for the resulting messages."),
  model: z.string().optional().describe("Model name, used to pick the tokenizer family (gpt-4, claude-sonnet, gemini, llama)."),
  strategy: z.enum(["drop-oldest", "drop-middle", "priority"]).optional(),
  preserve_first_n: z.number().int().nonnegative().optional(),
  preserve_last_n: z.number().int().nonnegative().optional(),
});

export type FitMessagesInput = z.infer<typeof fitMessagesSchema>;

export function fitMessagesTool(input: FitMessagesInput) {
  const result = fitMessages(input.messages as any[], {
    maxTokens: input.max_tokens,
    model: input.model,
    strategy: input.strategy,
    preserveFirstN: input.preserve_first_n,
    preserveLastN: input.preserve_last_n,
    onOverBudget: "return-partial",
  });
  return {
    fit: result.tokens.after <= result.tokens.budget,
    messages: result.messages,
    dropped_count: result.dropped.length,
    tokens: result.tokens,
  };
}

export const countTokensSchema = z.object({
  input: z.union([z.string(), z.array(messageSchema)]),
  model: z.string().optional(),
});

export type CountTokensInput = z.infer<typeof countTokensSchema>;

export function countTokensTool(input: CountTokensInput) {
  const tokens = fitCount(input.input as any, { model: input.model });
  return { tokens, model: input.model ?? "default" };
}

const traceSchema = z.object({
  version: z.number(),
  model: z.string().nullable(),
  input: z.string().nullable(),
  output: z.string().nullable(),
  tools: z.array(z.record(z.unknown())),
  error: z.record(z.unknown()).nullable(),
  fingerprint: z.record(z.string()).optional(),
}).passthrough();

export const diffSnapshotSchema = z.object({
  baseline: traceSchema.describe("The reference trace, usually from a previous run."),
  current: traceSchema.describe("The trace just produced. Must follow the agentsnap Trace shape."),
});

export type DiffSnapshotInput = z.infer<typeof diffSnapshotSchema>;

export function diffSnapshotTool(input: DiffSnapshotInput) {
  const result = snapDiff(input.baseline as any, input.current as any);
  return {
    status: result.status,
    changed: result.status !== "PASSED",
    change_count: result.changes.length,
    changes: result.changes,
  };
}
