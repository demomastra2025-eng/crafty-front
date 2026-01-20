"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setApiKey, fetchLlmModels, type LlmModel } from "@/lib/evo-api";
import {
  createCompany,
  listCompanies,
  rotatePrimaryKey,
  getPrimaryKey,
  listCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  type CredentialItem
} from "@/lib/evo-auth";

const COMPANY_STORAGE = "crafty:evo-company";

type Company = { id: string; name: string; role: string; agnoPorts?: number[] };

export function AccessSettings() {
  const [companyName, setCompanyName] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [credentialName, setCredentialName] = useState("");
  const [credentialProvider, setCredentialProvider] = useState("");
  const [credentialUrl, setCredentialUrl] = useState("");
  const [credentialKey, setCredentialKey] = useState("");
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [credentialMode, setCredentialMode] = useState<"create" | "edit">("create");
  const [credentialEditing, setCredentialEditing] = useState<CredentialItem | null>(null);
  const [credentialDeleting, setCredentialDeleting] = useState<CredentialItem | null>(null);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCompanies()
      .then((data) => {
        setCompanies(data);
        const stored = typeof window !== "undefined" ? localStorage.getItem(COMPANY_STORAGE) : null;
        const fallback = stored && data.find((c) => c.id === stored) ? stored : data[0]?.id || null;
        setSelectedCompany(fallback);
        if (fallback && !primaryKey) {
          getPrimaryKey(fallback)
            .then((res) => {
              setPrimaryKey(res.apiKey);
              setApiKey(res.apiKey);
            })
            .catch(() => {
              // ignore missing key
            });
        }
      })
      .catch(() => setCompanies([]));

    fetchLlmModels()
      .then((data) => setModels(Array.isArray(data) ? data : []))
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(COMPANY_STORAGE, selectedCompany);
    }
  }, [selectedCompany]);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompany) || null,
    [companies, selectedCompany]
  );

  useEffect(() => {
    if (!selectedCompany) return;
    listCredentials(selectedCompany)
      .then((items) => setCredentials(items))
      .catch(() => setCredentials([]));
  }, [selectedCompany]);

  const handleCreateCompany = async () => {
    if (!companyName.trim()) return;
    setError(null);
    try {
      const company = await createCompany({ name: companyName.trim() });
      const next = await listCompanies();
      setCompanies(next);
      setCompanyName("");
      setSelectedCompany(company.id);
      if (company.primaryKey) {
        setPrimaryKey(company.primaryKey);
        setApiKey(company.primaryKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create company failed");
    }
  };

  const handleRotateKey = async () => {
    if (!selectedCompany) return;
    setError(null);
    try {
      const result = await rotatePrimaryKey(selectedCompany);
      setPrimaryKey(result.apiKey);
      setApiKey(result.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotate key failed");
    }
  };

  const handleCreateCredential = async () => {
    if (!selectedCompany) return;
    if (!credentialName.trim() || !credentialProvider.trim() || !credentialKey.trim()) return;
    setError(null);
    try {
      const created = await createCredential(selectedCompany, {
        name: credentialName.trim(),
        provider: credentialProvider.trim(),
        apiKey: credentialKey.trim(),
        url: credentialUrl.trim() || undefined
      });
      setCredentials((current) => [created, ...current]);
      setCredentialModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create credentials failed");
    }
  };

  const handleUpdateCredential = async () => {
    if (!selectedCompany || !credentialEditing) return;
    if (!credentialName.trim() || !credentialProvider.trim()) return;
    setError(null);
    try {
      const updated = await updateCredential(selectedCompany, credentialEditing.id, {
        name: credentialName.trim(),
        provider: credentialProvider.trim(),
        apiKey: credentialKey.trim() || undefined,
        url: credentialUrl.trim() || undefined
      });
      setCredentials((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
      setCredentialModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update credentials failed");
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    if (!selectedCompany) return;
    setError(null);
    try {
      await deleteCredential(selectedCompany, credentialId);
      setCredentials((current) => current.filter((item) => item.id !== credentialId));
      setCredentialDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete credentials failed");
    }
  };

  const providerOptions = useMemo(() => {
    const unique = new Set(models.map((model) => model.provider).filter(Boolean));
    if (credentialProvider) unique.add(credentialProvider);
    return Array.from(unique).sort();
  }, [models, credentialProvider]);

  const openCreateCredential = () => {
    setCredentialMode("create");
    setCredentialEditing(null);
    setCredentialName("");
    setCredentialProvider(providerOptions[0] || "");
    setCredentialUrl("");
    setCredentialKey("");
    setCredentialModalOpen(true);
  };

  const openEditCredential = (item: CredentialItem) => {
    setCredentialMode("edit");
    setCredentialEditing(item);
    setCredentialName(item.name || "");
    setCredentialProvider(item.provider || providerOptions[0] || "");
    setCredentialUrl(item.url || "");
    setCredentialKey("");
    setCredentialModalOpen(true);
  };

  useEffect(() => {
    if (!credentialModalOpen) {
      setCredentialEditing(null);
      setCredentialMode("create");
      setCredentialName("");
      setCredentialProvider("");
      setCredentialUrl("");
      setCredentialKey("");
    }
  }, [credentialModalOpen]);

  return (
    <Card className="border-none shadow-none">
      <CardHeader>
        <CardTitle>Access & API Keys</CardTitle>
        <CardDescription>Create users, companies, and API keys for Evolution API.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Company</h3>
          {companies.length === 0 ? (
            <div className="flex items-center gap-2">
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
              />
              <Button onClick={handleCreateCompany}>Create</Button>
            </div>
          ) : (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{activeCompany?.name}</div>
              <div className="text-muted-foreground">Role: {activeCompany?.role}</div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">API Key</h3>
          {primaryKey ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">Primary key:</div>
              <div className="mt-1 break-all">{primaryKey}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={handleRotateKey} disabled={!selectedCompany}>
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={handleRotateKey} disabled={!selectedCompany}>
              Regenerate key
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Credentials</h3>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Управляйте API ключами провайдеров. Создание и правки открываются в модалке.
            </p>
            <Button size="sm" onClick={openCreateCredential} disabled={!selectedCompany}>
              Добавить
            </Button>
          </div>

          <div className="rounded-md border">
            {credentials.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No credentials yet.</div>
            ) : (
              <div className="divide-y">
                {credentials.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                    <div className="space-y-1">
                      <div className="font-medium">{item.name || "Untitled"}</div>
                      <div className="text-muted-foreground">
                        {item.provider}
                        {item.url ? ` • ${item.url}` : ""}
                      </div>
                      <div className="text-muted-foreground">Key: {item.apiKey || "****"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditCredential(item)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => setCredentialDeleting(item)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </CardContent>

      <Dialog open={credentialModalOpen} onOpenChange={setCredentialModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{credentialMode === "create" ? "Новые credentials" : "Изменить credentials"}</DialogTitle>
            <DialogDescription>Добавьте название, провайдера и ключ.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={credentialName}
                onChange={(event) => setCredentialName(event.target.value)}
                placeholder="OpenAI ключ"
              />
            </div>
            <div className="space-y-2">
              <Label>Провайдер</Label>
              <Select
                value={credentialProvider}
                onValueChange={(value) => setCredentialProvider(value)}
                disabled={!providerOptions.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={providerOptions.length ? "Выберите" : "Нет моделей"} />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL (опционально)</Label>
              <Input
                value={credentialUrl}
                onChange={(event) => setCredentialUrl(event.target.value)}
                placeholder="https://api.provider.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{credentialMode === "edit" ? "Новый API ключ (опционально)" : "API ключ"}</Label>
              <Input
                value={credentialKey}
                onChange={(event) => setCredentialKey(event.target.value)}
                placeholder="sk-..."
                type="password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={credentialMode === "create" ? handleCreateCredential : handleUpdateCredential}
              disabled={!selectedCompany || !credentialName.trim() || !credentialProvider.trim()}
            >
              {credentialMode === "create" ? "Создать" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(credentialDeleting)} onOpenChange={(open) => (!open ? setCredentialDeleting(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить credentials?</AlertDialogTitle>
            <AlertDialogDescription>
              {credentialDeleting?.name || "Без названия"} будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => credentialDeleting && handleDeleteCredential(credentialDeleting.id)}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
