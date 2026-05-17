# Splunk setup for agent-safety-mcp

This guide wires the hosted MCP server at
`https://agent-safety-mcp-444075785245.us-central1.run.app/mcp`
to a Splunk Cloud trial via HTTP Event Collector (HEC).

Once wired, every safety tool call (`check_egress`, `validate_args`, etc.)
emits a structured event with `sourcetype=agent_safety`, so you can search,
alert, and dashboard agent behavior end-to-end.

The event shape is defined in `src/splunk.ts`:

```json
{
  "tool": "check_egress",
  "outcome": "deny",
  "detail": { "url": "https://evil.example.com/exfil", "reason": "not-on-allowlist" },
  "latency_ms": 4
}
```

## 1. Splunk Cloud Free Trial (click-by-click)

1. Open `https://www.splunk.com/en_us/download/splunk-cloud.html`.
2. Click **Free Trial** > **Splunk Cloud Platform**.
3. Sign in with a Splunk.com account (create one if needed).
4. Fill the trial form, accept the EULA, click **Submit**.
5. Wait for the provisioning email (a few minutes), then click the **Access your trial** link.
6. Set your admin password on first login. You now have a stack URL like
   `https://prd-p-xxxxx.splunkcloud.com` — this is your Splunk web UI.

## 2. Create an HEC token

1. In the Splunk web UI, click **Settings** (top right) > **Data Inputs**.
2. Click **HTTP Event Collector**.
3. Top-right: **Global Settings** > set **All Tokens = Enabled** > **Save**.
4. Click **New Token**.
5. Name: `agent-safety-mcp`. Click **Next**.
6. **Source type**: select **Select** > **New** > type `agent_safety`.
   (This must match the `sourcetype` the server emits.)
7. **Allowed indexes**: pick `main` (or create a dedicated index, e.g. `agent_safety`).
   Set **Default Index** to the same.
8. Click **Review** > **Submit**. Splunk shows the token UUID — copy it now,
   you won't see it again.
9. Your HEC URL is your stack hostname with the HEC port. For Splunk Cloud
   trial it's:
   `https://http-inputs-<your-stack>.splunkcloud.com`
   (find the exact value under **Settings > Data Inputs > HTTP Event Collector**;
   the column **HEC URI** shows it).

## 3. Env vars the server reads

| Var | Required | Purpose |
| --- | --- | --- |
| `SPLUNK_HEC_URL` | yes | Base URL, e.g. `https://http-inputs-prd-p-xxxxx.splunkcloud.com` |
| `SPLUNK_HEC_TOKEN` | yes | The UUID token from step 2.8 |
| `SPLUNK_HEC_INDEX` | optional | Index name if not the token default |
| `SPLUNK_HEC_SOURCE` | optional | Defaults to `agent-safety-mcp` |
| `SPLUNK_HEC_SOURCETYPE` | optional | Defaults to `agent_safety` |

If `SPLUNK_HEC_URL` or `SPLUNK_HEC_TOKEN` is unset the sink is a no-op —
tools still work, nothing ships to Splunk.

## 4. Update the Cloud Run service

Replace the placeholders with your real values, then run:

```sh
gcloud run services update agent-safety-mcp \
  --region us-central1 \
  --update-env-vars \
SPLUNK_HEC_URL=https://http-inputs-prd-p-xxxxx.splunkcloud.com,SPLUNK_HEC_TOKEN=00000000-0000-0000-0000-000000000000
```

Optional index override:

```sh
gcloud run services update agent-safety-mcp \
  --region us-central1 \
  --update-env-vars SPLUNK_HEC_INDEX=agent_safety
```

Cloud Run will roll a new revision. Confirm with:

```sh
gcloud run services describe agent-safety-mcp --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)'
```

## 5. Verify end-to-end

This curl invokes the deployed `check_egress` tool against a URL that is
not on the default allowlist, which should emit an `outcome=deny` event.

```sh
curl -sS -X POST \
  https://agent-safety-mcp-444075785245.us-central1.run.app/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "check_egress",
      "arguments": {
        "url": "https://evil.example.com/exfil",
        "allowed_domains": ["api.anthropic.com"]
      }
    }
  }'
```

Then in Splunk Web, search:

```spl
index=* sourcetype=agent_safety tool=check_egress outcome=deny
| head 20
```

You should see an event with `detail.url=https://evil.example.com/exfil`
within 5–10 seconds. If nothing shows up:

- check the Cloud Run logs for `[splunk-hec]` errors
  (`gcloud run services logs read agent-safety-mcp --region us-central1`),
- confirm the token is enabled and the source type is allowed,
- confirm the HEC URL has no trailing path (the server appends
  `/services/collector/event` itself).

## 6. Ready-to-paste Splunk searches

### 6a. Decisions over time, grouped by tool

```spl
index=* sourcetype=agent_safety
| timechart span=1m count by tool
```

### 6b. Deny events in the last hour with URL detail

```spl
index=* sourcetype=agent_safety outcome=deny earliest=-1h
| eval url=coalesce('detail.url', 'detail.host', "(no url)")
| table _time tool url detail.reason latency_ms
| sort -_time
```

## 7. Dashboard

A minimal dashboard definition lives at `docs/splunk-dashboard.json`.
In Splunk Web: **Dashboards** > **Create New Dashboard** > **Classic Dashboards**
> **Source** tab, paste the file contents, **Save**.
