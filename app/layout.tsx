import type { Metadata } from "next";
import "./globals.css";
import { HeaderNav } from "./components/HeaderNav";
import { Footer } from "./components/Footer";

export const metadata: Metadata = {
  title: "The Count of Monte Cristo",
  description:
    "An immersive reader for The Count of Monte Cristo by Alexandre Dumas. Public domain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100"
      >
        <HeaderNav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
