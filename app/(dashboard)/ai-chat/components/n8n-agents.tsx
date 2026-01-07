import { useEffect, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Save, Trash2, Plus, GripVertical } from "lucide-react";

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

type Props = {
  instanceName: string | null;
  instances: string[];
  agentMode: "idle" | "create" | "edit";
  form: N8nForm;
  onFormChange: (next: N8nForm) => void;
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
};

export function N8nAgents({
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
  selectedFunnelId,
  onSelectFunnel,
  onNewFunnel
}: Props) {
  const [activeTab, setActiveTab] = useState<"agent" | "funnels">("agent");
  const requiresTriggerValue = form.triggerType === "keyword" || form.triggerType === "advanced";
  const followUpEnabled = funnelForm.followUpEnable;
  const canSave =
    (!form.useCustomWebhook || Boolean(form.webhookUrl.trim())) &&
    (!requiresTriggerValue || Boolean(form.triggerValue.trim()));

  useEffect(() => {
    if (!canManageFunnel && activeTab !== "agent") {
      setActiveTab("agent");
    }
  }, [activeTab, canManageFunnel]);

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
    <div className="h-full overflow-auto bg-gradient-to-b from-muted/20 to-background p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
          <TabsList className={`grid w-full ${canManageFunnel ? "grid-cols-2" : "grid-cols-1"}`}>
            <TabsTrigger value="agent">Агент</TabsTrigger>
            {canManageFunnel ? <TabsTrigger value="funnels">Сценарий</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="agent" className="mt-4">
            <Card className="border-muted/60 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle>
                  {agentMode === "create"
                    ? "Новый агент"
                    : agentMode === "edit"
                    ? "Редактирование агента"
                    : "Агент"}
                </CardTitle>
                {agentMode === "idle" ? (
                  <div className="pt-2">
                    <Button onClick={onNewAgent} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Новый агент
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              {agentMode === "idle" ? null : (
                <CardContent className="space-y-4">
              <div className={`grid gap-3 ${funnels.length ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <div className="space-y-1">
                  <Label>Инстанс</Label>
                  <Select
                    value={form.instanceName}
                    onValueChange={(value) => onFormChange({ ...form, instanceName: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите инстанс" />
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
                <Label>Описание</Label>
                <Input
                  value={form.description}
                  onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                  placeholder="Например, обработка лидов"
                />
              </div>
              <div className="space-y-1">
                <Label>Промпт агента</Label>
                <Textarea
                  value={form.prompt}
                  onChange={(e) => onFormChange({ ...form, prompt: e.target.value })}
                  className="min-h-[120px]"
                  placeholder="Инструкция для агента при ответе"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  Использовать свой webhook
                  <Switch
                    checked={form.useCustomWebhook}
                    onCheckedChange={(checked) =>
                      onFormChange({
                        ...form,
                        useCustomWebhook: checked,
                        webhookUrl: checked ? form.webhookUrl : "",
                        basicAuthUser: checked ? form.basicAuthUser : "",
                        basicAuthPass: checked ? form.basicAuthPass : ""
                      })
                    }
                  />
                </label>
                {form.useCustomWebhook ? (
                  <div className="space-y-1">
                    <Label>Webhook URL *</Label>
                    <Input
                      value={form.webhookUrl}
                      onChange={(e) => onFormChange({ ...form, webhookUrl: e.target.value })}
                      placeholder="https://.../webhook"
                    />
                  </div>
                ) : null}
              </div>
              {form.useCustomWebhook ? (
                <div className="space-y-3">
                  <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    Авторизация Basic
                    <Switch
                      checked={Boolean(form.basicAuthUser || form.basicAuthPass)}
                      onCheckedChange={(checked) =>
                        onFormChange({
                          ...form,
                          basicAuthUser: checked ? form.basicAuthUser : "",
                          basicAuthPass: checked ? form.basicAuthPass : ""
                        })
                      }
                    />
                  </label>
                  {form.basicAuthUser || form.basicAuthPass ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Логин Basic Auth</Label>
                        <Input
                          value={form.basicAuthUser}
                          onChange={(e) => onFormChange({ ...form, basicAuthUser: e.target.value })}
                          placeholder="Логин"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Пароль Basic Auth</Label>
                        <Input
                          value={form.basicAuthPass}
                          onChange={(e) => onFormChange({ ...form, basicAuthPass: e.target.value })}
                          placeholder="Пароль"
                          type="password"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Соединить входящие (сек)</Label>
                  <Input
                    type="number"
                    value={form.debounceTime}
                    onChange={(e) => onFormChange({ ...form, debounceTime: e.target.value })}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">Склеивает сообщения пользователя, пришедшие подряд.</p>
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
                  Сообщение менеджера останавливет агента
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
                      onFormChange({ ...form, triggerType: value as N8nForm["triggerType"] })
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
                          onFormChange({ ...form, triggerOperator: value as N8nForm["triggerOperator"] })
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
              <Card className="border-muted/60 bg-white/80 shadow-sm">
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
                                    touches: [
                                      ...next[stageIndex].touches,
                                    { delayMin: "60", condition: "", conditionEnabled: false }
                                    ]
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
                    <Button
                      type="button"
                      onClick={onFunnelSave}
                      disabled={funnelSaving || funnelLoading}
                      className="gap-2"
                    >
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
        </Tabs>
      </div>
    </div>
  );
}
