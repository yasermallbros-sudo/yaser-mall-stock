import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Yaser Mall Stock",
  description: "Internal inventory audit system",
  manifest: "/manifest.webmanifest",
  themeColor: "#166534",
  appleWebApp: { capable: true, title: "Yaser Stock", statusBarStyle: "default" },
  viewport: { width: "device-width", initialScale: 1, maximumScale: 1 }
};
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><PwaRegister />{children}</body></html>; }
