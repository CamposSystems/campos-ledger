import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Camp.OS Ledger",
  description: "Sistema de controlo financeiro familiar de elite",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Camp.OS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  );
}