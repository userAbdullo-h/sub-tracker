import Nav from "@/components/Nav";
import ReviewClient from "@/components/ReviewClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const repo = getRepo();
  const [events, subs, meta] = await Promise.all([
    repo.listDetected(),
    repo.listSubscriptions(),
    repo.getScanMeta(),
  ]);
  const subNames = Object.fromEntries(subs.map((s) => [s.id, s.name]));
  return (
    <div className="wrap">
      <Nav />
      <ReviewClient initial={events} subNames={subNames} lastScanAt={meta.lastScanAt ?? null} />
    </div>
  );
}
