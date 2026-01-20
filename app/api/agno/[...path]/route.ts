import { NextRequest, NextResponse } from "next/server";

const AGNO_BASE_URL = process.env.AGNO_BASE_URL || process.env.NEXT_PUBLIC_AGNO_BASE_URL;
const AGNO_DEFAULT_PORT = Number(process.env.AGNO_DEFAULT_PORT || process.env.NEXT_PUBLIC_AGNO_DEFAULT_PORT || "");
const UPSTREAM_BASE = AGNO_BASE_URL ? AGNO_BASE_URL.replace(/\/+$/, "") : "";

async function handler(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!AGNO_BASE_URL) {
    return NextResponse.json({ error: "Agno base URL is missing." }, { status: 500 });
  }

  try {
    const { path: segments = [] } = await context.params;
    const portHeader = req.headers.get("x-agno-port") || req.headers.get("agno-port");
    const port = Number(portHeader || "");
    const targetBase = new URL(UPSTREAM_BASE);
    if (Number.isInteger(port) && port > 0) {
      targetBase.port = String(port);
    } else if (Number.isInteger(AGNO_DEFAULT_PORT) && AGNO_DEFAULT_PORT > 0) {
      targetBase.port = String(AGNO_DEFAULT_PORT);
    }
    const targetUrl = `${targetBase.toString().replace(/\/+$/, "")}/${segments.join("/")}${req.nextUrl.search}`;

    const headers = new Headers(req.headers);
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
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Agno proxy error";
    console.error("Agno proxy failed:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS };
