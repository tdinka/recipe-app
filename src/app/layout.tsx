import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Family Recipe Box",
  description: "Collect recipes from the web, plan meals, and build grocery lists — together.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon/box/192", apple: "/app-icon/box/180" },
  appleWebApp: { capable: true, title: "Recipe Box", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF8F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-16 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
