import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata = {
  title: "PlantChain - 植物种植上链记录",
  description: "去中心化的植物养护与成长记录平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
