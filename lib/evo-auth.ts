const AUTH_TOKEN_STORAGE = "crafty:evo-auth-token";
const AUTH_COOKIE = "crafty_auth";

const readAuthToken = () => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_STORAGE, token);
    else localStorage.removeItem(AUTH_TOKEN_STORAGE);
  } catch {
    // ignore storage errors
  }
  try {
    if (token) {
      document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
    } else {
      document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  } catch {
    // ignore cookie errors
  }
};

export const getAuthToken = () => readAuthToken();

const authHeaders = (): HeadersInit | undefined => {
  const token = readAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

async function jsonRequest<T>(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      setAuthToken(null);
      window.location.href = "/auth";
    }
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function registerUser(payload: { email: string; password: string; name?: string }) {
  return jsonRequest<{ token: string; user: { id: string; email: string; name?: string | null } }>(
    "/api/evo/auth/register",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function loginUser(payload: { email: string; password: string }) {
  return jsonRequest<{ token: string; user: { id: string; email: string; name?: string | null } }>(
    "/api/evo/auth/login",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function fetchMe() {
  return jsonRequest<{ id: string; email: string; name?: string | null }>("/api/evo/auth/me", {
    headers: authHeaders()
  });
}

export async function listCompanies() {
  return jsonRequest<Array<{ id: string; name: string; role: string; agnoPorts?: number[] }>>(
    "/api/evo/companies",
    {
    headers: authHeaders()
    }
  );
}

export async function createCompany(payload: { name: string }) {
  return jsonRequest<{
    id: string;
    name: string;
    createdAt?: string | null;
    primaryKey?: string;
    agnoPorts?: number[];
  }>(
    "/api/evo/companies",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }
  );
}

export async function updateCompany(companyId: string, payload: { agnoPorts?: number[] }) {
  return jsonRequest<{ id: string; name: string; agnoPorts?: number[]; createdAt?: string | null }>(
    `/api/evo/companies/${companyId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }
  );
}

export async function rotatePrimaryKey(companyId: string) {
  return jsonRequest<{ apiKey: string }>(`/api/evo/companies/${companyId}/primary-key`, {
    method: "POST",
    headers: authHeaders()
  });
}

export async function getPrimaryKey(companyId: string) {
  return jsonRequest<{ apiKey: string }>(`/api/evo/companies/${companyId}/primary-key`, {
    headers: authHeaders()
  });
}

export type CredentialItem = {
  id: string;
  name: string | null;
  provider: string;
  url?: string | null;
  apiKey?: string | null;
  createdAt?: string | null;
};

export async function listCredentials(companyId: string) {
  return jsonRequest<CredentialItem[]>(`/api/evo/companies/${companyId}/credentials`, {
    headers: authHeaders()
  });
}

export async function createCredential(
  companyId: string,
  payload: { name: string; provider: string; apiKey: string; url?: string }
) {
  return jsonRequest<CredentialItem>(`/api/evo/companies/${companyId}/credentials`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export async function updateCredential(
  companyId: string,
  credentialId: string,
  payload: { name?: string; provider?: string; apiKey?: string; url?: string }
) {
  return jsonRequest<CredentialItem>(`/api/evo/companies/${companyId}/credentials/${credentialId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export async function deleteCredential(companyId: string, credentialId: string) {
  return jsonRequest<{ id: string }>(`/api/evo/companies/${companyId}/credentials/${credentialId}`, {
    method: "DELETE",
    headers: authHeaders()
  });
}
