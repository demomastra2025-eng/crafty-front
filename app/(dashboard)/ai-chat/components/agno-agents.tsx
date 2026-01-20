import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KnowledgeBase } from "@/app/(dashboard)/ai-chat/components/knowledge-base";
import { Loader2, Save, Trash2, Plus, GripVertical } from "lucide-react";

export type AgnoForm = {
  instanceName: string;
  enabled: boolean;
  description: string;
  prompt: string;
  agentId: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  providerModel: string;
  agnoPort: string;
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

export type LlmModelItem = {
  id: string;
  name: string;
  provider: string;
  model: string;
  type: string;
};

type Props = {
  instanceName: string | null;
  instances: string[];
  agentMode: "idle" | "create" | "edit";
  form: AgnoForm;
  onFormChange: (next: AgnoForm) => void;
  onSave: () => void;
  onDelete: () => void;
  onNewAgent: () => void;
  saving: boolean;
  error: string | null;
  funnels: Array<{
    id: string;
    name: string;
    goal: string;
    logic?: string | null;
    status?: string | null;
    stages?: Array<Record<string, unknown>>;
  }>;
  selectedFunnelId: string | null;
  onSelectFunnel: (id: string) => void;
  onNewFunnel: () => void;
  funnelMode: "idle" | "create" | "edit";
  funnelForm: {
    name: string;
    goal: string;
    logic: string;
    followUpEnable: boolean;
    status: "draft" | "active" | "archived";
    stages: Array<{
      title: string;
      objective: string;
      logicStage: string;
      commonTouchCondition: string;
      touches: Array<{ delayMin: string; condition: string; conditionEnabled: boolean }>;
    }>;
  };
  onFunnelFormChange: (next: {
    name: string;
    goal: string;
    logic: string;
    followUpEnable: boolean;
    status: "draft" | "active" | "archived";
    stages: Array<{
      title: string;
      objective: string;
      logicStage: string;
      commonTouchCondition: string;
      touches: Array<{ delayMin: string; condition: string; conditionEnabled: boolean }>;
    }>;
  }) => void;
  onFunnelSave: () => void;
  onFunnelDelete: () => void;
  funnelLoading: boolean;
  funnelSaving: boolean;
  funnelDeleting: boolean;
  funnelError: string | null;
  canManageFunnel: boolean;
  selectedAgentId?: string | null;
  selectedAgentInstance?: string | null;
  agentCatalog: AgnoAgentCatalogItem[];
  agentCatalogLoading: boolean;
  agentCatalogError: string | null;
  llmModels: LlmModelItem[];
  llmModelsLoading: boolean;
  llmModelsError: string | null;
  defaultPort?: number | null;
  sessionState: "on" | "off" | "mixed" | "empty";
  sessionCount: number;
  sessionLoading: boolean;
  sessionError: string | null;
  onSessionStateChange: (next: "on" | "off") => void;
};

export function AgnoAgents({
  instanceName,
  instances,
  agentMode,
  form,
  onFormChange,
  onSave,
  onDelete,
  onNewAgent,
  saving,
  error,
  funnels,
  funnelMode,
  funnelForm,
  onFunnelFormChange,
  onFunnelSave,
  onFunnelDelete,
  funnelLoading,
  funnelSaving,
  funnelDeleting,
  funnelError,
  canManageFunnel,
  selectedAgentId,
  selectedAgentInstance,
  selectedFunnelId,
  onSelectFunnel,
  onNewFunnel,
  agentCatalog,
  agentCatalogLoading,
  agentCatalogError,
  llmModels,
  llmModelsLoading,
  llmModelsError,
  defaultPort,
  sessionState,
  sessionCount,
  sessionLoading,
  sessionError,
  onSessionStateChange
}: Props) {
  const [activeTab, setActiveTab] = useState<"agent" | "funnels" | "knowledge">("agent");
  const requiresTriggerValue = form.triggerType === "keyword" || form.triggerType === "advanced";
  const followUpEnabled = funnelForm.followUpEnable;
  const canSave = !requiresTriggerValue || Boolean(form.triggerValue.trim());
  const hasSessions = sessionCount > 0;
  const sessionOn = sessionState === "on";
  const sessionOff = sessionState === "off";
  const sessionMixed = sessionState === "mixed";
  const webhookActive = form.webhookEnabled;
  const canManageKnowledge = agentMode === "edit" && Boolean(selectedAgentId);
  const parsedAgnoPort = Number(form.agnoPort);
  const resolvedAgnoPort =
    Number.isFinite(parsedAgnoPort) && parsedAgnoPort > 0 ? parsedAgnoPort : defaultPort ?? null;
  const selectedAgentValue =
    form.agentId && (form.agnoPort || defaultPort)
      ? `${form.agnoPort || defaultPort}::${form.agentId}`
      : form.agentId
      ? `::${form.agentId}`
      : "default";
  const visibleLlmModels = llmModels.filter((item) => {
    if (item.provider?.toLowerCase() === "openai") {
      return item.type === "text";
    }
    return true;
  });
  const groupedLlmModels = useMemo(() => {
    const map = new Map<string, LlmModelItem[]>();
    visibleLlmModels.forEach((item) => {
      const key = item.provider || "Другие";
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([provider, items]) => ({
      provider,
      items: items.sort((a, b) => (a.name || a.model).localeCompare(b.name || b.model))
    }));
  }, [visibleLlmModels]);

  useEffect(() => {
    if (!canManageFunnel && activeTab === "funnels") {
      setActiveTab("agent");
    }
    if (!canManageKnowledge && activeTab === "knowledge") {
      setActiveTab("agent");
    }
  }, [activeTab, canManageFunnel, canManageKnowledge]);

  const reorder = <T,>(list: T[], from: number, to: number) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const handleDragStart = (event: DragEvent, payload: Record<string, number | string>) => {
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDropStage = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { type: string; from: number };
      if (data.type !== "stage" || data.from === targetIndex) return;
      const next = reorder(funnelForm.stages, data.from, targetIndex);
      onFunnelFormChange({ ...funnelForm, stages: next });
    } catch {
      // ignore invalid payload
    }
  };

  const handleDropTouch = (event: DragEvent, stageIndex: number, targetIndex: number) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { type: string; stageIndex: number; touchIndex: number };
      if (data.type !== "touch" || data.stageIndex !== stageIndex || data.touchIndex === targetIndex) return;
      const nextStages = [...funnelForm.stages];
      const touches = reorder(nextStages[stageIndex].touches, data.touchIndex, targetIndex);
      nextStages[stageIndex] = { ...nextStages[stageIndex], touches };
      onFunnelFormChange({ ...funnelForm, stages: nextStages });
    } catch {
      // ignore invalid payload
    }
  };

  if (!instanceName) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Нет выбранного инстанса. Выберите в Connections.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Агенты</h2>
            <p className="text-sm text-gray-500">
              Настройка Agno-агентов и сценариев коммуникации.
            </p>
          </div>
          {agentMode === "idle" ? (
            <Button onClick={onNewAgent} className="gap-2">
              <Plus className="h-4 w-4" />
              Новый агент
            </Button>
          ) : null}
        </div>
      </div>
      <ScrollArea className="flex min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
            <TabsList
              className={`grid w-full ${
                canManageFunnel && canManageKnowledge
                  ? "grid-cols-3"
                  : canManageFunnel || canManageKnowledge
                    ? "grid-cols-2"
                    : "grid-cols-1"
              }`}
            >
              <TabsTrigger value="agent">Агент</TabsTrigger>
              {canManageFunnel ? <TabsTrigger value="funnels">Сценарий</TabsTrigger> : null}
              {canManageKnowledge ? <TabsTrigger value="knowledge">База знаний</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="agent" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {agentMode === "create"
                      ? "Новый агент"
                      : agentMode === "edit"
                      ? "Редактирование агента"
                      : "Агент"}
                  </CardTitle>
                </CardHeader>
                {agentMode === "idle" ? null : (
                  <CardContent className="space-y-4">
                  <div className={`grid gap-3 ${funnels.length ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                    <div className="space-y-1">
                      <Label>Канал подключения</Label>
                      <Select
                        value={form.instanceName}
                        onValueChange={(value) => onFormChange({ ...form, instanceName: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите канал" />
                        </SelectTrigger>
                        <SelectContent>
                          {instances.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Статус агента</Label>
                      <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        Активен
                        <Switch
                          checked={form.enabled}
                          onCheckedChange={(checked) => onFormChange({ ...form, enabled: checked })}
                        />
                      </label>
                    </div>
                    {funnels.length ? (
                      <div className="space-y-1">
                        <Label>Сценарий</Label>
                        <Select
                          value={form.funnelId || "none"}
                          onValueChange={(value) => onFormChange({ ...form, funnelId: value === "none" ? "" : value })}
                          disabled={funnelLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={funnelLoading ? "Загрузка..." : "Не выбрана"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Без Сценария</SelectItem>
                            {funnels.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Label>Все сессии</Label>
                    <ButtonGroup className="w-fit">
                      <Button
                        type="button"
                        variant={sessionOn ? "default" : "outline"}
                        disabled={!hasSessions || sessionLoading}
                        onClick={() => onSessionStateChange("on")}
                      >
                        Вкл
                      </Button>
                      <Button
                        type="button"
                        variant={sessionOff ? "default" : "outline"}
                        disabled={!hasSessions || sessionLoading}
                        onClick={() => onSessionStateChange("off")}
                      >
                        Выкл
                      </Button>
                      <Button
                        type="button"
                        variant={sessionMixed ? "default" : "outline"}
                        disabled
                      >
                        {sessionState === "empty" ? "Нет" : "Смешано"}
                      </Button>
                    </ButtonGroup>
                    <p className="text-xs text-muted-foreground">
                      {sessionLoading
                        ? "Обновляем статусы…"
                        : hasSessions
                        ? `Сессий: ${sessionCount}. При создании агента привязываем к инстансу.`
                        : "Сессий пока нет."}
                    </p>
                    {sessionError ? <p className="text-xs text-red-600">{sessionError}</p> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Шаблон агента</Label>
                      <Select
                        value={selectedAgentValue}
                        onValueChange={(value) => {
                          if (value === "default") {
                            onFormChange({ ...form, agentId: "", agnoPort: "" });
                            return;
                          }
                          const [portPart, ...agentParts] = value.split("::");
                          const agentId = agentParts.join("::");
                          onFormChange({
                            ...form,
                            agentId,
                            agnoPort: portPart || ""
                          });
                        }}
                        disabled={agentCatalogLoading}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={agentCatalogLoading ? "Загрузка..." : "Выберите агента"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">По умолчанию</SelectItem>
                          {agentCatalog.map((item) => {
                            const portLabel = item.port || defaultPort;
                            const value = `${portLabel ?? ""}::${item.id}`;
                            const label = item.name ? `${item.name} (${item.id})` : item.id;
                            return (
                              <SelectItem key={`${item.id}-${portLabel ?? "default"}`} value={value}>
                                {portLabel ? `${label} • ${portLabel}` : label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {agentCatalogError ? (
                        <p className="text-xs text-red-600">{agentCatalogError}</p>
                      ) : null}
                      {webhookActive ? (
                        <p className="text-xs text-muted-foreground">
                          При включенном webhook выбор агента и порта не обязателен.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label>LLM модель</Label>
                      <Select
                        value={form.providerModel || "none"}
                        onValueChange={(value) =>
                          onFormChange({ ...form, providerModel: value === "none" ? "" : value })
                        }
                        disabled={llmModelsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={llmModelsLoading ? "Загрузка..." : "Выберите модель"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Не выбрана</SelectItem>
                          {groupedLlmModels.map((group, index) => (
                            <div key={group.provider}>
                              <SelectGroup>
                                <SelectLabel>{group.provider}</SelectLabel>
                                {group.items.map((item) => {
                                  const value = `${item.provider}:${item.model}`;
                                  const label = item.name ? `${item.name} (${item.model})` : item.model;
                                  return (
                                    <SelectItem key={item.id} value={value}>
                                      {label}
                                    </SelectItem>
                                  );
                                })}
                              </SelectGroup>
                              {index < groupedLlmModels.length - 1 ? <SelectSeparator /> : null}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      {llmModelsError ? (
                        <p className="text-xs text-red-600">{llmModelsError}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      Использовать webhook
                      <Switch
                        checked={webhookActive}
                        onCheckedChange={(checked) =>
                          onFormChange({
                            ...form,
                            webhookEnabled: checked,
                            webhookUrl: checked ? form.webhookUrl : ""
                          })
                        }
                      />
                    </label>
                    {webhookActive ? (
                      <div className="space-y-1">
                        <Label>Webhook URL</Label>
                        <Input
                          value={form.webhookUrl}
                          onChange={(e) => onFormChange({ ...form, webhookUrl: e.target.value })}
                          placeholder="https://agno.example.com"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Label>Описание</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                      placeholder="Например, обработка лидов"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Промпт</Label>
                    <Textarea
                      value={form.prompt}
                      onChange={(e) => onFormChange({ ...form, prompt: e.target.value })}
                      placeholder="Инструкция для агента"
                      rows={4}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Соединить входящие (сек)</Label>
                      <Input
                        type="number"
                        value={form.debounceTime}
                        onChange={(e) => onFormChange({ ...form, debounceTime: e.target.value })}
                        placeholder="1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Склеивает сообщения пользователя, пришедшие подряд.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label>Задержка ответа (мс)</Label>
                      <Input
                        type="number"
                        value={form.delayMessage}
                        onChange={(e) => onFormChange({ ...form, delayMessage: e.target.value })}
                        placeholder="1000"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      Разбивать длинные сообщения
                      <Switch
                        checked={form.splitMessages}
                        onCheckedChange={(checked) => onFormChange({ ...form, splitMessages: checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      Сообщение менеджера останавливает агента
                      <Switch
                        checked={form.stopBotFromMe}
                        onCheckedChange={(checked) => onFormChange({ ...form, stopBotFromMe: checked })}
                      />
                    </label>
                  </div>
                  {form.splitMessages ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Время на символ (мс)</Label>
                        <Input
                          type="number"
                          value={form.timePerChar}
                          onChange={(e) => onFormChange({ ...form, timePerChar: e.target.value })}
                          placeholder="50"
                        />
                      </div>
                    </div>
                  ) : null}
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="advanced">
                      <AccordionTrigger>Дополнительные настройки</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Время сессии (сек)</Label>
                            <Input
                              type="number"
                              value={form.expire}
                              onChange={(e) => onFormChange({ ...form, expire: e.target.value })}
                              placeholder="300"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Ключевая фраза завершения</Label>
                            <Input
                              value={form.keywordFinish}
                              onChange={(e) => onFormChange({ ...form, keywordFinish: e.target.value })}
                              placeholder="пока"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Ответ на неизвестное</Label>
                            <Input
                              value={form.unknownMessage}
                              onChange={(e) => onFormChange({ ...form, unknownMessage: e.target.value })}
                              placeholder="Не понял запрос. Можете уточнить?"
                            />
                          </div>
                          <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            Слушать мои сообщения
                            <Switch
                              checked={form.listeningFromMe}
                              onCheckedChange={(checked) => onFormChange({ ...form, listeningFromMe: checked })}
                            />
                          </label>
                          <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            Держать сессию открытой
                            <Switch
                              checked={form.keepOpen}
                              onCheckedChange={(checked) => onFormChange({ ...form, keepOpen: checked })}
                            />
                          </label>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Игнорируемые номера (через запятую)</Label>
                            <Input
                              value={form.ignoreJids}
                              onChange={(e) => onFormChange({ ...form, ignoreJids: e.target.value })}
                              placeholder="77475318623, 77011234567"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Тип триггера *</Label>
                      <Select
                        value={form.triggerType}
                        onValueChange={(value) =>
                          onFormChange({ ...form, triggerType: value as AgnoForm["triggerType"] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Тип" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все сообщения</SelectItem>
                          <SelectItem value="keyword">Ключевое слово</SelectItem>
                          <SelectItem value="advanced">Регулярка</SelectItem>
                          <SelectItem value="none">Выключен</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.triggerType === "keyword" ? (
                      <>
                        <div className="space-y-1">
                          <Label>Оператор</Label>
                          <Select
                            value={form.triggerOperator}
                            onValueChange={(value) =>
                              onFormChange({ ...form, triggerOperator: value as AgnoForm["triggerOperator"] })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Оператор" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">содержит</SelectItem>
                              <SelectItem value="equals">равно</SelectItem>
                              <SelectItem value="startsWith">начинается</SelectItem>
                              <SelectItem value="endsWith">заканчивается</SelectItem>
                              <SelectItem value="regex">regex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-1">
                          <Label>Значение</Label>
                          <Input
                            value={form.triggerValue}
                            onChange={(e) => onFormChange({ ...form, triggerValue: e.target.value })}
                            placeholder="ключевое слово"
                          />
                        </div>
                      </>
                    ) : null}
                    {form.triggerType === "advanced" ? (
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Значение</Label>
                        <Input
                          value={form.triggerValue}
                          onChange={(e) => onFormChange({ ...form, triggerValue: e.target.value })}
                          placeholder="/regex/"
                        />
                      </div>
                    ) : null}
                  </div>
                  {error ? <div className="text-sm text-red-600">{error}</div> : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button onClick={onSave} disabled={!canSave || saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? "Сохраняем…" : "Сохранить"}
                    </Button>
                    {agentMode === "edit" ? (
                      <Button variant="outline" onClick={onDelete} className="gap-2 text-red-600">
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </Button>
                    ) : null}
                  </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>
          {canManageFunnel ? (
            <TabsContent value="funnels" className="mt-4">
              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Сценарий</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={onNewFunnel} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Новый сценарий
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Создайте этапы и касания, которые агент будет использовать как сценарий.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`grid gap-3 ${funnels.length ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                    {funnels.length ? (
                      <div className="space-y-1">
                        <Label>Сценарий</Label>
                        <Select
                          value={selectedFunnelId || ""}
                          onValueChange={(value) => onSelectFunnel(value)}
                          disabled={funnelLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={funnelLoading ? "Загрузка..." : "Выберите сценарий"} />
                          </SelectTrigger>
                          <SelectContent>
                            {funnels.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Название</Label>
                      <Input
                        value={funnelForm.name}
                        onChange={(e) => onFunnelFormChange({ ...funnelForm, name: e.target.value })}
                        placeholder="Продажа услуги"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Цель</Label>
                      <Input
                        value={funnelForm.goal}
                        onChange={(e) => onFunnelFormChange({ ...funnelForm, goal: e.target.value })}
                        placeholder="Закрыть сделку"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Статус</Label>
                      <Select
                        value={funnelForm.status}
                        onValueChange={(value) =>
                          onFunnelFormChange({ ...funnelForm, status: value as typeof funnelForm.status })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Черновик</SelectItem>
                          <SelectItem value="active">Активна</SelectItem>
                          <SelectItem value="archived">Архив</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      Дожим (follow-up)
                      <Switch
                        checked={funnelForm.followUpEnable}
                        onCheckedChange={(checked) =>
                          onFunnelFormChange({ ...funnelForm, followUpEnable: checked })
                        }
                      />
                    </label>
                    <div className="space-y-1">
                      <Label>Логика</Label>
                      <Input
                        value={funnelForm.logic}
                        onChange={(e) => onFunnelFormChange({ ...funnelForm, logic: e.target.value })}
                        placeholder="Кратко опишите общий сценарий"
                      />
                      <p className="text-xs text-muted-foreground">
                        Видно агенту и интеграции, помогает понять общий план общения.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {funnelForm.stages.map((stage, stageIndex) => (
                      <div
                        key={`stage-${stageIndex}`}
                        className="rounded-md border p-3"
                        draggable
                        onDragStart={(event) => handleDragStart(event, { type: "stage", from: stageIndex })}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDropStage(event, stageIndex)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Этап {stageIndex + 1}</div>
                          {funnelForm.stages.length > 1 ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const next = funnelForm.stages.filter((_, idx) => idx !== stageIndex);
                                onFunnelFormChange({ ...funnelForm, stages: next });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Название этапа</Label>
                            <Input
                              value={stage.title}
                              onChange={(e) => {
                                const next = [...funnelForm.stages];
                                next[stageIndex] = { ...stage, title: e.target.value };
                                onFunnelFormChange({ ...funnelForm, stages: next });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Цель этапа</Label>
                            <Input
                              value={stage.objective}
                              onChange={(e) => {
                                const next = [...funnelForm.stages];
                                next[stageIndex] = { ...stage, objective: e.target.value };
                                onFunnelFormChange({ ...funnelForm, stages: next });
                              }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Логика этапа</Label>
                            <Input
                              value={stage.logicStage}
                              onChange={(e) => {
                                const next = [...funnelForm.stages];
                                next[stageIndex] = { ...stage, logicStage: e.target.value };
                                onFunnelFormChange({ ...funnelForm, stages: next });
                              }}
                              placeholder="Что важно сказать/сделать на этом этапе"
                            />
                          </div>
                          {followUpEnabled ? (
                            <div className="space-y-1">
                              <Label>Условия касаний по этапу</Label>
                              <Input
                                value={stage.commonTouchCondition}
                                onChange={(e) => {
                                  const next = [...funnelForm.stages];
                                  next[stageIndex] = { ...stage, commonTouchCondition: e.target.value };
                                  onFunnelFormChange({ ...funnelForm, stages: next });
                                }}
                                placeholder="Например: нет ответа 24 часа"
                              />
                            </div>
                          ) : null}
                        </div>
                        {followUpEnabled ? (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">Касания</div>
                            {stage.touches.map((touch, touchIndex) => (
                              <div
                                key={`touch-${stageIndex}-${touchIndex}`}
                                className="cursor-grab rounded-md border border-dashed bg-muted/20 p-3 active:cursor-grabbing"
                                draggable
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  handleDragStart(event, {
                                    type: "touch",
                                    stageIndex,
                                    touchIndex
                                  });
                                }}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => handleDropTouch(event, stageIndex, touchIndex)}
                              >
                                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                  <span>Касание {touchIndex + 1}</span>
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                                  <div className="space-y-1">
                                    <Label>Через (мин)</Label>
                                    <Input
                                      type="number"
                                      value={touch.delayMin}
                                      onChange={(e) => {
                                        const next = [...funnelForm.stages];
                                        const touches = [...next[stageIndex].touches];
                                        touches[touchIndex] = { ...touch, delayMin: e.target.value };
                                        next[stageIndex] = { ...next[stageIndex], touches };
                                        onFunnelFormChange({ ...funnelForm, stages: next });
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Условие</Label>
                                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                      Включить условие
                                      <Switch
                                        checked={touch.conditionEnabled}
                                        onCheckedChange={(checked) => {
                                          const next = [...funnelForm.stages];
                                          const touches = [...next[stageIndex].touches];
                                          touches[touchIndex] = {
                                            ...touch,
                                            conditionEnabled: checked,
                                            condition: checked ? touch.condition : ""
                                          };
                                          next[stageIndex] = { ...next[stageIndex], touches };
                                          onFunnelFormChange({ ...funnelForm, stages: next });
                                        }}
                                      />
                                    </div>
                                    {touch.conditionEnabled ? (
                                      <Input
                                        value={touch.condition}
                                        onChange={(e) => {
                                          const next = [...funnelForm.stages];
                                          const touches = [...next[stageIndex].touches];
                                          touches[touchIndex] = { ...touch, condition: e.target.value };
                                          next[stageIndex] = { ...next[stageIndex], touches };
                                          onFunnelFormChange({ ...funnelForm, stages: next });
                                        }}
                                        placeholder="Например: клиент не ответил"
                                      />
                                    ) : null}
                                  </div>
                                  <div className="flex items-end justify-end pb-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-600"
                                      onClick={() => {
                                        if (stage.touches.length === 1) return;
                                        const next = [...funnelForm.stages];
                                        const touches = next[stageIndex].touches.filter((_, idx) => idx !== touchIndex);
                                        next[stageIndex] = { ...next[stageIndex], touches };
                                        onFunnelFormChange({ ...funnelForm, stages: next });
                                      }}
                                      disabled={stage.touches.length === 1}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                  const next = [...funnelForm.stages];
                                  next[stageIndex] = {
                                    ...next[stageIndex],
                                    touches: [...next[stageIndex].touches, { delayMin: "60", condition: "", conditionEnabled: false }]
                                  };
                                  onFunnelFormChange({ ...funnelForm, stages: next });
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Добавить касание
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-md border border-dashed bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                            Включите дожим, чтобы добавлять касания и условия.
                          </div>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        onFunnelFormChange({
                          ...funnelForm,
                          stages: [
                            ...funnelForm.stages,
                            {
                              title: "Новый этап",
                              objective: "",
                              logicStage: "",
                              commonTouchCondition: "",
                              touches: [{ delayMin: "60", condition: "", conditionEnabled: false }]
                            }
                          ]
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Добавить этап
                    </Button>
                  </div>
                  {funnelError ? <div className="text-sm text-red-600">{funnelError}</div> : null}
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                      Перетаскивайте этапы и касания для сортировки.
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button type="button" onClick={onFunnelSave} disabled={funnelSaving || funnelLoading} className="gap-2">
                      {funnelSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {funnelSaving ? "Сохраняем…" : "Сохранить"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onFunnelDelete}
                      className="gap-2 text-red-600"
                      disabled={!selectedFunnelId || funnelDeleting || funnelLoading}
                    >
                      {funnelDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Удалить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
          {canManageKnowledge ? (
            <TabsContent value="knowledge" className="mt-4">
              <KnowledgeBase
                agentId={selectedAgentId}
                instanceName={selectedAgentInstance || form.instanceName || null}
                port={resolvedAgnoPort}
                defaultPort={defaultPort}
              />
            </TabsContent>
          ) : null}
        </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
