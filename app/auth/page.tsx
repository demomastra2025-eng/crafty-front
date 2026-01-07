"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPrimaryKey, listCompanies, loginUser, registerUser, rotatePrimaryKey, setAuthToken } from "@/lib/evo-auth";
import { getApiKey, setApiKey } from "@/lib/evo-api";

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nextPath = useMemo(() => searchParams.get("next") || "/chats", [searchParams]);

  const handleSubmit = async () => {
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        const res = await loginUser({ email, password });
        setAuthToken(res.token);
        setApiKey(null);
        const companies = await listCompanies();
        if (companies.length > 0) {
          try {
            const primary = await getPrimaryKey(companies[0].id);
            setApiKey(primary.apiKey);
          } catch {
            const primary = await rotatePrimaryKey(companies[0].id);
            setApiKey(primary.apiKey);
          }
        }
      } else {
        const res = await registerUser({ email, password, name: name || undefined });
        setAuthToken(res.token);
        setApiKey(null);
      }
      const redirectPath = mode === "register" ? "/settings?section=access" : nextPath;
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>Access Craftychat with your Evolution account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button className="w-full" onClick={handleSubmit} disabled={pending}>
            {pending ? "Working..." : mode === "login" ? "Sign in" : "Register"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}>
            {mode === "login" ? "Create a new account" : "Already have an account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <AuthPageInner />
    </Suspense>
  );
}
