// Inbox sorter helpers. Pure: no I/O.

export type InboxCategory = "interested" | "meeting" | "question" | "follow_up" | "not_interested" | "out_of_office" | "other";
/** What shows up as "needs you". The rest is filed out of sight. */
export const USEFUL: InboxCategory[] = ["interested", "meeting", "question", "follow_up"];
export const CATEGORY_LABEL: Record<InboxCategory, string> = {
  interested: "Interested", meeting: "Meeting", question: "Question", follow_up: "Follow up", not_interested: "Not interested", out_of_office: "Out of office", other: "Other",
};

export type RawMail = { id: string; threadId: string; from: string; subject: string; snippet: string; listUnsubscribe: boolean; date: string };

/** "Mark Delgado <mark@ridgeline.com>" → { name, addr }. */
export function parseFrom(from: string): { name: string; addr: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (m) return { name: m[1].trim(), addr: m[2].trim().toLowerCase() };
  return { name: "", addr: from.trim().toLowerCase() };
}

/** Obvious non-people (newsletters, receipts, no-reply senders) skip the AI call entirely. */
export function isBulk(m: RawMail): boolean {
  const { addr } = parseFrom(m.from);
  return m.listUnsubscribe || /^(no-?reply|noreply|notifications?|mailer-daemon|postmaster|news|newsletter|marketing|support|billing|receipts?|team|hello|info)@/i.test(addr)
    || /@(.*\.)?(google|facebookmail|linkedin|stripe|vercel|github|calendly|cal\.com|resend|twilio|squarespace|wix|godaddy)\.com$/i.test(addr);
}

/** The prompt for one batch. The model returns one JSON line per email. */
export function sortPrompt(mails: RawMail[], knownProspects: Set<string>): string {
  return mails.map((m, i) => {
    const { addr } = parseFrom(m.from);
    return `#${i}\nFrom: ${m.from}${knownProspects.has(addr) ? " (a prospect we cold-emailed)" : ""}\nSubject: ${m.subject}\nPreview: ${m.snippet}`;
  }).join("\n\n");
}

export const SORT_SYSTEM = `You sort the inbox of Sam, who runs Cinder Revenue Company: he cold-emails contractors and detailers offering a system that texts back missed calls, follows up on quotes and books jobs.
For each email decide one category:
- interested: wants to hear more, see a demo, asks price, says yes or "tell me more"
- meeting: booking, rescheduling or confirming a call or meeting
- question: a real person asking something that needs Sam's answer
- follow_up: a real business conversation waiting on Sam that isn't one of the above
- not_interested: says no, stop, remove me, unsubscribe
- out_of_office: auto-replies, vacation, "no longer with the company"
- other: newsletters, receipts, notifications, spam, anything that doesn't need Sam
Reply with exactly one line of JSON per email, in order, nothing else:
{"i":0,"category":"interested","summary":"Owner wants pricing for 2 locations","next":"Reply with a call time today"}
summary: under 15 words, what they said. next: under 10 words, what Sam should do; empty for other/out_of_office.`;

/** Parse the model's lines; anything unreadable falls back to "other" so nothing breaks. */
export function parseSort(text: string, count: number): { category: InboxCategory; summary: string; next: string }[] {
  const out = Array.from({ length: count }, () => ({ category: "other" as InboxCategory, summary: "", next: "" }));
  for (const line of text.split("\n")) {
    const t = line.trim(); if (!t.startsWith("{")) continue;
    try {
      const j = JSON.parse(t) as { i?: number; category?: string; summary?: string; next?: string };
      if (typeof j.i !== "number" || j.i < 0 || j.i >= count) continue;
      const c = (j.category ?? "") as InboxCategory;
      out[j.i] = { category: c in CATEGORY_LABEL ? c : "other", summary: String(j.summary ?? "").slice(0, 160), next: String(j.next ?? "").slice(0, 100) };
    } catch { /* skip bad line */ }
  }
  return out;
}

export const REPLY_SYSTEM = `You write short email replies for Sam Ward of Cinder Revenue Company. He sells contractors and detailers a system that texts back missed calls, follows up on quotes and books jobs, with a guarantee: 5 booked appointments in the first 30 days or the next month is free.
Write the reply body only: no subject, no signature block beyond his first name.
- 2 to 5 short sentences, plain and friendly, like a person texting from his phone. No exclamation marks, no buzzwords, never the word "AI".
- Answer what they asked using only what's given. Don't invent prices, numbers or features. If they ask price, say it depends on the setup and is easiest to cover on a quick call.
- Always end by moving to a call: offer the booking link, or two times if they asked to meet.
- If they asked to move a meeting, confirm the new time they gave, or offer the booking link if none.`;

/** The user message for a reply draft. */
export function replyPrompt(m: { from: string; subject: string; snippet: string; category: string; summary: string }, ws: { ownerFirstName: string; bookingLink: string; demoLink?: string }): string {
  return `Their email (Gmail preview, may be cut off):
From: ${m.from}
Subject: ${m.subject}
Preview: ${m.snippet}
Sorted as: ${m.category}${m.summary ? ` (${m.summary})` : ""}

Sam's first name: ${ws.ownerFirstName || "Sam"}
Booking link: ${ws.bookingLink}
${ws.demoLink ? `Demo: ${ws.demoLink}\n` : ""}Write the reply.`;
}
