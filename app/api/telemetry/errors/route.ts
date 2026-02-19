import { NextResponse } from "next/server";
import { z } from "zod";
import { getTelemetryEnv } from "@/lib/env";

const eventSchema = z.object({
  ts: z.string().optional(),
  env: z.string().optional(),
  kind: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  route: z.string().optional(),
  status: z.number().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const env = getTelemetryEnv();
  if (!env) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event shape" }, { status: 400 });
  }

  const axiomPayload = [{ ...parsed.data, ts: parsed.data.ts || new Date().toISOString() }];

  try {
    await fetch(`https://api.axiom.co/v1/datasets/${env.AXIOM_DATASET}/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AXIOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(axiomPayload),
      cache: "no-store",
    });
  } catch {
    // Swallow telemetry failures; no user-facing impact.
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}

