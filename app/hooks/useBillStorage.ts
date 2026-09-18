"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getBill,
  getDraft,
  getStorageKind,
  getStoredMembers,
  setDraft,
  setStoredMembers,
  StorageError,
  type DraftRecord,
} from "../lib/bills";
import { snapshotSignature } from "../lib/snapshot";
import type { StorageKind } from "../lib/db";
import type { BillSnapshot, Member } from "../lib/types";

const DRAFT_DEBOUNCE_MS = 400;

export interface HydrationResult {
  draft: DraftRecord | null;
  members: Member[] | null;
}

interface UseBillStorageArgs {
  snapshot: BillSnapshot;
  billId: string | null;
  billName: string | null;
  /** Returns false when the stored state was not applied, e.g. the user
   * already started typing before the read finished. */
  onHydrate: (result: HydrationResult) => boolean;
}

interface PendingWrite {
  snapshot: BillSnapshot;
  billId: string | null;
  billName: string | null;
}

export interface BillStorage {
  hydrated: boolean;
  storageKind: StorageKind | null;
  isDirty: boolean;
  writeError: string | null;
  dismissWriteError: () => void;
  markSaved: (snapshot: BillSnapshot) => void;
  markUnsaved: () => void;
}

export function useBillStorage({
  snapshot,
  billId,
  billName,
  onHydrate,
}: UseBillStorageArgs): BillStorage {
  const [hydrated, setHydrated] = useState(false);
  const [storageKind, setStorageKind] = useState<StorageKind | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const hydratedRef = useRef(false);
  const onHydrateRef = useRef(onHydrate);
  const pendingRef = useRef<PendingWrite | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedMembersRef = useRef<string | null>(null);

  useEffect(() => {
    onHydrateRef.current = onHydrate;
  });

  const writeNow = useCallback((pending: PendingWrite) => {
    setDraft(pending.snapshot, pending.billId, pending.billName).catch((error) => {
      if (error instanceof StorageError) setWriteError(error.message);
    });

    const membersSignature = JSON.stringify(
      pending.snapshot.members.map((m) => [m.id, m.name, m.initial])
    );
    if (membersSignature !== persistedMembersRef.current) {
      persistedMembersRef.current = membersSignature;
      setStoredMembers(pending.snapshot.members).catch((error) => {
        if (error instanceof StorageError) setWriteError(error.message);
      });
    }
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    writeNow(pending);
  }, [writeNow]);

  // Initial read. Nothing may be written until this resolves, otherwise a slow
  // open would let the empty starting state overwrite the stored draft.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [draft, members, kind] = await Promise.all([
        getDraft(),
        getStoredMembers(),
        getStorageKind(),
      ]);
      if (cancelled) return;

      persistedMembersRef.current = members
        ? JSON.stringify(members.map((m) => [m.id, m.name, m.initial]))
        : null;

      const restored = onHydrateRef.current({ draft, members });
      setStorageKind(kind);
      hydratedRef.current = true;
      setHydrated(true);

      // The restored draft counts as saved only if it still matches the bill it
      // came from; otherwise it carries edits that were never written.
      if (!restored || !draft?.billId) return;
      const signature = snapshotSignature(draft.snapshot);
      const bill = await getBill(draft.billId);
      if (cancelled || !bill || snapshotSignature(bill) !== signature) return;
      setSavedSignature(signature);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced draft writes.
  useEffect(() => {
    if (!hydrated) return;
    pendingRef.current = { snapshot, billId, billName };

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      writeNow(pending);
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hydrated, snapshot, billId, billName, writeNow]);

  // `pagehide` and a hidden `visibilitychange` are the events that actually
  // fire when a mobile browser tab goes away; `beforeunload` often does not.
  useEffect(() => {
    if (!hydrated) return;

    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [hydrated, flush]);

  const markSaved = useCallback((saved: BillSnapshot) => {
    setSavedSignature(snapshotSignature(saved));
  }, []);

  const markUnsaved = useCallback(() => {
    setSavedSignature(null);
  }, []);

  const dismissWriteError = useCallback(() => setWriteError(null), []);

  const signature = useMemo(() => snapshotSignature(snapshot), [snapshot]);
  const isDirty = savedSignature !== signature;

  return {
    hydrated,
    storageKind,
    isDirty,
    writeError,
    dismissWriteError,
    markSaved,
    markUnsaved,
  };
}
