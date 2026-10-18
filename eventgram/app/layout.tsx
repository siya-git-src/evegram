import type { Metadata, Viewport } from "next";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Eventgram",
  description: "Every VIT event in one feed. Filter by date, club and OD, watch the reels, register on EventHub.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF0B3" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1311" },
  ],
};

// Applies the saved light/dark choice before the page paints, so it doesn't flash.
const themeScript = `try{var t=localStorage.getItem("eg-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Shrikhand&family=Archivo:wdth,wght@62..125,400..900&display=swap"
        />
      </head>
      <body>
        <header className="brandbar">
          <div className="wrap bar">
            <Link href="/" className="logo">event<span>gram</span></Link>
            <ThemeToggle />
          </div>
        </header>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
