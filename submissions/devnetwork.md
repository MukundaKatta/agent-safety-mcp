# DevNetwork AI+ML Hackathon 2026 — submission

**Project name**: agent-safety-mcp

**Tagline**: The five things you wish your LLM agent did by default — arg validation, egress firewall, JSON repair, context fitting, snapshot regression — exposed as one MCP server.

## What it does

agent-safety-mcp is a Model Context Protocol server that lets any LLM agent (Claude, Gemini, GPT-4, local models, anything MCP-aware) gain a uniform safety + reliability layer in 30 seconds:

- **`validate_args`**: catches LLM-hallucinated tool arguments before they reach the tool, with a structured retry hint.
- **`check_egress`**: declarative URL allowlist enforced at MCP-call time. Stops data leaks.
- **`extract_json`**: pulls real JSON out of fenced or chatty model output.
- **`fit_messages`** / **`count_tokens`**: keeps the chat under the model's context budget.
- **`diff_snapshot`**: regression-tests an agent's tool-use trace across runs — critical when you upgrade models.

Each tool is backed by a separate, MIT-licensed npm library (the `@mukundakatta` agent-stack), each with its own test suite and version. The MCP server is just the integration surface.

## Progress

- Six MCP tools wired and verified end-to-end against the MCP TS SDK v1.29.
- Stdio + Streamable HTTP transports both working.
- Dockerized for Cloud Run / Fly / any container host.
- Gemini-on-Vertex example client included.

## Concept

The agent ecosystem is on its third year of every team rewriting the same five primitives in slightly different ways. MCP is the first credible standard for sharing tools across agents. This project takes the obvious next step: ship safety primitives as MCP, so they're cross-agent, cross-model, cross-language.

## Feasibility

The underlying primitives are already used in production projects and published on npm. The MCP server is a thin wrapping layer (~200 LOC of TypeScript). The path to a startup is licensing the hosted version + enterprise policies (per-tenant allowlists, audit logs, GDPR-region pinning).

## Links

- Repo: https://github.com/MukundaKatta/agent-safety-mcp
- 1-min demo video: <TBD>

## Open-source dependencies (all my own)

- [@mukundakatta/agentvet](https://www.npmjs.com/package/@mukundakatta/agentvet)
- [@mukundakatta/agentguard](https://www.npmjs.com/package/@mukundakatta/agentguard)
- [@mukundakatta/agentcast](https://www.npmjs.com/package/@mukundakatta/agentcast)
- [@mukundakatta/agentfit](https://www.npmjs.com/package/@mukundakatta/agentfit)
- [@mukundakatta/agentsnap](https://www.npmjs.com/package/@mukundakatta/agentsnap)
