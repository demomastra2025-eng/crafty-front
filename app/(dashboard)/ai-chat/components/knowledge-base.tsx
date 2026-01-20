"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteKnowledgeContent,
  fetchKnowledgeConfig,
  fetchKnowledgeContent,
  fetchKnowledgeContentById,
  fetchKnowledgeContentStatus,
  searchKnowledge,
  updateKnowledgeContent,
  uploadKnowledgeContent,
  type KnowledgeConfigResponse,
  type KnowledgeContentItem,
  type KnowledgeContentListResponse,
  type KnowledgeSearchResponse
} from "@/lib/agno-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RefreshCcw, Search, Trash2, UploadCloud, PenLine, RotateCw, FileText, X } from "lucide-react";

type KnowledgeBaseProps = {
  agentId?: string | null;
  instanceName?: string | null;
  port?: number | null;
  defaultPort?: number | null;
};

type StatusFilter = "all" | "processing" | "completed" | "failed";
type UploadMode = "file" | "url" | "text";

const DEFAULT_DB_VALUE = "__default__";
const AUTO_READER_VALUE = "__auto_reader__";
const AUTO_CHUNKER_VALUE = "__auto_chunker__";

const formatBytes = (value?: string | null) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let unitIndex = -1;
  let normalized = size;
  do {
    normalized /= 1024;
    unitIndex += 1;
  } while (normalized >= 1024 && unitIndex < units.length - 1);
  return `${normalized.toFixed(normalized >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const normalizePort = (value?: number | null) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const getFileExtension = (filename: string) => {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
};

const normalizeUrlLines = (raw: string) =>
  raw
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

const toSafeUrl = (raw: string) => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const deriveNameFromUrl = (raw: string) => {
  const parsed = toSafeUrl(raw);
  if (!parsed) return "";
  const pathname = parsed.pathname.replace(/\/+$/, "");
  const lastSegment = pathname.split("/").filter(Boolean).pop();
  return lastSegment || parsed.hostname;
};

const inferReaderFromUrl = (raw: string, config?: KnowledgeConfigResponse | null) => {
  if (!config?.readersForType) return "";
  const parsed = toSafeUrl(raw);
  if (!parsed) return "";
  const host = parsed.hostname.toLowerCase();
  const isYoutube = host.includes("youtube.com") || host.includes("youtu.be");
  const isArxiv = host.includes("arxiv.org");
  const typeKey = isYoutube ? "youtube" : isArxiv ? "arxiv" : "url";
  const candidates = config.readersForType[typeKey] || [];
  const available = config.readers || {};
  return candidates.find((id) => id in available) || "";
};

const getStatusLabel = (status?: KnowledgeContentItem["status"]) => {
  switch (status) {
    case "processing":
      return "Обработка";
    case "completed":
      return "Готово";
    case "failed":
      return "Ошибка";
    default:
      return "—";
  }
};

const getStatusVariant = (status?: KnowledgeContentItem["status"]) => {
  switch (status) {
    case "processing":
      return "warning";
    case "completed":
      return "success";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
};

const stringifyMetadata = (value?: KnowledgeContentItem["metadata"]) => {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
};

const ensureJson = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { value: "", error: "" };
  try {
    JSON.parse(trimmed);
    return { value: trimmed, error: "" };
  } catch {
    return { value: trimmed, error: "Значение должно быть валидным JSON." };
  }
};

export function KnowledgeBase({ agentId, instanceName, port, defaultPort }: KnowledgeBaseProps) {
  const storageKeyPrefix = useMemo(
    () => (agentId ? `crafty:agno-knowledge:${agentId}` : "crafty:agno-knowledge"),
    [agentId]
  );
  const resolvedPort = useMemo(
    () => normalizePort(port) ?? normalizePort(defaultPort),
    [port, defaultPort]
  );
  const [token] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("crafty:agno-token") || "";
  });

  const [config, setConfig] = useState<KnowledgeConfigResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [contentResponse, setContentResponse] = useState<KnowledgeContentListResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const [selectedDbId, setSelectedDbId] = useState("");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadMetadata, setUploadMetadata] = useState("");
  const [uploadReaderId, setUploadReaderId] = useState("");
  const [uploadChunker, setUploadChunker] = useState("");
  const [uploadChunkSize, setUploadChunkSize] = useState("");
  const [uploadChunkOverlap, setUploadChunkOverlap] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<KnowledgeContentItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", metadata: "", readerId: "" });
  const [statusRefreshing, setStatusRefreshing] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"vector" | "keyword" | "hybrid">("hybrid");
  const [searchMaxResults, setSearchMaxResults] = useState("20");
  const [searchPage, setSearchPage] = useState(1);
  const [searchFilters, setSearchFilters] = useState("");
  const [searchFilterTags, setSearchFilterTags] = useState<string[]>([]);
  const [searchVectorDbIds, setSearchVectorDbIds] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<
    | { type: "single"; item: KnowledgeContentItem }
    | { type: "bulk"; ids: string[] }
    | null
  >(null);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readerOptions = useMemo(() => {
    if (!config?.readers) return [];
    return Object.values(config.readers).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  }, [config?.readers]);

  const chunkerOptions = useMemo(() => {
    const chunkers = config?.chunkers || {};
    if (uploadReaderId && config?.readers?.[uploadReaderId]?.chunkers?.length) {
      return config.readers[uploadReaderId].chunkers
        ?.map((key) => chunkers[key])
        .filter((item): item is NonNullable<typeof item> => Boolean(item)) || [];
    }
    return Object.values(chunkers);
  }, [config?.chunkers, config?.readers, uploadReaderId]);

  const vectorDbOptions = config?.vector_dbs || [];
  const supportedExtensions = useMemo(() => {
    if (!config?.readersForType) return [];
    return Object.keys(config.readersForType)
      .filter((key) => key.startsWith("."))
      .sort();
  }, [config?.readersForType]);
  const filterTags = useMemo(() => {
    if (!config?.filters) return [];
    return Array.from(new Set(config.filters)).filter(Boolean).sort();
  }, [config?.filters]);

  const filteredContent = useMemo(() => {
    const list = contentResponse?.data || [];
    return list.filter((item) =>
      statusFilter === "all" ? true : (item.status || "processing") === statusFilter
    );
  }, [contentResponse?.data, statusFilter]);

  const statusSummary = useMemo(() => {
    const summary = { processing: 0, completed: 0, failed: 0 };
    (contentResponse?.data || []).forEach((item) => {
      if (item.status === "processing") summary.processing += 1;
      if (item.status === "completed") summary.completed += 1;
      if (item.status === "failed") summary.failed += 1;
    });
    return summary;
  }, [contentResponse?.data]);

  const allSelected = filteredContent.length > 0 && selectedIds.length === filteredContent.length;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedDb = localStorage.getItem(`${storageKeyPrefix}:db`) || "";
    const storedLimit = Number(localStorage.getItem(`${storageKeyPrefix}:limit`) || "");
    setSelectedDbId(storedDb);
    setLimit(Number.isFinite(storedLimit) && storedLimit > 0 ? storedLimit : 20);
    setPage(1);
  }, [storageKeyPrefix]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedDbId) {
      localStorage.setItem(`${storageKeyPrefix}:db`, selectedDbId);
    } else {
      localStorage.removeItem(`${storageKeyPrefix}:db`);
    }
  }, [selectedDbId, storageKeyPrefix]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${storageKeyPrefix}:limit`, String(limit));
  }, [limit, storageKeyPrefix]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => (contentResponse?.data || []).some((row) => row.id === id))
    );
  }, [contentResponse?.data]);

  useEffect(() => {
    if (uploadMode !== "file" || !uploadFile || !config?.readersForType) return;
    const ext = getFileExtension(uploadFile.name);
    const candidates = config.readersForType[ext] || config.readersForType["file"] || [];
    if (candidates.length && !uploadReaderId) {
      setUploadReaderId(candidates[0]);
    }
    if (!uploadName.trim()) {
      setUploadName(uploadFile.name);
    }
  }, [config?.readersForType, uploadFile, uploadMode, uploadName, uploadReaderId]);

  useEffect(() => {
    if (uploadMode !== "url" || !config?.readersForType) return;
    const urls = normalizeUrlLines(uploadUrl);
    if (!urls.length) return;
    const firstUrl = urls[0];
    if (!uploadName.trim()) {
      const inferredName = deriveNameFromUrl(firstUrl);
      if (inferredName) setUploadName(inferredName);
    }
    if (!uploadReaderId) {
      const inferredReader = inferReaderFromUrl(firstUrl, config);
      if (inferredReader) setUploadReaderId(inferredReader);
    }
  }, [config, uploadMode, uploadName, uploadReaderId, uploadUrl]);

  useEffect(() => {
    if (!chunkerOptions.length) {
      setUploadChunker("");
      return;
    }
    if (!uploadChunker || !chunkerOptions.find((item) => item.key === uploadChunker)) {
      setUploadChunker(chunkerOptions[0].key);
    }
  }, [chunkerOptions, uploadChunker]);

  useEffect(() => {
    if (!uploadChunker) return;
    const meta = config?.chunkers?.[uploadChunker]?.metadata;
    const nextChunkSize = meta && typeof meta.chunk_size === "number" ? String(meta.chunk_size) : "";
    const nextChunkOverlap =
      meta && typeof meta.chunk_overlap === "number" ? String(meta.chunk_overlap) : "";
    if (nextChunkSize && !uploadChunkSize) setUploadChunkSize(nextChunkSize);
    if (nextChunkOverlap && !uploadChunkOverlap) setUploadChunkOverlap(nextChunkOverlap);
  }, [config?.chunkers, uploadChunkOverlap, uploadChunkSize, uploadChunker]);

  const loadConfig = useCallback(async () => {
    if (!resolvedPort || !agentId) return;
    setConfigLoading(true);
    setConfigError(null);
    try {
      const data = await fetchKnowledgeConfig({
        port: resolvedPort,
        token: token || null,
        dbId: selectedDbId || null
      });
      setConfig(data);
    } catch (err) {
      setConfig(null);
      setConfigError(err instanceof Error ? err.message : "Не удалось получить конфиг");
    } finally {
      setConfigLoading(false);
    }
  }, [agentId, resolvedPort, selectedDbId, token]);

  const loadContent = useCallback(async () => {
    if (!resolvedPort || !agentId) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const data = await fetchKnowledgeContent({
        port: resolvedPort,
        token: token || null,
        dbId: selectedDbId || null,
        limit,
        page,
        sortBy,
        sortOrder
      });
      setContentResponse(data);
    } catch (err) {
      setContentResponse(null);
      setContentError(err instanceof Error ? err.message : "Не удалось загрузить список");
    } finally {
      setContentLoading(false);
    }
  }, [agentId, resolvedPort, selectedDbId, limit, page, sortBy, sortOrder, token]);

  useEffect(() => {
    if (!autoRefresh) return;
    const hasProcessing = (contentResponse?.data || []).some((item) => item.status === "processing");
    if (!hasProcessing) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      loadContent();
    }, 6000);
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, contentResponse?.data, loadContent]);

  const resetUploadForm = useCallback(() => {
    setUploadMode("file");
    setUploadFile(null);
    setUploadUrl("");
    setUploadText("");
    setUploadName("");
    setUploadDescription("");
    setUploadMetadata("");
    setUploadReaderId("");
    setUploadChunker("");
    setUploadChunkSize("");
    setUploadChunkOverlap("");
    setUploadError(null);
  }, []);

  useEffect(() => {
    if (!uploadOpen) {
      resetUploadForm();
    }
  }, [uploadOpen, resetUploadForm]);

  useEffect(() => {
    if (!editOpen) {
      setEditItem(null);
      setEditError(null);
      setEditLoading(false);
      setEditSaving(false);
    }
  }, [editOpen]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchResults(null);
      setSearchError(null);
      setSearchFilterTags([]);
      setSearchPage(1);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!agentId) return;
    loadConfig();
  }, [agentId, loadConfig]);

  useEffect(() => {
    if (!agentId) return;
    loadContent();
  }, [agentId, loadContent]);

  const handleUpload = async () => {
    if (!resolvedPort) return;
    setUploadError(null);
    setNotice(null);
    const metadataCheck = ensureJson(uploadMetadata);
    if (metadataCheck.error) {
      setUploadError(metadataCheck.error);
      return;
    }
    if (uploadMode === "file" && !uploadFile) {
      setUploadError("Выберите файл для загрузки.");
      return;
    }
    if (uploadMode === "url" && !uploadUrl.trim()) {
      setUploadError("Добавьте URL для загрузки.");
      return;
    }
    if (uploadMode === "text" && !uploadText.trim()) {
      setUploadError("Добавьте текст для загрузки.");
      return;
    }

    const payload = new FormData();
    if (uploadMode === "file" && uploadFile) payload.append("file", uploadFile);
    if (uploadMode === "url") {
      const raw = uploadUrl.trim();
      const urlValue = raw.includes("\n")
        ? JSON.stringify(raw.split(/\n+/).map((item) => item.trim()).filter(Boolean))
        : raw;
      payload.append("url", urlValue);
    }
    if (uploadMode === "text") payload.append("text_content", uploadText.trim());
    if (uploadName.trim()) payload.append("name", uploadName.trim());
    if (uploadDescription.trim()) payload.append("description", uploadDescription.trim());
    if (metadataCheck.value) payload.append("metadata", metadataCheck.value);
    if (uploadReaderId && uploadReaderId !== AUTO_READER_VALUE) payload.append("reader_id", uploadReaderId);
    if (uploadChunker && uploadChunker !== AUTO_CHUNKER_VALUE) payload.append("chunker", uploadChunker);
    if (uploadChunkSize) payload.append("chunk_size", uploadChunkSize);
    if (uploadChunkOverlap) payload.append("chunk_overlap", uploadChunkOverlap);

    setUploading(true);
    try {
      await uploadKnowledgeContent(payload, {
        port: resolvedPort,
        token: token || null,
        dbId: selectedDbId || null
      });
      setNotice("Контент принят в обработку. Статус обновится автоматически.");
      setUploadOpen(false);
      loadContent();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = useCallback(
    async (contentId: string) => {
      if (!resolvedPort) return;
      setEditOpen(true);
      setEditLoading(true);
      setEditError(null);
      try {
        const item = await fetchKnowledgeContentById({
          contentId,
          port: resolvedPort,
          token: token || null,
          dbId: selectedDbId || null
        });
        setEditItem(item);
        setEditForm({
          name: item.name || "",
          description: item.description || "",
          metadata: stringifyMetadata(item.metadata),
          readerId: ""
        });
      } catch (err) {
        setEditItem(null);
        setEditError(err instanceof Error ? err.message : "Не удалось получить данные");
      } finally {
        setEditLoading(false);
      }
    },
    [resolvedPort, selectedDbId, token]
  );

  const handleStatusRefresh = async () => {
    if (!editItem?.id || !resolvedPort) return;
    setStatusRefreshing(true);
    setEditError(null);
    try {
      const status = await fetchKnowledgeContentStatus({
        contentId: editItem.id,
        port: resolvedPort,
        token: token || null,
        dbId: selectedDbId || null
      });
      setEditItem((current) =>
        current ? { ...current, status: status.status, status_message: status.status_message } : current
      );
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setStatusRefreshing(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editItem?.id || !resolvedPort) return;
    const metadataCheck = ensureJson(editForm.metadata);
    if (metadataCheck.error) {
      setEditError(metadataCheck.error);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateKnowledgeContent({
        contentId: editItem.id,
        port: resolvedPort,
        token: token || null,
        dbId: selectedDbId || null,
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        metadata: metadataCheck.value || null,
        readerId: editForm.readerId ? editForm.readerId : null
      });
      setEditItem(updated);
      setContentResponse((current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
            }
          : current
      );
      setNotice("Изменения сохранены.");
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Не удалось обновить");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (item: KnowledgeContentItem) => {
    if (!item.id || !resolvedPort) return;
    try {
      await deleteKnowledgeContent(item.id, {
        port: resolvedPort,
        token: token || null,
        dbId: selectedDbId || null
      });
      setContentResponse((current) =>
        current
          ? (() => {
              const nextData = current.data.filter((row) => row.id !== item.id);
              const nextCount = Math.max(0, (current.meta?.total_count || 0) - 1);
              const nextTotalPages = nextCount === 0 ? 0 : Math.max(1, Math.ceil(nextCount / limit));
              return {
                ...current,
                data: nextData,
                meta: { ...current.meta, total_count: nextCount, total_pages: nextTotalPages }
              };
            })()
          : current
      );
      setSelectedIds((current) => current.filter((id) => id !== item.id));
      setNotice("Файл удалён.");
    } catch (err) {
      setContentError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      try {
        await handleDelete({ id });
      } catch (err) {
        setContentError(err instanceof Error ? err.message : "Ошибка удаления");
      }
    }
    setSelectedIds([]);
  };


  const handleSearch = async (pageOverride?: number) => {
    if (!resolvedPort) return;
    setSearchError(null);
    setSearchResults(null);
    if (!searchQuery.trim()) {
      setSearchError("Введите поисковый запрос.");
      return;
    }
    const filterCheck = ensureJson(searchFilters);
    if (filterCheck.error) {
      setSearchError(filterCheck.error);
      return;
    }
    const maxResultsNumber = Number(searchMaxResults);
    const nextPage = pageOverride ?? searchPage;
    let filtersObject: Record<string, unknown> | undefined;
    if (filterCheck.value) {
      const parsed = JSON.parse(filterCheck.value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        filtersObject = { ...(parsed as Record<string, unknown>) };
      }
    }
    if (searchFilterTags.length) {
      filtersObject = { ...(filtersObject || {}), tags: searchFilterTags };
    }
    setSearchLoading(true);
    try {
      const result = await searchKnowledge({
        query: searchQuery.trim(),
        port: resolvedPort,
        token: token || null,
        dbId: selectedDbId || null,
        vectorDbIds:
          searchVectorDbIds.length > 0
            ? searchVectorDbIds
            : selectedDbId
              ? [selectedDbId]
              : undefined,
        searchType,
        maxResults: Number.isFinite(maxResultsNumber) && maxResultsNumber > 0 ? maxResultsNumber : undefined,
        filters: filtersObject,
        page: nextPage,
        limit: Number.isFinite(maxResultsNumber) && maxResultsNumber > 0 ? maxResultsNumber : 20
      });
      setSearchResults(result);
      setSearchPage(nextPage);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Не удалось выполнить поиск");
    } finally {
      setSearchLoading(false);
    }
  };

  const highlightQuery = useCallback((text: string, query: string) => {
    const cleaned = query.trim();
    if (!cleaned) return text;
    const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "ig"));
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <mark key={`${part}-${index}`} className="rounded-sm bg-amber-200/70 px-1">
          {part}
        </mark>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      )
    );
  }, []);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContent.map((item) => item.id));
    }
  };

  if (!agentId) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Выберите агента в списке, чтобы управлять его базой знаний.
      </div>
    );
  }

  if (!resolvedPort) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Не задан порт Agno</AlertTitle>
        <AlertDescription>Укажите порт в настройках агента.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {(configError || contentError) && (
        <Alert variant="destructive">
          <AlertTitle>Проблема с подключением</AlertTitle>
          <AlertDescription>{configError || contentError || "Не удалось получить данные."}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>База знаний</CardTitle>
              <CardDescription>
                Документы агента {instanceName || "—"}. Загрузка, поиск и управление файлами.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setUploadOpen(true)} className="gap-2">
                <UploadCloud className="h-4 w-4" />
                Загрузить
              </Button>
              <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="h-4 w-4" />
                Поиск
              </Button>
              <Button variant="outline" onClick={loadContent} disabled={contentLoading} className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Обновить
              </Button>
            </div>
          </div>

        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              {selectedIds.length ? <span>Выбрано: {selectedIds.length}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedDbId || DEFAULT_DB_VALUE}
                onValueChange={(value) => {
                  setSelectedDbId(value === DEFAULT_DB_VALUE ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vector DB" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_DB_VALUE}>По умолчанию</SelectItem>
                  {vectorDbOptions.map((db) => (
                    <SelectItem key={db.id} value={db.id}>
                      {db.name || db.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="processing">В обработке</SelectItem>
                  <SelectItem value="completed">Готово</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                </SelectContent>
              </Select>
              {selectedIds.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAction({ type: "bulk", ids: selectedIds })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
              ) : null}
            </div>
          </div>

          {contentLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Загрузка списка…</div>
          ) : filteredContent.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Файл</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Размер</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Обновлён</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContent.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelected(item.id)} />
                    </TableCell>
                    <TableCell className="max-w-[260px] whitespace-normal">
                      <div className="text-sm font-medium text-gray-900">
                        {item.name || "Без названия"}
                      </div>
                      {item.description ? (
                        <div className="mt-1 text-xs text-gray-500">{item.description}</div>
                      ) : null}
                      {item.status === "failed" && item.status_message ? (
                        <div className="mt-1 text-xs text-red-500">{item.status_message}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{item.type || "—"}</TableCell>
                    <TableCell className="text-xs text-gray-500">{formatBytes(item.size)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatDateTime(item.updated_at || item.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(item.id)}>
                          <PenLine className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmAction({ type: "single", item })}
                        >
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {contentResponse?.data?.length ? "Нет файлов по фильтру." : "Файлы не найдены."}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Страница {contentResponse?.meta?.page ?? page} из {contentResponse?.meta?.total_pages ?? "—"}
              </span>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} / стр
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2">
                <Checkbox checked={autoRefresh} onCheckedChange={(value) => setAutoRefresh(Boolean(value))} />
                Автообновление
              </label>
              {configLoading ? <span>Обновляем конфиг...</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Назад
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={contentResponse?.meta?.total_pages ? page >= contentResponse.meta.total_pages : true}
                onClick={() => setPage((current) => current + 1)}
              >
                Вперёд
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Загрузить контент</DialogTitle>
            <DialogDescription>
              Файл, URL или текст. Поддерживаемые форматы: {supportedExtensions.join(", ") || "—"}.
            </DialogDescription>
          </DialogHeader>
          {uploadError ? (
            <Alert variant="destructive">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Источник</Label>
              <ToggleGroup
                type="single"
                value={uploadMode}
                onValueChange={(value) => value && setUploadMode(value as UploadMode)}
                className="w-full justify-start"
                variant="outline"
              >
                <ToggleGroupItem value="file">Файл</ToggleGroupItem>
                <ToggleGroupItem value="url">URL</ToggleGroupItem>
                <ToggleGroupItem value="text">Текст</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {uploadMode === "file" ? (
              <div className="space-y-2">
                <Label>Файл</Label>
                <Input
                  type="file"
                  accept={supportedExtensions.length ? supportedExtensions.join(",") : undefined}
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                />
                {uploadFile ? <p className="text-xs text-gray-500">Выбран: {uploadFile.name}</p> : null}
              </div>
            ) : null}
            {uploadMode === "url" ? (
              <div className="space-y-2">
                <Label>URL (по одному в строке)</Label>
                <Textarea value={uploadUrl} onChange={(event) => setUploadUrl(event.target.value)} />
              </div>
            ) : null}
            {uploadMode === "text" ? (
              <div className="space-y-2">
                <Label>Текст</Label>
                <Textarea value={uploadText} onChange={(event) => setUploadText(event.target.value)} />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={uploadName} onChange={(event) => setUploadName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Метаданные (JSON)</Label>
              <Textarea
                value={uploadMetadata}
                onChange={(event) => setUploadMetadata(event.target.value)}
                placeholder='{"tag":"manual"}'
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Reader</Label>
                <Select
                  value={uploadReaderId || AUTO_READER_VALUE}
                  onValueChange={(value) => setUploadReaderId(value === AUTO_READER_VALUE ? "" : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Авто" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_READER_VALUE}>Авто</SelectItem>
                    {readerOptions.map((reader) => (
                      <SelectItem key={reader.id} value={reader.id}>
                        {reader.name || reader.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chunker</Label>
                <Select
                  value={uploadChunker || AUTO_CHUNKER_VALUE}
                  onValueChange={(value) => setUploadChunker(value === AUTO_CHUNKER_VALUE ? "" : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Авто" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_CHUNKER_VALUE}>Авто</SelectItem>
                    {chunkerOptions.map((item) => (
                      <SelectItem key={item.key} value={item.key}>
                        {item.name || item.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chunk size</Label>
                <Input
                  type="number"
                  min={1}
                  value={uploadChunkSize}
                  onChange={(event) => setUploadChunkSize(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Chunk overlap</Label>
                <Input
                  type="number"
                  min={0}
                  value={uploadChunkOverlap}
                  onChange={(event) => setUploadChunkOverlap(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Загрузка..." : "Загрузить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактирование файла</DialogTitle>
            <DialogDescription>Обновите название, описание или метаданные.</DialogDescription>
          </DialogHeader>
          {editLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Загрузка...</div>
          ) : editItem ? (
            <div className="space-y-4">
              {editError ? (
                <Alert variant="destructive">
                  <AlertTitle>Ошибка</AlertTitle>
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 text-xs text-muted-foreground">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ID: {editItem.id}
                  </div>
                  <div>Тип: {editItem.type || "—"}</div>
                  <div>Размер: {formatBytes(editItem.size)}</div>
                </div>
                <div className="space-y-1">
                  <div>Статус: {getStatusLabel(editItem.status)}</div>
                  {editItem.status_message ? <div>Ошибка: {editItem.status_message}</div> : null}
                  <div>Обновлён: {formatDateTime(editItem.updated_at)}</div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    value={editForm.name}
                    onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reader</Label>
                  <Select
                    value={editForm.readerId || AUTO_READER_VALUE}
                    onValueChange={(value) =>
                      setEditForm((current) => ({ ...current, readerId: value === AUTO_READER_VALUE ? "" : value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Авто" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO_READER_VALUE}>Авто</SelectItem>
                      {readerOptions.map((reader) => (
                        <SelectItem key={reader.id} value={reader.id}>
                          {reader.name || reader.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Метаданные (JSON)</Label>
                <Textarea
                  value={editForm.metadata}
                  onChange={(event) => setEditForm((current) => ({ ...current, metadata: event.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">Файл не найден.</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleStatusRefresh} disabled={statusRefreshing || !editItem}>
              <RotateCw className="mr-2 h-4 w-4" />
              Статус
            </Button>
            <Button onClick={handleUpdateItem} disabled={editSaving || !editItem}>
              {editSaving ? "Сохраняем..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="flex max-h-[90vh] w-[min(96vw,1400px)] !max-w-[min(96vw,1400px)] sm:!max-w-[min(96vw,1400px)] flex-col">
          <DialogHeader>
            <DialogTitle>Поиск по базе знаний</DialogTitle>
            <DialogDescription>Введите запрос и выберите параметры поиска.</DialogDescription>
          </DialogHeader>
          {searchError ? (
            <Alert variant="destructive">
              <AlertTitle>Ошибка поиска</AlertTitle>
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label>Запрос</Label>
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Тип поиска</Label>
                <ToggleGroup
                  type="single"
                  value={searchType}
                  onValueChange={(value) => value && setSearchType(value as typeof searchType)}
                  variant="outline"
                >
                  <ToggleGroupItem value="vector">Векторный</ToggleGroupItem>
                  <ToggleGroupItem value="keyword">Ключевой</ToggleGroupItem>
                  <ToggleGroupItem value="hybrid">Гибрид</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max results</Label>
                  <Input
                    type="number"
                    min={1}
                    value={searchMaxResults}
                    onChange={(event) => setSearchMaxResults(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Фильтры (JSON)</Label>
                  <Input
                    value={searchFilters}
                    onChange={(event) => setSearchFilters(event.target.value)}
                    placeholder='{"tag":"manual"}'
                  />
                </div>
              </div>
              {filterTags.length ? (
                <div className="space-y-2">
                  <Label>Теги фильтра</Label>
                  <ToggleGroup
                    type="multiple"
                    value={searchFilterTags}
                    onValueChange={(value) => setSearchFilterTags(value)}
                    variant="outline"
                    className="flex flex-wrap justify-start"
                  >
                    {filterTags.map((tag) => (
                      <ToggleGroupItem key={tag} value={tag}>
                        {tag}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <p className="text-xs text-muted-foreground">Отправляются как filters.tags</p>
                </div>
              ) : null}
              {vectorDbOptions.length ? (
                <div className="space-y-2">
                  <Label>Vector DB</Label>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {vectorDbOptions.map((db) => (
                      <label key={db.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={searchVectorDbIds.includes(db.id)}
                          onCheckedChange={(value) => {
                            setSearchVectorDbIds((current) =>
                              value ? [...current, db.id] : current.filter((item) => item !== db.id)
                            );
                          }}
                        />
                        <span>{db.name || db.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hidden lg:block w-px bg-border" aria-hidden="true" />
            <div className="flex min-h-0 flex-col rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {searchResults ? `Найдено результатов: ${searchResults.meta.total_count}` : "Результаты"}
                </span>
                {searchResults ? (
                  <span>
                    Страница {searchResults.meta.page} из {searchResults.meta.total_pages}
                  </span>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                {searchResults ? (
                  <div className="mt-3 space-y-3">
                    {searchResults.data.length ? (
                      searchResults.data.map((item) => (
                        <div key={item.id} className="space-y-2 rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">{item.name || "Без названия"}</div>
                            {typeof item.reranking_score === "number" ? (
                              <Badge variant="info">score {item.reranking_score.toFixed(2)}</Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-500">
                            {highlightQuery(item.content, searchQuery)}
                          </div>
                          {item.content_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSearchOpen(false);
                                openEditModal(item.content_id || "");
                              }}
                            >
                              Открыть файл
                            </Button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-xs text-muted-foreground">Ничего не найдено.</div>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 text-center text-xs text-muted-foreground">
                    Выполните поиск, чтобы увидеть результаты.
                  </div>
                )}
              </div>
              {searchResults ? (
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={searchLoading || searchResults.meta.page <= 1}
                    onClick={() => handleSearch(Math.max(1, searchResults.meta.page - 1))}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      searchLoading ||
                      (searchResults.meta.total_pages ? searchResults.meta.page >= searchResults.meta.total_pages : true)
                    }
                    onClick={() => handleSearch(searchResults.meta.page + 1)}
                  >
                    Вперёд
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setSearchOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={() => handleSearch(1)} disabled={searchLoading}>
              {searchLoading ? "Ищем..." : "Поиск"}
            </Button>
            {searchResults ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchResults(null);
                  setSearchError(null);
                  setSearchFilters("");
                  setSearchFilterTags([]);
                  setSearchVectorDbIds([]);
                  setSearchPage(1);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Сбросить
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => (!open ? setConfirmAction(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "single"
                ? `Удалить файл "${confirmAction.item.name || confirmAction.item.id}"?`
                : `Удалить выбранные файлы (${confirmAction?.ids.length || 0})?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmAction) return;
                if (confirmAction.type === "single") {
                  await handleDelete(confirmAction.item);
                }
                if (confirmAction.type === "bulk") {
                  await handleBulkDelete(confirmAction.ids);
                }
                setConfirmAction(null);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
