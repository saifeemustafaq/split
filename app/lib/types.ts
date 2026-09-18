export interface Member {
  id: string;
  name: string;
  initial: string;
}

export interface Entry {
  id: string;
  rawInput: string;
  cost: number;
  description: string;
  assignees: Record<string, boolean>;
}

/** Everything needed to rebuild the editor screen for a bill. */
export interface BillSnapshot {
  members: Member[];
  entries: Entry[];
  showDescription: boolean;
  showTax: boolean;
  showDelivery: boolean;
  taxAmount: string;
  deliveryAmount: string;
}

export const BILL_SCHEMA_VERSION = 1;

export interface SavedBill extends BillSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  /** Denormalized so the history list renders without recalculating. */
  grandTotal: number;
  itemCount: number;
}
