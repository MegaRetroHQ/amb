import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Unbounded, Inter } from "next/font/google";
import { TooltipProvider } from "@amb-app/ui/components/tooltip";
import "./globals.css";
import { cn } from "@amb-app/ui/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const bodyFont = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Agent Message Bus",
  description: "Agent and message management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(bodyFont.variable, displayFont.variable, "font-sans", inter.variable)}>
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
