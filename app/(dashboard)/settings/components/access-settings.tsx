"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setApiKey } from "@/lib/evo-api";
import { createCompany, listCompanies, rotatePrimaryKey, getPrimaryKey } from "@/lib/evo-auth";

const COMPANY_STORAGE = "crafty:evo-company";

type Company = { id: string; name: string; role: string };

export function AccessSettings() {
  const [companyName, setCompanyName] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
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

        {error && <div className="text-sm text-red-600">{error}</div>}
      </CardContent>
    </Card>
  );
}
