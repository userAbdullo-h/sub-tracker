import Nav from "@/components/Nav";
import SubscriptionsClient from "@/components/SubscriptionsClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const subs = await getRepo().listSubscriptions();
  return (
    <div className="wrap">
      <Nav />
      <SubscriptionsClient initial={subs} />
    </div>
  );
}
