import type { Metadata } from "next";
import "./globals.css";
import { HeaderNav } from "./components/HeaderNav";
import { HeaderProgressBar } from "./components/HeaderProgressBar";

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
        className="antialiased min-h-screen bg-stone-50 text-stone-900"
      >
        <header className="border-b border-stone-200 bg-white sticky top-0 z-10 flex flex-col">
          <HeaderNav />
          <HeaderProgressBar />
        </header>
        {children}
        <footer className="border-t border-stone-200 mt-16 py-6 text-center text-xs text-stone-400">
          <p>
            <em>The Count of Monte Cristo</em> by Alexandre Dumas, père — Public Domain
          </p>
          <p className="mt-1">
            Source:{" "}
            <a
              href="https://www.gutenberg.org/ebooks/1184"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Project Gutenberg #1184
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
