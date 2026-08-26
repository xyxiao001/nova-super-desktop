import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${protocol}://${host}`;
  const title = "照片工坊 · Photo Studio";
  const description = "在浏览器里，像照片一样编辑。导入图片，实时调整光效、颜色、滤镜与裁剪并导出成品。";
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: `${base}/og.png`, width: 1200, height: 630, alt: "照片工坊图片编辑器" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${base}/og.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
