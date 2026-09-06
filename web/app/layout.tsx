import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import CookieBanner from "@/app/_components/CookieBanner";

const siteIcon = "/assets/hospitalinsights-logo-icon.png";

export const metadata: Metadata = {
  title: "Hospitalinsights",
  description: "Hospitalinsights",
  icons: {
    icon: siteIcon,
    shortcut: siteIcon,
    apple: siteIcon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
