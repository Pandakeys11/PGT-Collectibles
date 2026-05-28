import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PokemonMarketIntelView } from "@/components/market/pokemon-market-intel-view";
import { buildPokemonMarketKnowledge } from "@/lib/market/pokemon-market-knowledge";

type PageProps = {
  params: Promise<{ catalogId: string }>;
};

async function loadKnowledge(catalogId: string) {
  const id = decodeURIComponent(catalogId).trim();
  if (!id) return null;
  return buildPokemonMarketKnowledge(id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { catalogId } = await params;
  const knowledge = await loadKnowledge(catalogId);
  const name = knowledge?.card?.name;
  return {
    title: name ? `${name} · Market` : "Market intel",
    description: name
      ? `Institutional market intelligence for ${name} (${knowledge?.catalogId ?? catalogId}).`
      : "Pokémon market intelligence by catalog ID.",
  };
}

export default async function PokemonMarketPage({ params }: PageProps) {
  const { catalogId } = await params;
  const knowledge = await loadKnowledge(catalogId);
  if (!knowledge?.card) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl pb-8">
      <PokemonMarketIntelView initial={knowledge} />
    </div>
  );
}
