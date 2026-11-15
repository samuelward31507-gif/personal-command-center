// What the app gets from /api/app/data, and how screens ask the shell to move around.
import type { Card, CardInvoice, Stage } from "@/lib/crm";
import type { CalEvent } from "@/lib/client-schedule";

export type Conv = { id: string; name: string; source: string; status: string; at: string | null; last: string; ask?: string };
export type Live = { leads: number; needs: number; answered: number; booked: number; replySec: number | null; chasing: number; chasingValue: number; won: number; wonValue: number; revived: number; reviews: number; weeks: { week: string; leads: number; booked: number }[]; conversations: Conv[] };
export type Appt = { id: string; starts_at: string; thread_id: string; customer_name: string; customer_phone: string; event_id?: string; link?: string };
export type Quote = { id: string; customer_name: string; customer_phone: string; amount: number | null; sent_on: string; steps_sent: number; status: string };
export type Cal = { connected: boolean; email: string; events: CalEvent[]; error: string; connectUrl: string };
export type Customer = { id: string; name: string; phone: string; address: string; source: string; status: string; stage: string | null; since: string; last: string; jobs: number; spent: number; owed: number; open_quote: number | null; line: string };
export type InvoiceRow = CardInvoice & { thread_id: string; customer: string; phone: string };
export type Winback = { past: number; eligible: number; names: string[]; draft: string };
export type Data = { project: string; business: string; number: string; canCall: boolean; businesses: { project_id: string; name: string }[]; live: Live; owner: string; appointments: Appt[]; quotes: Quote[]; quoteSteps: number;
  wonJobs?: { id: string; customer_name: string; customer_phone: string; amount: number | null; won_at: string }[]; hasReviewLink?: boolean; repeat?: boolean; calendar: Cal;
  messages: { author: string; body: string; created_at: string }[]; unreadFromSam: number; board?: Card[]; setup?: Record<string, string>; winback?: Winback; customers?: Customer[]; invoices?: InvoiceRow[] };
export type Text = { id: string; direction: string; author: string; body: string; at: string; media?: { url: string; type: string }[] };
export type Thread = { id: string; customer_name: string; customer_phone: string; source: string; status: string };
export type { Card, CardInvoice, Stage };

export type Tab = "today" | "inbox" | "jobs" | "calendar" | "customers" | "invoices" | "numbers" | "sam" | "more";
/** Where a screen can send the owner. The shell owns the state; screens just ask. */
export type Go = {
  tab: (t: Tab) => void;
  record: (id: string, opts?: { ask?: "quoted" | "won"; view?: "activity" | "job" }) => void;
  thread: (id: string) => void;
  invoice: (id: string) => void;
  addLead: () => void;
  importCustomers: () => void;
  setup: () => void;
  billing: () => void;
};
/** What the business has set up, so screens can show the right button or the right nudge. */
export type Biz = { reviewLink: boolean; number: boolean; owner: string; business: string; priceBook: string; taxRate: string; payLink: boolean; calendar: boolean; trade: string; canCall: boolean };

export const SOURCE: Record<string, string> = { missed_call: "Missed call", "web chat": "Website chat", "web form": "Web form", text: "Text", quote: "Quote follow-up", review: "Review request", rehash: "Old lead", angi: "Angi", thumbtack: "Thumbtack", facebook: "Facebook", google: "Google", yelp: "Yelp", nextdoor: "Nextdoor", zapier: "Form", referral: "Referral", owner: "Added by you", import: "Imported" };
export const sourceLabel = (s: string) => SOURCE[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown");
