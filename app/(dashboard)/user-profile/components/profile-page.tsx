"use client";

import { useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMe } from "@/lib/evo-auth";

type User = { id: string; email: string; name?: string | null };

const initialsFrom = (name?: string | null, email?: string | null) => {
  const base = (name || email || "").trim();
  if (!base) return "U";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const initials = useMemo(() => initialsFrom(user?.name, user?.email), [user?.name, user?.email]);
  const displayName = user?.name || user?.email || "User";

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Account details for the current session.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 md:flex-row">
          <Avatar className="h-24 w-24">
            <AvatarImage src="/logo.png" alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <div className="text-2xl font-semibold">{displayName}</div>
            <div className="text-sm text-muted-foreground">{user?.email || "Email not available"}</div>
            <div className="text-xs text-muted-foreground">User ID: {user?.id || "—"}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
