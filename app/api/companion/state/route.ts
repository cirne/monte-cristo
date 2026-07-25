import { type NextRequest, NextResponse } from "next/server";
import { resolveHostedReaderUrl } from "@/lib/companion-hosted-link";
import { getCompanionState } from "@/lib/companion-ingest";

/**
 * Read companion panel state without re-indexing.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim() ?? "";
  const asin = request.nextUrl.searchParams.get("asin")?.trim() || undefined;

  if (!title) {
    return NextResponse.json(
      { error: "Missing title" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const hostedPath = resolveHostedReaderUrl(title);
  const panel = getCompanionState({
    title,
    asin,
    hostedReaderUrl: hostedPath,
  });

  return NextResponse.json(panel, { headers: CORS_HEADERS });
}
