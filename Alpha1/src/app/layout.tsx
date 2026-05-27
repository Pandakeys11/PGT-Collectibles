import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces } from "next/font/google";
import localFont from "next/font/local";
import { MotionProvider } from "@/components/motion/motion-provider";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PGT Collectibles",
  description:
    "Mobile-first Pokemon and TCG card scanner with catalog matching, market evidence, and CSV/JSON export.",
  icons: {
    icon: "/branding/logo-icon.png",
    apple: "/branding/logo-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080a0e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <ClerkProvider>
          <MotionProvider>{children}</MotionProvider>
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
