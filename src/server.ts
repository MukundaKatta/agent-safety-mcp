#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  validateArgs,
  validateArgsSchema,
  checkEgress,
  checkEgressSchema,
  extractJsonTool,
  extractJsonSchema,
  fitMessagesTool,
  fitMessagesSchema,
  countTokensTool,
  countTokensSchema,
  diffSnapshotTool,
  diffSnapshotSchema,
} from "./tools.js";
import { emitSplunkEvent, splunkEnabled } from "./splunk.js";

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "agent-safety-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "validate_args",
    {
      title: "Validate tool arguments",
      description:
        "Validate LLM-generated tool arguments against a shape spec BEFORE running the tool. Returns a structured error with a retry hint when args are wrong. Backed by @mukundakatta/agentvet.",
      inputSchema: validateArgsSchema.shape,
    },
    async (input) => {
      const out = validateArgs(input);
      void emitSplunkEvent({
        tool: "validate_args",
        outcome: out.valid ? "valid" : "invalid",
        detail: { tool_name: input.tool_name },
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  server.registerTool(
    "check_egress",
    {
      title: "Check network egress against an allowlist",
      description:
        "Decide whether the agent is allowed to fetch a given URL under an allow/deny policy. Use this before any HTTP request. Backed by @mukundakatta/agentguard.",
      inputSchema: checkEgressSchema.shape,
    },
    async (input) => {
      const out = checkEgress(input);
      void emitSplunkEvent({
        tool: "check_egress",
        outcome: out.allowed ? "allow" : "deny",
        detail: { url: input.url, reason: out.allowed ? null : out.reason },
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  server.registerTool(
    "extract_json",
    {
      title: "Extract JSON from messy LLM output",
      description:
        "Pull a JSON object out of free-form text. Handles markdown fences, surrounding prose, and finds the largest balanced JSON substring. Returns null if nothing parses. Backed by @mukundakatta/agentcast.",
      inputSchema: extractJsonSchema.shape,
    },
    async (input) => {
      const out = extractJsonTool(input);
      void emitSplunkEvent({
        tool: "extract_json",
        outcome: out.extracted ? "ok" : "invalid",
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  server.registerTool(
    "fit_messages",
    {
      title: "Fit chat messages into a token budget",
      description:
        "Truncate a chat history to fit a token budget using configurable strategies (drop-oldest, drop-middle, priority). Preserves system messages by default. Backed by @mukundakatta/agentfit.",
      inputSchema: fitMessagesSchema.shape,
    },
    async (input) => {
      const out = fitMessagesTool(input);
      void emitSplunkEvent({
        tool: "fit_messages",
        outcome: out.fit ? "ok" : "invalid",
        detail: { dropped: out.dropped_count, tokens: out.tokens },
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  server.registerTool(
    "count_tokens",
    {
      title: "Estimate token count",
      description:
        "Fast, dependency-free token estimate for a string or chat-message array. Within ~10-20% of real tokenizers on English prose. Backed by @mukundakatta/agentfit.",
      inputSchema: countTokensSchema.shape,
    },
    async (input) => {
      const out = countTokensTool(input);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  server.registerTool(
    "diff_snapshot",
    {
      title: "Diff an agent run trace against a baseline",
      description:
        "Compare two agent traces (input/output/tool-calls) and report the diff status (PASSED, OUTPUT_DRIFT, TOOLS_REORDERED, TOOLS_CHANGED, REGRESSION) plus a list of changes. Use this for regression-testing agent behavior across runs. Backed by @mukundakatta/agentsnap.",
      inputSchema: diffSnapshotSchema.shape,
    },
    async (input) => {
      const out = diffSnapshotTool(input);
      void emitSplunkEvent({
        tool: "diff_snapshot",
        outcome: out.changed ? "drift" : "passed",
        detail: { status: out.status, change_count: out.change_count },
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    },
  );

  return server;
}

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `agent-safety-mcp running on stdio (splunk-hec=${splunkEnabled() ? "on" : "off"})`,
  );
}

main().catch((err) => {
  console.error("agent-safety-mcp fatal:", err);
  process.exit(1);
});
