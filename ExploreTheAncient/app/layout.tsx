import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import InterfaceEffects from "./InterfaceEffects";

const inter = Inter({
  subsets: ["greek", "latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Explore The Ancients",
  description: "Build a private collection of ancient places across Greece.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <InterfaceEffects />
        {children}
      </body>
    </html>
  );
}
