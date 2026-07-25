import { type NextRequest, NextResponse } from "next/server";
import { resolveHostedReaderUrl } from "@/lib/companion-hosted-link";
import { ingestCompanionChunk } from "@/lib/companion-ingest";

/**
 * Progressive companion ingest: index a visible-page chunk for any book.
 * CORS is open for the browser extension.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const MAX_TEXT_LENGTH = 4000;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const text =
    typeof record.text === "string" ? record.text.trim().slice(0, MAX_TEXT_LENGTH) : "";
  const asin = typeof record.asin === "string" ? record.asin.trim() : undefined;
  const positionHint =
    typeof record.positionHint === "string" ? record.positionHint.trim() : undefined;

  if (!title) {
    return NextResponse.json(
      { error: "Missing title" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const hostedPath = resolveHostedReaderUrl(title, text);
  const panel = await ingestCompanionChunk({
    title,
    text,
    asin,
    positionHint,
    hostedReaderUrl: hostedPath,
  });

  return NextResponse.json(panel, { headers: CORS_HEADERS });
}
