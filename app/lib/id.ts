/**
 * `crypto.randomUUID` is unavailable in insecure contexts and older browsers,
 * so fall back to a random string that is unique enough for local records.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
