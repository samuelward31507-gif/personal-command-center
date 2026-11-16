// What the app gets from /api/app/data, and how screens ask the shell to move around.
import type { Card, CardInvoice, Payment, Stage } from "@/lib/crm";
import type { CalEvent } from "@/lib/client-schedule";
import type { Plan, TimeEntry } from "@/lib/service";

export type Conv = { id: string; name: string; source: string; status: string; at: string | null; last: string; ask?: string;
  /** When the lead came in, how many seconds until the first reply, who spoke last ("in" means the customer), and the job's stage. */
  created?: string | null; replySec?: number | null; lastDir?: string; stage?: string };
export type Live = { replySecWeek?: number | null; leadsWeek?: number; leadsToday?: number; afterHours?: { leads: number; won: number; wonValue: number }; leads: number; needs: number; answered: number; booked: number; replySec: number | null; chasing: number; chasingValue: number; won: number; wonValue: number; revived: number; reviews: number; weeks: { week: string; leads: number; booked: number }[]; conversations: Conv[] };
export type Appt = { id: string; starts_at: string; thread_id: string; customer_name: string; customer_phone: string; event_id?: string; link?: string; crew_member?: string };
export type Quote = { id: string; customer_name: string; customer_phone: string; amount: number | null; sent_on: string; steps_sent: number; status: string };
export type Cal = { connected: boolean; email: string; events: CalEvent[]; error: string; connectUrl: string };
export type Customer = { id: string; name: string; phone: string; email?: string; address: string; source: string; status: string; stage: string | null; since: string; last: string; jobs: number; spent: number; owed: number; open_quote: number | null; line: string };
export type InvoiceRow = CardInvoice & { thread_id: string; customer: string; phone: string };
export type Winback = { past: number; eligible: number; names: string[]; draft: string };
export type Data = { /** The owner, or a crew member who sees the schedule and the jobs but no money or settings. */ role?: "owner" | "office" | "crew"; /** The signed-in phone, +1, so a crew member sees their own jobs. */ me?: string; /** Whether Cinder can email customers itself (a verified sending domain). */ emailReady?: boolean; project: string; business: string; number: string; canCall: boolean; businesses: { project_id: string; name: string }[]; live: Live; owner: string; appointments: Appt[]; quotes: Quote[]; quoteSteps: number;
  wonJobs?: { id: string; customer_name: string; customer_phone: string; amount: number | null; won_at: string }[]; hasReviewLink?: boolean; repeat?: boolean; calendar: Cal;
  messages: { author: string; body: string; created_at: string }[]; unreadFromSam: number; board?: Card[]; setup?: Record<string, string>; winback?: Winback; customers?: Customer[]; invoices?: InvoiceRow[];
  /** The website key (chat bubble and intake webhook) and the app's public origin, for the System screen. */
  key?: string; origin?: string;
  /** Jobber: whether it's wired up for this business, and the link that connects it. */
  payments?: Payment[];
  /** Service plans, the visits logged on them lately, and clocked hours (the owner sees everyone's, crew their own). */
  /** "While you worked": the last 24 hours, for the evening card. */
  evening?: import("@/lib/client-evening").Evening;
  plans?: Plan[]; visits?: { id: string; plan_id: string; thread_id: string; on_date: string; status: string; invoice_id: string | null }[]; time?: TimeEntry[];
  jobber?: { available: boolean; connected: boolean; account: string; error: string; lastPush: string | null; connectUrl: string };
  /** QuickBooks Online: invoices and payments pushed to the owner's books. */
  quickbooks?: { available: boolean; connected: boolean; company: string; error: string; lastPush: string | null; connectUrl: string };
  /** Leads by email: the forwarding address ("" until it's set up on Cinder's side) and the last emails it received. */
  mail?: { address: string; recent: LeadMail[] };
  /** Connections: each lead source's activity, texts that didn't send, the consent log. */
  wires?: { sources: { source: string; leads: number; last: string | null; last30: number }[]; failures: { id: string; at: string; body: string; name: string; phone: string; thread: string; source: string }[]; log: { at: string; event: string; source: string; phone: string; evidence: string }[] } };
export type LeadMail = { id: string; at: string; from: string; subject: string; source: string; status: string; name: string; phone: string; email: string; message: string; code: string; link: string; thread: string; why: string };
/** Lead emails that came without a phone (or couldn't be added on their own): waiting on the owner. */
export const mailWaiting = (d: { mail?: { recent: LeadMail[] } }) => (d.mail?.recent ?? []).filter(r => r.status === "no_phone" || r.status === "new");
export type Text = { id: string; direction: string; author: string; body: string; at: string; media?: { url: string; type: string }[];
  /** Twilio's word on an outgoing text: sent, delivered, undelivered, failed, or "" before the carrier answered. */
  status?: string };
export type Thread = { id: string; customer_name: string; customer_phone: string; source: string; status: string };
export type { Card, CardInvoice, Payment, Stage };

export type Tab = "today" | "inbox" | "jobs" | "quotes" | "calendar" | "customers" | "invoices" | "numbers" | "system" | "sam" | "more" | "plans" | "switch";
/** Where a screen can send the owner. The shell owns the state; screens just ask. */
export type Go = {
  tab: (t: Tab) => void;
  record: (id: string, opts?: { ask?: "quoted" | "won"; view?: "activity" | "job"; draft?: string }) => void;
  /** Open the command bar (⌘K). */
  find: () => void;
  thread: (id: string) => void;
  /** The quote editor for this customer, full page. */
  quote: (id: string) => void;
  invoice: (id: string) => void;
  addLead: () => void;
  importCustomers: () => void;
  setup: () => void;
  billing: () => void;
};
/** What the business has set up, so screens can show the right button or the right nudge. */
export type Biz = { crew: boolean; reviewLink: boolean; number: boolean; owner: string; business: string; priceBook: string; taxRate: string; payLink: boolean; calendar: boolean; trade: string; canCall: boolean };

export const SOURCE: Record<string, string> = { "booking page": "Booking page", missed_call: "Missed call", "web chat": "Website chat", "web form": "Web form", text: "Text", quote: "Quote follow-up", review: "Review request", rehash: "Old lead", angi: "Angi", thumbtack: "Thumbtack", facebook: "Facebook", google: "Google", yelp: "Yelp", nextdoor: "Nextdoor", houzz: "Houzz", bark: "Bark", porch: "Porch", networx: "Networx", email: "Email", zapier: "Form", referral: "Referral", owner: "Added by you", import: "Imported" };
export const sourceLabel = (s: string) => SOURCE[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown");
