import { redirect } from "next/navigation";
import { isBookSlug } from "@/lib/book";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BookChaptersPage({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) redirect("/");
  redirect(`/book/${slug}`);
}
