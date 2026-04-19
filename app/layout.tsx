import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Configurações da tela do celular (impede zoom de "pinça" que quebra o layout)
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Avisa o iPhone que isso é um aplicativo instalável
export const metadata: Metadata = {
  title: "Camp.OS Ledger",
  description: "Gestão Financeira Premium",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ledger",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-neutral-950 text-white antialiased selection:bg-orange-500/30`}>
        {children}
      </body>
    </html>
  );
}