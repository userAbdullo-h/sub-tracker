import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { advanceDate } from "@/lib/calc";

type Params = { params: Promise<{ id: string }> };

interface ActionBody {
  action: "dismiss" | "approve";
  /** approve target: create a subscription or a one-time purchase from this event */
  as?: "subscription" | "purchase";
  /** optional overrides when creating */
  price?: number | null;
  cycleMonths?: number;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const body = (await req.json()) as ActionBody;
    const repo = getRepo();
    const event = (await repo.listDetected()).find((e) => e.id === id);
    if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (event.status !== "pending") {
      return NextResponse.json({ error: `already ${event.status}` }, { status: 409 });
    }

    if (body.action === "dismiss") {
      return NextResponse.json(await repo.updateDetected(id, { status: "dismissed" }));
    }

    if (body.action === "approve") {
      const today = new Date().toISOString().slice(0, 10);

      if (event.subscriptionId) {
        // Matched but not auto-applied (renewal notice / trial / refund):
        // approving a renewal_notice adopts its date as the next renewal.
        let note = "Applied to matched subscription";
        if (event.kind === "renewal_notice") {
          const sub = (await repo.listSubscriptions()).find((s) => s.id === event.subscriptionId);
          // A notice is superseded when the subscription was paid after the
          // email arrived (e.g. July's "expires Aug 23" notice after the Aug 8
          // renewal charge already advanced the date to next year).
          const superseded = !!sub?.lastPaidAt && sub.lastPaidAt >= (event.emailDate ?? event.date);
          if (sub && !superseded) {
            await repo.updateSubscription(sub.id, {
              nextDate: event.date,
              price: sub.price ?? event.amount,
            });
          } else if (superseded) {
            note = "Notice superseded by a later payment — nothing changed";
          }
        }
        return NextResponse.json(
          await repo.updateDetected(id, { status: "approved", autoNote: note })
        );
      }

      if (body.as === "purchase") {
        const pur = await repo.createPurchase({
          name: event.vendor,
          price: event.amount,
          date: event.date,
          category: "Other",
          notes: `From Gmail scan: "${event.emailSubject}"`,
        });
        return NextResponse.json(
          await repo.updateDetected(id, { status: "approved", autoNote: `Created purchase "${pur.name}"` })
        );
      }

      // Default: create a subscription seeded from the event
      const cycle = body.cycleMonths && body.cycleMonths > 0 ? body.cycleMonths : 1;
      const sub = await repo.createSubscription({
        name: event.vendor,
        price: body.price !== undefined ? body.price : event.amount,
        cycleMonths: cycle,
        nextDate: event.kind === "renewal_notice" ? event.date : advanceDate(event.date, cycle),
        status: event.kind === "failure" ? "payment-issue" : event.kind === "trial" ? "trial" : "active",
        notes: `From Gmail scan: "${event.emailSubject}"`,
        lastPaidAt: event.kind === "charge" ? event.date : undefined,
        receipts:
          event.kind === "charge"
            ? [{ id: randomUUID(), date: event.date, amount: event.amount, note: "Charge detected in Gmail" }]
            : [],
      });
      return NextResponse.json(
        await repo.updateDetected(id, {
          status: "approved",
          subscriptionId: sub.id,
          autoNote: `Created subscription "${sub.name}"`,
        })
      );
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
