"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Instagram,
  MessageCircle,
  Send,
  Users2,
  Loader2,
  Wifi,
  QrCode,
  CirclePause,
  XCircle,
  RotateCcw,
  Play
} from "lucide-react";
import {
  connectInstance,
  deleteInstance,
  createInstance,
  fetchInstances,
  restartInstance,
  logoutInstance,
  fetchConnectionState,
  readPreferredInstance,
  setPreferredInstance,
  getApiKey,
  findSettings,
  setSettings,
  findProxy,
  setProxy,
  findWebhook,
  setWebhook
} from "@/lib/evo-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatDateTimeWithTz } from "@/lib/timezone";
import { useToast } from "@/hooks/use-toast";
import { getEvoSocket } from "@/lib/evo-socket";

const quickPlatforms = [
  {
    id: "whatsapp",
    label: "WhatsApp Evolution",
    hint: "Baileys / Cloud",
    icon: MessageCircle,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100"
  },
  {
    id: "instagram",
    label: "Instagram",
    hint: "DM + истории",
    icon: Instagram,
    tone: "bg-pink-50 text-pink-700 border-pink-100"
  },
  {
    id: "telegram",
    label: "Telegram",
    hint: "Бот / канал",
    icon: Send,
    tone: "bg-sky-50 text-sky-700 border-sky-100"
  }
] as const;

const statusTone = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "open") return "bg-emerald-100 text-emerald-700";
  if (s === "connecting" || s === "pairing") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
};

const statusLabel = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "open") return "Активен";
  if (s === "connecting" || s === "pairing") return "Подключается";
  return "Оффлайн";
};

type Connector = {
  id: string;
  instanceName: string;
  number?: string;
  ownerJid?: string;
  connectionStatus?: string;
  updatedAt?: string;
  token?: string;
  counts?: {
    Message?: number;
    Contact?: number;
    Chat?: number;
  };
};

type ApiInstance = {
  instanceId?: string;
  id?: string;
  instanceName?: string;
  name?: string;
  number?: string;
  ownerJid?: string;
  connectionStatus?: string;
  updatedAt?: string;
  token?: string;
  _count?: Connector["counts"];
};

type SettingsForm = {
  rejectCall: boolean;
  msgCall: string;
  groupsIgnore: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  readStatus: boolean;
  syncFullHistory: boolean;
  wavoipToken: string;
};

type ProxyForm = {
  enabled: boolean;
  host: string;
  port: string;
  protocol: string;
  username: string;
  password: string;
};

type WebhookForm = {
  enabled: boolean;
  url: string;
  headers: string;
  byEvents: boolean;
  base64: boolean;
  events: string;
};

type QrPayload = {
  instance?: string;
  qrcode?: { instance?: string; base64?: string | null; pairingCode?: string | null } | null;
  qrCode?: string | null;
  base64?: string | null;
  pairingCode?: string | null;
  code?: string | null;
  data?: { qrcode?: { instance?: string; base64?: string | null; pairingCode?: string | null } | null } | null;
};

const defaultSettings: SettingsForm = {
  rejectCall: false,
  msgCall: "",
  groupsIgnore: false,
  alwaysOnline: false,
  readMessages: false,
  readStatus: false,
  syncFullHistory: false,
  wavoipToken: ""
};

const defaultProxy: ProxyForm = {
  enabled: false,
  host: "",
  port: "",
  protocol: "",
  username: "",
  password: ""
};

const defaultWebhook: WebhookForm = {
  enabled: false,
  url: "",
  headers: "",
  byEvents: false,
  base64: false,
  events: ""
};

export default function ConnectorsView() {
  const defaultInstanceName =
    process.env.NEXT_PUBLIC_EVOLUTION_INSTANCE || process.env.EVOLUTION_INSTANCE || "";
  const defaultNumber =
    process.env.NEXT_PUBLIC_EVOLUTION_OWNER_NUMBER || process.env.EVOLUTION_OWNER_NUMBER || "";
  const [instanceIdHint, setInstanceIdHint] = useState("");
  const [newInstanceNumber, setNewInstanceNumber] = useState(defaultNumber);
  const [createOpen, setCreateOpen] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrInstance, setQrInstance] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [newInstanceName, setNewInstanceName] = useState(defaultInstanceName || "");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [currentInstanceName, setCurrentInstanceName] = useState<string | null>(null);
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [createSettings, setCreateSettings] = useState<SettingsForm>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInstance, setSettingsInstance] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [proxyOpen, setProxyOpen] = useState(false);
  const [proxyInstance, setProxyInstance] = useState<string | null>(null);
  const [proxyForm, setProxyForm] = useState<ProxyForm>(defaultProxy);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxySaving, setProxySaving] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookInstance, setWebhookInstance] = useState<string | null>(null);
  const [webhookForm, setWebhookForm] = useState<WebhookForm>(defaultWebhook);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey());
  const { toast } = useToast();
  const showApiKeyAlert = !apiKey;
  const showInstancesAlert = Boolean(apiKey) && !loading && connectors.length === 0;

  const applyConnectorState = (instanceName: string, state?: string | null) => {
    if (!instanceName || !state) return;
    setConnectors((prev) => {
      const idx = prev.findIndex((c) => c.instanceName === instanceName);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], connectionStatus: state };
      return next;
    });
  };

  useEffect(() => {
    const socket = getEvoSocket(apiKey);
    if (!socket) return;

    const handleConnectError = (err: unknown) => {
      console.warn("socket connect_error", err);
    };
    const handleConnectionUpdate = (payload: {
      instance?: string;
      data?: { instance?: string; state?: string };
    }) => {
      const instance = payload?.instance || payload?.data?.instance;
      const state = payload?.data?.state;
      if (!instance || !state) return;
      applyConnectorState(instance, state);
    };
    const handleStatusInstance = (payload: { data?: { instance?: string; status?: string } }) => {
      const instance = payload?.data?.instance;
      const status = payload?.data?.status;
      if (!instance || !status) return;
      applyConnectorState(instance, status);
    };
    const handleInstanceCreate = () => {
      void loadInstances();
    };
    const handleInstanceDelete = () => {
      void loadInstances();
    };
    const handleLogoutInstance = () => {
      void loadInstances();
    };

    socket.on("connect_error", handleConnectError);
    socket.on("connection.update", handleConnectionUpdate);
    socket.on("status.instance", handleStatusInstance);
    socket.on("instance.create", handleInstanceCreate);
    socket.on("instance.delete", handleInstanceDelete);
    socket.on("logout.instance", handleLogoutInstance);

    return () => {
      socket.off("connect_error", handleConnectError);
      socket.off("connection.update", handleConnectionUpdate);
      socket.off("status.instance", handleStatusInstance);
      socket.off("instance.create", handleInstanceCreate);
      socket.off("instance.delete", handleInstanceDelete);
      socket.off("logout.instance", handleLogoutInstance);
    };
  }, [apiKey]);

  const formatPairingCode = (value: string | null | undefined) => {
    if (!value) return null;
    const normalized = value.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    if (normalized.length <= 4) return normalized;
    if (normalized.length <= 8) {
      return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
    }
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8)}`;
  };

  const resolveQrPayload = (response: QrPayload | null | undefined) => {
    const qrcodeValue = response?.qrcode;
    const qrcodeString =
      typeof qrcodeValue === "string" ? qrcodeValue : null;
    const qrcode =
      response?.qrcode?.base64 ||
      response?.qrCode ||
      qrcodeString ||
      response?.base64 ||
      null;
    const pairing =
      response?.pairingCode ||
      response?.qrcode?.pairingCode ||
      response?.code ||
      null;
    return {
      qrcode,
      pairing: formatPairingCode(pairing)
    };
  };

  useEffect(() => {
    loadInstances();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string | null>)?.detail ?? null;
      const nextKey = detail ?? getApiKey();
      setApiKeyState(nextKey);
      setCurrentInstanceName(null);
      setCurrentInstanceId(null);
      setPreferredInstance(null);
      void loadInstances();
    };
    window.addEventListener("crafty:apikey-changed", handler as EventListener);
    return () => {
      window.removeEventListener("crafty:apikey-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!qrInstance) return;
    if (!apiKey) return;
    let cancelled = false;
    const stateInterval = setInterval(async () => {
      try {
        const res = await fetchConnectionState(qrInstance);
        const state = res?.instance?.state || res?.state;
        if (state === "open" && !cancelled) {
          setConnectionMessage(`Инстанс ${qrInstance} успешно подключен`);
          setQrData(null);
          setPairingCode(null);
          setQrInstance(null);
          void loadInstances();
          clearInterval(stateInterval);
        }
      } catch (err) {
        console.error("connectionState poll failed", err);
      }
    }, 1000);

    const socket = getEvoSocket(apiKey);
    if (!socket) return;
    const handleConnectError = (err: unknown) => {
      console.warn("socket connect_error", err);
    };
    const handleQrUpdated = (payload: QrPayload) => {
      const instance =
        payload?.instance ||
        payload?.data?.qrcode?.instance ||
        payload?.qrcode?.instance;
      if (instance !== qrInstance) return;
      const qrcode =
        payload?.data?.qrcode?.base64 ||
        payload?.qrcode?.base64 ||
        null;
      const pairing =
        payload?.data?.qrcode?.pairingCode ||
        payload?.qrcode?.pairingCode ||
        null;
      if (qrcode) {
        setQrData(qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`);
      }
      if (pairing) {
        setPairingCode(formatPairingCode(pairing));
      }
    };
    socket.on("connect_error", handleConnectError);
    socket.on("qrcode.updated", handleQrUpdated);

    return () => {
      cancelled = true;
      clearInterval(stateInterval);
      socket.off("connect_error", handleConnectError);
      socket.off("qrcode.updated", handleQrUpdated);
    };
  }, [qrInstance, connectors, newInstanceNumber, apiKey]);

  useEffect(() => {
    const saved = readPreferredInstance();
    if (saved) {
      if (saved.name) setCurrentInstanceName(saved.name);
      if (saved.id) setCurrentInstanceId(saved.id);
    }
  }, []);

  async function loadInstances() {
    if (!getApiKey()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = (await fetchInstances()) as ApiInstance[];
      const base = list.map((i) => ({
        id: i.instanceId || i.id || i.instanceName || "unknown",
        instanceName: i.instanceName || i.name || "—",
        number: i.number || defaultNumber,
        ownerJid: i.ownerJid,
        connectionStatus: i.connectionStatus,
        updatedAt: i.updatedAt,
        token: i.token,
        counts: i._count
      }));

      const withLiveStatus = await Promise.all(
        base.map(async (c) => {
          try {
            const live = await fetchConnectionState(c.instanceName);
            const state = live?.instance?.state || live?.state;
            return state ? { ...c, connectionStatus: state } : c;
          } catch (err) {
            console.error("connectionState check failed", err);
            return c;
          }
        })
      );

      setConnectors(withLiveStatus);
      if (!instanceIdHint && list[0]?.instanceId) {
        setInstanceIdHint(list[0].instanceId);
      }
      const hasCurrent =
        currentInstanceName && withLiveStatus.some((c) => c.instanceName === currentInstanceName);
      if (!hasCurrent) {
        const fallback =
          withLiveStatus.find((c) => c.connectionStatus === "open") ||
          withLiveStatus[0] ||
          null;
        const fallbackName = fallback?.instanceName || defaultInstanceName || null;
        const fallbackId = fallback?.id || null;
        if (fallbackName) {
          setCurrentInstanceName(fallbackName);
          setCurrentInstanceId(fallbackId);
          setPreferredInstance({ id: fallbackId, name: fallbackName });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const activeCount = connectors.filter((c) => c.connectionStatus === "open").length;
  const draftCount = connectors.filter((c) => c.connectionStatus !== "open").length;

  async function handleCreateInstance() {
    if (!newInstanceName.trim()) return;
    if (!getApiKey()) {
      setConnectionMessage("Добавьте API-ключ в Settings → Access.");
      return;
    }
    setActionId("create");
    setQrData(null);
    setPairingCode(null);
    try {
      const response = await createInstance({
        instanceName: newInstanceName.trim(),
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        number: newInstanceNumber.trim() || undefined,
        ...createSettings
      });
      const { qrcode, pairing } = resolveQrPayload(response);
      if (qrcode) {
        setQrData(qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`);
        setQrInstance(newInstanceName.trim());
      }
      setConnectionMessage(null);
      setInstanceIdHint(response?.instance?.instanceId || instanceIdHint);
      if (pairing) {
        setPairingCode(pairing);
      }
      await loadInstances();
      setCreateOpen(false);
    } catch (err) {
      console.error("create instance failed", err);
      toast({ title: "Не удалось создать инстанс" });
    } finally {
      setActionId(null);
    }
  }

  const handleOpenSettings = async (instanceName: string) => {
    setSettingsInstance(instanceName);
    setSettingsOpen(true);
    setSettingsLoading(true);
    try {
      const data = await findSettings(instanceName);
      const resolved = (data?.settings || data || {}) as Partial<SettingsForm>;
      setSettingsForm({ ...defaultSettings, ...resolved });
    } catch (err) {
      console.error("findSettings failed", err);
      setSettingsForm(defaultSettings);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsInstance) return;
    setSettingsSaving(true);
    try {
      await setSettings(settingsInstance, settingsForm);
      setConnectionMessage(`Настройки сохранены для ${settingsInstance}`);
      setSettingsOpen(false);
    } catch (err) {
      console.error("setSettings failed", err);
      toast({ title: "Не удалось сохранить настройки" });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleOpenProxy = async (instanceName: string) => {
    setProxyInstance(instanceName);
    setProxyOpen(true);
    setProxyLoading(true);
    try {
      const data = await findProxy(instanceName);
      const resolved = (data || {}) as Partial<ProxyForm>;
      setProxyForm({ ...defaultProxy, ...resolved });
    } catch (err) {
      console.error("findProxy failed", err);
      setProxyForm(defaultProxy);
    } finally {
      setProxyLoading(false);
    }
  };

  const handleSaveProxy = async () => {
    if (!proxyInstance) return;
    setProxySaving(true);
    try {
      await setProxy(proxyInstance, proxyForm);
      setConnectionMessage(`Прокси обновлён для ${proxyInstance}`);
      setProxyOpen(false);
    } catch (err) {
      console.error("setProxy failed", err);
      toast({ title: "Не удалось сохранить прокси" });
    } finally {
      setProxySaving(false);
    }
  };

  const handleOpenWebhook = async (instanceName: string) => {
    setWebhookInstance(instanceName);
    setWebhookOpen(true);
    setWebhookLoading(true);
    try {
      const data = await findWebhook(instanceName);
      const resolved = (data || {}) as Partial<{
        enabled?: boolean;
        url?: string;
        headers?: Record<string, string>;
        webhookByEvents?: boolean;
        webhookBase64?: boolean;
        events?: string[];
      }>;
      setWebhookForm({
        enabled: Boolean(resolved.enabled),
        url: resolved.url || "",
        headers: resolved.headers ? JSON.stringify(resolved.headers, null, 2) : "",
        byEvents: Boolean(resolved.webhookByEvents),
        base64: Boolean(resolved.webhookBase64),
        events: Array.isArray(resolved.events) ? resolved.events.join(", ") : ""
      });
    } catch (err) {
      console.error("findWebhook failed", err);
      setWebhookForm(defaultWebhook);
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookInstance) return;
    setWebhookSaving(true);
    try {
      const headers = webhookForm.headers.trim()
        ? (JSON.parse(webhookForm.headers) as Record<string, string>)
        : undefined;
      const events = webhookForm.events
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      await setWebhook(webhookInstance, {
        webhook: {
          enabled: webhookForm.enabled,
          url: webhookForm.url || undefined,
          headers,
          byEvents: webhookForm.byEvents,
          base64: webhookForm.base64,
          events
        }
      });
      setConnectionMessage(`Вебхук обновлён для ${webhookInstance}`);
      setWebhookOpen(false);
    } catch (err) {
      console.error("setWebhook failed", err);
      toast({ title: "Не удалось сохранить вебхук" });
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleAction = async (
    id: string,
    action: "connect" | "restart" | "logout" | "delete"
  ) => {
    setActionId(id);
    setQrData(null);
    setQrInstance(null);
    setPairingCode(null);
    try {
      if (action === "connect") {
          const response = await connectInstance(id, {
          number:
            connectors.find((c) => c.instanceName === id)?.number ||
            newInstanceNumber ||
            defaultNumber
        });
        const { qrcode, pairing } = resolveQrPayload(response);
        if (qrcode) {
          setQrData(
            qrcode.startsWith("data:")
              ? qrcode
              : `data:image/png;base64,${qrcode}`
          );
          setQrInstance(id);
        }
        if (pairing) {
          setPairingCode(pairing);
        }
      } else if (action === "restart") {
        await restartInstance(id);
      } else if (action === "logout") {
        await logoutInstance(id);
      } else if (action === "delete") {
        await deleteInstance(id, { instanceId: connectors.find((c) => c.instanceName === id)?.id });
      }
      await loadInstances();
    } catch (err) {
      console.error(`${action} failed`, err);
      toast({ title: "Не удалось выполнить действие", description: action });
    } finally {
      setActionId(null);
    }
  };

  const defaultInstance = useMemo(() => connectors[0]?.instanceName, [connectors]);
  const currentSession =
    currentInstanceName ||
    defaultInstance ||
    defaultInstanceName ||
    connectors[0]?.instanceName ||
    "—";

  const handleSelectInstance = (instanceName: string, instanceId?: string) => {
    setCurrentInstanceName(instanceName);
    setCurrentInstanceId(instanceId || null);
    setPreferredInstance({ id: instanceId || null, name: instanceName });
    setConnectionMessage(`Текущая сессия переключена на ${instanceName}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background p-6 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Коннекты мессенджеров</h1>
            <p className="text-sm text-muted-foreground">
              Проекты, их каналы и статус синхронизации. Настройте коннекты и отправляйте лиды в CRM.
            </p>
            {connectionMessage ? (
              <p className="text-sm text-emerald-700">{connectionMessage}</p>
            ) : null}
          </div>
          <Button variant="outline" className="gap-2 w-full sm:w-auto shadow-sm" onClick={loadInstances}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            Обновить статусы
          </Button>
        </header>

        {showApiKeyAlert ? (
          <Alert variant="destructive">
            <AlertTitle>Нет API-ключа</AlertTitle>
            <AlertDescription>
              <p>Добавьте ключ в Settings → Access, чтобы создавать инстансы.</p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/settings">Открыть Settings</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : showInstancesAlert ? (
          <Alert>
            <AlertTitle>Инстансы не найдены</AlertTitle>
            <AlertDescription>
              <p>Создайте первый инстанс и подключите WhatsApp.</p>
              <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
                Создать инстанс
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                Активных коннектов
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-semibold">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                Ожидают подключения
                <Clock3 className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-3xl font-semibold">{draftCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                Текущая сессия
                <Users2 className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-3xl font-semibold">{currentSession}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                SLA ответов
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-3xl font-semibold">7 сек</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Подключись в мессенджеры</CardTitle>
              <CardDescription>Выберите канал и закрепите его за проектом или пайплайном.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Поиск проектов или каналов" className="w-full sm:w-72" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {quickPlatforms.map((platform) => (
              <button
                key={platform.id}
                onClick={platform.id === "whatsapp" ? () => setCreateOpen(true) : undefined}
                className={`flex h-full flex-col justify-between rounded-xl border shadow-sm ${platform.tone} p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                  platform.id === "whatsapp" ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-base">
                      <platform.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{platform.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {platform.id === "whatsapp" ? platform.hint : "Доступно скоро"}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div className="mt-3 rounded-lg bg-white/70 p-2 text-xs text-muted-foreground">
                  {platform.id === "whatsapp"
                    ? "Создайте инстанс, получите QR и подключите канал."
                    : "Недоступно"}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Текущие коннекты</CardTitle>
              <CardDescription>Статусы, токены и действия по каждому каналу.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-3">
            {connectors.map((connector) => (
              <Card
                key={connector.id}
                className="border-muted/60 bg-gradient-to-br from-white/70 via-background to-muted/40 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md py-2">
                <CardContent className="space-y-1 p-4 pt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Badge>
                        <Badge className={statusTone(connector.connectionStatus)}>
                          {statusLabel(connector.connectionStatus)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-lg font-semibold tracking-tight">{connector.instanceName}</p>
                        <p className="text-sm text-muted-foreground">
                          {connector.number ? `+${connector.number}` : connector.ownerJid || "—"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Обновлено:{" "}
                          {connector.updatedAt
                          ? formatDateTimeWithTz(connector.updatedAt)
                          : "—"}
                      </p>
                    </div>
                    {connector.connectionStatus === "connecting" ? (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        onClick={() => handleAction(connector.instanceName, "connect")}
                        disabled={actionId === connector.instanceName}>
                        {actionId === connector.instanceName ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-muted/60 bg-muted/40 p-3 text-center text-xs">
                    <div className="flex flex-col items-center gap-1">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{connector.counts?.Message ?? 0}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Users2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{connector.counts?.Contact ?? 0}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{connector.counts?.Chat ?? 0}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleAction(connector.instanceName, "connect")}
                      disabled={actionId === connector.instanceName}
                      title="Подключить">
                      {actionId === connector.instanceName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 text-emerald-600" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleAction(connector.instanceName, "restart")}
                      disabled={actionId === connector.instanceName}
                      title="Перезапуск">
                      <RotateCcw className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleAction(connector.instanceName, "logout")}
                      disabled={actionId === connector.instanceName}
                      title="Остановить">
                      <CirclePause className="h-4 w-4 text-amber-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleAction(connector.instanceName, "delete")}
                      disabled={actionId === connector.instanceName}
                      title="Выход">
                      <XCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSettings(connector.instanceName)}
                      disabled={actionId === connector.instanceName}
                    >
                      Настройки
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenProxy(connector.instanceName)}
                      disabled={actionId === connector.instanceName}
                    >
                      Прокси
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenWebhook(connector.instanceName)}
                      disabled={actionId === connector.instanceName}
                    >
                      Вебхук
                    </Button>
                  </div>
                  <Button
                    variant={currentSession === connector.instanceName ? "default" : "secondary"}
                    className="w-full justify-center"
                    onClick={() => handleSelectInstance(connector.instanceName, connector.id)}
                    disabled={currentSession === connector.instanceName}>
                    {currentSession === connector.instanceName ? "Текущая сессия" : "Выбрать"}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {connectors.length === 0 && (
              <div className="col-span-3 flex items-center justify-center text-sm text-muted-foreground">
                {loading ? "Загружаем коннекты…" : "Нет доступных коннектов"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={Boolean(qrData)}
        onOpenChange={(open) => {
          if (!open) {
            setQrData(null);
            setPairingCode(null);
            setQrInstance(null);
            setConnectionMessage(null);
            void loadInstances();
          }
        }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR для подключения</DialogTitle>
            <DialogDescription>
              Отсканируйте QR в приложении WhatsApp для instance {qrInstance || ""}.
            </DialogDescription>
          </DialogHeader>
          {qrData ? (
            <div className="flex flex-col items-center gap-3">
              <img src={qrData} alt="QR" className="w-64 h-64 rounded-lg border" />
              {pairingCode ? (
                <div className="text-sm font-medium text-center">
                  Паринг-код: <span className="font-mono">{pairingCode}</span>
                </div>
              ) : null}
              <Separator />
              <Button onClick={() => setQrData(null)}>Закрыть</Button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              Нет QR-кода
            </div>
          )}
          <DialogFooter />
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать инстанс WhatsApp</DialogTitle>
            <DialogDescription>Укажите имя и номер, чтобы получить QR для подключения.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="instanceName">Имя инстанса</Label>
              <Input
                id="instanceName"
                placeholder="Например, akhan"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="instanceNumber">Номер (без +)</Label>
              <Input
                id="instanceNumber"
                placeholder="7706..."
                value={newInstanceNumber}
                onChange={(e) => setNewInstanceNumber(e.target.value)}
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="text-sm font-semibold">Настройки</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Читать сообщения
                <Switch
                  checked={createSettings.readMessages}
                  onCheckedChange={(checked) =>
                    setCreateSettings((prev) => ({ ...prev, readMessages: checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Читать статус
                <Switch
                  checked={createSettings.readStatus}
                  onCheckedChange={(checked) =>
                    setCreateSettings((prev) => ({ ...prev, readStatus: checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Всегда онлайн
                <Switch
                  checked={createSettings.alwaysOnline}
                  onCheckedChange={(checked) =>
                    setCreateSettings((prev) => ({ ...prev, alwaysOnline: checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Игнор групп
                <Switch
                  checked={createSettings.groupsIgnore}
                  onCheckedChange={(checked) =>
                    setCreateSettings((prev) => ({ ...prev, groupsIgnore: checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Отклонять звонки
                <Switch
                  checked={createSettings.rejectCall}
                  onCheckedChange={(checked) =>
                    setCreateSettings((prev) => ({ ...prev, rejectCall: checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Полная синхронизация
                <Switch
                  checked={createSettings.syncFullHistory}
                  onCheckedChange={(checked) =>
                    setCreateSettings((prev) => ({ ...prev, syncFullHistory: checked }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Сообщение при звонке</Label>
                <Input
                  value={createSettings.msgCall}
                  onChange={(e) => setCreateSettings((prev) => ({ ...prev, msgCall: e.target.value }))}
                  placeholder="Автоответ на звонок"
                />
              </div>
              <div className="space-y-1">
                <Label>Wavoip token</Label>
                <Input
                  value={createSettings.wavoipToken}
                  onChange={(e) => setCreateSettings((prev) => ({ ...prev, wavoipToken: e.target.value }))}
                  placeholder="Опционально"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateInstance} disabled={actionId === "create"}>
              {actionId === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {actionId === "create" ? "Создаем…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            setSettingsInstance(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Настройки инстанса</DialogTitle>
            <DialogDescription>{settingsInstance ? `Инстанс: ${settingsInstance}` : "—"}</DialogDescription>
          </DialogHeader>
          {settingsLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Читать сообщения
                  <Switch
                    checked={settingsForm.readMessages}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, readMessages: checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Читать статус
                  <Switch
                    checked={settingsForm.readStatus}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, readStatus: checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Всегда онлайн
                  <Switch
                    checked={settingsForm.alwaysOnline}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, alwaysOnline: checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Игнор групп
                  <Switch
                    checked={settingsForm.groupsIgnore}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, groupsIgnore: checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Отклонять звонки
                  <Switch
                    checked={settingsForm.rejectCall}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, rejectCall: checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Полная синхронизация
                  <Switch
                    checked={settingsForm.syncFullHistory}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, syncFullHistory: checked }))
                    }
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Сообщение при звонке</Label>
                  <Input
                    value={settingsForm.msgCall}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, msgCall: e.target.value }))}
                    placeholder="Автоответ на звонок"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Wavoip token</Label>
                  <Input
                    value={settingsForm.wavoipToken}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, wavoipToken: e.target.value }))}
                    placeholder="Опционально"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveSettings} disabled={settingsSaving || settingsLoading}>
              {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {settingsSaving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={proxyOpen}
        onOpenChange={(open) => {
          setProxyOpen(open);
          if (!open) {
            setProxyInstance(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Прокси инстанса</DialogTitle>
            <DialogDescription>{proxyInstance ? `Инстанс: ${proxyInstance}` : "—"}</DialogDescription>
          </DialogHeader>
          {proxyLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Прокси включён
                <Switch
                  checked={proxyForm.enabled}
                  onCheckedChange={(checked) => setProxyForm((prev) => ({ ...prev, enabled: checked }))}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Хост</Label>
                  <Input
                    value={proxyForm.host}
                    onChange={(e) => setProxyForm((prev) => ({ ...prev, host: e.target.value }))}
                    placeholder="proxy.host"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Порт</Label>
                  <Input
                    value={proxyForm.port}
                    onChange={(e) => setProxyForm((prev) => ({ ...prev, port: e.target.value }))}
                    placeholder="8080"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Протокол</Label>
                  <Input
                    value={proxyForm.protocol}
                    onChange={(e) => setProxyForm((prev) => ({ ...prev, protocol: e.target.value }))}
                    placeholder="http / https / socks5"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Пользователь</Label>
                  <Input
                    value={proxyForm.username}
                    onChange={(e) => setProxyForm((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Опционально"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Пароль</Label>
                  <Input
                    value={proxyForm.password}
                    onChange={(e) => setProxyForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Опционально"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setProxyOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveProxy} disabled={proxySaving || proxyLoading}>
              {proxySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {proxySaving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={webhookOpen}
        onOpenChange={(open) => {
          setWebhookOpen(open);
          if (!open) {
            setWebhookInstance(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Вебхук инстанса</DialogTitle>
            <DialogDescription>{webhookInstance ? `Инстанс: ${webhookInstance}` : "—"}</DialogDescription>
          </DialogHeader>
          {webhookLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Вебхук включён
                <Switch
                  checked={webhookForm.enabled}
                  onCheckedChange={(checked) => setWebhookForm((prev) => ({ ...prev, enabled: checked }))}
                />
              </label>
              <div className="space-y-1">
                <Label>URL</Label>
                <Input
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://your-webhook"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Base64
                  <Switch
                    checked={webhookForm.base64}
                    onCheckedChange={(checked) => setWebhookForm((prev) => ({ ...prev, base64: checked }))}
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  По событиям
                  <Switch
                    checked={webhookForm.byEvents}
                    onCheckedChange={(checked) => setWebhookForm((prev) => ({ ...prev, byEvents: checked }))}
                  />
                </label>
              </div>
              <div className="space-y-1">
                <Label>События (через запятую)</Label>
                <Input
                  value={webhookForm.events}
                  onChange={(e) => setWebhookForm((prev) => ({ ...prev, events: e.target.value }))}
                  placeholder="MESSAGES_UPSERT, CHATS_UPDATE"
                />
              </div>
              <div className="space-y-1">
                <Label>Headers (JSON)</Label>
                <Textarea
                  value={webhookForm.headers}
                  onChange={(e) => setWebhookForm((prev) => ({ ...prev, headers: e.target.value }))}
                  placeholder='{"Authorization":"Bearer ..."}'
                  className="min-h-[120px]"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWebhookOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveWebhook} disabled={webhookSaving || webhookLoading}>
              {webhookSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {webhookSaving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
