"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import { Info, Paperclip, Send, Tag, Pencil, Download, X, Loader2 } from "lucide-react";
import { LuBot, LuCheck, LuCheckCheck, LuFileImage, LuFileAudio, LuFileText, LuFileVideo } from "react-icons/lu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  timestampMs?: number;
  source?: string;
  isOwn: boolean;
  status?: string;
  keyId?: string;
  attachments?: Array<{
    type: "image" | "video" | "document" | "audio";
    url?: string;
    name?: string;
    caption?: string;
    mimetype?: string;
    sizeBytes?: number;
  }>;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  status: string;
  remoteJid: string;
  lastSource?: string;
  labels?: Array<{
    labelId: string;
    name: string;
    color?: string | null;
  }>;
}

type MediaType = "image" | "video" | "document" | "audio";
type AttachmentKind = "media-url" | "media-file";

interface ChatAreaProps {
  conversation: Conversation;
  messages: Message[];
  hasMoreMessages?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
  onToggleProfile: () => void;
  onSendMessage: (text: string) => Promise<void>;
  canSend: boolean;
  onMarkMessagesRead: (items: Array<{ remoteJid: string; fromMe: boolean; id: string }>) => Promise<void>;
  onMarkMessagesUnread: (
    items: Array<{ remoteJid: string; fromMe: boolean; id: string }>,
    targetStatus?: "DELIVERY_ACK" | "SERVER_ACK"
  ) => Promise<void>;
  availableLabels: Array<{
    labelId: string;
    name: string;
    color?: string | null;
  }>;
  onUpdateLabels: (labelIds: string[]) => Promise<void>;
  onSendMedia: (payload: { url: string; caption?: string; mediatype: MediaType }) => Promise<void>;
  onSendMediaFile: (file: File, caption?: string, mediatype?: MediaType) => Promise<void>;
  onShowQr: () => Promise<void>;
  onEditMessage: (messageId: string, keyId: string, text: string) => Promise<void>;
  isAiEnabled: boolean;
  aiTogglePending?: boolean;
  onToggleAi: (enabled: boolean) => Promise<void> | void;
  showBotToggle?: boolean;
}

const sourceIcon = (src?: string) => {
  if (!src) return null;
  const normalized = src.toLowerCase();
  if (
    normalized.includes("ios") ||
    normalized.includes("iphone") ||
    normalized.includes("unknown")
  )
    return "📱";
  if (normalized.includes("android")) return "🤖";
  if (normalized.includes("mac") || normalized.includes("windows")) return "💻";
  return "💬";
};

const statusLabel = (status?: string) => {
  if (!status) return "";
  const normalized = status.toUpperCase();
  switch (normalized) {
    case "PENDING":
      return "Отправляется";
    case "SERVER_ACK":
      return "Доставлено на сервер";
    case "DELIVERY_ACK":
      return "Доставлено";
    case "READ":
      return "Прочитано";
    default:
      return status;
  }
};

type StatusIconData = {
  icon?: React.ComponentType<{ className?: string; title?: string }>;
  className?: string;
  title?: string;
  sizeClass?: string;
  text?: string;
};

const statusIcon = (status?: string, isOwn?: boolean): StatusIconData | null => {
  if (!status) return null;
  const normalized = status.toUpperCase();
  if (isOwn && (normalized === "EDIT" || normalized === "EDITED")) {
    return { icon: Pencil, className: "text-gray-500", title: "Отредактировано", sizeClass: "h-2 w-2" };
  }
  if (normalized === "READ") {
    return { icon: LuCheck, className: "text-blue-500", title: statusLabel(status), sizeClass: "h-3 w-3" };
  }
  if (normalized === "DELIVERY_ACK" || normalized === "SERVER_ACK" || normalized === "PENDING") {
    return { icon: LuCheck, className: "text-gray-500", title: statusLabel(status), sizeClass: "h-3 w-3" };
  }
  return null;
};

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

const detectMediaType = (file?: File | null): MediaType => {
  if (!file) return "document";
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const name = (file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() || "" : "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "mkv", "avi", "webm", "3gp", "m4v"].includes(ext)) return "video";
  if (["mp3", "ogg", "oga", "opus", "m4a", "wav", "aac"].includes(ext)) return "audio";
  return "document";
};

export function ChatArea({
  conversation,
  messages,
  hasMoreMessages = false,
  isLoadingOlder = false,
  onLoadOlder,
  onToggleProfile,
  onSendMessage,
  availableLabels,
  onUpdateLabels,
  onSendMedia,
  onSendMediaFile,
  onShowQr,
  canSend,
  onMarkMessagesRead,
  onMarkMessagesUnread,
  onEditMessage,
  isAiEnabled,
  aiTogglePending,
  onToggleAi,
  showBotToggle = false
}: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentSending, setAttachmentSending] = useState(false);
  const [labelSaving, setLabelSaving] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    conversation.labels?.map((l) => l.labelId) || []
  );
  const endRef = useRef<HTMLDivElement | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachmentKind, setAttachmentKind] = useState<AttachmentKind>("media-url");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    caption?: string;
    name?: string;
  } | null>(null);
  const [documentPreview, setDocumentPreview] = useState<{
    url: string;
    caption?: string;
    name?: string;
    mimetype?: string;
  } | null>(null);
  const { toast } = useToast();
  const aiLocked = isAiEnabled;
  const triggerDownload = (url?: string, name?: string) => {
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name || "file";
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes < 0) return "";
    const units = ["Б", "КБ", "МБ", "ГБ"];
    const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const val = bytes / Math.pow(1024, idx);
    return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  };
  const [fileCaption, setFileCaption] = useState("");
  const [fileSelected, setFileSelected] = useState<File | null>(null);
  const [openLabelPopover, setOpenLabelPopover] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [editKeyId, setEditKeyId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingPrependRef = useRef<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    setIsAtBottom(true);
  }, [conversation.id]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (pendingPrependRef.current !== null && !isLoadingOlder) {
      const previousHeight = pendingPrependRef.current;
      const delta = container.scrollHeight - previousHeight;
      container.scrollTop = delta + container.scrollTop;
      pendingPrependRef.current = null;
      return;
    }
    if (isAtBottom && !isLoadingOlder) {
      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [messages, isAtBottom, isLoadingOlder]);

  useEffect(() => {
    setSelectedLabels(conversation.labels?.map((l) => l.labelId) || []);
  }, [conversation.id]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - (scrollTop + clientHeight) < 24;
    setIsAtBottom(atBottom);
    if (scrollTop <= 80 && onLoadOlder && hasMoreMessages && !isLoadingOlder) {
      pendingPrependRef.current = scrollHeight;
      onLoadOlder();
    }
  };

  useEffect(() => {
    if (!editOpen) {
      setEditMessageId(null);
      setEditKeyId(null);
    }
  }, [editOpen]);

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const handleSaveLabels = () => {
    setLabelSaving(true);
    onUpdateLabels(selectedLabels)
      .catch((err) => {
        console.error("Label update error", err);
        notify("Не удалось обновить теги");
      })
      .finally(() => {
        setLabelSaving(false);
        setOpenLabelPopover(false);
      });
  };

  const notify = (title: string, description?: string) =>
    toast({
      title,
      description
    });

  const openAttachment = (kind: AttachmentKind) => {
    setAttachmentKind(kind);
    setAttachmentOpen(true);
  };

  const isSendBlocked = () => {
    if (aiLocked) {
      notify("Сейчас отвечает ИИ", "Выключите тумблер, чтобы написать вручную");
      return true;
    }
    if (!canSend) {
      notify("Нет подключения к мессенджеру");
      return true;
    }
    return false;
  };

  async function submitMedia() {
    if (isSendBlocked()) return;
    if (attachmentSending) return;
    if (!mediaUrl) return;
    try {
      setAttachmentSending(true);
      await onSendMedia({
        url: mediaUrl,
        caption: mediaCaption || undefined,
        mediatype: "document"
      });
      notify("Документ отправлен");
      setMediaUrl("");
      setMediaCaption("");
      setAttachmentOpen(false);
    } catch (err) {
      console.error(err);
      notify("Не удалось отправить документ");
    } finally {
      setAttachmentSending(false);
    }
  }

  async function submitFile() {
    if (isSendBlocked()) return;
    if (attachmentSending) return;
    if (!fileSelected) {
      notify("Выберите файл");
      return;
    }
    const mediaType = detectMediaType(fileSelected);
    if (mediaType !== "image" && mediaType !== "document") {
      notify("Можно отправить только изображение или документ");
      return;
    }
    try {
      setAttachmentSending(true);
      await onSendMediaFile(fileSelected, fileCaption || undefined, mediaType);
      notify(mediaType === "image" ? "Изображение отправлено" : "Документ отправлен");
      setFileSelected(null);
      setFileCaption("");
      setAttachmentOpen(false);
    } catch (err) {
      console.error(err);
      notify("Не удалось отправить файл");
    } finally {
      setAttachmentSending(false);
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendBlocked()) return;
    if (newMessage.trim()) {
      setSending(true);
      onSendMessage(newMessage.trim())
        .catch((err) => {
          console.error("Send error", err);
          notify("Не удалось отправить сообщение");
        })
        .finally(() => {
          setSending(false);
          setNewMessage("");
        });
    }
  };

  const startEdit = (message: Message) => {
    if (!message.keyId) return;
    setEditMessageId(message.id);
    setEditKeyId(message.keyId);
    setEditText(message.content || "");
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editMessageId || !editKeyId || !editText.trim()) return;
    try {
      setEditSaving(true);
      await onEditMessage(editMessageId, editKeyId, editText.trim());
      setEditOpen(false);
    } catch (err) {
      console.error("edit message error", err);
      notify("Не удалось обновить сообщение");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={conversation.avatar || "/logo.png"}
                alt={conversation.name}
              />
              <AvatarFallback>
                {conversation.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div
              className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white ${
                canSend ? "bg-green-500" : "bg-gray-300"
              }`}
            ></div>
          </div>
          <div>
            <h2 className="font-medium text-gray-900">{conversation.name}</h2>
            {(conversation.labels?.length || conversation.lastSource) && (
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                {conversation.lastSource ? (
                  <span className="flex items-center gap-1">
                    <span title={conversation.lastSource}>{sourceIcon(conversation.lastSource)}</span>
                    <span className="truncate">{conversation.lastSource}</span>
                  </span>
                ) : null}
                {conversation.labels?.map((label) => (
                  <Badge
                    key={label.labelId}
                    variant="secondary"
                    className={`text-[10px] ${labelColorClass(label.color)}`}>
                    {label.name || label.labelId}
                  </Badge>
                ))}
              </div>
            )}
            {!canSend && (
              <p className="text-xs text-red-500">Нет подключения к мессенджеру</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Popover open={openLabelPopover} onOpenChange={setOpenLabelPopover}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                <Tag className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="mb-2 text-sm font-medium text-gray-900">Теги</div>
              <div className="space-y-2">
                {availableLabels.length === 0 ? (
                  <div className="text-xs text-gray-500">Нет тегов</div>
                ) : (
                  availableLabels.map((label) => (
                    <label key={label.labelId} className="flex items-center space-x-2 text-sm">
                      <Checkbox
                        checked={selectedLabels.includes(label.labelId)}
                        onCheckedChange={() => toggleLabel(label.labelId)}
                      />
                      <span>{label.name || label.labelId}</span>
                      <Badge className={`ml-auto text-[10px] ${labelColorClass(label.color)}`}>
                        {label.labelId}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
              <Separator className="my-3" />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedLabels(conversation.labels?.map((l) => l.labelId) || [])}>
                  Сброс
                </Button>
                <Button size="sm" onClick={handleSaveLabels} disabled={labelSaving}>
                  {labelSaving ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={onToggleProfile}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-4 overflow-y-auto p-4">
        {isLoadingOlder ? (
          <div className="text-center text-xs text-gray-500">Загрузка старых сообщений...</div>
        ) : null}
        {messages.length === 0 ? (
          <div className="text-sm text-gray-500">Сообщений пока нет.</div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.id || message.keyId || "msg"}-${message.timestampMs || index}`}
              className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`group relative max-w-xs rounded-2xl px-4 py-2 lg:max-w-md ${
                  message.isOwn ? "bg-blue-100 text-gray-900" : "bg-gray-100 text-gray-900"
                }`}>
                {!message.isOwn && message.keyId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const keyId = message.keyId;
                      if (!keyId) return;
                      (message.status === "READ" ? onMarkMessagesUnread : onMarkMessagesRead)(
                        [{ remoteJid: conversation.remoteJid, fromMe: false, id: keyId! }],
                        message.status === "READ" ? "DELIVERY_ACK" : undefined
                      );
                    }}
                    className="absolute -right-6 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 opacity-0 transition-opacity hover:text-blue-500 group-hover:opacity-100"
                    title={message.status === "READ" ? "Сделать непрочитанным" : "Отметить прочитанным"}>
                    <LuCheck className="h-4 w-4" />
                  </button>
                ) : message.isOwn && message.keyId ? (
                  <div className="absolute -left-14 top-1/2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        const keyId = message.keyId;
                        if (!keyId) return;
                        onMarkMessagesUnread(
                          [{ remoteJid: conversation.remoteJid, fromMe: true, id: keyId! }],
                          "SERVER_ACK"
                        );
                      }}
                      className="rounded-full p-1 text-gray-400 hover:text-blue-500"
                      title="Сделать непрочитанным">
                      <LuCheck className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(message)}
                      className="rounded-full p-1 text-gray-400 hover:text-blue-500"
                      title="Редактировать сообщение">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <p className="text-sm">{message.content}</p>
                {message.attachments?.map((att, idx) => (
                  <div key={idx} className="mt-2">
                    {att.type === "image" ? (
                      <div className="space-y-1">
                        {att.url ? (
                          <div className="relative">
                            <img
                              src={att.url}
                              alt={att.name || "Изображение"}
                              className="max-h-64 w-full cursor-zoom-in rounded-lg object-cover"
                              onClick={() =>
                                setImagePreview({ url: att.url as string, caption: att.caption, name: att.name })
                              }
                            />
                            <Button
                              asChild
                              size="icon"
                              variant="secondary"
                              className="absolute right-2 top-2 h-9 w-9 rounded-full bg-white/60 text-gray-700 shadow backdrop-blur hover:bg-white/90"
                            >
                              <a
                                href={att.url}
                                download={att.name || "image"}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50">
                            <LuFileImage className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        {/* caption выводим только в тексте сообщения, здесь убираем дублирование */}
                      </div>
                    ) : att.type === "audio" ? (
                      <div className="space-y-2">
                        {att.url ? (
                          <audio
                            controls
                            src={att.url}
                            className="w-[60vw] max-w-full"
                            preload="metadata"
                          />
                        ) : (
                          <div className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50">
                            <LuFileAudio className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                    ) : att.type === "video" ? (
                      <div className="space-y-2">
                        {att.url ? (
                          <video
                            controls
                            src={att.url}
                            className="w-[60vw] max-w-full rounded-lg bg-black"
                            preload="metadata"
                          />
                        ) : (
                          <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50">
                            <LuFileVideo className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                    ) : att.type === "document" ? (
                      <div className="space-y-2">
                        {att.url && (att.mimetype || "").includes("pdf") ? (
                          <div className="relative">
                            <object
                              data={att.url}
                              type={att.mimetype || "application/pdf"}
                              className="h-64 w-full cursor-zoom-in rounded-lg border"
                              onClick={() =>
                                setDocumentPreview({
                                  url: att.url as string,
                                  caption: att.caption,
                                  name: att.name,
                                  mimetype: att.mimetype
                                })
                              }
                            >
                              <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50">
                                <LuFileText className="h-6 w-6 text-gray-400" />
                              </div>
                            </object>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setDocumentPreview({
                                url: att.url || "",
                                caption: att.caption,
                                name: att.name,
                                mimetype: att.mimetype
                              })
                            }
                            className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50">
                            <LuFileText className="h-6 w-6 text-gray-400" />
                          </button>
                        )}
                        <div className="text-xs text-gray-800">
                          {att.name || "Документ"}
                          {att.mimetype ? ` (${att.mimetype})` : ""}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-md p-2 text-xs ${
                          message.isOwn ? "bg-white/10 text-white" : "bg-gray-200 text-gray-800"
                        }`}>
                        Вложение: {att.name || att.type}
                        {att.mimetype ? ` (${att.mimetype})` : ""}
                      </div>
                    )}
                  </div>
                ))}
                <div
                  className={`mt-1 flex items-center gap-1 text-[10px] ${
                    message.isOwn ? "justify-start text-gray-600" : "justify-start text-gray-500"
                  }`}>
                  {(() => {
                    const metaAtt = message.attachments?.find((a) =>
                      a.type === "image" || a.type === "audio" || a.type === "document" || a.type === "video"
                    );
                    if (!metaAtt) return null;
                    const size = metaAtt.sizeBytes ? ` • ${formatBytes(metaAtt.sizeBytes)}` : "";
                    const mime = (() => {
                      const mt = (metaAtt.mimetype || "").toLowerCase();
                      if (mt === "application/pdf") return "pdf";
                      if (mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docs";
                      if (mt === "image/png") return "png";
                      if (mt === "video/mp4") return "mp4";
                      if (mt === "video/quicktime") return "mov";
                      return metaAtt.mimetype || metaAtt.type;
                    })();
                    return (
                      <span className="text-[10px] leading-none tracking-tight text-gray-700">
                        {mime}{size}
                      </span>
                    );
                  })()}
                  {(() => {
                    const iconData = statusIcon(message.status, message.isOwn);
                    if (!iconData) return null;
                    const IconComp = iconData.icon;
                    if (IconComp) {
                      return (
                        <IconComp
                          className={`${iconData.sizeClass || "h-3 w-3"} text-[10px] leading-none tracking-tight ${iconData.className || ""}`}
                          title={statusLabel(message.status)}
                        />
                      );
                    }
                    return iconData.text ? (
                      <span
                        className={`text-[10px] leading-none tracking-tight ${iconData.className || ""}`}
                        title={statusLabel(message.status)}>
                        {iconData.text}
                      </span>
                    ) : null;
                  })()}
                  {message.isOwn && message.source ? <span>  {message.source}</span> : null}
                  <span>{message.timestamp}</span>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <Dialog open={Boolean(imagePreview)} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="fixed inset-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !max-w-none sm:!max-w-none !rounded-none p-2 sm:p-4 bg-white text-gray-900 [&_[aria-label='Close']]:hidden [&_button[aria-label='Close']]:hidden [&_[data-slot='dialog-close']]:hidden [&_button[data-slot='dialog-close']]:hidden">
          <div className="absolute right-10 top-4  flex gap-2">
            {imagePreview?.url ? (
              <Button variant="secondary" onClick={() => triggerDownload(imagePreview.url, imagePreview.name)}>
                Скачать
              </Button>
            ) : null}
          </div>
          <DialogHeader className="flex flex-row items-start justify-between space-y-0 pr-20">
            <div>
              <DialogTitle>{imagePreview?.name || "Изображение"}</DialogTitle>
              {imagePreview?.caption ? (
                <DialogDescription>{imagePreview.caption}</DialogDescription>
              ) : null}
            </div>
          </DialogHeader>
          {imagePreview?.url ? (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="flex flex-1 min-h-0 items-center justify-center">
                <img
                  src={imagePreview.url}
                  alt={imagePreview.name || "Изображение"}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(documentPreview)} onOpenChange={(open) => !open && setDocumentPreview(null)}>
        <DialogContent className="fixed inset-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !max-w-none sm:!max-w-none !rounded-none p-2 sm:p-4 bg-white text-gray-900 [&_[aria-label='Close']]:hidden [&_button[aria-label='Close']]:hidden [&_[data-slot='dialog-close']]:hidden [&_button[data-slot='dialog-close']]:hidden">
          <div className="absolute right-4 top-4 flex gap-2">
            {documentPreview?.url ? (
              <Button variant="secondary" onClick={() => triggerDownload(documentPreview.url, documentPreview.name)}>
                Скачать
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDocumentPreview(null)}
              aria-label="Закрыть документ">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <DialogHeader className="flex flex-row items-start justify-between space-y-0 pr-20">
            <div>
              <DialogTitle>{documentPreview?.name || "Документ"}</DialogTitle>
              {documentPreview?.caption ? (
                <DialogDescription>{documentPreview.caption}</DialogDescription>
              ) : null}
            </div>
          </DialogHeader>
          {documentPreview?.url ? (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="flex flex-1 min-h-0 items-center justify-center">
                {(documentPreview.mimetype || "").includes("pdf") ? (
                  <object
                    data={documentPreview.url}
                    type={documentPreview.mimetype || "application/pdf"}
                    className="h-full w-full rounded-lg border"
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50">
                      <LuFileText className="h-8 w-8 text-gray-400" />
                    </div>
                  </object>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50 p-6 text-center text-sm text-gray-600">
                    <LuFileText className="mb-3 h-8 w-8 text-gray-400" />
                    <div className="mb-2">Предпросмотр этого формата не поддерживается.</div>
                    <div className="mb-4 text-xs text-gray-500">
                      {documentPreview.mimetype || "application/octet-stream"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Message Input */}
      <div className="border-t bg-white px-2.5 pt-2.5 pb-1.5 ">
        <form
          onSubmit={handleSendMessage}
          className="flex items-center  bg-transparent "
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!canSend || sending || aiLocked || attachmentSending}>
                <Paperclip className="h-4 w-8" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => openAttachment("media-url")}>Документ по URL</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAttachment("media-file")}>Файл (картинка/документ)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {showBotToggle ? (
            <div
              className={`flex items-center gap-2 rounded-full px-2 py-1 text-xs transition ${
                aiLocked ? "bg-amber-50" : "bg-gray-50"
              }`}>
              <LuBot className="h-3 w-3 text-black" />
              <Switch
                checked={isAiEnabled}
                disabled={aiTogglePending}
                onCheckedChange={(checked) => onToggleAi(checked)}
              />
            </div>
          ) : null}
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                aiLocked ? "ИИ отвечает за чат — отключите тумблер, чтобы писать" : "Написать сообщение..."
              }
              className="flex-1 rounded-full border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={sending || !canSend || aiLocked}
            />
          <Button
            type="submit"
            className="rounded-xl bg-blue-500 text-white hover:bg-blue-600"
            disabled={sending || !newMessage.trim() || !canSend || aiLocked}>
            <Send className="h-4 w-8" />
          </Button>
        </form>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать сообщение</DialogTitle>
            <DialogDescription>Доступно только для отправленных вами сообщений.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Текст</Label>
            <Input value={editText} onChange={(e) => setEditText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submitEdit} disabled={!editText.trim() || editSaving}>
              {editSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={attachmentOpen} onOpenChange={setAttachmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {{
                "media-url": "Отправить документ по URL",
                "media-file": "Отправить файл"
              }[attachmentKind]}
            </DialogTitle>
            <DialogDescription>
              {{
                "media-url": "Укажите прямую ссылку на документ.",
                "media-file": "Будет отправлено изображение (imageMessage) или документ."
              }[attachmentKind] || undefined}
            </DialogDescription>
          </DialogHeader>

          {attachmentKind === "media-url" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Ссылка на документ</Label>
                <Input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={attachmentSending}
                />
              </div>
              <div className="space-y-1">
                <Label>Подпись</Label>
                <Input
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  placeholder="Комментарий"
                  disabled={attachmentSending}
                />
              </div>
            </div>
          ) : null}

          {attachmentKind === "media-file" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Файл</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv"
                  disabled={attachmentSending}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFileSelected(f);
                  }}
                />
                {fileSelected && <p className="text-xs text-muted-foreground">{fileSelected.name}</p>}
              </div>
              {fileSelected ? (
                <div className="text-xs text-muted-foreground">
                  Тип: {detectMediaType(fileSelected) === "image" ? "изображение" : "документ"}.
                </div>
              ) : null}
              <div className="space-y-1">
                <Label>Подпись</Label>
                <Input value={fileCaption} onChange={(e) => setFileCaption(e.target.value)} disabled={attachmentSending} />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => {
                switch (attachmentKind) {
                  case "media-url":
                    return submitMedia();
                  case "media-file":
                    return submitFile();
                  default:
                    return undefined;
                }
              }}
              disabled={
                attachmentSending ||
                (attachmentKind === "media-url" && !mediaUrl.trim()) ||
                (attachmentKind === "media-file" && !fileSelected)
              }
            >
              {attachmentSending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Отправка...
                </span>
              ) : (
                "Отправить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
