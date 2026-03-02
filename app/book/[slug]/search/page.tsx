import { notFound } from "next/navigation";
import { getBookConfig, getBookIndex, getVolumeLabels, isBookSlug } from "@/lib/book";
import { SearchContent } from "./SearchContent";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) return { title: "Not Found" };
  const config = getBookConfig(slug);
  if (!config) return { title: "Not Found" };
  return { title: `Search — ${config.title}` };
}

export default async function BookSearchPage({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) notFound();
  const config = getBookConfig(slug);
  if (!config) notFound();

  const book = getBookIndex(slug);
  if (!book) notFound();
  const volumeLabels = getVolumeLabels(slug);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <SearchContent
        slug={slug}
        volumeLabels={volumeLabels}
        totalChapters={book.chapters.length}
      />
    </main>
  );
}
