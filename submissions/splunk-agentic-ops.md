# Splunk Agentic Ops Hackathon — submission (Platform track)

**Project name**: agent-safety-mcp (Splunk variant)

**Tagline**: A Splunk-aware MCP safety server — every LLM agent action (validate, allow/deny, drift) flows into Splunk as a searchable event in real time.

**Track**: Platform

## What it does

agent-safety-mcp is an MCP (Model Context Protocol) server that any LLM agent can register to get a uniform safety layer: argument validation, network egress allowlists, JSON repair, context-window fitting, and snapshot regression checks. Six tools, all wrapping MIT-licensed open-source primitives.

The Splunk variant adds a **Splunk HEC (HTTP Event Collector) sink**: every tool invocation is streamed to a configured Splunk Enterprise / Cloud instance as a structured event. SOC, SRE, and platform teams can search, alert on, and dashboard agent behavior without touching the agent code.

## Why this fits the Platform track

The Platform track asks for "next-generation developer experiences for Splunk apps." This project:

- Lets any agent vendor turn Splunk into its observability + policy enforcement backplane in one line of config (`SPLUNK_HEC_URL` + `SPLUNK_HEC_TOKEN` env vars).
- Maps naturally to existing Splunk searches: `index=main sourcetype=agent_safety outcome=deny | stats count by tool` shows which agents are hitting policy violations.
- Composes with the Splunk MCP Server — agents calling the Splunk MCP Server for data can wrap those calls in agent-safety-mcp for pre-flight validation, with both flowing into the same Splunk index for unified investigation.

## Demo flow

1. Deploy `agent-safety-mcp` to Cloud Run (or any container host) with Splunk HEC env vars set.
2. Register the MCP endpoint in any MCP-aware agent (Claude Desktop, Cursor, Gemini-on-Vertex, custom).
3. Have the agent attempt:
   - A tool call with malformed args → `validate_args` returns a retry hint → emits `outcome=invalid` event to Splunk.
   - A fetch to a non-allowlisted host → `check_egress` blocks → emits `outcome=deny` event.
   - A snapshot diff against a baseline → `diff_snapshot` reports `OUTPUT_DRIFT` → emits `outcome=drift` event.
4. In Splunk, run `index=main sourcetype=agent_safety outcome=deny earliest=-1h | timechart count by tool` — every policy decision shows up as a time-series.

## Stack

- TypeScript + Node 22
- `@modelcontextprotocol/sdk` v1.29 (Stdio + Streamable HTTP transports)
- Splunk HEC over HTTPS (works with Splunk Enterprise, Splunk Cloud, free developer license)
- Five published npm primitives: `@mukundakatta/agentvet`, `agentguard`, `agentcast`, `agentfit`, `agentsnap`
- Cloud Run / Docker / Fly — runs anywhere

## Links

- Repo: https://github.com/MukundaKatta/agent-safety-mcp
- Live MCP endpoint: https://agent-safety-mcp-444075785245.us-central1.run.app/mcp
- Demo video: <TBD>

## What's novel

Most "agent + Splunk" demos route the agent's chat output to Splunk. This project routes the agent's **policy decisions and safety verdicts** — the things SRE teams actually need to alert on. The Splunk index becomes the source of truth for "what is the agent fleet doing, and what is it being stopped from doing."
