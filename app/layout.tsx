import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LangGraph 学习实验室",
  description: "用可视化执行轨迹、双语言代码与渐进练习，系统掌握 LangGraph。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "LangGraph 学习实验室",
    description: "把 Agent 工作流真正跑明白",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "LangGraph 学习实验室" }],
  },
  twitter: { card: "summary_large_image", title: "LangGraph 学习实验室", description: "把 Agent 工作流真正跑明白", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
