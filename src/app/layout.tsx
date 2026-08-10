import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Geist has no Greek glyphs in any subset it offers — almost all of this
// app's text is Greek, so it silently fell back to the browser's default
// serif font. Inter covers Greek properly and reads as a modern UI font.
const sans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "greek"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM Ασφαλιστικού Γραφείου",
  description: "Διαχείριση πελατών, συμβολαίων και υπενθυμίσεων",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="el"
      className={`${sans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
