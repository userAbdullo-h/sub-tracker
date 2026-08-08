import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type { Receipt } from "./types";

const DIR = path.join(process.cwd(), "data", "receipts");
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "txt", "eml", "html"]);
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB

export const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  eml: "message/rfc822",
  html: "text/html",
};

export async function saveReceiptFile(file: File): Promise<{ stored: string; origName: string }> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error(`file type .${ext} not allowed`);
  if (file.size > MAX_RECEIPT_BYTES) throw new Error("file too large (max 10 MB)");
  fs.mkdirSync(DIR, { recursive: true });
  const stored = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(DIR, stored), buf);
  return { stored, origName: file.name };
}

/** Strict name check prevents path traversal. */
export function receiptPath(stored: string): string | null {
  if (!/^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/i.test(stored)) return null;
  const p = path.join(DIR, stored);
  return fs.existsSync(p) ? p : null;
}

export function deleteReceiptFile(stored: string): void {
  const p = receiptPath(stored);
  if (p) fs.unlinkSync(p);
}

export async function buildReceipt(form: FormData): Promise<Receipt> {
  const file = form.get("file");
  const receipt: Receipt = {
    id: randomUUID(),
    date: String(form.get("date") ?? new Date().toISOString().slice(0, 10)),
    amount: form.get("amount") ? Number(form.get("amount")) : null,
    note: String(form.get("note") ?? "").trim(),
  };
  if (file instanceof File && file.size > 0) {
    const saved = await saveReceiptFile(file);
    receipt.file = saved.stored;
    receipt.origName = saved.origName;
  }
  return receipt;
}
