import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type { Subscription, SubscriptionInput, Purchase, PurchaseInput, DetectedEvent, ScanMeta } from "./types";
import { seedSubscriptions, seedPurchases } from "./seed";
import { normalizeSub } from "./vendors";

export interface Repo {
  listSubscriptions(): Promise<Subscription[]>;
  createSubscription(input: SubscriptionInput): Promise<Subscription>;
  updateSubscription(id: string, patch: Partial<SubscriptionInput>): Promise<Subscription | null>;
  deleteSubscription(id: string): Promise<boolean>;
  listPurchases(): Promise<Purchase[]>;
  createPurchase(input: PurchaseInput): Promise<Purchase>;
  updatePurchase(id: string, patch: Partial<PurchaseInput>): Promise<Purchase | null>;
  deletePurchase(id: string): Promise<boolean>;
  replaceAll(subs: Subscription[], purs: Purchase[]): Promise<void>;
  // Gmail scan (Phase 2)
  listDetected(): Promise<DetectedEvent[]>;
  createDetected(event: DetectedEvent): Promise<DetectedEvent>;
  updateDetected(id: string, patch: Partial<DetectedEvent>): Promise<DetectedEvent | null>;
  hasDetected(sourceMsgId: string): Promise<boolean>;
  getScanMeta(): Promise<ScanMeta>;
  setScanMeta(meta: ScanMeta): Promise<void>;
}

const now = () => new Date().toISOString();

/* ---------------- File-based repo (local dev fallback) ---------------- */

interface FileData {
  subscriptions: Subscription[];
  purchases: Purchase[];
  detected?: DetectedEvent[];
  scanMeta?: ScanMeta;
}

class FileRepo implements Repo {
  private file = path.join(process.cwd(), "data", "dev-db.json");
  private cache: FileData | null = null;

  private read(): FileData {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.file)) {
      const subs = seedSubscriptions.map((s) => ({ ...s, id: randomUUID(), createdAt: now(), updatedAt: now() }));
      const purs = seedPurchases.map((p) => ({ ...p, id: randomUUID() }));
      this.cache = { subscriptions: subs, purchases: purs };
      this.write();
      return this.cache;
    }
    this.cache = JSON.parse(fs.readFileSync(this.file, "utf-8")) as FileData;
    return this.cache;
  }

  private write() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.cache, null, 2), "utf-8");
  }

  async listSubscriptions() { return this.read().subscriptions.map(normalizeSub); }

  async createSubscription(input: SubscriptionInput) {
    const sub: Subscription = normalizeSub({ ...input, id: randomUUID(), createdAt: now(), updatedAt: now() });
    this.read().subscriptions.push(sub);
    this.write();
    return sub;
  }

  async updateSubscription(id: string, patch: Partial<SubscriptionInput>) {
    const sub = this.read().subscriptions.find((s) => s.id === id);
    if (!sub) return null;
    Object.assign(sub, patch, { updatedAt: now() });
    this.write();
    return normalizeSub(sub);
  }

  async deleteSubscription(id: string) {
    const data = this.read();
    const before = data.subscriptions.length;
    data.subscriptions = data.subscriptions.filter((s) => s.id !== id);
    this.write();
    return data.subscriptions.length < before;
  }

  async listPurchases() { return [...this.read().purchases]; }

  async createPurchase(input: PurchaseInput) {
    const pur: Purchase = { ...input, id: randomUUID() };
    this.read().purchases.push(pur);
    this.write();
    return pur;
  }

  async updatePurchase(id: string, patch: Partial<PurchaseInput>) {
    const pur = this.read().purchases.find((p) => p.id === id);
    if (!pur) return null;
    Object.assign(pur, patch);
    this.write();
    return pur;
  }

  async deletePurchase(id: string) {
    const data = this.read();
    const before = data.purchases.length;
    data.purchases = data.purchases.filter((p) => p.id !== id);
    this.write();
    return data.purchases.length < before;
  }

  async replaceAll(subs: Subscription[], purs: Purchase[]) {
    const { detected, scanMeta } = this.read();
    this.cache = { subscriptions: subs, purchases: purs, detected, scanMeta };
    this.write();
  }

  async listDetected() { return [...(this.read().detected ?? [])]; }

  async createDetected(event: DetectedEvent) {
    const data = this.read();
    (data.detected ??= []).push(event);
    this.write();
    return event;
  }

  async updateDetected(id: string, patch: Partial<DetectedEvent>) {
    const ev = this.read().detected?.find((e) => e.id === id);
    if (!ev) return null;
    Object.assign(ev, patch);
    this.write();
    return ev;
  }

  async hasDetected(sourceMsgId: string) {
    return (this.read().detected ?? []).some((e) => e.sourceMsgId === sourceMsgId);
  }

  async getScanMeta() { return { ...(this.read().scanMeta ?? {}) }; }

  async setScanMeta(meta: ScanMeta) {
    this.read().scanMeta = meta;
    this.write();
  }
}

/* ---------------- MongoDB repo (production) ---------------- */

class MongoRepo implements Repo {
  private clientPromise: Promise<import("mongodb").MongoClient>;

  constructor(uri: string) {
    // Reuse the client across hot reloads / serverless invocations
    const g = globalThis as unknown as { _mongoClientPromise?: Promise<import("mongodb").MongoClient> };
    if (!g._mongoClientPromise) {
      g._mongoClientPromise = import("mongodb").then(({ MongoClient }) => new MongoClient(uri).connect());
    }
    this.clientPromise = g._mongoClientPromise;
  }

  private async subsCol() {
    const client = await this.clientPromise;
    const col = client.db("paypilot").collection<Subscription>("subscriptions");
    if ((await col.estimatedDocumentCount()) === 0) {
      await col.insertMany(seedSubscriptions.map((s) => ({ ...s, id: randomUUID(), createdAt: now(), updatedAt: now() })));
    }
    return col;
  }

  private async pursCol() {
    const client = await this.clientPromise;
    const col = client.db("paypilot").collection<Purchase>("purchases");
    if ((await col.estimatedDocumentCount()) === 0) {
      await col.insertMany(seedPurchases.map((p) => ({ ...p, id: randomUUID() })));
    }
    return col;
  }

  private strip<T extends { id: string }>(doc: (T & { _id?: unknown }) | null): T | null {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest as unknown as T;
  }

  async listSubscriptions() {
    const col = await this.subsCol();
    return (await col.find().toArray()).map((d) => normalizeSub(this.strip<Subscription>(d)!));
  }

  async createSubscription(input: SubscriptionInput) {
    const sub: Subscription = normalizeSub({ ...input, id: randomUUID(), createdAt: now(), updatedAt: now() });
    await (await this.subsCol()).insertOne({ ...sub });
    return sub;
  }

  async updateSubscription(id: string, patch: Partial<SubscriptionInput>) {
    const col = await this.subsCol();
    const res = await col.findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: now() } },
      { returnDocument: "after" }
    );
    const stripped = this.strip<Subscription>(res);
    return stripped ? normalizeSub(stripped) : null;
  }

  async deleteSubscription(id: string) {
    return (await (await this.subsCol()).deleteOne({ id })).deletedCount > 0;
  }

  async listPurchases() {
    const col = await this.pursCol();
    return (await col.find().toArray()).map((d) => this.strip<Purchase>(d)!);
  }

  async createPurchase(input: PurchaseInput) {
    const pur: Purchase = { ...input, id: randomUUID() };
    await (await this.pursCol()).insertOne({ ...pur });
    return pur;
  }

  async updatePurchase(id: string, patch: Partial<PurchaseInput>) {
    const col = await this.pursCol();
    const res = await col.findOneAndUpdate({ id }, { $set: patch }, { returnDocument: "after" });
    return this.strip<Purchase>(res);
  }

  async deletePurchase(id: string) {
    return (await (await this.pursCol()).deleteOne({ id })).deletedCount > 0;
  }

  async replaceAll(subs: Subscription[], purs: Purchase[]) {
    const sCol = await this.subsCol();
    const pCol = await this.pursCol();
    await sCol.deleteMany({});
    if (subs.length) await sCol.insertMany(subs.map((s) => ({ ...s })));
    await pCol.deleteMany({});
    if (purs.length) await pCol.insertMany(purs.map((p) => ({ ...p })));
  }

  private async detectedCol() {
    const client = await this.clientPromise;
    return client.db("paypilot").collection<DetectedEvent>("detected");
  }

  private async metaCol() {
    const client = await this.clientPromise;
    return client.db("paypilot").collection<ScanMeta & { _key: string }>("meta");
  }

  async listDetected() {
    return (await (await this.detectedCol()).find().toArray()).map((d) => this.strip<DetectedEvent>(d)!);
  }

  async createDetected(event: DetectedEvent) {
    await (await this.detectedCol()).insertOne({ ...event });
    return event;
  }

  async updateDetected(id: string, patch: Partial<DetectedEvent>) {
    const res = await (await this.detectedCol()).findOneAndUpdate(
      { id },
      { $set: patch },
      { returnDocument: "after" }
    );
    return this.strip<DetectedEvent>(res);
  }

  async hasDetected(sourceMsgId: string) {
    return (await (await this.detectedCol()).countDocuments({ sourceMsgId }, { limit: 1 })) > 0;
  }

  async getScanMeta(): Promise<ScanMeta> {
    const doc = await (await this.metaCol()).findOne({ _key: "scan" });
    if (!doc) return {};
    const { _id, _key, ...meta } = doc as ScanMeta & { _key: string; _id?: unknown };
    void _id; void _key;
    return meta;
  }

  async setScanMeta(meta: ScanMeta) {
    await (await this.metaCol()).updateOne({ _key: "scan" }, { $set: { ...meta, _key: "scan" } }, { upsert: true });
  }
}

/* ---------------- Factory ---------------- */

let repo: Repo | null = null;

export function getRepo(): Repo {
  if (!repo) {
    const uri = process.env.MONGODB_URI;
    repo = uri ? new MongoRepo(uri) : new FileRepo();
  }
  return repo;
}

export function usingFileFallback(): boolean {
  return !process.env.MONGODB_URI;
}
