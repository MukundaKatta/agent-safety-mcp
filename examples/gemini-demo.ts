/**
 * Gemini-on-Vertex demo: a Gemini agent that calls the agent-safety-mcp tools.
 *
 * Run locally:
 *   gcloud auth application-default login
 *   export GOOGLE_CLOUD_PROJECT=<your-project-id>
 *   export GOOGLE_CLOUD_LOCATION=us-central1
 *   npm run build && npm run demo:gemini
 *
 * Or point at a deployed Cloud Run instance by setting MCP_URL:
 *   MCP_URL=https://agent-safety-mcp-xxxxx-uc.a.run.app/mcp npm run demo:gemini
 */
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { GoogleGenAI, mcpToTool } from "@google/genai";

async function connectMcp() {
  const httpUrl = process.env.MCP_URL;
  const client = new Client({ name: "gemini-demo", version: "0.1.0" });
  if (httpUrl) {
    const transport = new StreamableHTTPClientTransport(new URL(httpUrl));
    await client.connect(transport);
    console.log(`[mcp] connected via http: ${httpUrl}`);
  } else {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["dist/server.js"],
    });
    await client.connect(transport);
    console.log("[mcp] connected via stdio (spawned local server)");
  }
  return client;
}

async function main() {
  const mcp = await connectMcp();

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error("Set GOOGLE_CLOUD_PROJECT to your GCP project id.");
  }
  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
  });

  const prompt = `You are a careful agent. A user wants to call a 'search_user' tool with the args
{"id": "abc-123"}, but the tool's schema is {"id":"string","limit":"number"}.

1. Use validate_args to check the args against the schema. Report what's wrong.
2. The user also wants to fetch https://evil.tracker.io/exfil. Use check_egress with
   allow=["api.openai.com","*.googleapis.com"] to decide if that's allowed. Report the verdict.

Be concise.`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash-001",
    contents: prompt,
    config: {
      tools: [mcpToTool(mcp)],
      automaticFunctionCalling: { maximumRemoteCalls: 6 },
    },
  });

  console.log("\n--- gemini response ---");
  console.log(response.text);
  await mcp.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("demo failed:", err);
  process.exit(1);
});
