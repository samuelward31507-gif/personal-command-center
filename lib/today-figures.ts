// The client Today's money figures, from the same records every other screen uses. Pure, for tests.
// Window: today and the 29 days before ("last 30 days"). A job counts as won on the day it moved to Won.

export type FigCard = { stage: string; pastCustomer?: boolean; stageAt?: string | null; price: number };
export type FigPayment = { amount: number; paid_on: string };
export type FigInvoice = { status: string; total: number; paid_amount?: number; due_on: string | null };

const DAY = 86_400_000;
const noon = (s: string) => Date.parse(s + "T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function todayFigures(input: { today: string; cards: FigCard[]; payments: FigPayment[]; invoices: FigInvoice[]; dayOf?: (at: string) => string }) {
  const { today, cards, payments, invoices } = input;
  const dayOf = input.dayOf ?? ((at: string) => at.slice(0, 10));
  const days = Array.from({ length: 30 }, (_, k) => iso(noon(today) - (29 - k) * DAY));
  const from = days[0], fromPrev = iso(noon(from) - 30 * DAY);
  const won = cards.filter(c => c.stage === "won" && !c.pastCustomer && c.stageAt).map(c => ({ ...c, day: dayOf(c.stageAt!) }));
  const inWin = won.filter(c => c.day >= from && c.day <= today);
  const prev = won.filter(c => c.day >= fromPrev && c.day < from).reduce((a, c) => a + c.price, 0);
  const pays = payments.filter(p => p.paid_on >= from && p.paid_on <= today);
  const wonRun = days.map(d => inWin.filter(c => c.day <= d).reduce((a, c) => a + c.price, 0));
  const colRun = days.map(d => pays.filter(p => p.paid_on <= d).reduce((a, p) => a + p.amount, 0));
  const open = invoices.filter(i => i.status === "sent");
  const bal = (i: FigInvoice) => Math.max(0, i.total - (i.paid_amount ?? 0));
  const owed = open.reduce((a, i) => a + bal(i), 0);
  const late = open.filter(i => i.due_on && i.due_on < today).reduce((a, i) => a + bal(i), 0);
  const wonValue = wonRun[29];
  return {
    days, wonRun, colRun, wonValue, wonCount: inWin.length, average: inWin.length ? Math.round(wonValue / inWin.length) : 0,
    collected: colRun[29], owed, late, notDue: owed - late,
    delta: prev > 0 ? Math.round(((wonValue - prev) / prev) * 100) : null,
  };
}
