import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook, getBookConfig, isBookSlug } from "@/lib/book";
import { getEntityStore } from "@/lib/entity-store";
import { getChapterIndex } from "@/lib/chapter-index";
import { CharacterGuide } from "./CharacterGuide";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) return { title: "Not Found" };
  const config = getBookConfig(slug);
  if (!config) return { title: "Not Found" };
  return { title: `Characters — ${config.title}` };
}

export default async function BookCharactersPage({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) notFound();
  const config = getBookConfig(slug);
  if (!config) notFound();

  const book = getBook(slug);
  if (!book) notFound();
  const store = getEntityStore(slug);
  const index = getChapterIndex(slug);
  const persons = Object.values(store.entities)
    .filter((e) => e.type === "person");

  const appearancesByEntityId = new Map<string, Array<{ number: number; title: string }>>();
  for (const ch of index.chapters) {
    for (const { entityId } of ch.entities) {
      if (!store.entities[entityId] || store.entities[entityId].type !== "person") continue;
      const bookChapter = book.chapters.find((c) => c.number === ch.number);
      if (!appearancesByEntityId.has(entityId)) appearancesByEntityId.set(entityId, []);
      appearancesByEntityId.get(entityId)!.push({
        number: ch.number,
        title: bookChapter?.title ?? `Chapter ${ch.number}`,
      });
    }
  }

  const characters = persons
    .map((entity) => {
      const appearances = appearancesByEntityId.get(entity.id) ?? [];
      const firstAppearance = appearances.length > 0 ? appearances[0] : null;
      return { entity, firstAppearance, appearanceCount: appearances.length };
    })
    .sort(
      (a, b) =>
        b.appearanceCount - a.appearanceCount ||
        a.entity.firstSeenInChapter - b.entity.firstSeenInChapter ||
        a.entity.name.localeCompare(b.entity.name)
    )
    .map(({ entity, firstAppearance }) => ({ entity, firstAppearance }));

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href={`/book/${slug}`}
          className="text-xs text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mb-1">
          Character Guide
        </h1>
      </div>
      <CharacterGuide slug={slug} characters={characters} />
    </main>
  );
}
