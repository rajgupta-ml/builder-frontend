import { NextResponse } from "next/server";
import { z } from "zod";
import { getTelemetryEnv } from "@/lib/env";

const eventSchema = z.object({
  ts: z.string().optional(),
  env: z.string().optional(),
  kind: z.string(),
  message: z.string().optional(),
  route: z.string().optional(),
  traceId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const env = getTelemetryEnv();
  if (!env) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event shape" }, { status: 400 });
  }

  try {
    const headers = new Headers({
      Authorization: `Bearer ${env.AXIOM_TOKEN}`,
      "Content-Type": "application/json",
    });
    if (env.AXIOM_ORG_ID) {
      headers.set("X-Axiom-Org-Id", env.AXIOM_ORG_ID);
    }
    const ingestBaseUrl = (env.AXIOM_INGEST_BASE_URL || "https://us-east-1.aws.edge.axiom.co/v1/ingest").replace(/\/+$/, "");
    await fetch(`${ingestBaseUrl}/${encodeURIComponent(env.AXIOM_DATASET)}`, {
      method: "POST",
      headers,
      body: JSON.stringify([{ ...parsed.data, ts: parsed.data.ts || new Date().toISOString() }]),
      cache: "no-store",
    });
  } catch {
    // Swallow telemetry failures; no user-facing impact.
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
