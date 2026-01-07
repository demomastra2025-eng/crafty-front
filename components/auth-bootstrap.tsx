"use client";

import { useEffect } from "react";

import { getApiKey, setApiKey } from "@/lib/evo-api";
import { getPrimaryKey, listCompanies, rotatePrimaryKey } from "@/lib/evo-auth";
import { useToast } from "@/hooks/use-toast";

export function AuthBootstrap() {
  const { toast } = useToast();

  useEffect(() => {
    const storedKey = getApiKey();
    if (storedKey) {
      setApiKey(storedKey);
    }

    let active = true;
    const hydrateKey = async () => {
      try {
        const companies = await listCompanies();
        if (!active) return;
        if (companies.length === 0) {
          setApiKey(null);
          toast({
            title: "Компания не создана",
            description: "Создайте компанию в Settings, чтобы включить API.",
          });
          return;
        }
        try {
          const primary = await getPrimaryKey(companies[0].id);
          if (!active) return;
          setApiKey(primary.apiKey);
        } catch {
          const primary = await rotatePrimaryKey(companies[0].id);
          if (!active) return;
          setApiKey(primary.apiKey);
        }
      } catch {
        // no-op: keep UI working for auth-only scenarios
      }
    };

    hydrateKey();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
