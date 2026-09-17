import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Finaz - Financial Intelligence & Analytics",
  description: "Plataforma de inteligencia financiera y auditoría de transacciones",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen text-slate-900`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
