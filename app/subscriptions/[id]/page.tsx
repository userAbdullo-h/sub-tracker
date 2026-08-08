import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import SubscriptionDetailClient from "@/components/SubscriptionDetailClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = (await getRepo().listSubscriptions()).find((s) => s.id === id);
  if (!sub) notFound();
  return (
    <div className="wrap">
      <Nav />
      <SubscriptionDetailClient initial={sub} />
    </div>
  );
}
