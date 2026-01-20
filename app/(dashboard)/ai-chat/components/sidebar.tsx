"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Star, Archive, Search, MessageCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  isFavorite?: boolean;
  isArchived?: boolean;
}

interface SidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  activeTab: "playground" | "agents";
  onTabChange: (tab: "playground" | "agents") => void;
  agents?: Array<{
    id: string;
    description?: string;
    webhookUrl?: string | null;
    agentId?: string;
    enabled?: boolean;
    triggerType?: string;
    instanceName?: string | null;
  }>;
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  onNewAgent?: () => void;
  agentsLoading?: boolean;
}

export function Sidebar({
  chats,
  selectedChatId,
  onNewChat,
  onSelectChat,
  activeTab,
  onTabChange,
  agents,
  selectedAgentId,
  onSelectAgent,
  onNewAgent,
  agentsLoading
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [agentQuery, setAgentQuery] = useState("");
  const [chatFilter, setChatFilter] = useState<"all" | "favorite" | "archived">("all");

  const favoritesCount = chats.filter((chat) => chat.isFavorite).length;
  const archivedCount = chats.filter((chat) => chat.isArchived).length;

  const filteredChats = chats.filter((chat) => {
    const matchesSearch =
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.preview.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      chatFilter === "all"
        ? true
        : chatFilter === "favorite"
          ? !!chat.isFavorite
          : !!chat.isArchived;

    return matchesSearch && matchesFilter;
  });

  const filteredAgents = (agents || []).filter((agent) => {
    const title = agent.description || agent.agentId || agent.webhookUrl || "";
    return title.toLowerCase().includes(agentQuery.toLowerCase());
  });

  return (
    <div className="flex h-full w-80 flex-col overflow-hidden bg-gray-50">
      <div className="border-b border-gray-200 p-4">
        <ButtonGroup className="w-full">
          <Button
            variant={activeTab === "playground" ? "secondary" : "outline"}
            onClick={() => onTabChange("playground")}
            className="flex-1"
          >
            Playground
          </Button>
          <Button
            variant={activeTab === "agents" ? "secondary" : "outline"}
            onClick={() => onTabChange("agents")}
            className="flex-1"
          >
            Агенты
          </Button>
        </ButtonGroup>
      </div>

      {activeTab === "playground" ? (
        <>
          <div className="border-b border-gray-200 p-4">
            <Button
              onClick={onNewChat}
              className="w-full justify-start gap-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              variant="outline">
              <Plus className="h-4 w-4" />
              Новый чат
            </Button>
          </div>

          <div className="space-y-1 px-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={chatFilter === "all" ? "secondary" : "ghost"}
                className="w-full justify-between text-gray-700 px-3"
                onClick={() => setChatFilter("all")}>
                <MessageCircle className="h-4 w-4" />
                <span className="rounded-full bg-gray-200 px-2 py-1 text-xs">{chats.length}</span>
                <span className="sr-only">Все</span>
              </Button>
              <Button
                variant={chatFilter === "favorite" ? "secondary" : "ghost"}
                className="w-full justify-between text-gray-700 px-3"
                onClick={() => setChatFilter("favorite")}>
                <Star className="h-4 w-4" />
                <span className="rounded-full bg-gray-200 px-2 py-1 text-xs">{favoritesCount}</span>
                <span className="sr-only">Избранное</span>
              </Button>
              <Button
                variant={chatFilter === "archived" ? "secondary" : "ghost"}
                className="w-full justify-between text-gray-700 px-3"
                onClick={() => setChatFilter("archived")}>
                <Archive className="h-4 w-4" />
                <span className="rounded-full bg-gray-200 px-2 py-1 text-xs">{archivedCount}</span>
                <span className="sr-only">Архив</span>
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-4 py-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium tracking-wide text-gray-500 uppercase">
                  Недавние чаты
                </h3>
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <div className="relative">
                <Input
                  placeholder="Поиск по чатам..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
              <div className="space-y-1 pb-4">
                {filteredChats.length ? (
                  filteredChats.map((chat) => (
                    <Button
                      key={chat.id}
                      variant="ghost"
                      onClick={() => onSelectChat(chat.id)}
                      className={cn(
                        "h-auto w-full justify-start p-3 text-left hover:bg-gray-100",
                        selectedChatId === chat.id && "bg-gray-100"
                      )}>
                      <div className="flex w-full items-start gap-2">
                        <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-900">{chat.title}</div>
                          <div className="mt-0.5 line-clamp-2 break-words text-xs text-gray-500">
                            {chat.preview}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))
                ) : (
                  <div className="py-6 text-center text-sm text-gray-500">
                    Нет чатов по текущему фильтру
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-gray-200 p-4">
            <Button
              onClick={onNewAgent}
              className="w-full justify-start gap-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              variant="outline"
              disabled={!onNewAgent}
            >
              <Plus className="h-4 w-4" />
              Новый агент
            </Button>
          </div>
          <div className="px-4 py-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium tracking-wide text-gray-500 uppercase">
                Агенты
              </h3>
              <Bot className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              placeholder="Поиск по агентам..."
              value={agentQuery}
              onChange={(e) => setAgentQuery(e.target.value)}
              className="text-sm"
            />
          </div>
          <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
            <div className="space-y-1 pb-4">
              {agentsLoading ? (
                <div className="py-6 text-center text-sm text-gray-500">Загрузка…</div>
              ) : filteredAgents.length ? (
                filteredAgents.map((agent) => (
                  <Button
                    key={agent.id}
                    variant="ghost"
                    onClick={() => onSelectAgent?.(agent.id)}
                    className={cn(
                      "h-auto w-full justify-start p-3 text-left hover:bg-gray-100",
                      selectedAgentId === agent.id && "bg-gray-100"
                    )}
                  >
                    <div className="flex w-full items-start gap-2">
                      <Bot className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {agent.description || agent.agentId || agent.webhookUrl || "Без названия"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          <span>{agent.triggerType || "—"}</span>
                          {agent.instanceName ? <span>• {agent.instanceName}</span> : null}
                          <span>{agent.enabled ? "• активен" : "• выкл"}</span>
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-gray-500">
                  Нет агентов
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
