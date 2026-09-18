# Product Requirements Document — Splitor (Next.js)

| Field            | Detail                                          |
|------------------|-------------------------------------------------|
| **Product Name** | Splitor — Shopping Expense Splitter              |
| **Platform**     | Web (Next.js + React)                            |
| **Hosting**      | Netlify — https://splitor.netlify.app/           |
| **Stack**        | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **Architecture** | Single-page client-side app (`"use client"`)     |
| **State**        | React `useState`, persisted to IndexedDB (F10)    |

---

## 1. What This App Does

Splitor is a zero-friction, single-screen expense splitter for shared shopping trips. Users enter item costs, tag who each item is for, and see real-time per-person totals. No accounts, no setup, no limits.

---

## 2. Core Functionalities

### F1 — Member Management

| Aspect | Detail |
|--------|--------|
| **Default members** | A first-time visitor starts with one seeded member (`MS`). Users can remove it and add their own. On return visits the member list is restored from IndexedDB (see F10). |
| **Add member** | A text input + button lets the user add a new member by name. Duplicate names are rejected. |
| **Remove member** | Each member has a remove (x) button. Removing a member removes their column from all entries and recalculates totals. |
| **Member initials** | Each member is identified by the first character of their name (lowercased) for quick-entry syntax. If two members share the same first letter, the quick-entry assigns to both. |
| **Minimum members** | The app requires at least 2 members before items can be meaningfully split. The UI should gently prompt to add members if fewer than 2 exist. |

### F2 — Item Entry

| Aspect | Detail |
|--------|--------|
| **Entry row** | Each row contains: a cost text input, an optional description field, one checkbox per member, and a delete button. |
| **Descriptions** | A global toggle ("+ Description" / "- Description") shows or hides a description text input on every row. Descriptions are informational and do not affect calculations. |
| **Auto row addition** | When the user types any character in the last row's cost field, a new empty row is appended automatically. |
| **Row deletion** | Clicking the trash icon removes the row. If all rows are deleted, one empty row is restored. |
| **Inline editing** | Users can click any cost field to edit it. Changes are reflected in real-time. |
| **Input parsing** | Non-numeric characters (except `.`) are stripped before calculation. Invalid or negative values are ignored (treated as $0). |

### F3 — Quick-Entry Syntax

| Aspect | Detail |
|--------|--------|
| **Syntax** | `<amount><initials>` — e.g., `15.99mr` means $15.99 split between members whose names start with "m" and "r". |
| **Parsing** | Letters are extracted, matched to member initials (case-insensitive), and the corresponding checkboxes are auto-ticked. Remaining digits + `.` form the cost. |
| **No letters** | If the input has no letters, no checkboxes are auto-ticked; the user assigns manually. |
| **Interaction** | Quick-entry runs on every keystroke in the cost field. The displayed value in the field is the raw input (letters included); the *calculated* cost is the numeric portion only. |

### F4 — Tax & Delivery (Extras)

| Aspect | Detail |
|--------|--------|
| **Toggle buttons** | Two buttons — "Add Tax" / "Add Delivery" — toggle the visibility of their respective input fields. |
| **Input fields** | When visible, a numeric input appears for each. Values are validated the same way as item costs. |
| **Pro-rata distribution** | Tax and delivery are distributed across members proportionally to their subtotal share. If a member's subtotal is $0, they owe $0 in extras. |
| **Display** | When extras exist, the summary shows: subtotal + extras = total for each member. |

### F5 — Real-Time Totals

| Aspect | Detail |
|--------|--------|
| **Per-person split** | Shown in a summary panel. Updates on every keystroke / checkbox change. |
| **Grand total** | The sum of all per-person totals, displayed prominently. |
| **Breakdown** | When tax/delivery are active, show: subtotal, tax, delivery, and grand total separately. |
| **Empty state** | When no items are entered (or no checkboxes ticked), the summary shows a helpful placeholder: "Add items and assign members to see the split." |
| **Precision** | All arithmetic uses JavaScript `number` but rounds to 2 decimal places on display using `toFixed(2)`. For the scope of this app (< 200 items, small groups), floating-point precision is sufficient. |

### F6 — Keyboard Navigation

| Aspect | Detail |
|--------|--------|
| **Enter / Tab in cost field** | Both move focus to the next row's cost field (or create a new row if at the end). Tab's default behavior is prevented in cost fields to keep data entry fast. |
| **Tab in description field** | Moves focus to the next row's cost field. |
| **Enter in description field** | Moves focus to the next row's description field. |

### F7 — Export & Share

| Aspect | Detail |
|--------|--------|
| **Export formats** | PNG (receipt image), PDF, and Excel (`.xlsx` with formulas). |
| **Receipt rendering** | A hidden DOM element is rendered with a styled receipt layout. `html2canvas` captures it as a canvas, which is then converted to PNG or fed into `jspdf` for PDF. |
| **Excel export** | Uses `exceljs` (dynamically imported) to generate a workbook with item rows, member columns, and formula-based totals. |
| **Web Share API** | When `navigator.canShare` supports file sharing (mostly mobile), PNG and PDF exports offer a "Share" action using the native share sheet. |
| **Contact link** | A LinkedIn profile link is included in the export menu area. |

### F8 — Dark Mode

| Aspect | Detail |
|--------|--------|
| **Implementation** | Uses `next-themes` with a `ThemeProvider` wrapping the app. |
| **Toggle** | A theme toggle button in the header switches between light and dark modes. |
| **System default** | The app respects the user's OS-level color scheme preference on first load. |

### F9 — How to Use Modal

| Aspect | Detail |
|--------|--------|
| **Trigger** | A help button ("?") in the header opens the modal. |
| **Content** | Explains the quick-entry syntax, member management, and general usage. |
| **Dismiss** | Closed via Escape key, clicking the backdrop, or a close button. |

### F10 — Save & Recent History (browser storage)

The browser is the database. Nothing is sent to a server.

| Aspect | Detail |
|--------|--------|
| **Backend** | IndexedDB (`splitor`, version 1). If `indexedDB.open` fails or hangs for 3s (private browsing, in-app browsers), the app falls back to `localStorage`, then to an in-memory map. The app never throws over storage. |
| **Object stores** | `bills` (keyPath `id`, index on `updatedAt`) and `app` (key-value: `draft`, `members`). |
| **Auto-saved draft** | The live screen is written to `app/draft` on a 400ms debounce and flushed on `visibilitychange`/`pagehide`. Reopening the app restores exactly where the user left off. |
| **Member memory** | The current member list is stored under `app/members`, so members persist even before any bill is saved. |
| **Save** | The Save button opens a dialog with the name prefilled as `<date> - $<total>`. A bill loaded from history offers **Update** (same record) or **Save as new**. |
| **Recent** | The Recent button opens a modal listing every saved bill, newest first, with date, item count, members, and total. Per-bill actions: Load, Export (PNG/PDF/Excel), Rename, Duplicate, Delete. A footer action clears all history. |
| **Unsaved-work guard** | Loading a bill while the screen has unsaved changes prompts to save first, discard, or cancel. "Unsaved" compares a normalized signature of the screen against the last saved state; trailing empty rows are ignored. |
| **Duplicate** | Copies regenerate all bill, member, and entry ids and remap assignees, so a copy never shares keys with its source. |
| **Cross-tab** | Bill mutations broadcast on `BroadcastChannel("splitor")`; an open history list refreshes. The draft is last-write-wins across tabs. |
| **Resilience** | Records are shape-validated on read; corrupt records and records written by a newer schema version are skipped rather than crashing the list. Writes are serialized through a single queue. `QuotaExceededError` surfaces an inline message. Timestamps are strictly increasing so history order is deterministic. |
| **No cap** | History is unlimited; JSON bills are small relative to the IndexedDB quota. |

---

## 3. UI / UX Design Specification

### 3.1 Design Philosophy

- **Minimalist** — Only show what's needed. No decorative elements, no unnecessary dividers, no emoji overload.
- **Functional typography** — Use the Geist Sans font (already configured). Hierarchy through size and weight, not color.
- **Monochrome with subtle accent** — The primary palette is neutral grays and blacks. One accent color (blue-600 / `#2563EB`) for interactive elements and highlights. Dark mode inverts the palette using `next-themes`.
- **Density over whitespace** — This is a data-entry tool. Rows should be compact so users can see many items without scrolling.
- **Mobile-first** — The layout must work well on a phone screen (single column, stacked panels). On desktop, it expands to a two-panel layout.

### 3.2 Layout

```
┌─────────────────────────────────────────────────┐
│  Splitor              [?] [🌙]     [members...] │  ← Header: app name + help + theme toggle + member chips
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────┐  ┌───────────────────┐ │
│  │                     │  │   Summary Panel    │ │
│  │    Item Entry Form  │  │                   │ │
│  │                     │  │  Person A: $XX.XX │ │
│  │  [cost] [A][B][C] 🗑│  │  Person B: $XX.XX │ │
│  │  [cost] [A][B][C] 🗑│  │  Person C: $XX.XX │ │
│  │  [cost] [A][B][C] 🗑│  │                   │ │
│  │  [    empty row   ] │  │  ────────────────  │ │
│  │                     │  │  Total:   $XX.XX  │ │
│  │  [+Desc][+Tax][+Dlvr] │ │                   │ │
│  │  [tax input]        │  │  (subtotal, tax,  │ │
│  │  [delivery input]   │  │   delivery shown  │ │
│  │                     │  │   when active)    │ │
│  └─────────────────────┘  └───────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Mobile (< 768px):** Single column — summary panel stacks above the item entry form (sticky at top or collapsible).

**Desktop (>= 768px):** Two columns — item entry (left, wider), summary panel (right, narrower, sticky).

### 3.3 Component Breakdown

| Component | Description |
|-----------|-------------|
| **Header** | App name "Splitor" on the left with a help ("?") button. Theme toggle and member management area on the right: inline input to add a member + existing members as removable chips/pills. |
| **Item Row** | A horizontal row: cost input (flex-grow), optional description input, compact checkbox toggles for each member (small pill-style toggles showing initials, not full checkboxes), and a subtle delete icon. |
| **Tax/Delivery Bar** | Toggle buttons below the item list for descriptions, tax, and delivery. When active, corresponding input fields appear. |
| **Summary Panel** | Clean card with per-person breakdown. Each person's name + amount. When extras exist, a finer-grained breakdown (subtotal + tax share + delivery share = total). Grand total at the bottom, prominent. |
| **Export Menu** | Download buttons for PNG, PDF, and Excel exports. Share buttons (via Web Share API) when supported. Contact link. |
| **How to Use Modal** | Overlay modal explaining quick-entry syntax and app usage. Dismissible via Escape, backdrop click, or close button. |
| **Theme Toggle** | Button to switch between light and dark mode. |
| **Empty State** | When no members exist: centered message prompting to add members. When no items have costs + assignments: "Add items to see the split." |

### 3.4 Interaction Details

| Interaction | Behavior |
|-------------|----------|
| **Adding a member** | Type name, press Enter or click "Add". Member chip appears. Checkbox column appears in all item rows. |
| **Removing a member** | Click "x" on chip. Column removed from all rows. Totals recalculate. |
| **Typing in cost field** | Raw input is shown. Quick-entry parsing runs on change: letters toggle checkboxes, numeric portion becomes the cost for calculations. |
| **Toggling a checkbox** | Click the member initial pill to toggle. Totals recalculate. |
| **Deleting a row** | Click trash icon. Row removed with no confirmation. |
| **Toggling tax/delivery** | Button press reveals/hides the input. Removing the toggle clears the value. |

### 3.5 Visual Style Tokens

| Token | Value |
|-------|-------|
| Font family | Geist Sans (variable, already loaded) |
| Font size — body | 14px |
| Font size — heading | 18px semibold |
| Font size — grand total | 28px bold |
| Border radius | 8px (cards), 6px (inputs), 999px (pills/chips) |
| Primary accent | `#2563EB` (blue-600) |
| Background | `#FAFAFA` (page), `#FFFFFF` (cards) |
| Text primary | `#111827` (gray-900) |
| Text secondary | `#6B7280` (gray-500) |
| Border | `#E5E7EB` (gray-200) |
| Danger/delete | `#EF4444` (red-500), used sparingly |
| Success/amount | `#059669` (emerald-600) for final amounts |
| Spacing unit | 4px base (Tailwind default) |
| Row height | ~44px (compact but touch-friendly) |

---

## 4. State Model

All state is managed via React `useState` in a single page component, mirrored into browser storage by `useBillStorage` (see F10). No server state, no remote database.

```typescript
interface Member {
  id: string;       // crypto.randomUUID()
  name: string;     // display name
  initial: string;  // first char, lowercased
}

interface Entry {
  id: string;                        // crypto.randomUUID()
  rawInput: string;                  // what the user typed (e.g. "15.99mr")
  cost: number;                      // parsed numeric value
  description: string;               // optional item description
  assignees: Record<string, boolean>; // member ID → assigned flag
}

interface BillSnapshot {             // everything needed to rebuild the screen
  members: Member[];
  entries: Entry[];
  showDescription: boolean;
  showTax: boolean;
  showDelivery: boolean;
  taxAmount: string;
  deliveryAmount: string;
}

interface SavedBill extends BillSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  grandTotal: number;       // denormalized for the history list
  itemCount: number;
}

// Top-level state
members: Member[]           // seeded with MS, or restored from storage
entries: Entry[]
showTax: boolean
showDelivery: boolean
showDescription: boolean    // global toggle for description fields
taxAmount: string           // raw input string
deliveryAmount: string      // raw input string
currentBillId: string|null  // the saved bill being edited, if any
currentBillName: string|null
```

---

## 5. Calculation Logic

```
For each entry:
  parsedCost = parseFloat(strip non-numeric except '.')
  if parsedCost <= 0 or NaN → skip
  selectedMembers = entry.assignees (must be non-empty)
  splitCost = parsedCost / selectedMembers.length
  Add splitCost to each selected member's subtotal

subtotals = { memberId → sum of their splits }
grandSubtotal = sum of all subtotals

taxValue = parseFloat(taxAmount) or 0
deliveryValue = parseFloat(deliveryAmount) or 0
extras = taxValue + deliveryValue

For each member:
  if grandSubtotal > 0:
    proportion = subtotals[memberId] / grandSubtotal
    total = subtotals[memberId] + extras * proportion
  else:
    total = 0

grandTotal = sum of all totals
```

---

## 6. Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Client-only (`"use client"`)** | No server-side logic needed. Pure client-side state. |
| **No external state library** | The state is simple enough for `useState` + prop drilling. No need for Zustand/Redux. |
| **IndexedDB, no server** | The browser is the database, so there is no backend, no accounts, and no sync. IndexedDB is used over `localStorage` for its larger quota and structured records, with `localStorage` kept as a fallback for browsers that block it. |
| **No storage library** | The adapter in `lib/db.ts` is ~200 lines and keeps the dependency list minimal, which is an explicit success criterion. |
| **Tailwind CSS** | Already configured in the project. Enables rapid, consistent styling. |
| **`next-themes`** | Lightweight dark mode with system preference detection. |
| **`exceljs`** | Generates `.xlsx` files with formulas for Excel export. Dynamically imported to avoid bloating the initial bundle. |
| **`html2canvas` + `jspdf`** | Renders a styled receipt DOM node to PNG/PDF for download or sharing. |
| **Geist font** | Already configured. Clean, modern, good for data-dense UIs. |
| **Netlify hosting** | Static/SSR deploy via Netlify at https://splitor.netlify.app/. |

---

## 7. File Structure

```
app/
  layout.tsx          — Root layout (font loading, metadata, ThemeProvider)
  globals.css         — Tailwind imports + CSS custom properties
  page.tsx            — Main page (thin wrapper, renders <ExpenseSplitter />)
  components/
    ExpenseSplitter.tsx   — Top-level client component, owns all state
    MemberBar.tsx         — Member add input + member chips
    ItemRow.tsx           — Single item entry row (cost, description, assignees)
    ItemList.tsx          — List of ItemRows + auto-add logic
    ExtrasBar.tsx         — Tax/delivery/description toggle buttons + inputs
    SummaryPanel.tsx      — Per-person breakdown + grand total
    ExportMenu.tsx        — Save / Recent / Download / Share action bar
    ReceiptView.tsx       — Printable receipt, captured by html2canvas
    SaveBillModal.tsx     — Name a bill, update it, or save as new
    HistoryModal.tsx      — Recent bills: load, export, rename, duplicate, delete
    HowToUseModal.tsx     — Help modal with usage instructions
    ThemeProvider.tsx      — next-themes provider wrapper
    ThemeToggle.tsx        — Light/dark mode toggle button
  hooks/
    useBillStorage.ts     — Hydration, debounced draft writes, dirty tracking
  lib/
    types.ts              — Member, Entry, BillSnapshot, SavedBill
    db.ts                 — IndexedDB adapter + localStorage/in-memory fallbacks
    bills.ts              — Bill repository, draft/member records, cross-tab sync
    calc.ts               — Pure split calculation
    snapshot.ts           — Signatures, default names, date formatting
    exporters.ts          — PNG / PDF / Excel generation
    id.ts                 — crypto.randomUUID with a fallback
```

---

## 8. Out of Scope (v1)

- Server-side storage, URL state, or cross-device sync
- User accounts / authentication
- Receipt OCR
- Settlement suggestions ("A pays B $X")
- Currency selection
- PWA / offline support
- Undo/redo

---

## 9. Success Criteria

| Metric | Target |
|--------|--------|
| Time from page load to first entry | < 3 seconds |
| Works on mobile Safari + Chrome | Yes |
| Handles 100 items without perceptible lag | Yes |
| Minimal runtime dependencies | Only `next-themes`, `exceljs`, `html2canvas`, `jspdf` beyond Next.js/React |
| Lighthouse performance score | > 90 |
| Live at | https://splitor.netlify.app/ |
