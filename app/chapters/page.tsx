import { redirect } from "next/navigation";
import { DEFAULT_BOOK_SLUG } from "@/lib/books";

export default function LegacyChaptersPage() {
  redirect(`/book/${DEFAULT_BOOK_SLUG}`);
}
