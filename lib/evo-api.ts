const API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || process.env.EVOLUTION_API_URL;
const OWNER_NUMBER =
  process.env.NEXT_PUBLIC_EVOLUTION_OWNER_NUMBER || process.env.EVOLUTION_OWNER_NUMBER;
const FALLBACK_INSTANCE =
  process.env.NEXT_PUBLIC_EVOLUTION_INSTANCE || process.env.EVOLUTION_INSTANCE;

const PREFERRED_INSTANCE_KEY = "crafty:selected-evo-instance";
const PREFERRED_INSTANCE_OWNER_KEY = "crafty:selected-evo-instance-owner";

export type PreferredInstance = {
  id?: string | null;
  name?: string | null;
};

if (!API_URL) {
  console.warn("Evolution API URL is not set (EVOLUTION_API_URL).");
}

const isServer = typeof window === "undefined";
const API_BASE = API_URL ? API_URL.replace(/\/$/, "") : "";
const PROXY_BASE = "/api/evo";
const API_KEY_STORAGE = "crafty:evo-api-key";

const ensureServerEnv = () => {
  if (isServer && !API_URL) {
    throw new Error("Evolution API env vars are missing.");
  }
};

const readStoredApiKey = () => {
  if (isServer) return null;
  try {
    return localStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
};

const hashApiKey = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getPreferredOwnerHash = () => {
  if (isServer) return null;
  try {
    return localStorage.getItem(PREFERRED_INSTANCE_OWNER_KEY);
  } catch {
    return null;
  }
};

const setPreferredOwnerHash = (hash: string | null) => {
  if (isServer) return;
  try {
    if (hash) {
      localStorage.setItem(PREFERRED_INSTANCE_OWNER_KEY, hash);
    } else {
      localStorage.removeItem(PREFERRED_INSTANCE_OWNER_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const setApiKey = (key: string | null) => {
  if (isServer) return;
  const prev = readStoredApiKey();
  if (prev && key && prev !== key) {
    setPreferredInstance(null);
  }
  if (!key) {
    setPreferredInstance(null);
  }
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    // ignore storage errors
  }
  if (key) {
    setPreferredOwnerHash(hashApiKey(key));
  } else {
    setPreferredOwnerHash(null);
  }
  try {
    if (key) {
      document.cookie = `crafty_apikey=${encodeURIComponent(key)}; Path=/; SameSite=Lax`;
    } else {
      document.cookie = "crafty_apikey=; Path=/; Max-Age=0; SameSite=Lax";
    }
  } catch {
    // ignore cookie errors
  }
  try {
    window.dispatchEvent(new CustomEvent("crafty:apikey-changed", { detail: key }));
  } catch {
    // ignore dispatch errors
  }
};

export const getApiKey = () => readStoredApiKey();

const evoHeaders = (headers: HeadersInit = {}) => {
  const storedKey = readStoredApiKey();
  return storedKey ? { ...headers, apikey: storedKey } : headers;
};

const evoBaseUrl = () => (isServer ? API_BASE : PROXY_BASE);

export type EvoInstance = {
  instanceName: string;
  number?: string;
  connectionStatus?: string;
  name?: string;
  id?: string;
  ownerJid?: string;
  profilePicUrl?: string | null;
  token?: string;
  updatedAt?: string;
  instanceId?: string;
  integration?: string;
};

type EvoInstanceApi = Omit<EvoInstance, "instanceName"> & { instanceName?: string | null };

const buildQuery = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

const getPreferredInstance = (): PreferredInstance | null => {
  if (isServer) return null;
  const currentKey = readStoredApiKey();
  const currentHash = currentKey ? hashApiKey(currentKey) : null;
  const ownerHash = getPreferredOwnerHash();
  if (ownerHash && currentHash && ownerHash !== currentHash) {
    setPreferredInstance(null);
    return null;
  }
  try {
    const raw = localStorage.getItem(PREFERRED_INSTANCE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PreferredInstance;
      if (parsed && (parsed.id || parsed.name)) return parsed;
    } catch {
      // legacy string value with name only
      return { name: raw };
    }
    return null;
  } catch {
    return null;
  }
};


export const setPreferredInstance = (payload: PreferredInstance | null) => {
  if (isServer) return;
  try {
    if (payload?.id || payload?.name) {
      localStorage.setItem(
        PREFERRED_INSTANCE_KEY,
        JSON.stringify({ id: payload.id || null, name: payload.name || null })
      );
      const currentKey = readStoredApiKey();
      if (currentKey) {
        setPreferredOwnerHash(hashApiKey(currentKey));
      }
    } else {
      localStorage.removeItem(PREFERRED_INSTANCE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const readPreferredInstance = getPreferredInstance;

export async function fetchInstances(): Promise<EvoInstance[]> {
  ensureServerEnv();
  const res = await fetch(`${evoBaseUrl()}/instance/fetchInstances`, {
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchInstances error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const list: EvoInstanceApi[] = Array.isArray(data)
    ? (data as EvoInstanceApi[])
    : Array.isArray((data as { instances?: EvoInstanceApi[] })?.instances)
      ? ((data as { instances?: EvoInstanceApi[] }).instances as EvoInstanceApi[])
      : [];
  const normalized = list
    .map((item: EvoInstanceApi) => {
      const instanceName = item.instanceName || item.name || item.id;
      if (!instanceName) return null;
      return { ...item, instanceName } as EvoInstance;
    })
    .filter((item): item is EvoInstance => Boolean(item));

  return normalized;
}

export async function fetchAgnoBots(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/agno/find/${instance}`;
  const res = await fetch(url, { headers: evoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchAgnoBots error ${res.status}: ${body}`);
  }
  return res.json();
}

export type LlmModel = {
  id: string;
  name: string;
  provider: string;
  model: string;
  type: string;
  config?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function fetchLlmModels() {
  ensureServerEnv();
  const url = `${evoBaseUrl()}/llm-models`;
  const res = await fetch(url, { headers: evoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchLlmModels error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function createAgnoBot(instance: string, payload: Record<string, unknown>) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/agno/create/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json",
      "x-message-author": "manager"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createAgnoBot error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function updateAgnoBot(
  instance: string,
  botId: string,
  payload: Record<string, unknown>
) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/agno/update/${botId}/${instance}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`updateAgnoBot error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function deleteAgnoBot(instance: string, botId: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/agno/delete/${botId}/${instance}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deleteAgnoBot error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function fetchAgnoSettings(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/agno/fetchSettings/${instance}`;
  const res = await fetch(url, { headers: evoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchAgnoSettings error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function changeAgnoStatus(
  instance: string,
  payload:
    | { remoteJid: string; status: "opened" | "paused" | "closed" | "delete" }
    | { botId: string; allSessions: true; status: "opened" | "paused" | "closed" | "delete" }
) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/agno/changeStatus/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json",
      "x-message-author": "manager"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`changeAgnoStatus error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function fetchAgnoSessions(
  instance: string,
  botId: string,
  remoteJid?: string
) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const qs = buildQuery({ remoteJid });
  const url = `${evoBaseUrl()}/agno/fetchSessions/${botId}/${instance}${qs}`;
  const res = await fetch(url, { headers: evoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchAgnoSessions error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function emitAgnoLastMessage(instance: string, payload: { remoteJid: string }) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/agno/emitLastMessage/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json",
      "x-message-author": "manager"
    }),
    body: JSON.stringify({ ...payload, author: "manager" })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`emitAgnoLastMessage error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function fetchFunnels(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/funnel/list/${instance}`;
  const res = await fetch(url, { headers: evoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchFunnels error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function deleteFunnel(instance: string, funnelId: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/funnel/delete/${funnelId}/${instance}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deleteFunnel error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function createFunnel(instance: string, payload: Record<string, unknown>) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/funnel/create/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json",
      "x-message-author": "manager"
    }),
    body: JSON.stringify({ ...payload, author: "manager" })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createFunnel error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function updateFunnel(
  instance: string,
  funnelId: string,
  payload: Record<string, unknown>
) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/funnel/update/${funnelId}/${instance}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`updateFunnel error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function resolveInstance(): Promise<string | null> {
  const preferred = getPreferredInstance()?.name || null;
  try {
    const list = await fetchInstances();
    const preferredAvailable =
      preferred && list.some((i) => i.instanceName === preferred) ? preferred : null;
    const byNumber = OWNER_NUMBER
      ? list.find((i) => (i.number || "").includes(String(OWNER_NUMBER)))
      : undefined;
    const connected = list.find((i) => i.connectionStatus === "open");
    return (
      preferredAvailable ||
      byNumber?.instanceName ||
      connected?.instanceName ||
      list[0]?.instanceName ||
      FALLBACK_INSTANCE ||
      preferred ||
      null
    );
  } catch (e) {
    if (preferred) return preferred;
    if (FALLBACK_INSTANCE) return FALLBACK_INSTANCE;
    throw e;
  }
}

export type SendTextPayload = {
  number: string;
  text: string;
};

export async function sendTextMessage(instance: string, payload: SendTextPayload) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");

  const url = `${evoBaseUrl()}/message/sendText/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json",
      "x-message-author": "manager"
    }),
    body: JSON.stringify({ ...payload, author: "manager" })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SendText error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function sendMedia(instance: string, payload: Record<string, unknown>) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/message/sendMedia/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json",
      "x-message-author": "manager"
    }),
    body: JSON.stringify({ ...payload, author: "manager" })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sendMedia error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function sendMediaFile(
  instance: string,
  payload: { number: string; file: File; caption?: string; mediatype: string; mimetype?: string; fileName?: string }
) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/message/sendMedia/${instance}`;
  const form = new FormData();
  form.append("number", payload.number);
  form.append("mediatype", payload.mediatype);
  if (payload.caption) form.append("caption", payload.caption);
  if (payload.mimetype) form.append("mimetype", payload.mimetype);
  if (payload.fileName) form.append("fileName", payload.fileName);
  form.append("author", "manager");
  form.append("file", payload.file);

  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({ "x-message-author": "manager" }),
    body: form
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sendMediaFile error ${res.status}: ${body}`);
  }
  return res.json();
}
export type HandleLabelPayload = {
  number: string;
  labelId: string;
  action: "add" | "remove";
};

export async function handleLabel(instance: string, payload: HandleLabelPayload) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/label/handleLabel/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`handleLabel error ${res.status}: ${body}`);
  }
  return res.json();
}

export type MarkChatReadPayload = {
  remoteJid?: string;
  messageId?: string;
  readMessages?: boolean | Array<{ remoteJid: string; fromMe: boolean; id: string }>;
};

export async function markChatAsRead(instance: string, payload: MarkChatReadPayload) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/chat/markMessageAsRead/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`markChatAsRead error ${res.status}: ${body}`);
  }
  return res.json();
}

export type UpdateMessagePayload = {
  number: string;
  key: { remoteJid: string; fromMe: boolean; id: string };
  text: string;
};

export async function updateMessage(instance: string, payload: UpdateMessagePayload) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/chat/updateMessage/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`updateMessage error ${res.status}: ${body}`);
  }
  return res.json();
}

export type FetchMediaBase64Payload = {
  remoteJid?: string;
  messageId?: string;
  keyId?: string;
  participant?: string;
  fromMe?: boolean;
  message?: { key?: { id?: string } };
  convertToMp4?: boolean;
};

export async function fetchMediaBase64(instance: string, payload: FetchMediaBase64Payload) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/chat/getBase64FromMediaMessage/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchMediaBase64 error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function findContacts(instance: string, payload: Record<string, unknown> = {}) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/chat/findContacts/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`findContacts error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function connectInstance(
  instance: string,
  options?: { number?: string; instanceId?: string }
) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const query = buildQuery({
    number: options?.number || OWNER_NUMBER,
    instanceId: options?.instanceId || undefined
  });
  const res = await fetch(
    `${evoBaseUrl()}/instance/connect/${instance}${query}`,
    {
      headers: evoHeaders()
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`connectInstance error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function restartInstance(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/instance/restart/${instance}`, {
    method: "POST",
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`restartInstance error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function fetchConnectionState(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/instance/connectionState/${instance}`, {
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`connectionState error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function createInstance(payload: {
  instanceName: string;
  integration?: string;
  qrcode?: boolean;
  number?: string;
  rejectCall?: boolean;
  msgCall?: string;
  groupsIgnore?: boolean;
  alwaysOnline?: boolean;
  readMessages?: boolean;
  readStatus?: boolean;
  syncFullHistory?: boolean;
  mediaRecognition?: boolean;
  wavoipToken?: string;
}) {
  ensureServerEnv();
  const res = await fetch(`${evoBaseUrl()}/instance/create`, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      ...payload
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createInstance error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function logoutInstance(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/instance/logout/${instance}`, {
    method: "DELETE",
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`logoutInstance error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function updateBlockStatus(instance: string, remoteJid: string, block: boolean) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const url = `${evoBaseUrl()}/message/updateBlockStatus/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ remoteJid, block })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`updateBlockStatus error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function deleteInstance(instance: string, options?: { instanceId?: string }) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const query = buildQuery({ instanceId: options?.instanceId || undefined });
  const res = await fetch(
    `${evoBaseUrl()}/instance/delete/${instance}${query}`,
    {
      method: "DELETE",
      headers: evoHeaders()
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deleteInstance error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function setPresence(instance: string, presence: "available" | "unavailable" | "composing") {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/instance/setPresence/${instance}`, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ presence })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`setPresence error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function findSettings(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/settings/find/${instance}`, {
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`findSettings error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function setSettings(instance: string, payload: Record<string, unknown>) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/settings/set/${instance}`, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`setSettings error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function findProxy(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/proxy/find/${instance}`, {
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`findProxy error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function setProxy(instance: string, payload: Record<string, unknown>) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/proxy/set/${instance}`, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`setProxy error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function findWebhook(instance: string) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/webhook/find/${instance}`, {
    headers: evoHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`findWebhook error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function setWebhook(instance: string, payload: Record<string, unknown>) {
  ensureServerEnv();
  if (!instance) throw new Error("Evolution API env vars are missing.");
  const res = await fetch(`${evoBaseUrl()}/webhook/set/${instance}`, {
    method: "POST",
    headers: evoHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`setWebhook error ${res.status}: ${body}`);
  }
  return res.json();
}
