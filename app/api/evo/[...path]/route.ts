import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL;
const UPSTREAM_BASE = API_URL ? API_URL.replace(/\/$/, "") : "";

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  if (!API_URL) {
    return NextResponse.json({ error: "Evolution API URL is missing." }, { status: 500 });
  }

  try {
    const { path: segments = [] } = await context.params;
    const targetUrl = `${UPSTREAM_BASE}/${segments.join("/")}${req.nextUrl.search}`;

    const headers = new Headers(req.headers);
    const incomingKey = req.headers.get("apikey") || req.headers.get("x-evo-apikey");
    const cookieKey = req.cookies.get("crafty_apikey")?.value;
    const finalKey = incomingKey || cookieKey;
    if (finalKey) {
      headers.set("apikey", finalKey);
    }
    headers.delete("host");
    headers.delete("content-length");
    headers.delete("connection");

    const init: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
      redirect: "follow"
    };

    if (req.method && !["GET", "HEAD"].includes(req.method)) {
      init.body = await req.arrayBuffer();
    }

    const upstream = await fetch(targetUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    // undici already decodes gzip/deflate, so strip encoding-related headers to avoid double decode errors in the client
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");
    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Evolution proxy error";
    console.error("Evolution proxy failed:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS
};
