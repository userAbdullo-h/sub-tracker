import Nav from "@/components/Nav";
import PurchasesClient from "@/components/PurchasesClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const purs = await getRepo().listPurchases();
  return (
    <div className="wrap">
      <Nav />
      <PurchasesClient initial={purs} />
    </div>
  );
}
