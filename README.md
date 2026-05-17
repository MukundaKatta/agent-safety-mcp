# agent-safety-mcp

An MCP server that gives any LLM agent a built-in safety layer. Every tool maps to a battle-tested, npm-published primitive from the [@mukundakatta agent-stack](https://www.npmjs.com/~mukundakatta), so the agent gets validation, egress control, JSON repair, context-window fitting, and snapshot tracing without writing any of that itself.

## Why

When you give an LLM real tools, four things go wrong:

1. The model emits bad arguments → your tool crashes (or worse, runs with garbage).
2. The model fetches whatever URL it wants → data leaks, prompt injection, runaway cost.
3. The model returns JSON wrapped in prose → your parser blows up.
4. The conversation outgrows the context window → silent truncation, lost system prompt.

Each of those is solved separately by an open-source library. This MCP server wires those libraries into one server any agent (Claude, Gemini, GPT, anything with MCP support) can plug into in 30 seconds.

## Tools

| Tool | What it does | Backed by |
|---|---|---|
| `validate_args` | Validate LLM-emitted tool arguments against a shape spec. Returns a structured error + retry hint. | [@mukundakatta/agentvet](https://www.npmjs.com/package/@mukundakatta/agentvet) |
| `check_egress` | Decide whether a URL is in the agent's allowlist before fetching. | [@mukundakatta/agentguard](https://www.npmjs.com/package/@mukundakatta/agentguard) |
| `extract_json` | Pull JSON out of messy LLM output (handles fences, prose, balanced extraction). | [@mukundakatta/agentcast](https://www.npmjs.com/package/@mukundakatta/agentcast) |
| `fit_messages` | Truncate chat history to a token budget. Preserves system messages. | [@mukundakatta/agentfit](https://www.npmjs.com/package/@mukundakatta/agentfit) |
| `count_tokens` | Fast token estimate for a string or message array. | [@mukundakatta/agentfit](https://www.npmjs.com/package/@mukundakatta/agentfit) |
| `diff_snapshot` | Compare two agent traces. Reports `PASSED`, `OUTPUT_DRIFT`, `TOOLS_REORDERED`, `TOOLS_CHANGED`, or `REGRESSION`. | [@mukundakatta/agentsnap](https://www.npmjs.com/package/@mukundakatta/agentsnap) |

## Run it

### Local (stdio)

```bash
npm install
npm run build
node dist/server.js
```

Register in a Claude Desktop / Cursor / Cline config:

```json
{
  "mcpServers": {
    "agent-safety": {
      "command": "node",
      "args": ["/absolute/path/to/agent-safety-mcp/dist/server.js"]
    }
  }
}
```

### HTTP (Cloud Run, Fly, anywhere)

```bash
npm run build
npm run http        # listens on $PORT (default 8080) at /mcp
```

### Deploy to Cloud Run

```bash
gcloud run deploy agent-safety-mcp \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

The deployed server exposes:

- `POST /mcp` — Streamable HTTP MCP endpoint
- `GET /healthz` — liveness probe

## Demo

`examples/gemini-demo.ts` runs a Gemini 2.0 Flash agent on Vertex AI that calls the MCP tools to validate args and check an egress URL.

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
npm run demo:gemini
```

## License

MIT
