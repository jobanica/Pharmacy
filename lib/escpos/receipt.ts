/**
 * ESC/POS receipt encoder for direct thermal-printer output.
 *
 * Thermal printers don't render HTML — they consume a byte stream of ESC/POS
 * commands. This module turns a plain {@link ReceiptData} object (built on the
 * server and serialised to the client) into the exact bytes a 58mm/80mm
 * printer expects, then the Web Bluetooth layer streams them to the device.
 *
 * Reference: Epson ESC/POS command set. Most no-name Chinese BT printers
 * implement the same core commands.
 */

/** Characters per line for the printer's default Font A. */
const CHARS_PER_LINE: Record<ReceiptPaper, number> = {
  "58mm": 32,
  "80mm": 48,
  // A4 isn't a thermal printer, but if someone has it selected we still want a
  // sane width rather than crashing — treat it like an 80mm roll.
  A4: 48,
};

export type ReceiptPaper = "58mm" | "80mm" | "A4";

export type ReceiptLine = {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number; // centavos
  total: number; // centavos
};

export type ReceiptData = {
  storeName: string;
  branchName: string;
  header: string | null;
  footer: string | null;
  tin: string | null;
  address: string | null;
  receiptNumber: string;
  dateText: string;
  cashier: string;
  voided: boolean;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  beneficiary: string | null;
  pointsRedeemed: number;
  total: number;
  payments: { method: string; amount: number }[];
  change: number;
  customer: { name: string; pointsEarned: number; pointsBalance: number } | null;
  vatableSales: number;
  vatAmount: number;
  vatRatePct: number;
  vatExemptSales: number;
  accreditationNo: string | null;
  permitNo: string | null;
  atpNo: string | null;
  paper: ReceiptPaper;
};

// --- ESC/POS control bytes -------------------------------------------------
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Accumulates ESC/POS bytes. Text is encoded as CP437-ish single-byte: ASCII
 * passes through, anything above 0x7f (e.g. ₱, ×, ★) is swapped for an ASCII
 * fallback so the printer never prints garbage.
 */
class EscPosBuilder {
  private bytes: number[] = [];

  raw(...b: number[]): this {
    this.bytes.push(...b);
    return this;
  }

  init(): this {
    return this.raw(ESC, 0x40); // ESC @ — reset to defaults
  }

  align(mode: "left" | "center" | "right"): this {
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    return this.raw(ESC, 0x61, n); // ESC a n
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0); // ESC E n
  }

  /** Double width + double height when `on`, normal otherwise (GS ! n). */
  doubleSize(on: boolean): this {
    return this.raw(GS, 0x21, on ? 0x11 : 0x00);
  }

  text(s: string): this {
    for (const ch of asciiFold(s)) this.bytes.push(ch.charCodeAt(0) & 0xff);
    return this;
  }

  line(s = ""): this {
    return this.text(s).raw(LF);
  }

  feed(lines = 1): this {
    return this.raw(ESC, 0x64, lines); // ESC d n
  }

  cut(): this {
    // GS V 1 — partial cut. Printers without a cutter just ignore it.
    return this.feed(3).raw(GS, 0x56, 0x01);
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** Replace common non-ASCII glyphs with printable ASCII equivalents. */
function asciiFold(s: string): string {
  return s
    .replace(/[₱]/g, "P")
    .replace(/[×]/g, "x")
    .replace(/[★]/g, "*")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Anything still outside printable ASCII becomes '?'.
    .replace(/[^\x20-\x7e]/g, "?");
}

/** 12345 -> "P123.45" (no thousands grouping issues across printers). */
function peso(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}P${whole}.${frac}`;
}

/** Left/right justified within `width` columns, e.g. "Subtotal      P10.00". */
function lr(left: string, right: string, width: number): string {
  const l = asciiFold(left);
  const r = asciiFold(right);
  const space = width - l.length - r.length;
  if (space < 1) {
    // Right value wins; truncate the label so the price stays aligned.
    const room = Math.max(0, width - r.length - 1);
    return `${l.slice(0, room)} ${r}`;
  }
  return l + " ".repeat(space) + r;
}

/** Centre a string within `width` columns. */
function center(s: string, width: number): string {
  const t = asciiFold(s);
  if (t.length >= width) return t;
  const pad = Math.floor((width - t.length) / 2);
  return " ".repeat(pad) + t;
}

const dashes = (width: number) => "-".repeat(width);

/** Build the full ESC/POS byte stream for a receipt. */
export function encodeReceipt(data: ReceiptData): Uint8Array {
  const w = CHARS_PER_LINE[data.paper];
  const b = new EscPosBuilder().init();

  // --- Header (centred) ---
  b.align("center");
  b.bold(true).doubleSize(true).line(data.storeName).doubleSize(false).bold(false);
  if (data.branchName) b.line(data.branchName);
  if (data.header) for (const ln of data.header.split("\n")) b.line(ln);
  b.line("OFFICIAL RECEIPT");
  if (data.tin) b.line(`TIN: ${data.tin}`);
  if (data.address) for (const ln of data.address.split("\n")) b.line(ln);

  if (data.voided) {
    b.line().bold(true).line("*** VOIDED ***").bold(false);
  }

  // --- Meta (left) ---
  b.align("left").line(dashes(w));
  b.line(lr("Receipt", `#${data.receiptNumber}`, w));
  b.line(lr("Date", data.dateText, w));
  b.line(lr("Cashier", data.cashier, w));

  // --- Items ---
  b.line(dashes(w));
  for (const it of data.lines) {
    b.line(it.name);
    b.line(lr(`  ${it.qty} ${it.unit} x ${peso(it.unitPrice)}`, peso(it.total), w));
  }

  // --- Totals ---
  b.line(dashes(w));
  b.line(lr("Subtotal", peso(data.subtotal), w));
  if (data.discount > 0) {
    b.line(lr(data.discountLabel ?? "Discount", `-${peso(data.discount)}`, w));
  }
  if (data.beneficiary) b.line(`  ${data.beneficiary}`);
  if (data.pointsRedeemed > 0) {
    b.line(lr(`Points (${data.pointsRedeemed})`, `-${peso(data.pointsRedeemed * 100)}`, w));
  }
  b.bold(true).line(lr("TOTAL", peso(data.total), w)).bold(false);
  for (const p of data.payments) {
    b.line(lr(p.method.toUpperCase(), peso(p.amount), w));
  }
  b.line(lr("Change", peso(data.change), w));

  // --- Loyalty ---
  if (data.customer) {
    b.line(dashes(w));
    b.align("center").line("* Loyalty *").align("left");
    b.line(lr("Member", data.customer.name, w));
    b.line(lr("Earned", `+${data.customer.pointsEarned} pts`, w));
    b.line(lr("Balance", `${data.customer.pointsBalance} pts`, w));
  }

  // --- VAT breakdown (BIR) ---
  b.line(dashes(w));
  b.line(lr("VATable Sales", peso(data.vatableSales), w));
  b.line(lr(`VAT (${data.vatRatePct}%)`, peso(data.vatAmount), w));
  b.line(lr("VAT-Exempt Sales", peso(data.vatExemptSales), w));
  b.line(lr("Zero-Rated Sales", peso(0), w));

  // --- Accreditation ---
  if (data.accreditationNo || data.permitNo || data.atpNo) {
    b.line(dashes(w)).align("center");
    if (data.accreditationNo) b.line(`Accreditation: ${data.accreditationNo}`);
    if (data.permitNo) b.line(`Permit No.: ${data.permitNo}`);
    if (data.atpNo) b.line(`ATP No.: ${data.atpNo}`);
    b.align("left");
  }

  // --- Footer ---
  b.line(dashes(w)).align("center");
  for (const ln of (data.footer ?? "Thank you for shopping!").split("\n")) {
    b.line(center(ln, w));
  }
  b.line("This serves as your official receipt.");

  return b.cut().build();
}
