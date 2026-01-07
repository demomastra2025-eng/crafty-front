"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, Lock, KeyRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProfileSettings } from "./profile-settings";
import { SecuritySettings } from "./security-settings";
import { AccessSettings } from "./access-settings";

type Section = "profile" | "security" | "access";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<Section>("profile");

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "profile" || section === "security" || section === "access") {
      setActiveSection(section);
    }
  }, [searchParams]);

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return <ProfileSettings />;
      case "security":
        return <SecuritySettings />;
      case "access":
        return <AccessSettings />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full max-w-6xl">
        {/* Sidebar Navigation */}
        <aside className="w-64 shrink-0 space-y-2 border-r p-6">
          <h2 className="mb-4 text-lg font-semibold">Settings</h2>
          <nav className="space-y-1">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2",
                activeSection === "profile" && "text-primary bg-gray-100"
              )}
              onClick={() => setActiveSection("profile")}>
              <User className="h-5 w-5" />
              Profile
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2",
                activeSection === "security" && "text-primary bg-gray-100"
              )}
              onClick={() => setActiveSection("security")}>
              <Lock className="h-5 w-5" />
              Security
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2",
                activeSection === "access" && "text-primary bg-gray-100"
              )}
              onClick={() => setActiveSection("access")}>
              <KeyRound className="h-5 w-5" />
              Access
            </Button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">{renderSection()}</main>
      </div>
    </div>
  );
}
