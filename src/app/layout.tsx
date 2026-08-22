import type { Metadata } from "next";
import { Noto_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Geist has no Greek glyphs at all — almost all of this app's text is
// Greek, so it silently fell back to the browser's default serif font.
// Inter replaced it, but Inter's Greek is drawn by a Latin-first eye: its
// ω has flat tops and a very high middle joint, so it reads as a Latin
// "w" to a Greek reader. Noto Sans is designed script-by-script, its ω has
// the proper rounded bowls — and it renders Greek ~5% NARROWER than Inter,
// so the dense tables didn't lose any room.
const sans = Noto_Sans({
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
