import { redirect } from "next/navigation";
import { DEFAULT_BOOK_SLUG } from "@/lib/books";

export default function LegacySearchPage() {
  redirect(`/book/${DEFAULT_BOOK_SLUG}/search`);
}
