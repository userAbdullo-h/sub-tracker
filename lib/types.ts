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

/* ---------------- Gmail scan (Phase 2) ---------------- */

export type DetectedKind = "charge" | "renewal_notice" | "failure" | "trial" | "refund";

export type DetectedStatus =
  | "pending" // waiting for owner review
  | "approved" // owner accepted it (record created/updated)
  | "dismissed" // owner rejected it as noise
  | "auto"; // scanner applied it automatically (matched charge/failure)

/** A normalized event extracted from one email by the scan pipeline. */
export interface DetectedEvent {
  id: string;
  vendor: string; // parser's best product/vendor name, e.g. "AI Content Accelerator"
  amount: number | null;
  date: string; // YYYY-MM-DD (email date unless the parser found a better one)
  kind: DetectedKind;
  emailDate?: string; // YYYY-MM-DD the email arrived (date may differ, e.g. a stated renewal date)
  sourceMsgId: string; // Gmail message id — idempotency key
  emailFrom: string;
  emailSubject: string;
  parser: string; // which parser produced this event
  status: DetectedStatus;
  subscriptionId?: string; // set when matched to an existing subscription
  autoNote?: string; // what the scanner did automatically, if anything
  createdAt: string;
}

export interface ScanMeta {
  lastScanAt?: string; // ISO timestamp of the last completed scan
  gmailWatermark?: number; // epoch seconds — only emails newer than this are fetched
  gmailRefreshToken?: string; // set by /api/gmail/callback after "Connect Gmail" consent
  gmailConnectedAt?: string;
}
