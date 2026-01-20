"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getEvoSocket } from "@/lib/evo-socket";
import {
  fetchChats,
  fetchContacts,
  fetchIntegrationSession,
  fetchInstances,
  fetchLabels,
  fetchMessages,
  updateChatUnread,
  updateMessagesStatus
} from "@/lib/db-api";
import { ConversationList } from "@/app/(dashboard)/chats/component/conversation-list";
import { ChatArea } from "@/app/(dashboard)/chats/component/chat-area";
import { UserProfile } from "@/app/(dashboard)/chats/component/user-profile";
import {
  changeAgnoStatus,
  emitAgnoLastMessage,
  fetchAgnoSessions,
  sendTextMessage,
  resolveInstance,
  handleLabel,
  markChatAsRead,
  fetchConnectionState,
  sendMedia,
  sendMediaFile,
  connectInstance,
  updateMessage,
  readPreferredInstance,
  setPreferredInstance,
  getApiKey
} from "@/lib/evo-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeWithTz } from "@/lib/timezone";

type MessageKey = {
  id?: string | null;
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  participant?: string | null;
  fromMe?: boolean | null;
};

type FileLength = number | { low?: number; high?: number; unsigned?: boolean };

type MediaMessage = {
  url?: string;
  directPath?: string;
  caption?: string;
  fileName?: string;
  mimetype?: string;
  fileLength?: FileLength | null;
};

type MessageContent = {
  conversation?: string;
  extendedTextMessage?: { text?: string | null };
  imageMessage?: MediaMessage;
  videoMessage?: MediaMessage;
  documentMessage?: MediaMessage;
  audioMessage?: MediaMessage;
  mediaUrl?: string | null;
};

type MessageRow = {
  id: string;
  key?: MessageKey | null;
  message?: MessageContent | null;
  messageType?: string | null;
  messageTimestamp?: number | null;
  pushName?: string | null;
  status?: string | null;
  source?: string | null;
  author?: string | null;
  chatId?: string | null;
  labels?: string | null;
  instanceId?: string | null;
  sessionId?: string | null;
};

type MessageUpdateRow = {
  messageId?: string;
  keyId?: string | null;
  remoteJid?: string | null;
  status?: string | null;
  instanceId?: string | null;
};

type ChatRow = {
  id: string;
  remoteJid: string;
  name?: string | null;
  unreadMessages?: number | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  instanceId: string;
  labels?: string | null;
  // is_ai column отсутствует в текущей схеме БД
};

type Conversation = {
  id: string;
  remoteJid: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  lastMessageTs?: number;
  lastSource?: string;
  unreadCount: number;
  isActive: boolean;
  status: string;
  labels?: LabelTag[];
  instanceId?: string;
  isAi?: boolean;
};

type Message = {
  id: string;
  senderId: string;
  participant?: string;
  content: string;
  timestamp: string;
  timestampMs?: number;
  source?: string;
  author?: string;
  isOwn: boolean;
  status?: string;
  keyId?: string;
  attachments?: Attachment[];
  sessionId?: string | null;
};

type IntegrationSessionRow = {
  id: string;
  sessionId: string;
  remoteJid: string;
  status: "opened" | "paused" | "closed";
  botId?: string | null;
  type?: string | null;
};

type BotSessionRow = {
  id: string;
  remoteJid: string;
  status: "opened" | "paused" | "closed";
  botId?: string | null;
  type?: string | null;
};

type Attachment = {
  type: "image" | "video" | "document" | "audio";
  url?: string;
  name?: string;
  caption?: string;
  mimetype?: string;
  sizeBytes?: number;
};

type Contact = {
  remoteJid: string;
  pushName?: string | null;
  profilePicUrl?: string | null;
};

type InstanceStatus = {
  id: string;
  connectionStatus: string;
  instanceId?: string | null;
  instanceName?: string | null;
  name?: string | null;
};

type QrCodePayload = {
  instance?: string;
  data?: { qrcode?: { instance?: string; base64?: string | null } | null } | null;
  qrcode?: { instance?: string; base64?: string | null } | null;
};

type LabelRow = {
  labelId: string;
  name?: string | null;
  color?: string | null;
  instanceId?: string | null;
};

type LabelTag = {
  labelId: string;
  name: string;
  color?: string | null;
};

const fallbackAvatar = "/logo.png";

function formatTimestampFromSeconds(seconds?: number | null) {
  if (!seconds) return "";
  return formatDateTimeWithTz(seconds * 1000);
}

function extractText(message?: MessageContent | null) {
  if (!message) return "";
  return (
    message.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  );
}

function extractAttachments(
  message?: MessageContent | null,
  opts?: { allowMmg?: boolean; allowMmgForDocuments?: boolean }
) {
  const attachments: Attachment[] = [];
  if (!message) return attachments;
  const mediaUrl = message.mediaUrl ?? undefined;
  const normalizeUrl = (value?: string | null, allowMmgOverride = false) => {
    if (!value) return undefined;
    // Ссылки mmg.whatsapp.net без авторизации обычно не грузятся в браузере. Для исходящих сообщений
    // оставляем их, чтобы показать превью, иначе прячем. Для документов разрешаем всегда.
    if (value.includes("mmg.whatsapp.net") && !(opts?.allowMmg || allowMmgOverride)) return undefined;
    if (value.startsWith("/")) return undefined;
    return value;
  };
  const parseFileLength = (input?: FileLength | null) => {
    if (!input) return undefined;
    if (typeof input === "number") return input;
    const low = input.low || 0;
    const high = input.high || 0;
    return high ? high * 2 ** 32 + low : low;
  };

  if (message.imageMessage) {
    attachments.push({
      type: "image",
      url:
        normalizeUrl(mediaUrl) ||
        normalizeUrl(message.imageMessage.url) ||
        normalizeUrl(message.imageMessage.directPath),
      caption: message.imageMessage.caption,
      name: message.imageMessage.fileName,
      mimetype: message.imageMessage.mimetype,
      sizeBytes: parseFileLength(message.imageMessage.fileLength)
    });
  }

  if (message.videoMessage) {
    attachments.push({
      type: "video",
      url:
        normalizeUrl(mediaUrl) ||
        normalizeUrl(message.videoMessage.url) ||
        normalizeUrl(message.videoMessage.directPath),
      caption: message.videoMessage.caption,
      name: message.videoMessage.fileName,
      mimetype: message.videoMessage.mimetype,
      sizeBytes: parseFileLength(message.videoMessage.fileLength)
    });
  }

  if (message.documentMessage) {
    attachments.push({
      type: "document",
      url:
        normalizeUrl(mediaUrl, opts?.allowMmgForDocuments) ||
        normalizeUrl(message.documentMessage.url, opts?.allowMmgForDocuments) ||
        normalizeUrl(message.documentMessage.directPath, opts?.allowMmgForDocuments),
      name: message.documentMessage.fileName,
      mimetype: message.documentMessage.mimetype,
      sizeBytes: parseFileLength(message.documentMessage.fileLength)
    });
  }

  if (message.audioMessage) {
    attachments.push({
      type: "audio",
      url:
        normalizeUrl(mediaUrl) ||
        normalizeUrl(message.audioMessage.url) ||
        normalizeUrl(message.audioMessage.directPath),
      name: message.audioMessage.fileName,
      mimetype: message.audioMessage.mimetype,
      sizeBytes: parseFileLength(message.audioMessage.fileLength)
    });
  }

  return attachments;
}

function friendlySource(src?: string | null) {
  if (!src) return "";
  const normalized = src.toLowerCase();
  if (normalized === "unknown") return "mobile app";
  return src;
}

function sortConversationsByTime(list: Conversation[]) {
  return [...list].sort((a, b) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0));
}

const stripWhatsappSuffix = (value?: string | null) =>
  (value || "").replace(/@s\.whatsapp\.net$/, "");

const resolveRemoteJid = (key?: MessageKey | null): string | null => {
  if (!key) return null;
  const primary = key.remoteJid || null;
  const alt = key.remoteJidAlt || null;
  if (primary && !primary.includes("@lid")) return primary;
  if (alt && !alt.includes("@lid")) return alt;
  return primary || alt || null;
};

const isUnreadStatus = (status?: string | null) =>
  (status || "").toUpperCase() === "DELIVERY_ACK";

const statusRank = (status?: string | null) => {
  switch ((status || "").toUpperCase()) {
    case "PENDING":
      return 0;
    case "SERVER_ACK":
      return 1;
    case "DELIVERY_ACK":
      return 2;
    case "READ":
      return 3;
    default:
      return -1;
  }
};

function parseLabels(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // not JSON, fallback to comma-separated
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function findLatestSessionId(rows: MessageRow[]): string | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const sessionId = rows[i]?.sessionId;
    if (sessionId) return sessionId;
  }
  return null;
}

const CHAT_PAGE_SIZE = 20;

export default function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const [contactByRemote, setContactByRemote] = useState<Record<string, Contact>>({});
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, string>>({});
  const [instanceNames, setInstanceNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [preferredInstanceId, setPreferredInstanceId] = useState<string | null>(null);
  const [tab, setTab] = useState<"chats" | "groups" | "archive">("chats");
  const [labelsById, setLabelsById] = useState<Record<string, LabelTag>>({});
  const [chatPage, setChatPage] = useState(0);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const availableLabels = useMemo(() => Object.values(labelsById), [labelsById]);
  const searchParams = useSearchParams();
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrInstance, setQrInstance] = useState<string | null>(null);
  const { toast } = useToast();
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey());
  const [botMeta, setBotMeta] = useState<IntegrationSessionRow | null>(null);
  const [botSession, setBotSession] = useState<BotSessionRow | null>(null);
  const [botSessionId, setBotSessionId] = useState<string | null>(null);
  const [botTogglePending, setBotTogglePending] = useState(false);
  const selectedConversationRef = useRef<Conversation | null>(null);
  const instanceNameRef = useRef<string | null>(null);
  const preferredInstanceIdRef = useRef<string | null>(null);
  const qrInstanceRef = useRef<string | null>(null);
  const debouncedSearchRef = useRef<string>("");
  const loadChatsRef = useRef(loadChats);
  const instanceNameToIdRef = useRef<Record<string, string>>({});
  const contactByRemoteRef = useRef<Record<string, Contact>>({});
  const instanceStatusesRef = useRef<Record<string, string>>({});
  const labelsByIdRef = useRef<Record<string, LabelTag>>({});
  const skipUnreadIncrementRef = useRef<Record<string, boolean>>({});
  const messagesRef = useRef<Message[]>([]);

  const hasApiKey = Boolean(apiKey);
  const hasInstances = Object.keys(instanceNames).length > 0;
  const showAlertType =
    !hasApiKey
      ? "apikey"
      : !loadingChats && !loadingMoreChats && !hasInstances
        ? "instances"
        : !loadingChats && !loadingMoreChats && hasInstances && !instanceName && !preferredInstanceId
          ? "selection"
          : null;

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    instanceNameRef.current = instanceName;
  }, [instanceName]);

  useEffect(() => {
    preferredInstanceIdRef.current = preferredInstanceId;
  }, [preferredInstanceId]);

  useEffect(() => {
    qrInstanceRef.current = qrInstance;
  }, [qrInstance]);

  useEffect(() => {
    debouncedSearchRef.current = debouncedSearch;
  }, [debouncedSearch]);

  useEffect(() => {
    contactByRemoteRef.current = contactByRemote;
  }, [contactByRemote]);

  useEffect(() => {
    instanceStatusesRef.current = instanceStatuses;
  }, [instanceStatuses]);

  useEffect(() => {
    labelsByIdRef.current = labelsById;
  }, [labelsById]);

  useEffect(() => {
    loadChatsRef.current = loadChats;
  }, [loadChats]);

  useEffect(() => {
    const saved = readPreferredInstance();
    if (saved?.name) setInstanceName(saved.name);
    if (saved?.id) setPreferredInstanceId(saved.id);
    loadChats(saved?.name || null, saved?.id || null, { search: debouncedSearch });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string | null>)?.detail ?? null;
      const nextKey = detail ?? getApiKey();
      setApiKeyState(nextKey);
      setInstanceName(null);
      setPreferredInstanceId(null);
      setSelectedConversation(null);
      setMessages([]);
      setBotMeta(null);
      setBotSession(null);
      setBotSessionId(null);
      setQrData(null);
      setQrInstance(null);
      if (!nextKey) {
        return;
      }
      loadChatsRef.current(null, null, { search: debouncedSearchRef.current });
    };
    window.addEventListener("crafty:apikey-changed", handler as EventListener);
    return () => {
      window.removeEventListener("crafty:apikey-changed", handler as EventListener);
    };
  }, [toast]);

  useEffect(() => {
    if (instanceName) return;
    if (!apiKey) return;
    resolveInstance()
      .then((name) => setInstanceName((prev) => prev || name))
      .catch((err) => {
        console.error("Не удалось получить instanceName:", err);
        setInstanceName(null);
      });
  }, [apiKey, instanceName]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!instanceName && !preferredInstanceId) return;
    loadChats(instanceName || null, preferredInstanceId, { search: debouncedSearch });
  }, [instanceName, preferredInstanceId, debouncedSearch]);

  useEffect(() => {
    const instId = selectedConversation?.instanceId;
    const instName = instId ? instanceNames[instId] : null;
    if (!instId || !instName) return;

    let cancelled = false;
    const pollState = async () => {
      try {
        const res = await fetchConnectionState(instName);
        const state = res?.instance?.state as string | undefined;
        if (!cancelled && state) {
          setInstanceStatuses((prev) => ({ ...prev, [instId]: state }));
        }
      } catch (err) {
        console.warn("connectionState poll failed", err);
      }
    };

    pollState();
    const interval = setInterval(pollState, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedConversation?.instanceId, instanceNames]);

  const currentUser = useMemo(
    () =>
      selectedConversation
        ? {
            id: selectedConversation.remoteJid,
            name: stripWhatsappSuffix(selectedConversation.name),
            avatar: selectedConversation.avatar || fallbackAvatar,
            status: selectedConversation.status || "Онлайн",
            bio: "",
            email: selectedConversation.remoteJid,
            phone: selectedConversation.remoteJid.replace("@s.whatsapp.net", ""),
            location: "Казахстан",
            sharedFiles: [],
            labels: selectedConversation.labels || []
          }
        : null,
    [selectedConversation]
  );

  async function loadChats(
    preferredInstanceName?: string | null,
    preferredInstanceId?: string | null,
    opts?: { page?: number; append?: boolean; search?: string; preserve?: boolean }
  ) {
    const page = opts?.page ?? 0;
    const append = opts?.append ?? false;
    const preserve = opts?.preserve ?? false;
    const searchTerm = (opts?.search || "").trim();
    const from = page * CHAT_PAGE_SIZE;
    const to = from + CHAT_PAGE_SIZE - 1;
    const setLoadingFn = append ? setLoadingMoreChats : setLoadingChats;
    setChatPage(page);
    if (!append && page === 0 && !preserve) {
      setConversations([]);
      setHasMoreChats(true);
    }
    setLoadingFn(true);
    try {
      const currentKey = apiKey || getApiKey();
      if (!currentKey) {
        return;
      }
      let chatRows: ChatRow[] = [];
      let contactRows: Contact[] = [];
      let instances: InstanceStatus[] = [];
      let labelRows: LabelRow[] = [];
      try {
        const [chatsRes, contactsRes, instancesRes, labelsRes] = await Promise.all([
          fetchChats({
            instanceId: preferredInstanceId || undefined,
            page,
            pageSize: CHAT_PAGE_SIZE,
            search: searchTerm || undefined
          }),
          fetchContacts(preferredInstanceId),
          fetchInstances(),
          fetchLabels(preferredInstanceId)
        ]);
        chatRows = (chatsRes.chats || []) as ChatRow[];
        contactRows = (contactsRes.contacts || []) as Contact[];
        instances = (instancesRes.instances || []) as InstanceStatus[];
        labelRows = (labelsRes.labels || []) as LabelRow[];
      } catch (err) {
        console.error("Ошибка загрузки чатов:", err);
        return;
      }

      const remoteJids = (chatRows || [])
        .map((row) => (row as ChatRow).remoteJid)
        .filter(Boolean);
      let recentMessages: MessageRow[] = [];
      if (remoteJids.length) {
        try {
          const { messages: messageRows } = await fetchMessages({
            instanceId: preferredInstanceId || undefined,
            remoteJids,
            limit: Math.max(remoteJids.length * 3, CHAT_PAGE_SIZE),
            order: "desc"
          });
          recentMessages = (messageRows || []) as MessageRow[];
        } catch (err) {
          console.error("Ошибка загрузки сообщений:", err);
        }
      }

      const contactMap: Record<string, Contact> = {};
      (contactRows || []).forEach((c) => {
        const contact = c as Contact;
        contactMap[contact.remoteJid] = contact;
      });
      setContactByRemote(contactMap);

      const instanceMap: Record<string, string> = {};
      const instanceNameMap: Record<string, string> = {};
      const instanceNameToId: Record<string, string> = {};
      (instances || []).forEach((i) => {
        const id = i.id || i.instanceId || i.instanceName || i.name;
        if (!id) return;
        const name = i.instanceName || i.name || null;
        instanceMap[id] = i.connectionStatus;
        if (name) {
          instanceNameMap[id] = name;
          instanceNameToId[name] = id;
        }
      });
      setInstanceStatuses(instanceMap);
      setInstanceNames(instanceNameMap);
      instanceNameToIdRef.current = instanceNameToId;
      const targetInstanceId =
        (preferredInstanceName && instanceNameToId[preferredInstanceName]) ||
        (instanceName && instanceNameToId[instanceName]) ||
        preferredInstanceId ||
        null;
      const fallbackInstance =
        instances.find((i) => i.connectionStatus === "open") ||
        instances[0] ||
        null;
      const fallbackId =
        (fallbackInstance as { id?: string; instanceId?: string; instanceName?: string; name?: string })?.id ||
        (fallbackInstance as { instanceId?: string })?.instanceId ||
        (fallbackInstance as { instanceName?: string })?.instanceName ||
        (fallbackInstance as { name?: string })?.name ||
        null;
      const resolvedInstanceId = targetInstanceId || fallbackId;
      if (resolvedInstanceId && resolvedInstanceId !== preferredInstanceId) {
        const resolvedName =
          instanceNameMap[resolvedInstanceId] ||
          (fallbackInstance as { instanceName?: string; name?: string })?.instanceName ||
          (fallbackInstance as { name?: string })?.name ||
          null;
        setPreferredInstanceId(resolvedInstanceId);
        setPreferredInstance({ id: resolvedInstanceId, name: resolvedName });
        if (!instanceName && resolvedName) {
          setInstanceName(resolvedName);
        }
      }

      const labelMap: Record<string, LabelTag> = {};
      (labelRows || []).forEach((l) => {
        const lbl = l as LabelRow;
        if (!lbl.labelId) return;
        labelMap[lbl.labelId] = {
          labelId: lbl.labelId,
          name: lbl.name || lbl.labelId,
          color: lbl.color
        };
      });
      setLabelsById(labelMap);

      const lastMessageByRemote: Record<string, MessageRow> = {};
      const lastIncomingByRemote: Record<string, MessageRow> = {};
      (recentMessages || []).forEach((m) => {
        const msg = m as MessageRow;
        const remote = msg.key?.remoteJid || msg.key?.remoteJidAlt;
        if (!remote) return;
        if (!lastMessageByRemote[remote]) {
          lastMessageByRemote[remote] = msg;
        }
        if (msg.key?.fromMe === false && !lastIncomingByRemote[remote]) {
          lastIncomingByRemote[remote] = msg;
        }
      });

      const filteredChats = (chatRows || []).filter((chat) => {
        if (!targetInstanceId) return true;
        return (chat as ChatRow).instanceId === targetInstanceId;
      });

      const mapped: Conversation[] = filteredChats.reduce<Conversation[]>((acc, chat) => {
        const chatRow = chat as ChatRow;
        const remote = chatRow.remoteJid || "";
        if (!remote) return acc;
        const contact = contactMap[remote];
        const lastMsg = lastMessageByRemote[remote];
        const lastIncoming = lastIncomingByRemote[remote];
        const lastText = extractText(lastMsg?.message);
        const lastTs = lastMsg?.messageTimestamp
          ? lastMsg.messageTimestamp * 1000
          : chatRow.updatedAt
            ? Date.parse(chatRow.updatedAt)
            : 0;
        const tsString = lastMsg?.messageTimestamp
          ? formatTimestampFromSeconds(lastMsg.messageTimestamp)
          : chatRow.updatedAt
            ? formatDateTimeWithTz(chatRow.updatedAt)
            : "";
        const status =
          instanceMap[chatRow.instanceId] === "open"
            ? "Онлайн"
            : instanceMap[chatRow.instanceId]
              ? "Оффлайн"
              : contact?.pushName
                ? "На связи"
                : "Не в сети";
        const parsedLabels = parseLabels(chatRow.labels).map(
          (id) => labelMap[id] || { labelId: id, name: id }
        );
        const rawName = chatRow.name || contact?.pushName || chatRow.remoteJid;
        const cleanName = stripWhatsappSuffix(rawName) || "Неизвестный контакт";

        acc.push({
          id: chatRow.id,
          remoteJid: remote,
          name: cleanName,
          avatar: contact?.profilePicUrl || fallbackAvatar,
          lastMessage: lastText || "Нет сообщений",
          timestamp: tsString,
          lastMessageTs: lastTs,
          lastSource: friendlySource(lastIncoming?.source || lastMsg?.source),
          unreadCount: chatRow.unreadMessages ?? 0,
          isActive: false,
          status,
          labels: parsedLabels,
          instanceId: chatRow.instanceId,
          // is_ai column отсутствует в текущей схеме БД
          isAi: false
        });
        return acc;
      }, []);

      const sorted = sortConversationsByTime(mapped);
      if (!preserve) {
        setHasMoreChats(filteredChats.length === CHAT_PAGE_SIZE);
        setChatPage(page);
      }
      setConversations((prev) => {
        const merged = append || preserve ? [...prev, ...sorted] : sorted;
        const dedupedById: Record<string, Conversation> = {};
        merged.forEach((item) => {
          const key = item.id || item.remoteJid;
          if (!key) return;
          const existing = dedupedById[key];
          if (!existing || (item.lastMessageTs || 0) > (existing.lastMessageTs || 0)) {
            dedupedById[key] = item;
          }
        });
        return sortConversationsByTime(Object.values(dedupedById));
      });
      if (!append) {
        const paramJid = searchParams?.get("jid");
        setSelectedConversation((prev) => {
          const hasPrev = sorted.some((c) => prev && c.remoteJid === prev.remoteJid);
          if (prev && hasPrev) return prev;
          const found = paramJid ? sorted.find((c) => c.remoteJid === paramJid) : null;
          return found || sorted[0] || null;
        });
      }
    } finally {
      setLoadingFn(false);
      if (!append) {
        setLoadingMoreChats(false);
      }
    }
  }

  const loadMessagesForConversation = useCallback(
    async (conversation: Conversation | null) => {
      if (!conversation) {
        setMessages([]);
        setBotMeta(null);
        setBotSession(null);
        setBotSessionId(null);
        return;
      }

      const remoteJid = conversation.remoteJid;
      const targetInstanceId = conversation.instanceId || preferredInstanceIdRef.current || null;
      setBotMeta(null);
      setBotSession(null);
      setBotSessionId(null);

      try {
        const { messages: data } = await fetchMessages({
          instanceId: targetInstanceId,
          remoteJid,
          limit: 50,
          order: "desc"
        });
        const messageRows = (data || []) as MessageRow[];
        setHasMoreMessages(messageRows.length >= 50);
        setLoadingOlderMessages(false);
        const mappedMessages: Message[] = messageRows.map((row) => mapMessageRow(row));
        mappedMessages.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
        setMessages(mappedMessages);
        setBotSessionId(findLatestSessionId(messageRows));
      } catch (err) {
        console.error("Ошибка загрузки сообщений:", err);
        setMessages([]);
        setBotSession(null);
        setBotSessionId(null);
      }
    },
    []
  );

  const loadOlderMessages = useCallback(async () => {
    const conversation = selectedConversationRef.current;
    if (!conversation || loadingOlderMessages || !hasMoreMessages) return;
    const currentMessages = messagesRef.current;
    const oldest = currentMessages[0];
    if (!oldest?.timestampMs) return;
    const remoteJid = conversation.remoteJid;
    const targetInstanceId = conversation.instanceId || preferredInstanceIdRef.current || null;

    setLoadingOlderMessages(true);
    try {
      const { messages: data } = await fetchMessages({
        instanceId: targetInstanceId,
        remoteJid,
        limit: 50,
        order: "desc",
        before: Math.floor(oldest.timestampMs / 1000)
      });
      const messageRows = (data || []) as MessageRow[];
      if (messageRows.length === 0) {
        setHasMoreMessages(false);
        return;
      }
      if (messageRows.length < 50) {
        setHasMoreMessages(false);
      }
      const mappedMessages: Message[] = messageRows.map((row) => mapMessageRow(row));
      mappedMessages.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
      setMessages((prev) => {
        const merged = [...mappedMessages, ...prev];
        const deduped: Record<string, Message> = {};
        merged.forEach((msg) => {
          const key = msg.keyId || msg.id;
          if (!key) return;
          if (!deduped[key] || (msg.timestampMs || 0) < (deduped[key].timestampMs || 0)) {
            deduped[key] = msg;
          }
        });
        return Object.values(deduped).sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
      });
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [hasMoreMessages, loadingOlderMessages]);

  useEffect(() => {
    loadMessagesForConversation(selectedConversation);
  }, [selectedConversation, loadMessagesForConversation]);

  useEffect(() => {
    if (!botSessionId) {
      setBotMeta(null);
      return;
    }

    let cancelled = false;
    const loadSession = async () => {
      try {
        const { session } = await fetchIntegrationSession(botSessionId);
        if (!cancelled) {
          const next = (session as IntegrationSessionRow | null) || null;
          setBotMeta(next && next.type === "agno" ? next : null);
        }
      } catch (err) {
        console.warn("Ошибка загрузки сессии бота:", err);
        if (!cancelled) setBotMeta(null);
      }
    };

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [botSessionId]);

  useEffect(() => {
    const remoteJid = selectedConversation?.remoteJid;
    const instId = selectedConversation?.instanceId;
    const instName = instId ? instanceNames[instId] : null;
    const botId = botMeta?.botId || null;
    const botType = botMeta?.type || null;
    if (!remoteJid || !instName || !botId || botType !== "agno") {
      setBotSession(null);
      return;
    }

    let cancelled = false;
    const loadBotSession = async () => {
      try {
        const sessions = (await fetchAgnoSessions(instName, botId, remoteJid)) as BotSessionRow[];
        const match = sessions.find((s) => s.remoteJid === remoteJid) || null;
        if (!cancelled) setBotSession(match);
      } catch (err) {
        console.warn("Ошибка загрузки статуса бота:", err);
        if (!cancelled) setBotSession(null);
      }
    };

    loadBotSession();
    return () => {
      cancelled = true;
    };
  }, [botMeta?.botId, botMeta?.type, instanceNames, selectedConversation?.instanceId, selectedConversation?.remoteJid]);

  useEffect(() => {
    const socket = getEvoSocket(apiKey);
    if (!socket) return;
    const handleConnectError = (err: unknown) => {
      console.warn("socket connect_error", err);
    };
    const handleDisconnect = (reason: string) => {
      console.warn("socket disconnected", reason);
    };
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);

    const updateConversationFromMessage = (data: MessageRow, message: Message) => {
      const remote = resolveRemoteJid(data.key);
      if (!remote) return;
      const contacts = contactByRemoteRef.current;
      const statuses = instanceStatusesRef.current;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.remoteJid === remote);
        const baseUnread = prev[idx]?.unreadCount || 0;
        const shouldIncrement = !message.isOwn && isUnreadStatus(message.status);
        let nextUnread = baseUnread;
        if (shouldIncrement) {
          if (skipUnreadIncrementRef.current[remote]) {
            delete skipUnreadIncrementRef.current[remote];
          } else {
            nextUnread = baseUnread + 1;
          }
        }
        const base: Conversation = {
          id: prev[idx]?.id || remote,
          remoteJid: remote,
          name: stripWhatsappSuffix(
            prev[idx]?.name || contacts[remote]?.pushName || data.pushName || remote
          ),
          avatar: contacts[remote]?.profilePicUrl || prev[idx]?.avatar || fallbackAvatar,
          lastMessage: message.content,
          timestamp: message.timestamp,
          lastMessageTs: message.timestampMs,
          lastSource: message.source,
          unreadCount: nextUnread,
          isActive: false,
          status:
            data.instanceId && statuses[data.instanceId]
              ? statuses[data.instanceId] === "open"
                ? "Онлайн"
                : "Не в сети"
              : prev[idx]?.status || "Неизвестно",
          labels: prev[idx]?.labels || [],
          instanceId: data.instanceId || prev[idx]?.instanceId,
          isAi: prev[idx]?.isAi
        };

        if (idx === -1) {
          return sortConversationsByTime([base, ...prev]);
        }
        const next = [...prev];
        next.splice(idx, 1);
        return sortConversationsByTime([base, ...next]);
      });
    };

    const handleConnect = () => {
      loadChatsRef.current(
        instanceNameRef.current || null,
        preferredInstanceIdRef.current || null,
        { search: debouncedSearchRef.current, preserve: true }
      );
      loadMessagesForConversation(selectedConversationRef.current);
    };
    socket.on("connect", handleConnect);

    const handleQrUpdated = (payload: QrCodePayload) => {
      const instance =
        payload?.instance ||
        payload?.data?.qrcode?.instance ||
        payload?.qrcode?.instance;
      if (!instance || instance !== qrInstanceRef.current) return;
      const qrcode =
        payload?.data?.qrcode?.base64 ||
        payload?.qrcode?.base64 ||
        null;
      if (qrcode) {
        setQrData(qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`);
      }
    };
    socket.on("qrcode.updated", handleQrUpdated);

    const handleMessagesUpsert = (payload: { data?: MessageRow }) => {
      const data = payload?.data;
      if (!data?.key) return;
      const remote = resolveRemoteJid(data.key);
      if (!remote) return;
      const message = mapMessageRow(data);
      const current = selectedConversationRef.current;
      updateConversationFromMessage(data, message);
      if (current && current.remoteJid === remote) {
        if (message.sessionId) {
          setBotSessionId(message.sessionId);
        }
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              (message.id && m.id === message.id) ||
              (message.keyId && m.keyId === message.keyId)
          );
          if (exists) return prev;
          const next = [...prev, message];
          next.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
          return next;
        });
        // mediaUrl приходит в payload, дополнительных запросов не требуется
      }
    };
    socket.on("messages.upsert", handleMessagesUpsert);

    const handleSendMessage = (payload: {
      data?: Partial<MessageRow> & { key?: MessageKey; messageId?: string };
    }) => {
      const data = payload?.data;
      if (!data?.key) return;
      const remote = resolveRemoteJid(data.key);
      if (!remote) return;
      const normalized: MessageRow = {
        id: data.messageId || data.key?.id || `local-${Date.now()}`,
        key: data.key || null,
        message: data.message || null,
        messageType: data.messageType || null,
        messageTimestamp: data.messageTimestamp || null,
        pushName: data.pushName || null,
        status: data.status || null,
        source: data.source || null,
        author: data.author || null,
        instanceId: data.instanceId || null,
        sessionId: data.sessionId || null
      };
      const message = mapMessageRow(normalized);
      const current = selectedConversationRef.current;
      updateConversationFromMessage(normalized, message);
      if (current && current.remoteJid === remote) {
        if (message.sessionId) {
          setBotSessionId(message.sessionId);
        }
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              (message.id && m.id === message.id) ||
              (message.keyId && m.keyId === message.keyId)
          );
          if (exists) return prev;
          const next = [...prev, message];
          next.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
          return next;
        });
      }
    };
    socket.on("send.message", handleSendMessage);

    const handleMessagesUpdate = (payload: { data?: MessageUpdateRow }) => {
      const data = payload?.data;
      if (!data?.messageId && !data?.keyId) return;
      const remote = data.remoteJid || null;
      let delta = 0;
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          const match =
            (data.messageId && m.id === data.messageId) ||
            (data.keyId && m.keyId === data.keyId);
          if (!match) return m;
          const prevStatus = m.status || null;
          const nextStatus = data.status || m.status;
          const prevRank = statusRank(prevStatus);
          const nextRank = statusRank(nextStatus);
          if (prevRank >= 0 && nextRank >= 0 && nextRank < prevRank) {
            return m;
          }
          if (prevStatus !== nextStatus) {
            changed = true;
            if (!m.isOwn && remote) {
              const wasUnread = isUnreadStatus(prevStatus);
              const nowUnread = isUnreadStatus(nextStatus);
              if (wasUnread !== nowUnread) {
                delta += nowUnread ? 1 : -1;
              }
            }
          }
          return { ...m, status: nextStatus };
        });
        return changed ? next : prev;
      });
      if (remote && delta !== 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.remoteJid === remote
              ? { ...c, unreadCount: Math.max(0, (c.unreadCount || 0) + delta) }
              : c
          )
        );
      }
    };
    socket.on("messages.update", handleMessagesUpdate);

    const handleMessagesDelete = (payload: { data?: { id?: string; key?: { id?: string } } }) => {
      const id = payload?.data?.id;
      const keyId = payload?.data?.key?.id;
      if (!id && !keyId) return;
      const current = selectedConversationRef.current;
      let delta = 0;
      setMessages((prev) =>
        prev.filter((m) => {
          const match =
            (id && m.id === id) ||
            (keyId && m.keyId === keyId);
          if (match && !m.isOwn && isUnreadStatus(m.status) && current?.remoteJid) {
            delta -= 1;
          }
          return !match;
        })
      );
      if (delta !== 0 && current?.remoteJid) {
        setConversations((prev) =>
          prev.map((c) =>
            c.remoteJid === current.remoteJid
              ? { ...c, unreadCount: Math.max(0, (c.unreadCount || 0) + delta) }
              : c
          )
        );
      }
    };
    socket.on("messages.delete", handleMessagesDelete);

    const handleChatsUpsert = (payload: {
      data?: Array<{ remoteJid: string; instanceId: string; unreadMessages?: number }>;
    }) => {
      const rows = payload?.data || [];
      if (!rows.length) return;
      const contacts = contactByRemoteRef.current;
      const statuses = instanceStatusesRef.current;
      rows.forEach((row) => {
        if (typeof row.unreadMessages === "number") {
          skipUnreadIncrementRef.current[row.remoteJid] = true;
        }
      });
      setConversations((prev) => {
        const next = [...prev];
        rows.forEach((row) => {
          const idx = next.findIndex((c) => c.remoteJid === row.remoteJid);
          if (idx === -1) {
            next.unshift({
              id: row.remoteJid,
              remoteJid: row.remoteJid,
              name: stripWhatsappSuffix(contacts[row.remoteJid]?.pushName || row.remoteJid),
              avatar: contacts[row.remoteJid]?.profilePicUrl || fallbackAvatar,
              lastMessage: "",
              timestamp: "",
              lastMessageTs: 0,
              lastSource: "",
              unreadCount: row.unreadMessages ?? 0,
              isActive: false,
              status: statuses[row.instanceId] === "open" ? "Онлайн" : "Не в сети",
              labels: [],
              instanceId: row.instanceId,
              isAi: false
            });
          } else {
            next[idx] = {
              ...next[idx],
              unreadCount: row.unreadMessages ?? next[idx].unreadCount,
              instanceId: row.instanceId || next[idx].instanceId
            };
          }
        });
        return sortConversationsByTime(next);
      });
    };
    socket.on("chats.upsert", handleChatsUpsert);

    const handleChatsUpdate = (payload: {
      data?: Array<{ remoteJid: string; instanceId: string; unreadMessages?: number }>;
    }) => {
      const rows = payload?.data || [];
      if (!rows.length) return;
      rows.forEach((row) => {
        if (typeof row.unreadMessages === "number") {
          skipUnreadIncrementRef.current[row.remoteJid] = true;
        }
      });
      setConversations((prev) => {
        const next = [...prev];
        rows.forEach((row) => {
          const idx = next.findIndex((c) => c.remoteJid === row.remoteJid);
          if (idx === -1) return;
          next[idx] = {
            ...next[idx],
            unreadCount: row.unreadMessages ?? next[idx].unreadCount,
            instanceId: row.instanceId || next[idx].instanceId
          };
        });
        return sortConversationsByTime(next);
      });
    };
    socket.on("chats.update", handleChatsUpdate);

    const handleChatsDelete = (payload: { data?: string[] }) => {
      const rows = payload?.data || [];
      if (!rows.length) return;
      setConversations((prev) => prev.filter((c) => !rows.includes(c.remoteJid)));
    };
    socket.on("chats.delete", handleChatsDelete);

    const handleContactsUpdate = (payload: { data?: Contact | Contact[] }) => {
      const data = payload?.data;
      const items = Array.isArray(data) ? data : data ? [data] : [];
      if (!items.length) return;
      setContactByRemote((prev) => {
        const next = { ...prev };
        items.forEach((c) => {
          if (!c.remoteJid) return;
          next[c.remoteJid] = { ...next[c.remoteJid], ...c };
        });
        return next;
      });
      setConversations((prev) =>
        prev.map((c) => {
          const updated = items.find((i) => i.remoteJid === c.remoteJid);
          if (!updated) return c;
          return {
            ...c,
            name: stripWhatsappSuffix(updated.pushName || c.name),
            avatar: updated.profilePicUrl || c.avatar
          };
        })
      );
    };
    socket.on("contacts.update", handleContactsUpdate);

    const handleLabelsEdit = (payload: {
      data?: { id?: string; name?: string; color?: string; deleted?: boolean };
    }) => {
      const data = payload?.data;
      if (!data?.id) return;
      setLabelsById((prev) => {
        if (data.deleted) {
          const next = { ...prev };
          delete next[data.id as string];
          return next;
        }
        return {
          ...prev,
          [data.id as string]: {
            labelId: data.id as string,
            name: data.name || data.id || "Label",
            color: data.color || null
          }
        };
      });
    };
    socket.on("labels.edit", handleLabelsEdit);

    const handleLabelsAssociation = (payload: {
      data?: { chatId?: string; labelId?: string; type?: "add" | "remove" };
    }) => {
      const data = payload?.data;
      if (!data?.chatId || !data.labelId) return;
      const labels = labelsByIdRef.current;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.remoteJid !== data.chatId) return c;
          const existing = c.labels?.map((l) => l.labelId) || [];
          const nextIds =
            data.type === "add"
              ? Array.from(new Set([...existing, data.labelId]))
              : existing.filter((id) => id !== data.labelId);
          const nextLabels = nextIds.map((id) => labels[id as string] || { labelId: id, name: id });
          return { ...c, labels: nextLabels };
        })
      );
    };
    socket.on("labels.association", handleLabelsAssociation);

    const handleConnectionUpdate = (payload: {
      instance?: string;
      data?: { instance?: string; state?: string };
    }) => {
      const name = payload?.instance || payload?.data?.instance;
      const state = payload?.data?.state;
      if (!name || !state) return;
      const id = instanceNameToIdRef.current[name];
      if (!id) return;
      setInstanceStatuses((prev) => ({ ...prev, [id]: state }));
    };
    socket.on("connection.update", handleConnectionUpdate);

    const refreshInstances = () => {
      loadChatsRef.current(
        instanceNameRef.current || null,
        preferredInstanceIdRef.current || null,
        { search: debouncedSearchRef.current, preserve: true }
      );
    };

    socket.on("instance.create", refreshInstances);
    socket.on("instance.delete", refreshInstances);
    socket.on("status.instance", refreshInstances);

    return () => {
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect", handleConnect);
      socket.off("qrcode.updated", handleQrUpdated);
      socket.off("messages.upsert", handleMessagesUpsert);
      socket.off("send.message", handleSendMessage);
      socket.off("messages.update", handleMessagesUpdate);
      socket.off("messages.delete", handleMessagesDelete);
      socket.off("chats.upsert", handleChatsUpsert);
      socket.off("chats.update", handleChatsUpdate);
      socket.off("chats.delete", handleChatsDelete);
      socket.off("contacts.update", handleContactsUpdate);
      socket.off("labels.edit", handleLabelsEdit);
      socket.off("labels.association", handleLabelsAssociation);
      socket.off("connection.update", handleConnectionUpdate);
      socket.off("instance.create", refreshInstances);
      socket.off("instance.delete", refreshInstances);
      socket.off("status.instance", refreshInstances);
    };
  }, [apiKey, loadMessagesForConversation]);

  async function markConversationAsRead(conversation?: Conversation | null) {
    if (!conversation) return;
    const remoteJid = conversation.remoteJid;
    if (!remoteJid) return;
    setConversations((prev) =>
      prev.map((c) => (c.remoteJid === remoteJid ? { ...c, unreadCount: 0 } : c))
    );
    try {
      const instFromConversation = conversation.instanceId
        ? instanceNames[conversation.instanceId]
        : null;
      const preferred = readPreferredInstance();
      const preferredName = preferred?.name || null;
      let inst = instFromConversation || instanceName || preferredName;
      if (!inst) inst = await resolveInstance();
      if (inst) setInstanceName(inst);
      if (inst) {
        await markChatAsRead(inst, { remoteJid, readMessages: true });
      }
    } catch (err) {
      console.warn("Не удалось пометить прочитанным через API", err);
    }
  }

  useEffect(() => {
    // Авто-пометка прочитанного убрана: делать вручную по действию
  }, [selectedConversation]);

  function mapMessageRow(m: MessageRow, mediaAttachments?: Attachment[]): Message {
    const fromMe = m.key?.fromMe === true;
    const author = m.author || (fromMe ? "owner" : "client");
    const fromPayload = extractAttachments(m.message, {
      allowMmg: fromMe,
      allowMmgForDocuments: true
    });
    const mergedAttachments: Attachment[] = [...fromPayload, ...(mediaAttachments || [])];
    const dedupedAttachments = (() => {
      const byType: Record<string, Attachment> = {};
      mergedAttachments.forEach((att) => {
        const key = att.type;
        const existing = byType[key];
        // Пропускаем медиавложения без ссылки, если есть альтернатива с ссылкой
        if (existing) {
          const hasUrl = Boolean(att.url);
          const existingHasUrl = Boolean(existing.url);
          if (!existingHasUrl && hasUrl) {
            byType[key] = att;
          } else if (existingHasUrl && hasUrl && !existing.caption && att.caption) {
            byType[key] = { ...existing, caption: att.caption };
          }
        } else {
          byType[key] = att;
        }
      });
      return Object.values(byType);
    })();
    return {
      id: m.id,
      senderId: m.key?.participant || m.pushName || m.key?.remoteJid || "Контакт",
      participant: m.key?.participant || undefined,
      content: extractText(m.message),
      timestamp: formatTimestampFromSeconds(m.messageTimestamp),
      timestampMs: m.messageTimestamp ? m.messageTimestamp * 1000 : undefined,
      source: friendlySource(m.source),
      author,
      isOwn: fromMe,
      status: m.status ?? undefined,
      keyId: m.key?.id || m.id || undefined,
      attachments: dedupedAttachments,
      sessionId: m.sessionId ?? null
    };
  }

  const filteredConversations = conversations
    .filter((c) => Boolean(c.remoteJid))
    .filter((c) => {
      const jid = c.remoteJid || "";
      const isWhatsappJid = jid.endsWith("@s.whatsapp.net");
      if (tab === "chats") return isWhatsappJid;
      if (tab === "groups") return !isWhatsappJid;
      if (tab === "archive") return false; // архив пока пустой
      return true;
    })
    .filter((c) => {
      if (!debouncedSearch.trim()) return true;
      const q = debouncedSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.remoteJid.toLowerCase().includes(q);
    });

  const handleLoadMoreChats = () => {
    if (loadingChats || loadingMoreChats || !hasMoreChats) return;
    const nextPage = chatPage + 1;
    loadChats(instanceName || null, preferredInstanceId, {
      page: nextPage,
      append: true,
      search: debouncedSearch
    });
  };

  async function handleSendMessage(text: string) {
    if (!selectedConversation) return;
    if (manualSendBlockedByAi()) return;
    const resolvedInstance = await ensureInstance();
    try {
      await sendTextMessage(resolvedInstance, {
        number: selectedConversation.remoteJid,
        text
      });
      const unreadClient = messages
        .filter((m) => !m.isOwn && m.keyId && m.status !== "READ")
        .map((m) => ({
          remoteJid: selectedConversation.remoteJid,
          fromMe: false,
          id: m.keyId as string
        }));
      if (unreadClient.length) {
        await markMessagesAsRead(unreadClient);
      }
      toast({ title: "Сообщение отправлено" });
    } catch (err) {
      toast({ title: "Не удалось отправить", description: String(err) });
      throw err;
    }
  }

  async function handleEditMessage(messageId: string, keyId: string, text: string) {
    if (!selectedConversation) return;
    if (manualSendBlockedByAi()) return;
    const inst = await ensureInstance();
    try {
      await updateMessage(inst, {
        number: selectedConversation.remoteJid,
        key: {
          remoteJid: selectedConversation.remoteJid,
          fromMe: true,
          id: keyId
        },
        text
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: text, status: "PENDING" } : m
        )
      );
      toast({ title: "Сообщение отредактировано" });
    } catch (err) {
      toast({ title: "Не удалось отредактировать", description: String(err) });
      throw err;
    }
  }

  async function ensureInstance(): Promise<string> {
    const preferred = readPreferredInstance();
    const preferredName = preferred?.name || null;
    const fromConversation = selectedConversation?.instanceId
      ? instanceNames[selectedConversation.instanceId]
      : null;
    let inst = fromConversation || instanceName || preferredName;
    if (!inst) {
      inst = await resolveInstance();
      if (inst) setInstanceName(inst);
    }
    if (!inst) throw new Error("Instance не получен");
    return inst;
  }

  async function handleSendMedia(payload: { url: string; caption?: string; mediatype: "image" | "video" | "audio" | "document" }) {
    if (!selectedConversation) return;
    if (manualSendBlockedByAi()) return;
    const inst = await ensureInstance();
    try {
      await sendMedia(inst, {
        number: selectedConversation.remoteJid,
        mediatype: payload.mediatype,
        media: payload.url,
        caption: payload.caption
      });
      toast({ title: "Медиа отправлено" });
    } catch (err) {
      toast({ title: "Не удалось отправить медиа", description: String(err) });
      throw err;
    }
  }

  async function handleSendMediaFile(file: File, caption?: string, mediatype?: "image" | "video" | "audio" | "document") {
    if (!selectedConversation) return;
    if (manualSendBlockedByAi()) return;
    const inst = await ensureInstance();
    try {
      const safeType = mediatype || "document";
      await sendMediaFile(inst, {
        number: selectedConversation.remoteJid,
        file,
        caption,
        mediatype: safeType,
        mimetype: file.type || undefined,
        fileName: file.name || undefined
      });
      toast({ title: "Файл отправлен" });
    } catch (err) {
      toast({ title: "Не удалось отправить файл", description: String(err) });
      throw err;
    }
  }

  async function handleShowQr() {
    const inst = await ensureInstance();
    const response = await connectInstance(inst);
    const qrcode =
      response?.qrcode?.base64 ||
      response?.qrCode ||
      response?.qrcode ||
      response?.base64 ||
      null;
    if (qrcode) {
      setQrData(qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`);
      setQrInstance(inst);
    }
  }

  useEffect(() => {
    if (!qrInstance) return;
    let cancelled = false;
    const stateInterval = setInterval(async () => {
      try {
        const res = await fetchConnectionState(qrInstance);
        const state = res?.instance?.state || res?.state;
        if (state === "open" && !cancelled) {
          setQrData(null);
          setQrInstance(null);
          clearInterval(stateInterval);
        }
      } catch (err) {
        console.warn("connectionState poll failed", err);
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(stateInterval);
    };
  }, [qrInstance]);

  async function handleLabelsUpdate(labelIds: string[]) {
    if (!selectedConversation) return;
    const prevLabels = selectedConversation.labels?.map((l) => l.labelId) || [];
    const unique = Array.from(new Set(labelIds));
    const toLabelObjects = (ids: string[]) =>
      ids.map((id) => labelsById[id] || { labelId: id, name: id });

    setSelectedConversation((prev) => (prev ? { ...prev, labels: toLabelObjects(unique) } : prev));
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversation.id ? { ...c, labels: toLabelObjects(unique) } : c))
    );

    try {
      let resolvedInstance = instanceName;
      if (!resolvedInstance) {
        resolvedInstance = await resolveInstance();
        if (resolvedInstance) setInstanceName(resolvedInstance);
      }
      if (!resolvedInstance) {
        throw new Error("Instance не получен");
      }

      const adds = unique.filter((id) => !prevLabels.includes(id));
      const removes = prevLabels.filter((id) => !unique.includes(id));
      const number = stripWhatsappSuffix(selectedConversation.remoteJid) || selectedConversation.remoteJid;

      const requests: Promise<unknown>[] = [];
      adds.forEach((labelId) =>
        requests.push(
          handleLabel(resolvedInstance, {
            number,
            labelId,
            action: "add"
          })
        )
      );
      removes.forEach((labelId) =>
        requests.push(
          handleLabel(resolvedInstance, {
            number,
            labelId,
            action: "remove"
          })
        )
      );

      if (requests.length) {
        await Promise.all(requests);
      }
    } catch (err) {
      console.error("handleLabel error", err);
      // rollback optimistic update
      setSelectedConversation((prev) =>
        prev ? { ...prev, labels: toLabelObjects(prevLabels) } : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation?.id ? { ...c, labels: toLabelObjects(prevLabels) } : c
        )
      );
      throw err;
    }
  }

  async function handleToggleAi(enabled: boolean) {
    if (!selectedConversation || !botSession) return;
    const instId = selectedConversation.instanceId || "";
    const instName = instId ? instanceNames[instId] : null;
    if (!instName) {
      toast({
        title: "Не удалось переключить бота",
        description: "Не найдено имя инстанса для чата."
      });
      return;
    }

    const status = enabled ? "opened" : "paused";

    setBotTogglePending(true);
    try {
      await changeAgnoStatus(instName, {
        remoteJid: selectedConversation.remoteJid,
        status
      });
      setBotSession((prev) => (prev ? { ...prev, status } : prev));
      if (enabled) {
        await emitAgnoLastMessage(instName, { remoteJid: selectedConversation.remoteJid });
      }
    } catch (err) {
      console.error("toggle bot error", err);
      toast({
        title: "Не удалось переключить бота",
        description: err instanceof Error ? err.message : "Ошибка запроса"
      });
    } finally {
      setBotTogglePending(false);
    }
  }
 
  const aiLocked = botSession?.status === "opened";

  const manualSendBlockedByAi = () => {
    if (!aiLocked) return false;
    toast({
      title: "Сейчас отвечает ИИ",
      description: "Выключите тумблер, чтобы отправлять сообщения вручную."
    });
    return true;
  };

  const canSend =
    selectedConversation && selectedConversation.instanceId
      ? instanceStatuses[selectedConversation.instanceId] === "open"
      : false;

  async function markMessagesAsRead(
    items: Array<{ remoteJid: string; fromMe: boolean; id: string }>,
    targetStatus: "READ" | "DELIVERY_ACK" | "SERVER_ACK" = "READ"
  ) {
    if (!items.length || !selectedConversation?.instanceId) return;
    try {
      const targetRemote = items[0]?.remoteJid;
      const conversationEntry =
        conversations.find((c) => c.remoteJid === targetRemote) || selectedConversation;
      const baseUnread = conversationEntry?.unreadCount ?? 0;
      const msgIds: string[] = [];
      items.forEach((item) => {
        const msg = messages.find((m) => m.keyId === item.id || m.id === item.id);
        if (msg) msgIds.push(msg.id);
      });

      if (targetStatus === "READ") {
        const instName = await ensureInstance();
        await markChatAsRead(instName, { readMessages: items });
      }
      if (msgIds.length) {
        await updateMessagesStatus(msgIds, targetStatus);
      }
      const ids = new Set(items.map((i) => i.id));
      setMessages((prev) =>
        prev.map((m) =>
          m.keyId && ids.has(m.keyId) ? { ...m, status: targetStatus } : m
        )
      );

      const incoming = items.filter((i) => !i.fromMe);
      if (incoming.length) {
        const isRead = targetStatus === "READ";
        const delta = incoming.length;
        const updatedUnread = isRead ? Math.max(0, baseUnread - delta) : baseUnread + delta;

        setConversations((prev) =>
          prev.map((c) =>
            incoming.some((i) => i.remoteJid === c.remoteJid)
              ? { ...c, unreadCount: updatedUnread }
              : c
          )
        );
        setSelectedConversation((prev) =>
          prev && incoming.some((i) => i.remoteJid === prev.remoteJid)
            ? { ...prev, unreadCount: updatedUnread }
            : prev
        );
        if (targetRemote) {
          await updateChatUnread({
            instanceId: selectedConversation.instanceId,
            remoteJid: targetRemote,
            unreadMessages: updatedUnread
          });
        }
      }
    } catch (err) {
      console.warn("markMessagesAsRead error", err);
    }
  }

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col bg-gray-50">
      {showAlertType ? (
        <div className="px-4 pt-4">
          {showAlertType === "apikey" ? (
            <Alert variant="destructive">
              <AlertTitle>Нет API-ключа</AlertTitle>
              <AlertDescription>
                <p>Добавьте ключ в Settings → Access, чтобы загрузить чаты.</p>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/settings">Открыть Settings</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : showAlertType === "instances" ? (
            <Alert>
              <AlertTitle>Инстансы не найдены</AlertTitle>
              <AlertDescription>
                <p>Создайте инстанс и подключите WhatsApp, чтобы увидеть чаты.</p>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/connections">Перейти к Connections</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>Инстанс не выбран</AlertTitle>
              <AlertDescription>
                <p>Выберите инстанс в Connections, чтобы открыть чаты.</p>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/connections">Выбрать инстанс</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <ConversationList
          conversations={filteredConversations}
          selectedConversation={selectedConversation}
          loading={loadingChats}
          searchTerm={search}
          onSearch={setSearch}
          selectedTab={tab}
          onTabChange={setTab}
          chatsCount={conversations.filter((c) => (c.remoteJid || "").endsWith("@s.whatsapp.net")).length}
          groupsCount={conversations.filter((c) => !!c.remoteJid && !(c.remoteJid || "").endsWith("@s.whatsapp.net")).length}
          onSelectConversation={(c) => setSelectedConversation(c)}
          onLoadMore={handleLoadMoreChats}
          hasMore={hasMoreChats}
          loadingMore={loadingMoreChats}
        />

        {selectedConversation ? (
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            hasMoreMessages={hasMoreMessages}
            isLoadingOlder={loadingOlderMessages}
            onLoadOlder={loadOlderMessages}
            onToggleProfile={() => setShowProfile(!showProfile)}
            onSendMessage={handleSendMessage}
            availableLabels={availableLabels}
            onUpdateLabels={handleLabelsUpdate}
            onSendMedia={(payload) => handleSendMedia(payload)}
            onSendMediaFile={(file, caption, mediatype) => handleSendMediaFile(file, caption, mediatype)}
            onShowQr={() => handleShowQr()}
            onMarkMessagesRead={(items) => markMessagesAsRead(items)}
            onMarkMessagesUnread={(items) => markMessagesAsRead(items, "DELIVERY_ACK")}
            onEditMessage={(messageId, keyId, text) => handleEditMessage(messageId, keyId, text)}
            canSend={canSend}
            isAiEnabled={aiLocked}
            onToggleAi={handleToggleAi}
            aiTogglePending={botTogglePending}
            showBotToggle={Boolean(botSession)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Нет выбранных чатов.
          </div>
        )}

        {showProfile && currentUser && (
          <UserProfile user={currentUser} onClose={() => setShowProfile(false)} />
        )}
      </div>

      <Dialog open={Boolean(qrData)} onOpenChange={(open) => !open && (setQrData(null), setQrInstance(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR для подключения</DialogTitle>
            <DialogDescription>Отсканируйте в WhatsApp, чтобы открыть сессию.</DialogDescription>
          </DialogHeader>
          {qrData ? (
            <div className="flex flex-col items-center gap-3">
              <img src={qrData} alt="QR" className="h-64 w-64 rounded-lg border" />
              <DialogFooter>
                <Button onClick={() => setQrData(null)}>Закрыть</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-gray-500">Нет QR-кода</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
