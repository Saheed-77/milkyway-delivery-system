/**
 * Client-side checks for the simulated checkout. They mirror what a real
 * gateway form validates; nothing here stores or sends full card numbers.
 */

/** Razorpay's published test cards — behaviour is the same here. */
export const TEST_CARDS = {
  success: "4111 1111 1111 1111",
  decline: "4000 0000 0000 0002",
};
/** Razorpay test VPAs: success@razorpay succeeds, failure@razorpay fails. */
export const TEST_UPI = { success: "success@razorpay", failure: "failure@razorpay" };

export const digitsOnly = (v: string) => v.replace(/\D/g, "");

export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export type CardNetwork = "Visa" | "Mastercard" | "RuPay" | "Amex" | "Card";

export function cardNetwork(number: string): CardNetwork {
  const d = digitsOnly(number);
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(60|65|81|82|508)/.test(d)) return "RuPay";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^4/.test(d)) return "Visa";
  return "Card";
}

/** "4111111111111111" → "4111 1111 1111 1111" (Amex 4-6-5). */
export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19);
  if (/^3[47]/.test(d)) return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  return d.replace(/(.{4})/g, "$1 ").trim();
}

export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function expiryValid(value: string, now: Date = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  return endOfMonth >= now && year <= now.getFullYear() + 20;
}

/** Display-safe card detail: "Visa •••• 1111". */
export const maskedCard = (number: string) => `${cardNetwork(number)} •••• ${digitsOnly(number).slice(-4)}`;

/** name@handle, as accepted by NPCI (2–256 chars, handle letters only). */
export const upiValid = (vpa: string) => /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.trim());

/** Card outcome in test mode. */
export const cardDeclined = (number: string) => digitsOnly(number) === digitsOnly(TEST_CARDS.decline);

export const BANKS = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Federal Bank"];
export const WALLETS = ["Paytm", "PhonePe", "Amazon Pay", "MobiKwik"];
