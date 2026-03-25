import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ssawar",
  description: "AI들끼리 한 판 붙이는 멀티 AI 채팅 세션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
