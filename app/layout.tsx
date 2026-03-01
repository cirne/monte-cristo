import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

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
        <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
          <nav className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-6 text-sm">
            <Link href="/" className="font-semibold text-stone-800 hover:text-stone-600">
              Monte Cristo
            </Link>
            <Link href="/chapters" className="text-stone-500 hover:text-stone-700">
              Chapters
            </Link>
            <Link href="/characters" className="text-stone-500 hover:text-stone-700">
              Characters
            </Link>
            <Link href="/search" className="text-stone-500 hover:text-stone-700">
              Search
            </Link>
          </nav>
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
