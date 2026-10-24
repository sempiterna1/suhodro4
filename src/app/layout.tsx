import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Последний горизонт — прототип кооперативного Tower Defense",
  description:
    "Прототип кооперативного Tower Defense в мире, который убил живой минерал: защитите лагерь беженцев от заражённых — 10 волн, слияние башен, Охотница и загадочный ИИ на связи.",
  keywords: ["Tower Defense", "прототип", "стимпанк", "кооператив", "GDD"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* один шрифт на весь интерфейс (есть кириллица); холст рисует подписи тем же семейством */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
