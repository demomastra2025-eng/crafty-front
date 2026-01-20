"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getEvoSocket } from "@/lib/evo-socket";
import { Sidebar } from "@/app/(dashboard)/ai-chat/components/sidebar";
import { useChat } from "@ai-sdk/react";
import { WelcomeScreen } from "@/app/(dashboard)/ai-chat/components/welcome-screen";
import { ChatInterface } from "@/app/(dashboard)/ai-chat/components/chat-interface";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AgnoAgents, type AgnoForm, type AgnoAgentCatalogItem } from "@/app/(dashboard)/ai-chat/components/agno-agents";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  createAgnoBot,
  deleteAgnoBot,
  fetchAgnoBots,
  fetchInstances,
  fetchFunnels,
  getApiKey,
  readPreferredInstance,
  setPreferredInstance,
  updateAgnoBot,
  fetchAgnoSessions,
  changeAgnoStatus,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  fetchLlmModels,
  type LlmModel
} from "@/lib/evo-api";
import { fetchAgnoAgentCatalog, getAgnoDefaultPort } from "@/lib/agno-api";
import { listCompanies } from "@/lib/evo-auth";

type AgnoAgent = {
  id: string;
  enabled?: boolean;
  description?: string;
  prompt?: string;
  agentId?: string;
  webhookUrl?: string | null;
  providerModel?: string | null;
  agnoPort?: number | null;
  triggerType?: string;
  triggerOperator?: string | null;
  triggerValue?: string | null;
  funnelId?: string | null;
  expire?: number | null;
  keywordFinish?: string | null;
  delayMessage?: number | null;
  unknownMessage?: string | null;
  listeningFromMe?: boolean | null;
  stopBotFromMe?: boolean | null;
  keepOpen?: boolean | null;
  debounceTime?: number | null;
  ignoreJids?: string[] | null;
  splitMessages?: boolean | null;
  timePerChar?: number | null;
  instanceName?: string | null;
};

type AgnoSession = {
  id: string;
  status?: "opened" | "paused" | "closed" | string | null;
};

type Funnel = {
  id: string;
  name: string;
  goal: string;
  logic?: string | null;
  followUpEnable?: boolean | null;
  status?: string | null;
  stages?: Array<Record<string, unknown>>;
  updatedAt?: string;
};

type FunnelTouchForm = {
  delayMin: string;
  condition: string;
  conditionEnabled: boolean;
};

type FunnelStageForm = {
  title: string;
  objective: string;
  logicStage: string;
  commonTouchCondition: string;
  touches: FunnelTouchForm[];
};

type FunnelForm = {
  name: string;
  goal: string;
  logic: string;
  followUpEnable: boolean;
  status: "draft" | "active" | "archived";
  stages: FunnelStageForm[];
};

const defaultAgnoForm: AgnoForm = {
  instanceName: "",
  enabled: false,
  description: "",
  prompt: "",
  agentId: "",
  webhookEnabled: false,
  webhookUrl: "",
  providerModel: "",
  agnoPort: "",
  triggerType: "all",
  triggerOperator: "contains",
  triggerValue: "",
  funnelId: "",
  expire: "",
  keywordFinish: "",
  delayMessage: "",
  unknownMessage: "",
  listeningFromMe: false,
  stopBotFromMe: false,
  keepOpen: true,
  debounceTime: "",
  ignoreJids: "",
  splitMessages: false,
  timePerChar: ""
};

const defaultFunnelForm: FunnelForm = {
  name: "",
  goal: "",
  logic: "",
  followUpEnable: true,
  status: "active",
  stages: [
    {
      title: "Знакомство",
      objective: "Уточнить запрос клиента",
      logicStage: "",
      commonTouchCondition: "",
      touches: [
        { delayMin: "60", condition: "", conditionEnabled: false },
        { delayMin: "180", condition: "", conditionEnabled: false }
      ]
    }
  ]
};

const CHAT_SEED_TS = Date.parse("2026-01-01T12:00:00Z");
const COMPANY_STORAGE = "crafty:evo-company";
const seedDate = (offsetMs: number) => new Date(CHAT_SEED_TS - offsetMs);
const seedChats = [
    {
      id: "1",
      title: "Как оформить ИП в Казахстане?",
      preview: "Пошагово: ЭЦП, eGov, налоги...",
      timestamp: seedDate(1000 * 60 * 30), // 30 минут назад
      isFavorite: true
    },
    {
      id: "2",
      title: "Подготовь КП для Astana Hub",
      preview: "Укажи тарифы, сроки, команду...",
      timestamp: seedDate(1000 * 60 * 60), // 1 час назад
      isFavorite: true
    },
    {
      id: "3",
      title: "Скрипт звонка для Алматы",
      preview: "Приветствие, потребность, оффер...",
      timestamp: seedDate(1000 * 60 * 60 * 2) // 2 часа назад
    },
    {
      id: "4",
      title: "Презентация ЖК в Астане",
      preview: "Сделать слайды на русском/казахском",
      timestamp: seedDate(1000 * 60 * 60 * 3), // 3 часа назад
      isArchived: true
    },
    {
      id: "5",
      title: "Пост в Telegram про ЖК",
      preview: "Два абзаца, добавить смайлы...",
      timestamp: seedDate(1000 * 60 * 60 * 4) // 4 hours ago
    },
    {
      id: "6",
      title: "Сравни налоги ИП/ТОO",
      preview: "Порог 24 млн, ОСМС, соцналог...",
      timestamp: seedDate(1000 * 60 * 60 * 5) // 5 hours ago
    },
    {
      id: "7",
      title: "Адаптируй письмо для банка",
      preview: "Запрос по проектному финансированию...",
      timestamp: seedDate(1000 * 60 * 60 * 6) // 6 hours ago
    },
    {
      id: "8",
      title: "FAQ по клиентам из Узбекистана",
      preview: "Доставка, валютный контроль...",
      timestamp: seedDate(1000 * 60 * 60 * 7) // 7 часов назад
    },
    {
      id: "9",
      title: "Сообщение для инвестора",
      preview: "Коротко о цифрах и команде...",
      timestamp: seedDate(1000 * 60 * 60 * 8) // 8 hours ago
    },
    {
      id: "10",
      title: "Контент-план по новостройкам",
      preview: "Сетку постов на месяц...",
      timestamp: seedDate(1000 * 60 * 60 * 9), // 9 часов назад
      isFavorite: true
    },
    {
      id: "11",
      title: "Шаблон договора аренды",
      preview: "Нужно учесть депозит и ремонт...",
      timestamp: seedDate(1000 * 60 * 60 * 10) // 10 hours ago
    }
];

const toIgnoreJidValue = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
};

const stripIgnoreJid = (jid: string) =>
  jid.endsWith("@s.whatsapp.net") ? jid.replace("@s.whatsapp.net", "") : jid;

export default function AIChatApp() {
  const [activeTab, setActiveTab] = useState<"playground" | "agents">("playground");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chats] = useState(seedChats);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    initialMessages:
      selectedChatId === "2"
        ? [
            {
              id: "1",
              role: "user",
              content: "Подготовь письмо клиенту на русском и казахском"
            },
            {
              id: "2",
              role: "assistant",
              content:
                "Конечно! Напиши, что это за клиент и что нужно подчеркнуть: сроки, цену, локацию или команду?"
            }
          ]
        : []
  });

  const handleNewChat = () => {
    setSelectedChatId(null);
    // Reset chat messages would happen here in a real app
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
  };

  const handleSuggestionClick = () => {
    // In a real app, this would start a new chat with the suggestion
    setSelectedChatId("new");
  };

  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [instances, setInstances] = useState<string[]>([]);
  const [agnoAgents, setAgnoAgents] = useState<AgnoAgent[]>([]);
  const [agnoLoading, setAgnoLoading] = useState(false);
  const [agnoSaving, setAgnoSaving] = useState(false);
  const [agnoError, setAgnoError] = useState<string | null>(null);
  const [selectedAgnoAgentId, setSelectedAgnoAgentId] = useState<string | null>(null);
  const [selectedAgnoAgentInstance, setSelectedAgnoAgentInstance] = useState<string | null>(null);
  const [agnoAgentMode, setAgnoAgentMode] = useState<"idle" | "create" | "edit">("idle");
  const [agnoAgentForm, setAgnoAgentForm] = useState<AgnoForm>(defaultAgnoForm);
  const [agnoCatalog, setAgnoCatalog] = useState<AgnoAgentCatalogItem[]>([]);
  const [agnoCatalogLoading, setAgnoCatalogLoading] = useState(false);
  const [agnoCatalogError, setAgnoCatalogError] = useState<string | null>(null);
  const [llmModels, setLlmModels] = useState<LlmModel[]>([]);
  const [llmModelsLoading, setLlmModelsLoading] = useState(false);
  const [llmModelsError, setLlmModelsError] = useState<string | null>(null);
  const [companyPorts, setCompanyPorts] = useState<number[]>([]);
  const defaultAgnoPort = getAgnoDefaultPort();
  const [agnoSessions, setAgnoSessions] = useState<AgnoSession[]>([]);
  const [agnoSessionsLoading, setAgnoSessionsLoading] = useState(false);
  const [agnoSessionsError, setAgnoSessionsError] = useState<string | null>(null);
  const sessionsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey());
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [funnelSaving, setFunnelSaving] = useState(false);
  const [funnelDeleting, setFunnelDeleting] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);
  const [funnelMode, setFunnelMode] = useState<"idle" | "create" | "edit">("idle");
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [funnelForm, setFunnelForm] = useState<FunnelForm>(defaultFunnelForm);
  const showApiKeyAlert = !apiKey;
  const showInstancesAlert = Boolean(apiKey) && instances.length === 0;

  const loadAgnoAgents = useCallback(async (instanceNames: string[]) => {
    if (!instanceNames.length) {
      setAgnoAgents([]);
      return;
    }
    setAgnoLoading(true);
    try {
      const results = await Promise.all(
        instanceNames.map(async (instanceName) => {
          try {
            const data = await fetchAgnoBots(instanceName);
            const list = Array.isArray(data) ? data : [];
            return list.map((agent: AgnoAgent) => ({ ...agent, instanceName }));
          } catch {
            return [];
          }
        })
      );
      setAgnoAgents(results.flat());
    } finally {
      setAgnoLoading(false);
    }
  }, []);

  const loadAgnoSessions = useCallback(async (instance: string, botId: string) => {
    setAgnoSessionsLoading(true);
    setAgnoSessionsError(null);
    try {
      const data = await fetchAgnoSessions(instance, botId);
      setAgnoSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setAgnoSessions([]);
      setAgnoSessionsError(err instanceof Error ? err.message : "Ошибка загрузки сессий");
    } finally {
      setAgnoSessionsLoading(false);
    }
  }, []);

  const scheduleAgnoSessionsRefresh = useCallback(() => {
    if (activeTab !== "agents") return;
    if (agnoAgentMode !== "edit" || !selectedAgnoAgentId || !selectedAgnoAgentInstance) return;
    if (sessionsRefreshTimerRef.current) {
      clearTimeout(sessionsRefreshTimerRef.current);
    }
    sessionsRefreshTimerRef.current = setTimeout(() => {
      loadAgnoSessions(selectedAgnoAgentInstance, selectedAgnoAgentId);
    }, 300);
  }, [activeTab, agnoAgentMode, selectedAgnoAgentId, selectedAgnoAgentInstance, loadAgnoSessions]);

  const refreshInstances = useCallback(async () => {
    if (!apiKey) {
      setInstances([]);
      setInstanceName(null);
      return;
    }
    try {
      const list = await fetchInstances();
      const names = list.map((item) => item.instanceName).filter(Boolean);
      setInstances(names);
      const nextInstance =
        instanceName && names.includes(instanceName) ? instanceName : names[0] || null;
      if (nextInstance !== instanceName) {
        setInstanceName(nextInstance);
        setPreferredInstance(nextInstance ? { name: nextInstance } : null);
      }
      if (activeTab === "agents" && names.length) {
        loadAgnoAgents(names);
      }
    } catch (err) {
      console.warn("Ошибка обновления инстансов", err);
      setInstances([]);
      setInstanceName(null);
    }
  }, [activeTab, apiKey, loadAgnoAgents, instanceName]);

  const loadFunnels = useCallback(async (instanceName: string | null) => {
    if (!instanceName) {
      setFunnels([]);
      return;
    }
    setFunnelLoading(true);
    try {
      const data = await fetchFunnels(instanceName);
      const list = Array.isArray(data) ? data : [];
      setFunnels(list);
    } catch {
      setFunnels([]);
    } finally {
      setFunnelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setInstances([]);
      setInstanceName(null);
      return;
    }
    const preferred = readPreferredInstance()?.name || null;
    fetchInstances()
      .then((list) => {
        const names = list.map((item) => item.instanceName).filter(Boolean);
        setInstances(names);
        const fallback = preferred && names.includes(preferred) ? preferred : names[0] || null;
        setInstanceName(fallback);
        setPreferredInstance(fallback ? { name: fallback } : null);
      })
      .catch(() => {
        setInstances([]);
        setInstanceName(null);
      });
  }, [apiKey]);

  useEffect(() => {
    const socket = getEvoSocket(apiKey);
    if (!socket) return;

    const handleConnectError = (err: unknown) => {
      console.warn("socket connect_error", err);
    };
    socket.on("instance.create", refreshInstances);
    socket.on("instance.delete", refreshInstances);
    socket.on("connection.update", refreshInstances);
    socket.on("status.instance", refreshInstances);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("instance.create", refreshInstances);
      socket.off("instance.delete", refreshInstances);
      socket.off("connection.update", refreshInstances);
      socket.off("status.instance", refreshInstances);
      socket.off("connect_error", handleConnectError);
    };
  }, [apiKey, refreshInstances]);

  useEffect(() => {
    const socket = getEvoSocket(apiKey);
    if (!socket) return;

    const handleSessionEvent = () => {
      scheduleAgnoSessionsRefresh();
    };

    socket.on("messages.upsert", handleSessionEvent);
    socket.on("messages.update", handleSessionEvent);
    socket.on("chats.update", handleSessionEvent);

    return () => {
      socket.off("messages.upsert", handleSessionEvent);
      socket.off("messages.update", handleSessionEvent);
      socket.off("chats.update", handleSessionEvent);
    };
  }, [apiKey, scheduleAgnoSessionsRefresh]);

  useEffect(() => {
    const handleFocus = () => {
      refreshInstances();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshInstances]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string | null>)?.detail ?? null;
      const nextKey = detail ?? getApiKey();
      setApiKeyState(nextKey);
      setInstances([]);
      setInstanceName(null);
      setPreferredInstance(null);
    };
    window.addEventListener("crafty:apikey-changed", handler as EventListener);
    return () => {
      window.removeEventListener("crafty:apikey-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    listCompanies()
      .then((companies) => {
        const stored = typeof window !== "undefined" ? localStorage.getItem(COMPANY_STORAGE) : null;
        const active =
          (stored && companies.find((company) => company.id === stored)) || companies[0] || null;
        const ports = Array.isArray(active?.agnoPorts) ? active?.agnoPorts : [];
        setCompanyPorts(ports);
      })
      .catch(() => {
        setCompanyPorts([]);
      });
  }, []);

  useEffect(() => {
    const ports = Array.from(
      new Set(
        [defaultAgnoPort, ...companyPorts].filter(
          (value): value is number => typeof value === "number" && value > 0
        )
      )
    );
    setAgnoCatalogLoading(true);
    Promise.all(ports.map((port) => fetchAgnoAgentCatalog(port).catch(() => [])))
      .then((lists) => {
        const flattened = lists.flat();
        setAgnoCatalog(flattened);
        setAgnoCatalogError(null);
      })
      .catch((err) => {
        setAgnoCatalog([]);
        setAgnoCatalogError(err instanceof Error ? err.message : "Ошибка загрузки каталога");
      })
      .finally(() => {
        setAgnoCatalogLoading(false);
      });
  }, [companyPorts, defaultAgnoPort]);

  useEffect(() => {
    if (!apiKey) return;
    setLlmModelsLoading(true);
    fetchLlmModels()
      .then((data) => {
        setLlmModels(Array.isArray(data) ? data : []);
        setLlmModelsError(null);
      })
      .catch((err) => {
        setLlmModels([]);
        setLlmModelsError(err instanceof Error ? err.message : "Ошибка загрузки моделей");
      })
      .finally(() => setLlmModelsLoading(false));
  }, [apiKey]);

  useEffect(() => {
    if (activeTab !== "agents") return;
    if (!instances.length) return;
    loadAgnoAgents(instances);
    if (instanceName) {
      loadFunnels(instanceName);
    }
  }, [activeTab, instanceName, instances, loadAgnoAgents, loadFunnels]);

  useEffect(() => {
    setSelectedFunnelId(null);
    setFunnelMode("idle");
    setFunnelForm(defaultFunnelForm);
    setFunnelError(null);
  }, [instanceName]);

  useEffect(() => {
    if (agnoAgentMode !== "create") return;
    if (agnoAgentForm.agentId || agnoAgentForm.webhookEnabled) return;
    const firstId = agnoCatalog[0]?.id || "";
    if (!firstId) return;
    const firstPort = agnoCatalog[0]?.port;
    setAgnoAgentForm((current) => ({
      ...current,
      agentId: firstId,
      agnoPort: firstPort ? String(firstPort) : current.agnoPort
    }));
  }, [agnoAgentForm.agentId, agnoAgentMode, agnoCatalog]);

  useEffect(() => {
    if (agnoAgentMode !== "edit" || !selectedAgnoAgentId || !selectedAgnoAgentInstance) {
      setAgnoSessions([]);
      return;
    }
    loadAgnoSessions(selectedAgnoAgentInstance, selectedAgnoAgentId);
  }, [agnoAgentMode, selectedAgnoAgentId, selectedAgnoAgentInstance, loadAgnoSessions]);

  useEffect(() => {
    return () => {
      if (sessionsRefreshTimerRef.current) {
        clearTimeout(sessionsRefreshTimerRef.current);
      }
    };
  }, []);

  const handleSelectAgnoAgent = (agentId: string) => {
    const found = agnoAgents.find((agent) => agent.id === agentId);
    if (!found) return;
    setSelectedAgnoAgentId(agentId);
    setSelectedAgnoAgentInstance(found.instanceName || null);
    setAgnoAgentMode("edit");
    setAgnoAgentForm({
      instanceName: found.instanceName || instanceName || "",
      enabled: found.enabled ?? true,
      description: found.description || "",
      prompt: found.prompt || "",
      agentId: found.agentId || "",
      webhookEnabled: Boolean(found.webhookUrl),
      webhookUrl: found.webhookUrl || "",
      providerModel: found.providerModel || "",
      agnoPort: found.agnoPort !== undefined && found.agnoPort !== null ? String(found.agnoPort) : "",
      triggerType: (found.triggerType as AgnoForm["triggerType"]) || "all",
      triggerOperator: (found.triggerOperator as AgnoForm["triggerOperator"]) || "contains",
      triggerValue: found.triggerValue || "",
      funnelId: found.funnelId || "",
      expire: found.expire !== undefined && found.expire !== null ? String(found.expire) : "",
      keywordFinish: found.keywordFinish || "",
      delayMessage: found.delayMessage !== undefined && found.delayMessage !== null ? String(found.delayMessage) : "",
      unknownMessage: found.unknownMessage || "",
      listeningFromMe: found.listeningFromMe ?? false,
      stopBotFromMe: found.stopBotFromMe ?? false,
      keepOpen: found.keepOpen ?? false,
      debounceTime: found.debounceTime !== undefined && found.debounceTime !== null ? String(found.debounceTime) : "",
      ignoreJids: Array.isArray(found.ignoreJids)
        ? found.ignoreJids.map(stripIgnoreJid).join(", ")
        : "",
      splitMessages: found.splitMessages ?? false,
      timePerChar: found.timePerChar !== undefined && found.timePerChar !== null ? String(found.timePerChar) : ""
    });
    setAgnoError(null);
  };

  const handleNewAgnoAgent = () => {
    const preferredId = agnoCatalog[0]?.id || "";
    const preferredPort = agnoCatalog[0]?.port || defaultAgnoPort || undefined;
    setSelectedAgnoAgentId(null);
    setSelectedAgnoAgentInstance(null);
    setAgnoAgentMode("create");
    setAgnoAgentForm({
      ...defaultAgnoForm,
      instanceName: instanceName || "",
      agentId: preferredId,
      webhookEnabled: false,
      webhookUrl: "",
      providerModel: "",
      agnoPort: preferredPort ? String(preferredPort) : ""
    });
    setAgnoError(null);
  };

  const handleSelectFunnel = (funnelId: string) => {
    const found = funnels.find((item) => item.id === funnelId);
    if (!found) return;
    setSelectedFunnelId(found.id);
    setFunnelMode("edit");
    const rawStages =
      Array.isArray(found.stages)
        ? found.stages
        : typeof found.stages === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(found.stages);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];
    const stages: FunnelStageForm[] = rawStages.map((stage) => ({
      title: stage?.title ? String(stage.title) : "",
      objective: stage?.objective ? String(stage.objective) : "",
      logicStage: stage?.logicStage ? String(stage.logicStage) : "",
      commonTouchCondition: stage?.commonTouchCondition ? String(stage.commonTouchCondition) : "",
      touches: Array.isArray(stage?.touches)
        ? stage.touches.map((touch: { delayMin?: number; condition?: string }) => {
            const conditionValue = touch?.condition ? String(touch.condition) : "";
            return {
              delayMin:
                touch?.delayMin !== undefined && touch?.delayMin !== null ? String(touch.delayMin) : "",
              condition: conditionValue,
              conditionEnabled: Boolean(conditionValue)
            };
          })
        : [{ delayMin: "60", condition: "", conditionEnabled: false }]
    }));
    setFunnelForm({
      name: found.name || "",
      goal: found.goal || "",
      logic: found.logic || "",
      followUpEnable: found.followUpEnable ?? true,
      status: (found.status as FunnelForm["status"]) || "active",
      stages: stages.length
        ? stages
        : [
            {
              title: "Знакомство",
              objective: "Уточнить запрос клиента",
              logicStage: "",
              commonTouchCondition: "",
              touches: [{ delayMin: "60", condition: "", conditionEnabled: false }]
            }
          ]
    });
    setFunnelError(null);
  };

  const handleNewFunnel = () => {
    setSelectedFunnelId(null);
    setFunnelMode("create");
    setFunnelForm(defaultFunnelForm);
    setFunnelError(null);
  };

  const handleSaveFunnel = async () => {
    if (!instanceName) return;
    if (!funnelForm.name.trim()) {
      setFunnelError("Укажите название");
      return;
    }
    if (!funnelForm.goal.trim()) {
      setFunnelError("Укажите цель");
      return;
    }
    if (!funnelForm.stages.length) {
      setFunnelError("Добавьте хотя бы один этап");
      return;
    }
    if (funnelForm.followUpEnable && !funnelForm.logic.trim()) {
      setFunnelError("Укажите общую логику");
      return;
    }
    setFunnelSaving(true);
    setFunnelError(null);

    const stages: Array<Record<string, unknown>> = [];
    for (const [index, stage] of funnelForm.stages.entries()) {
      const title = stage.title.trim();
      if (!title) {
        setFunnelError(`Этап ${index + 1}: укажите название`);
        setFunnelSaving(false);
        return;
      }
      const objective = stage.objective.trim();
      const logicStage = stage.logicStage.trim();
      const commonTouchCondition = stage.commonTouchCondition.trim();
      if (funnelForm.followUpEnable && !logicStage) {
        setFunnelError(`Этап ${index + 1}: заполните логику этапа`);
        setFunnelSaving(false);
        return;
      }
      if (funnelForm.followUpEnable && !commonTouchCondition) {
        setFunnelError(`Этап ${index + 1}: заполните общее условие касаний`);
        setFunnelSaving(false);
        return;
      }
      const touches: Array<Record<string, unknown>> = [];
      for (const [touchIndex, touch] of stage.touches.entries()) {
        const delay = Number(touch.delayMin.trim());
        if (!Number.isFinite(delay) || delay <= 0) {
          setFunnelError(`Этап ${index + 1}, касание ${touchIndex + 1}: delay должен быть > 0`);
          setFunnelSaving(false);
          return;
        }
        if (funnelForm.followUpEnable && touch.conditionEnabled && !touch.condition.trim()) {
          setFunnelError(`Этап ${index + 1}, касание ${touchIndex + 1}: заполните условие`);
          setFunnelSaving(false);
          return;
        }
        touches.push({
          delayMin: delay,
          condition: touch.conditionEnabled ? touch.condition.trim() || undefined : undefined,
          touch: touchIndex + 1
        });
      }
      stages.push({
        stage: index + 1,
        title,
        objective: objective || undefined,
        logicStage: logicStage || undefined,
        commonTouchCondition: commonTouchCondition || undefined,
        touches
      });
    }

    try {
      if (funnelMode === "edit" && selectedFunnelId) {
        await updateFunnel(instanceName, selectedFunnelId, {
          name: funnelForm.name.trim(),
          goal: funnelForm.goal.trim(),
          logic: funnelForm.logic.trim() || undefined,
          followUpEnable: funnelForm.followUpEnable,
          status: funnelForm.status,
          stages
        });
      } else {
        const created = await createFunnel(instanceName, {
          name: funnelForm.name.trim(),
          goal: funnelForm.goal.trim(),
          logic: funnelForm.logic.trim() || undefined,
          followUpEnable: funnelForm.followUpEnable,
          status: funnelForm.status,
          stages
        });
        if (created?.id) {
          setSelectedFunnelId(created.id);
          setFunnelMode("edit");
        }
      }
      loadFunnels(instanceName);
    } catch (err) {
      setFunnelError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setFunnelSaving(false);
    }
  };

  const handleSaveAgnoAgent = async () => {
    if (!agnoAgentForm.instanceName) return;
    setAgnoSaving(true);
    setAgnoError(null);
    const parseNumber = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? undefined : parsed;
    };
    const ignoreJids = agnoAgentForm.ignoreJids
      .split(",")
      .map((item) => toIgnoreJidValue(item))
      .filter(Boolean);
    const agnoPort = parseNumber(agnoAgentForm.agnoPort);
    const payload: Record<string, unknown> = {
      enabled: agnoAgentForm.enabled,
      description: agnoAgentForm.description || undefined,
      prompt: agnoAgentForm.prompt || undefined,
      agentId: agnoAgentForm.agentId || undefined,
      webhookUrl: agnoAgentForm.webhookEnabled ? agnoAgentForm.webhookUrl.trim() || null : null,
      providerModel: agnoAgentForm.providerModel || null,
      agnoPort: agnoPort ?? undefined,
      triggerType: agnoAgentForm.triggerType,
      triggerOperator: agnoAgentForm.triggerType === "keyword" ? agnoAgentForm.triggerOperator : undefined,
      triggerValue:
        agnoAgentForm.triggerType === "keyword" || agnoAgentForm.triggerType === "advanced"
          ? agnoAgentForm.triggerValue
          : undefined,
      funnelId: agnoAgentForm.funnelId || null,
      expire: parseNumber(agnoAgentForm.expire),
      keywordFinish: agnoAgentForm.keywordFinish || undefined,
      delayMessage: parseNumber(agnoAgentForm.delayMessage),
      unknownMessage: agnoAgentForm.unknownMessage || undefined,
      listeningFromMe: agnoAgentForm.listeningFromMe,
      stopBotFromMe: agnoAgentForm.stopBotFromMe,
      keepOpen: agnoAgentForm.keepOpen,
      debounceTime: parseNumber(agnoAgentForm.debounceTime),
      ignoreJids: ignoreJids.length ? ignoreJids : undefined,
      splitMessages: agnoAgentForm.splitMessages,
      timePerChar: parseNumber(agnoAgentForm.timePerChar)
    };
    const currentAgent = agnoAgents.find(
      (agent) =>
        agent.id === selectedAgnoAgentId && agent.instanceName === selectedAgnoAgentInstance
    );
    const previousEnabled = Boolean(currentAgent?.enabled);
    try {
      if (agnoAgentMode === "edit" && selectedAgnoAgentId) {
        if (selectedAgnoAgentInstance && selectedAgnoAgentInstance !== agnoAgentForm.instanceName) {
          const created = await createAgnoBot(agnoAgentForm.instanceName, payload);
          await deleteAgnoBot(selectedAgnoAgentInstance, selectedAgnoAgentId);
          if (created?.id) {
            setSelectedAgnoAgentId(created.id);
            setSelectedAgnoAgentInstance(agnoAgentForm.instanceName);
            setAgnoAgentMode("edit");
          } else {
            setSelectedAgnoAgentId(null);
            setSelectedAgnoAgentInstance(null);
            setAgnoAgentMode("idle");
          }
        } else {
          await updateAgnoBot(agnoAgentForm.instanceName, selectedAgnoAgentId, payload);
          if (previousEnabled !== agnoAgentForm.enabled) {
            await changeAgnoStatus(agnoAgentForm.instanceName, {
              botId: selectedAgnoAgentId,
              allSessions: true,
              status: agnoAgentForm.enabled ? "opened" : "paused"
            });
            await loadAgnoSessions(agnoAgentForm.instanceName, selectedAgnoAgentId);
          }
        }
      } else {
        const created = await createAgnoBot(agnoAgentForm.instanceName, payload);
        if (created?.id) {
          setSelectedAgnoAgentId(created.id);
          setSelectedAgnoAgentInstance(agnoAgentForm.instanceName);
          setAgnoAgentMode("edit");
        }
      }
      loadAgnoAgents(instances);
    } catch (err) {
      setAgnoError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setAgnoSaving(false);
    }
  };

  const handleDeleteFunnel = async () => {
    if (!instanceName || !selectedFunnelId) return;
    if (!window.confirm("Удалить сценарий? Если она используется в follow-up, удаление будет заблокировано.")) {
      return;
    }
    setFunnelDeleting(true);
    setFunnelError(null);
    try {
      await deleteFunnel(instanceName, selectedFunnelId);
      setSelectedFunnelId(null);
      setFunnelMode("idle");
      setFunnelForm(defaultFunnelForm);
      loadFunnels(instanceName);
    } catch (err) {
      setFunnelError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setFunnelDeleting(false);
    }
  };

  const handleDeleteAgnoAgent = async () => {
    if (!selectedAgnoAgentInstance || !selectedAgnoAgentId) return;
    const ok = window.confirm("Удалить агента?");
    if (!ok) return;
    try {
      await deleteAgnoBot(selectedAgnoAgentInstance, selectedAgnoAgentId);
      setSelectedAgnoAgentId(null);
      setSelectedAgnoAgentInstance(null);
      setAgnoAgentMode("idle");
      setAgnoAgentForm(defaultAgnoForm);
      loadAgnoAgents(instances);
    } catch (err) {
      setAgnoError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const canManageFunnel = agnoAgentMode === "edit" && Boolean(selectedAgnoAgentId);
  const sessionSummary = (() => {
    if (!agnoSessions.length) return "empty";
    const opened = agnoSessions.filter((session) => session.status === "opened").length;
    if (opened === agnoSessions.length) return "on";
    if (opened === 0) return "off";
    return "mixed";
  })();

  const handleToggleAllSessions = async (next: "on" | "off") => {
    if (!selectedAgnoAgentInstance || !selectedAgnoAgentId) return;
    setAgnoSessionsError(null);
    setAgnoSessionsLoading(true);
    try {
      await changeAgnoStatus(selectedAgnoAgentInstance, {
        botId: selectedAgnoAgentId,
        allSessions: true,
        status: next === "on" ? "opened" : "paused"
      });
      setAgnoAgentForm((current) => ({
        ...current,
        enabled: next === "on"
      }));
      await loadAgnoSessions(selectedAgnoAgentInstance, selectedAgnoAgentId);
      loadAgnoAgents(instances);
    } catch (err) {
      setAgnoSessionsError(err instanceof Error ? err.message : "Не удалось обновить сессии");
    } finally {
      setAgnoSessionsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(113vh-10rem)] min-h-0 w-full flex-col overflow-hidden rounded-xl bg-white">
      {showApiKeyAlert ? (
        <div className="border-b bg-white px-4 py-3">
          <Alert variant="destructive">
            <AlertTitle>Нет API-ключа</AlertTitle>
            <AlertDescription>
              <p>Добавьте ключ в Settings → Access, чтобы управлять агентами.</p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/settings">Открыть Settings</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : showInstancesAlert ? (
        <div className="border-b bg-white px-4 py-3">
          <Alert>
            <AlertTitle>Инстансы не найдены</AlertTitle>
            <AlertDescription>
              <p>Создайте инстанс и подключите WhatsApp, чтобы добавить агента.</p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/connections">Перейти к Connections</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "playground" | "agents")}
        className="min-h-0 w-full flex-1"
      >
        <div className="flex min-h-0 w-full">
          <Sidebar
            chats={chats}
            selectedChatId={selectedChatId}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            agents={agnoAgents}
            selectedAgentId={selectedAgnoAgentId}
            onSelectAgent={handleSelectAgnoAgent}
            onNewAgent={handleNewAgnoAgent}
            agentsLoading={agnoLoading}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <TabsContent value="playground" className="flex min-h-0 flex-1 flex-col">
              {!selectedChatId ? (
                <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
              ) : (
                <ChatInterface
                  messages={messages}
                  input={input}
                  handleInputChange={handleInputChange}
                  handleSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="agents" className="flex min-h-0 flex-1 flex-col">
              <AgnoAgents
                instanceName={instanceName}
                instances={instances}
                agentMode={agnoAgentMode}
                form={agnoAgentForm}
                onFormChange={(next) => setAgnoAgentForm(next)}
                onSave={handleSaveAgnoAgent}
                onDelete={handleDeleteAgnoAgent}
                saving={agnoSaving}
                error={agnoError}
                onNewAgent={handleNewAgnoAgent}
                funnels={funnels}
                funnelMode={funnelMode}
                funnelForm={funnelForm}
                onFunnelFormChange={setFunnelForm}
                onFunnelSave={handleSaveFunnel}
                onFunnelDelete={handleDeleteFunnel}
                funnelLoading={funnelLoading}
                funnelSaving={funnelSaving}
                funnelDeleting={funnelDeleting}
                funnelError={funnelError}
                selectedFunnelId={selectedFunnelId}
                onSelectFunnel={handleSelectFunnel}
                onNewFunnel={handleNewFunnel}
                canManageFunnel={canManageFunnel}
                selectedAgentId={selectedAgnoAgentId}
                selectedAgentInstance={selectedAgnoAgentInstance}
                agentCatalog={agnoCatalog}
                agentCatalogLoading={agnoCatalogLoading}
                agentCatalogError={agnoCatalogError}
                llmModels={llmModels}
                llmModelsLoading={llmModelsLoading}
                llmModelsError={llmModelsError}
                defaultPort={defaultAgnoPort}
                sessionState={sessionSummary}
                sessionCount={agnoSessions.length}
                sessionLoading={agnoSessionsLoading}
                sessionError={agnoSessionsError}
                onSessionStateChange={handleToggleAllSessions}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
