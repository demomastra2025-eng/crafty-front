import { getApiKey } from "@/lib/evo-api";

type FetchOptions = {
  instanceId?: string | null;
  page?: number;
  pageSize?: number;
  search?: string;
};

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

const authHeaders = (): HeadersInit | undefined => {
  if (typeof window === "undefined") return undefined;
  const key = getApiKey();
  return key ? { apikey: key } : undefined;
};

const handleUnauthorized = (res: Response) => {
  if (res.status !== 401 || typeof window === "undefined") return;
  try {
    document.cookie = "crafty_auth=; Path=/; Max-Age=0; SameSite=Lax";
  } catch {
    // ignore cookie errors
  }
  window.location.href = "/auth";
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store", headers: authHeaders() });
  handleUnauthorized(res);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(authHeaders() || {}) },
    body: JSON.stringify(body)
  });
  handleUnauthorized(res);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchChats(opts: FetchOptions) {
  const qs = buildQuery({
    instanceId: opts.instanceId || undefined,
    page: opts.page ?? 0,
    pageSize: opts.pageSize ?? 25,
    search: opts.search || undefined
  });
  return getJson<{ chats: unknown[] }>(`/api/db/chats${qs}`);
}

export async function fetchContacts(instanceId?: string | null) {
  const qs = buildQuery({ instanceId: instanceId || undefined });
  return getJson<{ contacts: unknown[] }>(`/api/db/contacts${qs}`);
}

export async function fetchInstances() {
  return getJson<{ instances: unknown[] }>(`/api/db/instances`);
}

export async function fetchLabels(instanceId?: string | null) {
  const qs = buildQuery({ instanceId: instanceId || undefined });
  return getJson<{ labels: unknown[] }>(`/api/db/labels${qs}`);
}

export async function fetchMessages(params: {
  instanceId?: string | null;
  remoteJid?: string | null;
  remoteJids?: string[];
  limit?: number;
  order?: "asc" | "desc";
  recent?: boolean;
  before?: number;
}) {
  const qs = buildQuery({
    instanceId: params.instanceId || undefined,
    remoteJid: params.remoteJid || undefined,
    remoteJids: params.remoteJids?.length ? params.remoteJids.join(",") : undefined,
    limit: params.limit ?? undefined,
    order: params.order || undefined,
    recent: params.recent ? "true" : undefined,
    before: params.before ?? undefined
  });
  return getJson<{ messages: unknown[] }>(`/api/db/messages${qs}`);
}

export async function fetchMedia(params: { messageId?: string; messageIds?: string[] }) {
  const qs = buildQuery({
    messageId: params.messageId,
    messageIds: params.messageIds?.length ? params.messageIds.join(",") : undefined
  });
  return getJson<{ media: unknown[] }>(`/api/db/media${qs}`);
}

export async function fetchIntegrationSession(id: string) {
  const qs = buildQuery({ id });
  return getJson<{ session: unknown | null }>(`/api/db/integration-session${qs}`);
}

export async function updateChatAi(id: string, enabled: boolean) {
  return patchJson<{ ok: true }>(`/api/db/chat-ai`, { id, enabled });
}

export async function updateMessagesStatus(ids: string[], status: string) {
  return patchJson<{ ok: true }>(`/api/db/messages-status`, { ids, status });
}

export async function updateChatUnread(params: {
  instanceId: string;
  remoteJid: string;
  unreadMessages: number;
}) {
  return patchJson<{ ok: true }>(`/api/db/chat-unread`, params);
}
