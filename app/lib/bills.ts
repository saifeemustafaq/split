import { enqueue, getAdapter, isQuotaError, type StorageKind } from "./db";
import { newId } from "./id";
import { calculate } from "./calc";
import {
  BILL_SCHEMA_VERSION,
  type BillSnapshot,
  type Entry,
  type Member,
  type SavedBill,
} from "./types";

const DRAFT_KEY = "draft";
const MEMBERS_KEY = "members";
const CHANNEL_NAME = "splitor";

export interface DraftRecord {
  schemaVersion: number;
  updatedAt: number;
  /** The saved bill this draft was loaded from, if any. */
  billId: string | null;
  billName: string | null;
  snapshot: BillSnapshot;
}

interface MembersRecord {
  schemaVersion: number;
  updatedAt: number;
  members: Member[];
}

export class StorageError extends Error {
  readonly quota: boolean;

  constructor(message: string, options?: { cause?: unknown; quota?: boolean }) {
    super(message, { cause: options?.cause });
    this.name = "StorageError";
    this.quota = options?.quota ?? false;
  }
}

function wrapWriteError(error: unknown): StorageError {
  if (isQuotaError(error)) {
    return new StorageError(
      "Browser storage is full. Delete some saved bills and try again.",
      { cause: error, quota: true }
    );
  }
  return new StorageError("Could not write to browser storage.", { cause: error });
}

/* ---------------------------------------------------------------- validation */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMember(value: unknown): value is Member {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.initial === "string"
  );
}

function isEntry(value: unknown): value is Entry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.rawInput === "string" &&
    typeof value.cost === "number" &&
    Number.isFinite(value.cost) &&
    typeof value.description === "string" &&
    isRecord(value.assignees)
  );
}

function parseSnapshot(value: unknown): BillSnapshot | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.members) || !value.members.every(isMember)) return null;
  if (!Array.isArray(value.entries) || !value.entries.every(isEntry)) return null;

  return {
    members: value.members,
    entries: value.entries,
    showDescription: value.showDescription === true,
    showTax: value.showTax === true,
    showDelivery: value.showDelivery === true,
    taxAmount: typeof value.taxAmount === "string" ? value.taxAmount : "",
    deliveryAmount:
      typeof value.deliveryAmount === "string" ? value.deliveryAmount : "",
  };
}

/** Records written by a newer version of the app are skipped, not guessed at. */
function isReadableVersion(value: unknown): boolean {
  return typeof value === "number" && value <= BILL_SCHEMA_VERSION;
}

function parseBill(value: unknown): SavedBill | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id === "") return null;
  if (!isReadableVersion(value.schemaVersion)) return null;

  const snapshot = parseSnapshot(value);
  if (!snapshot) return null;

  const createdAt = typeof value.createdAt === "number" ? value.createdAt : Date.now();
  const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : createdAt;

  return {
    ...snapshot,
    id: value.id,
    name: typeof value.name === "string" && value.name ? value.name : "Untitled bill",
    createdAt,
    updatedAt,
    schemaVersion: value.schemaVersion as number,
    grandTotal:
      typeof value.grandTotal === "number" && Number.isFinite(value.grandTotal)
        ? value.grandTotal
        : calculate(snapshot).grandTotal,
    itemCount:
      typeof value.itemCount === "number"
        ? value.itemCount
        : snapshot.entries.filter((e) => e.cost > 0).length,
  };
}

/* ------------------------------------------------------------ cross-tab sync */

let channel: BroadcastChannel | null = null;
let channelReady = false;

function getChannel(): BroadcastChannel | null {
  if (channelReady) return channel;
  channelReady = true;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

function announceChange() {
  try {
    getChannel()?.postMessage({ type: "bills-changed" });
  } catch {
    // A closed or unsupported channel must not fail the write.
  }
}

/** Notifies the callback when another tab changes the bill history. */
export function subscribeToBillChanges(onChange: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === "bills-changed") onChange();
  };
  ch.addEventListener("message", handler);
  return () => ch.removeEventListener("message", handler);
}

/* -------------------------------------------------------------------- bills */

let lastStamp = 0;

/**
 * Strictly increasing timestamp. Two writes in the same millisecond would
 * otherwise tie and make the history order arbitrary.
 */
function nextStamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function snapshotOf(snapshot: BillSnapshot): BillSnapshot {
  return {
    members: snapshot.members,
    entries: snapshot.entries,
    showDescription: snapshot.showDescription,
    showTax: snapshot.showTax,
    showDelivery: snapshot.showDelivery,
    taxAmount: snapshot.taxAmount,
    deliveryAmount: snapshot.deliveryAmount,
  };
}

function buildBill(
  id: string,
  name: string,
  snapshot: BillSnapshot,
  createdAt: number
): SavedBill {
  const { grandTotal } = calculate(snapshot);
  return {
    ...snapshotOf(snapshot),
    id,
    name,
    createdAt,
    updatedAt: nextStamp(),
    schemaVersion: BILL_SCHEMA_VERSION,
    grandTotal,
    itemCount: snapshot.entries.filter((e) => e.cost > 0).length,
  };
}

export async function listBills(): Promise<SavedBill[]> {
  try {
    const rows = await enqueue((adapter) => adapter.getAll<unknown>("bills"));
    return rows
      .map(parseBill)
      .filter((bill): bill is SavedBill => bill !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

export async function getBill(id: string): Promise<SavedBill | null> {
  try {
    const row = await enqueue((adapter) => adapter.get<unknown>("bills", id));
    return parseBill(row);
  } catch {
    return null;
  }
}

export async function createBill(
  name: string,
  snapshot: BillSnapshot
): Promise<SavedBill> {
  const bill = buildBill(newId(), name, snapshot, Date.now());
  try {
    await enqueue((adapter) => adapter.put("bills", bill.id, bill));
  } catch (error) {
    throw wrapWriteError(error);
  }
  announceChange();
  return bill;
}

export async function updateBill(
  id: string,
  snapshot: BillSnapshot,
  name?: string
): Promise<SavedBill> {
  const existing = await getBill(id);
  if (!existing) return createBill(name ?? "Untitled bill", snapshot);

  const bill = buildBill(id, name ?? existing.name, snapshot, existing.createdAt);
  try {
    await enqueue((adapter) => adapter.put("bills", bill.id, bill));
  } catch (error) {
    throw wrapWriteError(error);
  }
  announceChange();
  return bill;
}

export async function renameBill(id: string, name: string): Promise<SavedBill | null> {
  const existing = await getBill(id);
  if (!existing) return null;

  const bill: SavedBill = { ...existing, name, updatedAt: nextStamp() };
  try {
    await enqueue((adapter) => adapter.put("bills", bill.id, bill));
  } catch (error) {
    throw wrapWriteError(error);
  }
  announceChange();
  return bill;
}

/** Copies a bill with fresh ids so the two never share member or entry keys. */
export async function duplicateBill(id: string): Promise<SavedBill | null> {
  const existing = await getBill(id);
  if (!existing) return null;

  const memberIdMap = new Map<string, string>();
  const members = existing.members.map((member) => {
    const nextId = newId();
    memberIdMap.set(member.id, nextId);
    return { ...member, id: nextId };
  });

  const entries = existing.entries.map((entry) => {
    const assignees: Record<string, boolean> = {};
    for (const [oldId, assigned] of Object.entries(entry.assignees)) {
      const mapped = memberIdMap.get(oldId);
      if (mapped) assignees[mapped] = assigned;
    }
    return { ...entry, id: newId(), assignees };
  });

  return createBill(`${existing.name} (copy)`, {
    ...snapshotOf(existing),
    members,
    entries,
  });
}

export async function deleteBill(id: string): Promise<void> {
  try {
    await enqueue((adapter) => adapter.del("bills", id));
  } catch (error) {
    throw wrapWriteError(error);
  }
  announceChange();
}

export async function clearAllBills(): Promise<void> {
  try {
    await enqueue((adapter) => adapter.clear("bills"));
  } catch (error) {
    throw wrapWriteError(error);
  }
  announceChange();
}

/* -------------------------------------------------------- draft and members */

export async function getDraft(): Promise<DraftRecord | null> {
  try {
    const row = await enqueue((adapter) => adapter.get<unknown>("app", DRAFT_KEY));
    if (!isRecord(row) || !isReadableVersion(row.schemaVersion)) return null;

    const snapshot = parseSnapshot(row.snapshot);
    if (!snapshot) return null;

    return {
      schemaVersion: row.schemaVersion as number,
      updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
      billId: typeof row.billId === "string" ? row.billId : null,
      billName: typeof row.billName === "string" ? row.billName : null,
      snapshot,
    };
  } catch {
    return null;
  }
}

export async function setDraft(
  snapshot: BillSnapshot,
  billId: string | null,
  billName: string | null
): Promise<void> {
  const record: DraftRecord = {
    schemaVersion: BILL_SCHEMA_VERSION,
    updatedAt: Date.now(),
    billId,
    billName,
    snapshot: snapshotOf(snapshot),
  };
  try {
    await enqueue((adapter) => adapter.put("app", DRAFT_KEY, record));
  } catch (error) {
    throw wrapWriteError(error);
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await enqueue((adapter) => adapter.del("app", DRAFT_KEY));
  } catch {
    // A draft that cannot be cleared is harmless; it gets overwritten next save.
  }
}

export async function getStoredMembers(): Promise<Member[] | null> {
  try {
    const row = await enqueue((adapter) => adapter.get<unknown>("app", MEMBERS_KEY));
    if (!isRecord(row) || !isReadableVersion(row.schemaVersion)) return null;
    if (!Array.isArray(row.members) || !row.members.every(isMember)) return null;
    return row.members;
  } catch {
    return null;
  }
}

export async function setStoredMembers(members: Member[]): Promise<void> {
  const record: MembersRecord = {
    schemaVersion: BILL_SCHEMA_VERSION,
    updatedAt: Date.now(),
    members,
  };
  try {
    await enqueue((adapter) => adapter.put("app", MEMBERS_KEY, record));
  } catch (error) {
    throw wrapWriteError(error);
  }
}

export async function getStorageKind(): Promise<StorageKind> {
  return (await getAdapter()).kind;
}
