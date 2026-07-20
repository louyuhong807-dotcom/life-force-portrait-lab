import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import RuntimeGuard from "./runtime-guard";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const title = "生命感实验室｜人像摄影修图神器";
  const description = "基于 Fantasy 生命感人像摄影 Skill 的浏览器本地修图工具：保留人物身份，重做光线、色彩与摄影质感。";

  return {
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: [{ url: `${origin}/og.png`, width: 1733, height: 909, alt: "生命感实验室——把普通照片，重新看见。" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2efe8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><RuntimeGuard>{children}</RuntimeGuard></body>
    </html>
  );
}
