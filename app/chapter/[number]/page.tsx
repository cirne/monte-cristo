import { redirect } from "next/navigation";
import { DEFAULT_BOOK_SLUG } from "@/lib/books";

interface Props {
  params: Promise<{ number: string }>;
}

export default async function LegacyChapterPage({ params }: Props) {
  const { number } = await params;
  redirect(`/book/${DEFAULT_BOOK_SLUG}/chapter/${number}`);
}
