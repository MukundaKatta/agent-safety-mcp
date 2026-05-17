# Web Data Agents Hackathon (Bright Data × lablab.ai) — submission

**Project name**: agent-safety-mcp (Web Data variant)

**Tagline**: Audited web research agent — every Bright Data fetch goes through an egress allowlist, every scraped JSON gets repaired, every run gets a snapshot.

## What it does

This variant adds a `bright_data_fetch` tool to agent-safety-mcp. The whole thing is an MCP server that turns any LLM agent into an "audited researcher":

1. Agent decides to research a URL.
2. `check_egress` validates the URL against an allowlist (no exfiltration to random hosts).
3. `bright_data_fetch` calls the Bright Data Web Unlocker / SERP API for real-time data.
4. `extract_json` pulls structured data out of the scraped page's LLM summary.
5. `diff_snapshot` compares this run against the last one — catches drift in what the web is returning.

The result is a research agent where every web touch is policy-checked, every parse is robust, and every run is diffable against history.

## Why Bright Data + safety primitives compose well

Web data is the most untrusted input an agent ever sees: prompt-injected pages, hijacked SEO, malicious JSON. Bright Data delivers the data; agent-safety-mcp keeps the agent from leaking creds back to the same hosts, and validates everything the LLM emits before it acts.

## Stack

- **Bright Data**: Web Unlocker API + SERP API for real-time fetches
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.29
- **Open-source primitives**: `@mukundakatta/agentvet`, `agentguard`, `agentcast`, `agentfit`, `agentsnap`
- **LLM**: pluggable — demo runs with Claude Sonnet 4.6 via Anthropic API

## Links

- Repo: https://github.com/MukundaKatta/agent-safety-mcp
- Demo video: <TBD>
- npm packages used: 5 of mine + `@modelcontextprotocol/sdk`

## What's novel

Most web-agent demos show "fetch a page → ask LLM about it." This one shows the second-order problem: the LLM IS the attack surface. agent-safety-mcp puts a guardrail around the whole loop, so a malicious page can't trick the agent into fetching a credential-stealing URL on its second turn.
