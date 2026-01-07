"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  SortingState
} from "@tanstack/react-table";
import {
  Search,
  Filter,
  MoreHorizontal,
  X,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import StatCards from "@/app/(dashboard)/customers/components/stat-cards";
import NewCustomer from "@/app/(dashboard)/customers/components/new-customer";
import { fetchContacts, fetchMessages } from "@/lib/db-api";
import {
  findContacts,
  resolveInstance,
  updateBlockStatus,
  readPreferredInstance,
  setPreferredInstance,
  getApiKey
} from "@/lib/evo-api";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { getEvoSocket } from "@/lib/evo-socket";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  remoteJid?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
  isActive: boolean;
  avatar?: string;
}

type EvoContact = {
  id?: string;
  name?: string;
  number?: string;
  remoteJid?: string;
  profilePicUrl?: string | null;
  pushName?: string | null;
};

export default function CustomerList() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [filterActive, setFilterActive] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [blockedMap, setBlockedMap] = useState<Record<string, boolean>>({});
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey());
  const [hasInstance, setHasInstance] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const loadDataRef = useRef<() => void>(() => {});
  const messageStatsRef = useRef<Record<string, { count: number; lastTs?: number }>>({});
  const lastMessageIdRef = useRef<Record<string, string>>({});
  const contactMetaRef = useRef<Record<string, { name?: string; avatar?: string }>>({});
  const showApiKeyAlert = !apiKey;
  const showInstanceAlert = Boolean(apiKey) && !hasInstance;
  const showEmptyAlert = Boolean(apiKey) && hasInstance && !loading && customers.length === 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const currentKey = apiKey || getApiKey();
      if (!currentKey) {
        return;
      }
      const preferred = readPreferredInstance();
      const instanceId = preferred?.id || null;
      const instanceName = preferred?.name || null;

      const [{ contacts: contactRows }, { messages: messageRows }] = await Promise.all([
        fetchContacts(instanceId),
        fetchMessages({ instanceId, limit: 500, order: "desc", recent: true }),
      ]);
      const resolvedInstanceName = instanceName
        ? instanceName
        : await resolveInstance().catch(() => null);

      const targetInstanceName = instanceName || resolvedInstanceName || "";
      setHasInstance(Boolean(targetInstanceName));
      if (!targetInstanceName) {
        // баннер отображается через showInstanceAlert
      }
      if (!instanceName && resolvedInstanceName) {
        setPreferredInstance({ name: resolvedInstanceName });
      }
      let evoContacts: EvoContact[] = [];
      if (targetInstanceName) {
        try {
          const evo = await findContacts(targetInstanceName, {});
          if (Array.isArray(evo)) evoContacts = evo;
          if (Array.isArray((evo as { contacts?: EvoContact[] })?.contacts)) {
            evoContacts = (evo as { contacts?: EvoContact[] }).contacts as EvoContact[];
          }
        } catch (err) {
          console.warn("findContacts failed", err);
        }
      }

      type MessageRow = {
        key?: { remoteJid?: string | null; remoteJidAlt?: string | null; id?: string | null };
        messageTimestamp?: number | null;
      };
      const messageByRemote: Record<string, { count: number; lastTs?: number }> = {};
      (messageRows || []).forEach((raw) => {
        const row = raw as MessageRow;
        const remote = row?.key?.remoteJid || row?.key?.remoteJidAlt;
        if (!remote) return;
        const ts = row?.messageTimestamp || 0;
        if (!messageByRemote[remote]) {
          messageByRemote[remote] = { count: 0, lastTs: ts };
        }
        messageByRemote[remote].count += 1;
        messageByRemote[remote].lastTs = Math.max(messageByRemote[remote].lastTs || 0, ts);
      });

      type ContactRow = {
        id: string;
        remoteJid: string;
        pushName?: string | null;
        profilePicUrl?: string | null;
        createdAt?: string | null;
      };

      const merged = (contactRows || []).map((c) => {
        const contact = c as ContactRow;
        const evo = evoContacts.find(
          (e) => e.remoteJid === contact.remoteJid || e.number === contact.remoteJid
        );
        const metrics = messageByRemote[contact.remoteJid] || { count: 0, lastTs: undefined };
        const lastDate =
          metrics.lastTs && metrics.lastTs > 0
            ? new Date(metrics.lastTs * 1000)
            : contact.createdAt
              ? new Date(contact.createdAt)
              : null;

        return {
          id: contact.id,
          name: contact.pushName || evo?.name || contact.remoteJid,
          phone: contact.remoteJid.replace(/@.*/, ""),
          remoteJid: contact.remoteJid,
          totalOrders: metrics.count,
          totalSpent: 0,
          lastOrder: lastDate ? lastDate.toISOString() : "",
          isActive: metrics.lastTs ? Date.now() - metrics.lastTs * 1000 < 24 * 60 * 60 * 1000 : false,
          avatar: contact.profilePicUrl || evo?.profilePicUrl
        } as Customer;
      });

      const extras = evoContacts
        .filter((e) => !(contactRows || []).some((c) => (c as ContactRow).remoteJid === e.remoteJid))
        .map((e) => {
          const metrics = messageByRemote[e.remoteJid || ""] || { count: 0, lastTs: undefined };
          const lastDate =
            metrics.lastTs && metrics.lastTs > 0 ? new Date(metrics.lastTs * 1000) : null;
          return {
            id: e.id || e.remoteJid || e.number || crypto.randomUUID(),
          name: e.name || e.pushName || e.remoteJid || e.number || "Контакт",
          phone: (e.remoteJid || e.number || "").replace(/@.*/, ""),
          remoteJid: e.remoteJid || e.number,
          totalOrders: metrics.count,
          totalSpent: 0,
          lastOrder: lastDate ? lastDate.toISOString() : "",
          isActive: metrics.lastTs ? Date.now() - metrics.lastTs * 1000 < 24 * 60 * 60 * 1000 : false,
          avatar: e.profilePicUrl || undefined
          } as Customer;
        });

      setCustomers([...merged, ...extras]);
      messageStatsRef.current = messageByRemote;
      const meta: Record<string, { name?: string; avatar?: string }> = {};
      merged.forEach((c) => {
        if (!c.remoteJid) return;
        meta[c.remoteJid] = { name: c.name, avatar: c.avatar };
      });
      extras.forEach((c) => {
        if (!c.remoteJid || meta[c.remoteJid]) return;
        meta[c.remoteJid] = { name: c.name, avatar: c.avatar };
      });
      contactMetaRef.current = meta;
    } finally {
      setLoading(false);
    }
  }, [apiKey, toast]);

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string | null>)?.detail ?? null;
      const nextKey = detail ?? getApiKey();
      setApiKeyState(nextKey);
      setCustomers([]);
      setBlockedMap({});
      if (nextKey) {
        loadDataRef.current();
      }
    };
    window.addEventListener("crafty:apikey-changed", handler as EventListener);
    return () => {
      window.removeEventListener("crafty:apikey-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    const socket = getEvoSocket(apiKey);
    if (!socket) return;

    const ensureCustomer = (remoteJid: string, overrides?: Partial<Customer>) => {
      setCustomers((prev) => {
        const idx = prev.findIndex((c) => c.remoteJid === remoteJid);
        if (idx === -1) {
          const meta = contactMetaRef.current[remoteJid];
          const stats = messageStatsRef.current[remoteJid] || { count: 0, lastTs: undefined };
          const lastOrder = stats.lastTs ? new Date(stats.lastTs * 1000).toISOString() : "";
          const next: Customer = {
            id: remoteJid,
            name: meta?.name || remoteJid,
            phone: remoteJid.replace(/@.*/, ""),
            remoteJid,
            totalOrders: stats.count,
            totalSpent: 0,
            lastOrder,
            isActive: stats.lastTs ? Date.now() - stats.lastTs * 1000 < 24 * 60 * 60 * 1000 : false,
            avatar: meta?.avatar,
            ...overrides
          };
          return [next, ...prev];
        }
        const updated = { ...prev[idx], ...overrides };
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    };

    const handleConnect = () => {
      loadDataRef.current();
    };
    socket.on("connect", handleConnect);

    const handleContactsUpdate = (payload: { data?: EvoContact | EvoContact[] }) => {
      const data = payload?.data;
      const items = Array.isArray(data) ? data : data ? [data] : [];
      items.forEach((item) => {
        const remoteJid = item.remoteJid || item.number;
        if (!remoteJid) return;
        const name = item.pushName || item.name || remoteJid;
        const avatar = item.profilePicUrl || undefined;
        contactMetaRef.current[remoteJid] = { name, avatar };
        ensureCustomer(remoteJid, { name, avatar, remoteJid, phone: remoteJid.replace(/@.*/, "") });
      });
    };
    socket.on("contacts.update", handleContactsUpdate);

    const handleMessagesUpsert = (payload: {
      data?: {
        key?: { remoteJid?: string | null; remoteJidAlt?: string | null; id?: string | null };
        messageTimestamp?: number | null;
      };
    }) => {
      const data = payload?.data;
      const remoteJid = data?.key?.remoteJid || data?.key?.remoteJidAlt || null;
      if (!remoteJid) return;
      const keyId = data?.key?.id || null;
      if (keyId && lastMessageIdRef.current[remoteJid] === keyId) return;
      if (keyId) lastMessageIdRef.current[remoteJid] = keyId;
      const ts = data?.messageTimestamp || Math.floor(Date.now() / 1000);
      const stats = messageStatsRef.current[remoteJid] || { count: 0, lastTs: undefined };
      stats.count += 1;
      stats.lastTs = Math.max(stats.lastTs || 0, ts || 0);
      messageStatsRef.current[remoteJid] = stats;
      const lastOrder = stats.lastTs ? new Date(stats.lastTs * 1000).toISOString() : "";
      ensureCustomer(remoteJid, {
        totalOrders: stats.count,
        lastOrder,
        isActive: stats.lastTs ? Date.now() - stats.lastTs * 1000 < 24 * 60 * 60 * 1000 : false
      });
    };
    socket.on("messages.upsert", handleMessagesUpsert);

    const handleMessagesUpdate = (payload: { data?: { remoteJid?: string | null } }) => {
      const remoteJid = payload?.data?.remoteJid || null;
      if (!remoteJid) return;
      ensureCustomer(remoteJid);
    };
    socket.on("messages.update", handleMessagesUpdate);

    const handleInstanceCreate = () => loadDataRef.current();
    const handleInstanceDelete = () => loadDataRef.current();
    const handleConnectionUpdate = () => loadDataRef.current();
    const handleStatusInstance = () => loadDataRef.current();
    const handleConnectError = (err: unknown) => {
      console.warn("socket connect_error", err);
    };
    socket.on("instance.create", handleInstanceCreate);
    socket.on("instance.delete", handleInstanceDelete);
    socket.on("connection.update", handleConnectionUpdate);
    socket.on("status.instance", handleStatusInstance);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("contacts.update", handleContactsUpdate);
      socket.off("messages.upsert", handleMessagesUpsert);
      socket.off("messages.update", handleMessagesUpdate);
      socket.off("instance.create", handleInstanceCreate);
      socket.off("instance.delete", handleInstanceDelete);
      socket.off("connection.update", handleConnectionUpdate);
      socket.off("status.instance", handleStatusInstance);
      socket.off("connect_error", handleConnectError);
    };
  }, [apiKey]);

  const columns: ColumnDef<Customer>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-muted-foreground h-auto p-0! text-xs! font-medium tracking-wider uppercase hover:bg-transparent">
            Имя
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const customer = row.original;
        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={customer.avatar} alt={customer.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {customer.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-foreground font-medium">{customer.name}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "phone",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-muted-foreground h-auto p-0! text-xs! font-medium tracking-wider uppercase hover:bg-transparent">
            Телефон
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("phone")}</span>
    },
    {
      accessorKey: "totalOrders",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-muted-foreground h-auto p-0! text-xs! font-medium tracking-wider uppercase hover:bg-transparent">
            Сообщений
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <span className="text-foreground">{row.getValue("totalOrders")}</span>
    },
    {
      accessorKey: "lastOrder",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-muted-foreground h-auto p-0 font-medium tracking-wider hover:bg-transparent">
            ПОСЛ. АКТИВНОСТЬ
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const raw = row.getValue("lastOrder") as string;
        const date = raw ? new Date(raw) : null;
        const formatted = date && !isNaN(date.getTime())
          ? new Intl.DateTimeFormat("ru-KZ", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            }).format(date)
          : "—";
        return <span className="text-muted-foreground">{formatted}</span>;
      }
    },
    {
      accessorKey: "isActive",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-muted-foreground h-auto p-0 font-medium tracking-wider hover:bg-transparent">
            Статус
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const active = row.getValue("isActive") as boolean;
        return (
          <Badge variant={active ? "secondary" : "outline"}>
            {active ? "На связи" : "Оффлайн"}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const customer = row.original;
        const isBlocked = blockedMap[customer.remoteJid || customer.id] || false;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  customer.remoteJid
                    ? router.push(`/chats?jid=${encodeURIComponent(customer.remoteJid)}`)
                    : router.push("/chats")
                }>
                Открыть чат
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBlockToggle(customer)}
                className={isBlocked ? "text-destructive" : ""}>
                {isBlocked ? "Разблокировать" : "Заблокировать"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Удалить</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ];

  const table = useReactTable({
    data: customers,
    columns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      globalFilter,
      rowSelection
    }
  });

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.isActive).length;
  const newCustomers = useMemo(
    () =>
      customers.filter((c) => {
        const d = c.lastOrder ? new Date(c.lastOrder) : null;
        return d && d.getMonth() === new Date().getMonth();
      }).length,
    [customers]
  );

  async function handleBlockToggle(customer: Customer) {
    if (!customer.remoteJid) return;
    const nextState = !blockedMap[customer.remoteJid];
    setBlockedMap((prev) => ({ ...prev, [customer.remoteJid!]: nextState }));
    try {
      const instance = await resolveInstance();
      if (!instance) throw new Error("Нет instance");
      await updateBlockStatus(instance, customer.remoteJid, nextState);
      toast({
        title: nextState ? "Контакт заблокирован" : "Контакт разблокирован",
        description: customer.remoteJid
      });
    } catch (err) {
      console.error("block/unblock failed", err);
      toast({ title: "Не удалось выполнить операцию" });
      setBlockedMap((prev) => ({ ...prev, [customer.remoteJid!]: !nextState }));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-foreground text-2xl font-semibold">Клиенты</h1>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <NewCustomer />
      </div>

      <StatCards
        activeCustomers={activeCustomers}
        newCustomers={newCustomers}
        totalCustomers={totalCustomers}
      />

      {showApiKeyAlert ? (
        <Alert variant="destructive">
          <AlertTitle>Нет API-ключа</AlertTitle>
          <AlertDescription>
            <p>Добавьте ключ в Settings → Access, чтобы увидеть клиентов.</p>
            <Button asChild size="sm" className="mt-2">
              <Link href="/settings">Открыть Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : showInstanceAlert ? (
        <Alert>
          <AlertTitle>Инстансы не найдены</AlertTitle>
          <AlertDescription>
            <p>Создайте инстанс и подключите WhatsApp, чтобы появились клиенты.</p>
            <Button asChild size="sm" className="mt-2">
              <Link href="/connections">Перейти к Connections</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : showEmptyAlert ? (
        <Alert>
          <AlertTitle>Клиентов пока нет</AlertTitle>
          <AlertDescription>
            <p>Как только пойдут диалоги, список появится здесь автоматически.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Поиск по клиентам"
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(String(event.target.value))}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {filterActive && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Время: последние 30 дней
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterActive(false)} />
            </Badge>
          )}
          <Button variant="outline" className="flex items-center gap-2" onClick={loadData}>
            <Filter />
            Обновить
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="py-0">
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-muted-foreground text-xs font-medium tracking-wider">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-muted/50">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      {loading ? "Загружаем…" : "Нет данных."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-muted-foreground text-sm">
            Показываем{" "}
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )} из {table.getFilteredRowModel().rows.length}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
            Назад
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}>
            Далее
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
