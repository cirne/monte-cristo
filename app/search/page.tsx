"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { VOLUME_LABELS } from "@/lib/constants";

interface SearchResult {
  number: number;
  title: string;
  volume: string;
  excerpt: string;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: SearchResponse = await res.json();
      setResults(data.results);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  function highlight(text: string, query: string) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="text-xs text-stone-400 hover:text-stone-600 mb-4 inline-block">
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-stone-900 mb-4">Search</h1>

        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chapters, characters, places…"
            autoFocus
            className="w-full px-4 py-3 pr-10 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-base"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {query.length >= 2 && !loading && (
          <p className="text-sm text-stone-500 mt-2">
            {total === 0
              ? "No chapters found"
              : `Found in ${total} chapter${total !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <Link
              key={result.number}
              href={`/chapter/${result.number}`}
              className="block p-4 bg-white border border-stone-200 rounded-xl hover:border-amber-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs text-stone-400 font-mono mr-2">
                    Ch. {result.number}
                  </span>
                  <span className="text-base font-semibold text-stone-800 group-hover:text-amber-700">
                    {highlight(result.title, query)}
                  </span>
                </div>
                <span className="text-xs text-stone-400 flex-shrink-0">
                  {VOLUME_LABELS[result.volume]}
                </span>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed">
                {highlight(result.excerpt, query)}
              </p>
            </Link>
          ))}
        </div>
      )}

      {query.length < 2 && (
        <div className="text-center text-stone-400 mt-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm">Type at least 2 characters to search</p>
          <p className="text-xs mt-1">Search across all 117 chapters of the novel</p>
        </div>
      )}
    </main>
  );
}
