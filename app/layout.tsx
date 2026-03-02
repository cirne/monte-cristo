import type { Metadata } from "next";
import "./globals.css";
import { HeaderNav } from "./components/HeaderNav";
import { HeaderProgressBar } from "./components/HeaderProgressBar";
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
        <header className="border-b border-stone-200 bg-white sticky top-0 z-10 flex flex-col dark:border-stone-800 dark:bg-stone-900">
          <HeaderNav />
          <HeaderProgressBar />
        </header>
        {children}
        <Footer />
      </body>
    </html>
  );
}
