export type SubStatus = "active" | "trial" | "payment-issue" | "canceled";

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
}

export type SubscriptionInput = Omit<Subscription, "id" | "createdAt" | "updatedAt">;
export type PurchaseInput = Omit<Purchase, "id">;
