"use client";

import { Search } from "lucide-react";
import { LuArchive, LuMessageSquare, LuMessagesSquare } from "react-icons/lu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isActive: boolean;
  status: string;
  remoteJid: string;
  labels?: Array<{
    labelId: string;
    name: string;
    color?: string | null;
  }>;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation?: Conversation | null;
  loading?: boolean;
  searchTerm: string;
  onSearch: (value: string) => void;
  selectedTab: "chats" | "groups" | "archive";
  onTabChange: (tab: "chats" | "groups" | "archive") => void;
  chatsCount: number;
  groupsCount: number;
  onSelectConversation: (conversation: Conversation) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore?: boolean;
}

export function ConversationList({
  conversations,
  selectedConversation,
  loading,
  searchTerm,
  onSearch,
  selectedTab,
  onTabChange,
  chatsCount,
  groupsCount,
  onSelectConversation,
  onLoadMore,
  hasMore,
  loadingMore
}: ConversationListProps) {
  const labelColorClass = (color?: string | null) => {
    switch ((color || "").trim()) {
      case "1":
        return "bg-blue-100 text-blue-800";
      case "2":
        return "bg-green-100 text-green-800";
      case "3":
        return "bg-yellow-100 text-yellow-800";
      case "4":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex w-80 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <h1 className="mb-4 text-xl font-semibold text-gray-900">Чаты</h1>
          <div className="h-9 rounded-md bg-gray-100" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-16 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-80 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => onTabChange("chats")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${
              selectedTab === "chats"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-700"
            }`}>
            <LuMessageSquare className="mx-auto h-4 w-4" />
          </button>
          <button
            onClick={() => onTabChange("groups")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${
              selectedTab === "groups"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-700"
            }`}>
            <LuMessagesSquare className="mx-auto h-4 w-4" />
          </button>
          <button
            onClick={() => onTabChange("archive")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${
              selectedTab === "archive"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-700"
            }`}>
            <LuArchive className="mx-auto h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <Input
            placeholder="Поиск по сообщениям..."
            className="border-gray-200 bg-gray-50 pl-10"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Нет чатов</div>
        ) : (
          conversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={`cursor-pointer border-b border-gray-100 px-3 py-2.5 transition-colors hover:bg-gray-50 ${
              selectedConversation?.id === conversation.id
                ? "border-l-4 border-l-blue-500 bg-blue-50"
                : ""
            }`}>
            <div className="flex items-center space-x-3">
              <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={conversation.avatar}
                      alt={conversation.name}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      {conversation.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  {conversation.isActive && (
                    <div className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-green-500"></div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate text-sm font-medium text-gray-900">
                      {conversation.name}
                    </h3>
                    <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-600">
                    {conversation.lastMessage || "Нет сообщений"}
                  </p>
                  {conversation.labels?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {conversation.labels.slice(0, 3).map((label) => (
                        <Badge
                          key={label.labelId}
                          variant="secondary"
                          className={`text-[10px] ${labelColorClass(label.color)}`}>
                          {label.name || label.labelId}
                        </Badge>
                      ))}
                      {conversation.labels.length > 3 && (
                        <span className="text-[10px] text-gray-500">
                          +{conversation.labels.length - 3}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>

                {conversation.unreadCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 rounded-full bg-orange-400 px-1 text-[10px] font-semibold leading-none text-white">
                    {conversation.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-gray-100 p-2">
        <button
          onClick={onLoadMore}
          disabled={!hasMore || loadingMore}
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
          {loadingMore ? "Загрузка..." : hasMore ? "Еще 20 чатов" : "Все чаты загружены"}
        </button>
      </div>
    </div>
  );
}
