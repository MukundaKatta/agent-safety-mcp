# Google Cloud Rapid Agent Hackathon — submission

**Project name**: agent-safety-mcp

**Tagline**: Drop-in MCP safety layer for Gemini agents — arg validation, egress allowlists, JSON repair, context fitting, and snapshot diffs in one server.

## What it does

agent-safety-mcp is an MCP server that any Gemini agent (or any MCP-aware agent) can register to get a built-in safety layer. The server exposes six tools that wrap five open-source npm libraries I authored and maintain:

1. `validate_args` — catches bad tool arguments before they reach your tool, with a structured retry hint the LLM understands.
2. `check_egress` — decides whether a URL is allowed under a declarative allow/deny policy. Stops data exfiltration and runaway fetches.
3. `extract_json` — pulls valid JSON out of messy LLM output (markdown fences, surrounding prose, balanced extraction).
4. `fit_messages` — truncates chat history to a token budget while preserving the system prompt.
5. `count_tokens` — fast token estimate, no tokenizer dependency.
6. `diff_snapshot` — compares two agent traces (input + output + tool calls) and reports drift status. Use this for regression testing across model upgrades.

## How it uses Google Cloud + MCP

- Deployed to **Google Cloud Run** as a Streamable HTTP MCP server.
- Demo agent uses **Vertex AI** (`gemini-2.0-flash-001`) with the `@google/genai` SDK's `mcpToTool` helper. The agent calls the deployed MCP server with automatic function calling — Gemini handles the tool-call loop, the MCP server enforces the safety checks.
- Anyone can plug into the deployed server by pointing their MCP client at `https://agent-safety-mcp-<hash>-uc.a.run.app/mcp`.

## What partner solution it integrates via MCP

The agent integrates with the MCP servers of partners (TBD per partner availability — Gemini supports any MCP-compatible partner tool). The demo combines `agent-safety-mcp` with a public partner MCP to show a realistic agentic flow where safety checks gate every partner-tool call.

## Why it's useful

Today, every team building on Gemini reinvents the same four safety primitives. The MCP standard makes that reinvention finally avoidable: register one server, get all of it. The underlying primitives are already shipped at scale on npm.

## Stack

- **Runtime**: Node 22, TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.29
- **Cloud**: Cloud Run + Vertex AI (Gemini 2.0 Flash)
- **Open-source primitives**: `@mukundakatta/agentvet`, `agentguard`, `agentcast`, `agentfit`, `agentsnap` (all MIT-licensed, all public on npm)

## Links

- Repo: https://github.com/MukundaKatta/agent-safety-mcp
- Deployed MCP: https://agent-safety-mcp-<TBD>-uc.a.run.app/mcp
- 3-min demo video: <TBD>

## Judging criteria fit

- **Tech implementation**: clean MCP server, Cloud Run + Vertex AI deployment, function-calling demo agent.
- **Design**: every tool returns LLM-friendly retry hints, not raw stack traces.
- **Potential impact**: any team using Gemini + tools can register this server in one config line.
- **Quality of idea**: turns five independent safety libraries into one composable safety layer accessible to any MCP client.
