export type SubStatus = "active" | "trial" | "payment-issue" | "canceled";

/** A payment record and/or attached receipt document. */
export interface Receipt {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number | null;
  note: string;
  file?: string; // stored filename under data/receipts (see /api/receipts/[name])
  origName?: string; // original uploaded filename
}

export interface Subscription {
  id: string;
  name: string;
  price: number | null; // null = unknown, excluded from totals, flagged in UI
  cycleMonths: number;
  nextDate: string; // YYYY-MM-DD
  status: SubStatus;
  notes: string;
  category?: string; // one of lib/vendors CATEGORIES; auto-inferred when missing
  logoDomain?: string; // real service domain used for favicon logo; auto-inferred
  lastPaidAt?: string; // YYYY-MM-DD of the most recent confirmed payment
  receipts?: Receipt[];
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  name: string;
  price: number | null;
  date: string; // YYYY-MM-DD
  category: string;
  notes: string;
  receipts?: Receipt[];
}

export type SubscriptionInput = Omit<Subscription, "id" | "createdAt" | "updatedAt">;
export type PurchaseInput = Omit<Purchase, "id">;
