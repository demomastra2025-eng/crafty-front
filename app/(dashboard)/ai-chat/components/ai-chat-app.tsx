"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getEvoSocket } from "@/lib/evo-socket";
import { Sidebar } from "@/app/(dashboard)/ai-chat/components/sidebar";
import { useChat } from "@ai-sdk/react";
import { WelcomeScreen } from "@/app/(dashboard)/ai-chat/components/welcome-screen";
import { ChatInterface } from "@/app/(dashboard)/ai-chat/components/chat-interface";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { N8nAgents } from "@/app/(dashboard)/ai-chat/components/n8n-agents";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  createN8nBot,
  deleteN8nBot,
  fetchInstances,
  fetchFunnels,
  getApiKey,
  fetchN8nBots,
  readPreferredInstance,
  setPreferredInstance,
  updateN8nBot,
  createFunnel,
  updateFunnel,
  deleteFunnel
} from "@/lib/evo-api";

type N8nAgent = {
  id: string;
  enabled?: boolean;
  description?: string;
  prompt?: string;
  webhookUrl?: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
  triggerType?: string;
  triggerOperator?: string | null;
  triggerValue?: string | null;
  funnelId?: string | null;
  updatedAt?: string;
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

type N8nForm = {
  instanceName: string;
  enabled: boolean;
  description: string;
  webhookUrl: string;
  useCustomWebhook: boolean;
  basicAuthUser: string;
  basicAuthPass: string;
  prompt: string;
  triggerType: "all" | "keyword" | "advanced" | "none";
  triggerOperator: "equals" | "contains" | "startsWith" | "endsWith" | "regex";
  triggerValue: string;
  funnelId: string;
  expire: string;
  keywordFinish: string;
  delayMessage: string;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: string;
  ignoreJids: string;
  splitMessages: boolean;
  timePerChar: string;
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

const defaultAgentForm: N8nForm = {
  instanceName: "",
  enabled: false,
  description: "",
  webhookUrl: "",
  useCustomWebhook: false,
  basicAuthUser: "",
  basicAuthPass: "",
  prompt: "",
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

  const [n8nInstanceName, setN8nInstanceName] = useState<string | null>(null);
  const [n8nInstances, setN8nInstances] = useState<string[]>([]);
  const [n8nAgents, setN8nAgents] = useState<N8nAgent[]>([]);
  const [n8nLoading, setN8nLoading] = useState(false);
  const [n8nSaving, setN8nSaving] = useState(false);
  const [n8nError, setN8nError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentInstance, setSelectedAgentInstance] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<"idle" | "create" | "edit">("idle");
  const [agentForm, setAgentForm] = useState<N8nForm>(defaultAgentForm);
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
  const showInstancesAlert = Boolean(apiKey) && n8nInstances.length === 0;

  const loadAgents = useCallback(async (instanceNames: string[]) => {
    if (!instanceNames.length) {
      setN8nAgents([]);
      return;
    }
    setN8nLoading(true);
    try {
      const results = await Promise.all(
        instanceNames.map(async (instanceName) => {
          try {
            const data = await fetchN8nBots(instanceName);
            const list = Array.isArray(data) ? data : [];
            return list.map((agent: N8nAgent) => ({ ...agent, instanceName }));
          } catch {
            return [];
          }
        })
      );
      setN8nAgents(results.flat());
    } finally {
      setN8nLoading(false);
    }
  }, []);

  const refreshInstances = useCallback(async () => {
    if (!apiKey) {
      setN8nInstances([]);
      setN8nInstanceName(null);
      return;
    }
    try {
      const list = await fetchInstances();
      const names = list.map((item) => item.instanceName).filter(Boolean);
      setN8nInstances(names);
      const nextInstance =
        n8nInstanceName && names.includes(n8nInstanceName) ? n8nInstanceName : names[0] || null;
      if (nextInstance !== n8nInstanceName) {
        setN8nInstanceName(nextInstance);
        setPreferredInstance(nextInstance ? { name: nextInstance } : null);
      }
      if (activeTab === "agents" && names.length) {
        loadAgents(names);
      }
    } catch (err) {
      console.warn("Ошибка обновления инстансов", err);
      setN8nInstances([]);
      setN8nInstanceName(null);
    }
  }, [activeTab, apiKey, loadAgents, n8nInstanceName]);

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
      setN8nInstances([]);
      setN8nInstanceName(null);
      return;
    }
    const preferred = readPreferredInstance()?.name || null;
    fetchInstances()
      .then((list) => {
        const names = list.map((item) => item.instanceName).filter(Boolean);
        setN8nInstances(names);
        const fallback = preferred && names.includes(preferred) ? preferred : names[0] || null;
        setN8nInstanceName(fallback);
        setPreferredInstance(fallback ? { name: fallback } : null);
      })
      .catch(() => {
        setN8nInstances([]);
        setN8nInstanceName(null);
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
      setN8nInstances([]);
      setN8nInstanceName(null);
      setPreferredInstance(null);
    };
    window.addEventListener("crafty:apikey-changed", handler as EventListener);
    return () => {
      window.removeEventListener("crafty:apikey-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "agents") return;
    if (!n8nInstances.length) return;
    loadAgents(n8nInstances);
    if (n8nInstanceName) {
      loadFunnels(n8nInstanceName);
    }
  }, [activeTab, n8nInstanceName, n8nInstances, loadFunnels]);

  useEffect(() => {
    setSelectedFunnelId(null);
    setFunnelMode("idle");
    setFunnelForm(defaultFunnelForm);
    setFunnelError(null);
  }, [n8nInstanceName]);

  const handleSelectAgent = (agentId: string) => {
    const found = n8nAgents.find((agent) => agent.id === agentId);
    if (!found) return;
    setSelectedAgentId(agentId);
    setSelectedAgentInstance(found.instanceName || null);
    setAgentMode("edit");
    setAgentForm({
      instanceName: found.instanceName || n8nInstanceName || "",
      enabled: found.enabled ?? true,
      description: found.description || "",
      webhookUrl: found.webhookUrl || "",
      useCustomWebhook: Boolean(found.webhookUrl),
      basicAuthUser: found.basicAuthUser || "",
      basicAuthPass: found.basicAuthPass || "",
      prompt: found.prompt || "",
      triggerType: (found.triggerType as N8nForm["triggerType"]) || "all",
      triggerOperator: (found.triggerOperator as N8nForm["triggerOperator"]) || "contains",
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
    setN8nError(null);
  };

  const handleNewAgent = () => {
    setSelectedAgentId(null);
    setSelectedAgentInstance(null);
    setAgentMode("create");
    setAgentForm({
      ...defaultAgentForm,
      instanceName: n8nInstanceName || ""
    });
    setN8nError(null);
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
    if (!n8nInstanceName) return;
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
        await updateFunnel(n8nInstanceName, selectedFunnelId, {
          name: funnelForm.name.trim(),
          goal: funnelForm.goal.trim(),
          logic: funnelForm.logic.trim() || undefined,
          followUpEnable: funnelForm.followUpEnable,
          status: funnelForm.status,
          stages
        });
      } else {
        const created = await createFunnel(n8nInstanceName, {
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
      loadFunnels(n8nInstanceName);
    } catch (err) {
      setFunnelError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setFunnelSaving(false);
    }
  };

  const handleSaveAgent = async () => {
    if (!agentForm.instanceName) return;
    setN8nSaving(true);
    setN8nError(null);
    const parseNumber = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? undefined : parsed;
    };
    const ignoreJids = agentForm.ignoreJids
      .split(",")
      .map((item) => toIgnoreJidValue(item))
      .filter(Boolean);
    const payload: Record<string, unknown> = {
      enabled: agentForm.enabled,
      description: agentForm.description || undefined,
      webhookUrl: agentForm.useCustomWebhook ? agentForm.webhookUrl : null,
      basicAuthUser: agentForm.useCustomWebhook ? agentForm.basicAuthUser || undefined : undefined,
      basicAuthPass: agentForm.useCustomWebhook ? agentForm.basicAuthPass || undefined : undefined,
      prompt: agentForm.prompt || undefined,
      triggerType: agentForm.triggerType,
      triggerOperator: agentForm.triggerType === "keyword" ? agentForm.triggerOperator : undefined,
      triggerValue:
        agentForm.triggerType === "keyword" || agentForm.triggerType === "advanced"
          ? agentForm.triggerValue
          : undefined,
      funnelId: agentForm.funnelId || null,
      expire: parseNumber(agentForm.expire),
      keywordFinish: agentForm.keywordFinish || undefined,
      delayMessage: parseNumber(agentForm.delayMessage),
      unknownMessage: agentForm.unknownMessage || undefined,
      listeningFromMe: agentForm.listeningFromMe,
      stopBotFromMe: agentForm.stopBotFromMe,
      keepOpen: agentForm.keepOpen,
      debounceTime: parseNumber(agentForm.debounceTime),
      ignoreJids: ignoreJids.length ? ignoreJids : undefined,
      splitMessages: agentForm.splitMessages,
      timePerChar: parseNumber(agentForm.timePerChar)
    };
    try {
      if (agentMode === "edit" && selectedAgentId) {
        if (selectedAgentInstance && selectedAgentInstance !== agentForm.instanceName) {
          const created = await createN8nBot(agentForm.instanceName, payload);
          await deleteN8nBot(selectedAgentInstance, selectedAgentId);
          if (created?.id) {
            setSelectedAgentId(created.id);
            setSelectedAgentInstance(agentForm.instanceName);
            setAgentMode("edit");
          } else {
            setSelectedAgentId(null);
            setSelectedAgentInstance(null);
            setAgentMode("idle");
          }
        } else {
          await updateN8nBot(agentForm.instanceName, selectedAgentId, payload);
        }
      } else {
        const created = await createN8nBot(agentForm.instanceName, payload);
        if (created?.id) {
          setSelectedAgentId(created.id);
          setSelectedAgentInstance(agentForm.instanceName);
          setAgentMode("edit");
        }
      }
      loadAgents(n8nInstances);
    } catch (err) {
      setN8nError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setN8nSaving(false);
    }
  };

  const handleDeleteFunnel = async () => {
    if (!n8nInstanceName || !selectedFunnelId) return;
    if (!window.confirm("Удалить сценарий? Если она используется в follow-up, удаление будет заблокировано.")) {
      return;
    }
    setFunnelDeleting(true);
    setFunnelError(null);
    try {
      await deleteFunnel(n8nInstanceName, selectedFunnelId);
      setSelectedFunnelId(null);
      setFunnelMode("idle");
      setFunnelForm(defaultFunnelForm);
      loadFunnels(n8nInstanceName);
    } catch (err) {
      setFunnelError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setFunnelDeleting(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgentInstance || !selectedAgentId) return;
    const ok = window.confirm("Удалить агента n8n?");
    if (!ok) return;
    try {
      await deleteN8nBot(selectedAgentInstance, selectedAgentId);
      setSelectedAgentId(null);
      setSelectedAgentInstance(null);
      setAgentMode("idle");
      setAgentForm(defaultAgentForm);
      loadAgents(n8nInstances);
    } catch (err) {
      setN8nError(err instanceof Error ? err.message : "Не удалось удалить");
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
            agents={n8nAgents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleSelectAgent}
            onNewAgent={handleNewAgent}
            agentsLoading={n8nLoading}
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
              <N8nAgents
                instanceName={n8nInstanceName}
                instances={n8nInstances}
                agentMode={agentMode}
                form={agentForm}
                onFormChange={(next) => setAgentForm(next)}
                onSave={handleSaveAgent}
                onDelete={handleDeleteAgent}
                saving={n8nSaving}
                error={n8nError}
                onNewAgent={handleNewAgent}
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
                canManageFunnel={agentMode === "edit" && Boolean(selectedAgentId)}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
