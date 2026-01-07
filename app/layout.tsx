import React from "react";
import type { Metadata } from "next";

import { Plus_Jakarta_Sans } from "next/font/google";
import GoogleAnalyticsInit from "@/lib/ga";
import { Toaster } from "@/components/ui/toaster";

import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  weight: ["200", "300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakartaSans.className} antialiased`} suppressHydrationWarning>
      <body>
        {children}
        <Toaster />
        {process.env.NODE_ENV === "production" ? <GoogleAnalyticsInit /> : null}
      </body>
    </html>
  );
}
