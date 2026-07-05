import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradPath Admin",
  description: "TradPath super admin portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-adminbg text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
