const AGNO_BASE_URL = process.env.NEXT_PUBLIC_AGNO_BASE_URL || process.env.AGNO_BASE_URL;
const AGNO_DEFAULT_PORT = Number(
  process.env.NEXT_PUBLIC_AGNO_DEFAULT_PORT || process.env.AGNO_DEFAULT_PORT || ""
);
const AGNO_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_AGNO_TIMEOUT_MS || process.env.AGNO_TIMEOUT_MS || "120000"
);

const isServer = typeof window === "undefined";
const AGNO_API_BASE = AGNO_BASE_URL ? AGNO_BASE_URL.replace(/\/+$/, "") : "";
const AGNO_PROXY_BASE = "/api/agno";

if (!AGNO_BASE_URL) {
  console.warn("Agno base URL is not set (AGNO_BASE_URL). Using proxy only.");
}

const normalizePort = (value?: number | null) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const buildAgnoBaseUrl = (port?: number | null) => {
  const base = isServer ? AGNO_API_BASE : AGNO_PROXY_BASE;
  const normalized = normalizePort(port) ?? normalizePort(AGNO_DEFAULT_PORT);
  if (!isServer || !normalized) return base;
  try {
    const url = new URL(base);
    url.port = String(normalized);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return base;
  }
};

export type AgnoAgentCatalogItem = {
  id: string;
  name?: string;
  model?: {
    name?: string;
    model?: string;
    provider?: string;
  };
  port?: number | null;
};

export type KnowledgeReader = {
  id: string;
  name?: string | null;
  description?: string | null;
  chunkers?: string[] | null;
};

export type KnowledgeChunker = {
  key: string;
  name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type KnowledgeVectorDb = {
  id: string;
  name?: string | null;
  description?: string | null;
  search_types?: string[] | null;
};

export type KnowledgeConfigResponse = {
  readers?: Record<string, KnowledgeReader> | null;
  readersForType?: Record<string, string[]> | null;
  chunkers?: Record<string, KnowledgeChunker> | null;
  filters?: string[] | null;
  vector_dbs?: KnowledgeVectorDb[] | null;
};

export type KnowledgeContentItem = {
  id: string;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  size?: string | null;
  linked_to?: string | null;
  metadata?: Record<string, unknown> | null;
  access_count?: number | null;
  status?: "processing" | "completed" | "failed" | null;
  status_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KnowledgePagination = {
  page: number;
  limit: number;
  total_pages: number;
  total_count: number;
  search_time_ms?: number;
};

export type KnowledgeContentListResponse = {
  data: KnowledgeContentItem[];
  meta: KnowledgePagination;
};

export type KnowledgeSearchResult = {
  id: string;
  content: string;
  name?: string | null;
  meta_data?: Record<string, unknown> | null;
  usage?: Record<string, unknown> | null;
  reranking_score?: number | null;
  content_id?: string | null;
  content_origin?: string | null;
  size?: number | null;
};

export type KnowledgeSearchResponse = {
  data: KnowledgeSearchResult[];
  meta: KnowledgePagination;
};

type AgnoRequestOptions = {
  port?: number | null;
  token?: string | null;
  query?: Record<string, string | number | null | undefined>;
  init?: RequestInit;
};

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

const normalizeBearerToken = (token?: string | null) => {
  if (!token) return "";
  const trimmed = token.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
};

const buildAgnoHeaders = (options: { port?: number | null; token?: string | null; headers?: HeadersInit }) => {
  const headers = new Headers(options.headers);
  const normalizedPort = normalizePort(options.port);
  if (normalizedPort) {
    headers.set("x-agno-port", String(normalizedPort));
  }
  const bearer = normalizeBearerToken(options.token);
  if (bearer) {
    headers.set("Authorization", bearer);
  }
  return headers;
};

const agnoFetch = async (path: string, options: AgnoRequestOptions = {}) => {
  const base = buildAgnoBaseUrl(options.port);
  if (!base) {
    throw new Error("Agno base URL is missing.");
  }
  const qs = options.query ? buildQuery(options.query) : "";
  const response = await fetch(`${base}${path}${qs}`, {
    cache: "no-store",
    ...options.init,
    headers: buildAgnoHeaders({ port: options.port, token: options.token, headers: options.init?.headers })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Agno request failed: ${response.status}`);
  }
  return response;
};

export async function fetchAgnoAgentCatalog(port?: number | null): Promise<AgnoAgentCatalogItem[]> {
  const base = buildAgnoBaseUrl(port);
  if (!base) {
    throw new Error("Agno base URL is missing.");
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = Number.isFinite(AGNO_TIMEOUT_MS) && AGNO_TIMEOUT_MS > 0 ? AGNO_TIMEOUT_MS : 120000;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

  try {
    const res = await fetch(`${base}/agents`, {
      method: "GET",
      cache: "no-store",
      signal: controller?.signal,
      headers: normalizePort(port) ? { "x-agno-port": String(port) } : undefined
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`fetchAgnoAgentCatalog error ${res.status}: ${body}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    const normalizedPort = normalizePort(port) ?? normalizePort(AGNO_DEFAULT_PORT);
    return list.map((item) => ({ ...item, port: normalizedPort }));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const getAgnoDefaultPort = () => normalizePort(AGNO_DEFAULT_PORT);

export async function fetchKnowledgeConfig(options: {
  port?: number | null;
  token?: string | null;
  dbId?: string | null;
}): Promise<KnowledgeConfigResponse> {
  const response = await agnoFetch("/knowledge/config", {
    port: options.port,
    token: options.token,
    query: { db_id: options.dbId || undefined }
  });
  return (await response.json()) as KnowledgeConfigResponse;
}

export async function fetchKnowledgeContent(options: {
  port?: number | null;
  token?: string | null;
  dbId?: string | null;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<KnowledgeContentListResponse> {
  const response = await agnoFetch("/knowledge/content", {
    port: options.port,
    token: options.token,
    query: {
      db_id: options.dbId || undefined,
      limit: options.limit,
      page: options.page,
      sort_by: options.sortBy,
      sort_order: options.sortOrder
    }
  });
  return (await response.json()) as KnowledgeContentListResponse;
}

export async function uploadKnowledgeContent(
  payload: FormData,
  options: { port?: number | null; token?: string | null; dbId?: string | null }
): Promise<KnowledgeContentItem> {
  const response = await agnoFetch("/knowledge/content", {
    port: options.port,
    token: options.token,
    query: { db_id: options.dbId || undefined },
    init: { method: "POST", body: payload }
  });
  return (await response.json()) as KnowledgeContentItem;
}

export async function deleteKnowledgeContent(
  contentId: string,
  options: { port?: number | null; token?: string | null; dbId?: string | null }
): Promise<KnowledgeContentItem | null> {
  const response = await agnoFetch(`/knowledge/content/${contentId}`, {
    port: options.port,
    token: options.token,
    query: { db_id: options.dbId || undefined },
    init: { method: "DELETE" }
  });
  if (response.status === 204) return null;
  return (await response.json()) as KnowledgeContentItem;
}

export async function deleteAllKnowledgeContent(options: {
  port?: number | null;
  token?: string | null;
  dbId?: string | null;
}): Promise<unknown> {
  const response = await agnoFetch("/knowledge/content", {
    port: options.port,
    token: options.token,
    query: { db_id: options.dbId || undefined },
    init: { method: "DELETE" }
  });
  if (response.status === 204) return null;
  return response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : await response.text();
}

export async function fetchKnowledgeContentById(options: {
  contentId: string;
  port?: number | null;
  token?: string | null;
  dbId?: string | null;
}): Promise<KnowledgeContentItem> {
  const response = await agnoFetch(`/knowledge/content/${options.contentId}`, {
    port: options.port,
    token: options.token,
    query: { db_id: options.dbId || undefined }
  });
  return (await response.json()) as KnowledgeContentItem;
}

export async function fetchKnowledgeContentStatus(options: {
  contentId: string;
  port?: number | null;
  token?: string | null;
  dbId?: string | null;
}): Promise<{ status: KnowledgeContentItem["status"]; status_message?: string }> {
  const response = await agnoFetch(`/knowledge/content/${options.contentId}/status`, {
    port: options.port,
    token: options.token,
    query: { db_id: options.dbId || undefined }
  });
  return (await response.json()) as { status: KnowledgeContentItem["status"]; status_message?: string };
}

export async function updateKnowledgeContent(options: {
  contentId: string;
  port?: number | null;
  token?: string | null;
  dbId?: string | null;
  name?: string | null;
  description?: string | null;
  metadata?: string | null;
  readerId?: string | null;
}): Promise<KnowledgeContentItem> {
  const body = new URLSearchParams();
  if (options.name !== undefined && options.name !== null) body.set("name", options.name);
  if (options.description !== undefined && options.description !== null) body.set("description", options.description);
  if (options.metadata !== undefined && options.metadata !== null) body.set("metadata", options.metadata);
  if (options.readerId !== undefined && options.readerId !== null) body.set("reader_id", options.readerId);

  const response = await agnoFetch(`/knowledge/content/${options.contentId}`, {
    port: options.port,
    token: options.token,
    query: { db_id: options.dbId || undefined },
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    }
  });
  return (await response.json()) as KnowledgeContentItem;
}

export async function searchKnowledge(options: {
  query: string;
  port?: number | null;
  token?: string | null;
  dbId?: string | null;
  vectorDbIds?: string[] | null;
  searchType?: "vector" | "keyword" | "hybrid" | null;
  maxResults?: number | null;
  filters?: Record<string, unknown> | null;
  page?: number | null;
  limit?: number | null;
}): Promise<KnowledgeSearchResponse> {
  const response = await agnoFetch("/knowledge/search", {
    port: options.port,
    token: options.token,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: options.query,
        db_id: options.dbId || undefined,
        vector_db_ids: options.vectorDbIds && options.vectorDbIds.length ? options.vectorDbIds : undefined,
        search_type: options.searchType || undefined,
        max_results: options.maxResults ?? undefined,
        filters: options.filters || undefined,
        meta: options.limit || options.page ? { limit: options.limit ?? undefined, page: options.page ?? undefined } : undefined
      })
    }
  });
  return (await response.json()) as KnowledgeSearchResponse;
}
