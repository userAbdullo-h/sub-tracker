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
  /**
   * Restore a backup. `detected` and `scanMeta` are optional: pass them to migrate
   * scan history (keeps message-id dedupe intact), omit them to leave it untouched.
   */
  replaceAll(subs: Subscription[], purs: Purchase[], detected?: DetectedEvent[], scanMeta?: ScanMeta): Promise<void>;
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

  async replaceAll(subs: Subscription[], purs: Purchase[], detected?: DetectedEvent[], scanMeta?: ScanMeta) {
    const current = this.read();
    this.cache = {
      subscriptions: subs,
      purchases: purs,
      detected: detected ?? current.detected,
      // Never let a backup file overwrite the live Gmail token (backups omit it).
      scanMeta: scanMeta
        ? { ...scanMeta, gmailRefreshToken: current.scanMeta?.gmailRefreshToken }
        : current.scanMeta,
    };
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
  /** Database named in MONGODB_URI (e.g. ...net/subscription-app?...), else "paypilot". */
  private dbName: string;

  constructor(uri: string) {
    this.dbName = MongoRepo.databaseFromUri(uri);
    // Reuse the client across hot reloads / serverless invocations
    const g = globalThis as unknown as { _mongoClientPromise?: Promise<import("mongodb").MongoClient> };
    if (!g._mongoClientPromise) {
      g._mongoClientPromise = import("mongodb").then(({ MongoClient }) => new MongoClient(uri).connect());
    }
    this.clientPromise = g._mongoClientPromise;
  }

  static databaseFromUri(uri: string): string {
    // Everything between the host list and the query string is the database name.
    const afterHost = uri.replace(/^mongodb(\+srv)?:\/\/[^/]+/i, "");
    const name = afterHost.split("?")[0].replace(/^\//, "").trim();
    return name || "paypilot";
  }

  private async db() {
    return (await this.clientPromise).db(this.dbName);
  }

  /**
   * Seed a brand-new database exactly once.
   *
   * A plain "is it empty?" check is not safe here: several requests hit the
   * database at the same moment on a cold start, all see zero documents, and
   * all seed. That produced 7 copies of the seed data the first time this ran
   * against Atlas. The upsert below is atomic, so only the caller that inserts
   * the marker does the seeding.
   */
  private async ensureSeeded() {
    const db = await this.db();
    const marker = await db.collection("meta").updateOne(
      { _key: "seeded" },
      { $setOnInsert: { _key: "seeded", at: now() } },
      { upsert: true }
    );
    if (marker.upsertedCount !== 1) return; // someone else seeded (or already seeded)

    const subs = db.collection<Subscription>("subscriptions");
    const purs = db.collection<Purchase>("purchases");
    if ((await subs.estimatedDocumentCount()) === 0) {
      await subs.insertMany(
        seedSubscriptions.map((s) => ({ ...s, id: randomUUID(), createdAt: now(), updatedAt: now() }))
      );
    }
    if ((await purs.estimatedDocumentCount()) === 0) {
      await purs.insertMany(seedPurchases.map((p) => ({ ...p, id: randomUUID() })));
    }
  }

  private async subsCol() {
    await this.ensureSeeded();
    return (await this.db()).collection<Subscription>("subscriptions");
  }

  private async pursCol() {
    await this.ensureSeeded();
    return (await this.db()).collection<Purchase>("purchases");
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

  async replaceAll(subs: Subscription[], purs: Purchase[], detected?: DetectedEvent[], scanMeta?: ScanMeta) {
    const sCol = await this.subsCol();
    const pCol = await this.pursCol();
    await sCol.deleteMany({});
    if (subs.length) await sCol.insertMany(subs.map((s) => ({ ...s })));
    await pCol.deleteMany({});
    if (purs.length) await pCol.insertMany(purs.map((p) => ({ ...p })));

    if (detected) {
      const dCol = await this.detectedCol();
      await dCol.deleteMany({});
      if (detected.length) await dCol.insertMany(detected.map((e) => ({ ...e })));
    }
    if (scanMeta) {
      // Keep whatever Gmail token this environment already holds; backups omit it.
      const { gmailRefreshToken } = await this.getScanMeta();
      await this.setScanMeta({ ...scanMeta, gmailRefreshToken });
    }
  }

  private async detectedCol() {
    return (await this.db()).collection<DetectedEvent>("detected");
  }

  private async metaCol() {
    return (await this.db()).collection<ScanMeta & { _key: string }>("meta");
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
