import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 8080);

const sessions = new Map<string, StreamableHTTPServerTransport>();

async function getOrCreateTransport(sessionId: string | undefined) {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, transport);
    },
  });
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };
  const server = buildServer();
  await server.connect(transport);
  return transport;
}

const httpServer = createServer(async (req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.url !== "/mcp") {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = await getOrCreateTransport(sessionId);
    let body: any = undefined;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw) body = JSON.parse(raw);
    }
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("mcp handler error", err);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`agent-safety-mcp http listening on :${PORT}`);
});
