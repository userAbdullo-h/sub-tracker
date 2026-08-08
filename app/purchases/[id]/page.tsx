import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import PurchaseDetailClient from "@/components/PurchaseDetailClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pur = (await getRepo().listPurchases()).find((p) => p.id === id);
  if (!pur) notFound();
  return (
    <div className="wrap">
      <Nav />
      <PurchaseDetailClient initial={pur} />
    </div>
  );
}
