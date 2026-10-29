// Ask Cinder: the Home bar's AI. Tool definitions, system prompt and action validation. No I/O.
//
// Reads run automatically (owner-scoped SQL). Anything that changes data is only *proposed*
// by the model; the founder confirms each change, and /api/ask/execute re-validates it.
// Cinder never sends messages, places calls, drafts SMS, deletes records or marks money paid.

export const ASK_STAGES = ["new", "contacted", "meeting_booked", "meeting_held", "proposal", "won", "lost", "nurture"] as const;
export const ASK_TIERS = {
  tier1: { serviceType: "tier1_speed_to_lead", label: "Tier 1 · Speed to Lead", setupFee: 1500, monthlyFee: 997 },
  tier2: { serviceType: "tier2_revenue_system", label: "Tier 2 · Revenue System", setupFee: 3000, monthlyFee: 1500 },
} as const;
export const ACTION_KINDS = ["create_contact", "set_follow_up", "add_note", "create_task", "create_deal", "move_deal", "schedule_event"] as const;
export type ActionKind = typeof ACTION_KINDS[number];
export type AskAction = { kind: ActionKind; label: string; summary: string; params: Record<string, string | number | null> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function validDate(v: unknown): string | null {
  if (typeof v !== "string" || !DATE.test(v)) return null;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}
function validDateTime(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

/**
 * Validate and normalise one proposed action. Returns the clean action or an error string.
 * The same function guards both the proposal (shown to the founder) and the execution.
 */
export function validateAction(input: unknown): AskAction | string {
  if (!input || typeof input !== "object") return "Action must be an object.";
  const raw = input as Record<string, unknown>;
  const kind = raw.kind as ActionKind;
  if (!ACTION_KINDS.includes(kind)) return `Unknown action "${String(raw.kind)}". Allowed: ${ACTION_KINDS.join(", ")}.`;
  const p = (raw.params && typeof raw.params === "object" ? raw.params : {}) as Record<string, unknown>;
  const label = str(raw.label, 80);
  const summary = str(raw.summary, 400);
  const out = (params: AskAction["params"], fallback: string): AskAction => ({ kind, label: label || fallback, summary, params });

  switch (kind) {
    case "create_contact": {
      const name = str(p.name, 200), company = str(p.company, 300);
      if (!name && !company) return "create_contact needs a name or a company.";
      const status = str(p.status, 20).toLowerCase() || "lead";
      if (!["lead", "contact", "customer", "partner"].includes(status)) return "status must be lead, contact, customer or partner.";
      return out({ name: name || company, company, phone: str(p.phone, 100), email: str(p.email, 320), website: str(p.website, 500),
        location: str(p.location, 300), notes: str(p.notes, 2000), status }, "Add contact");
    }
    case "set_follow_up": {
      const contactId = uuidOrNull(p.contactId), date = validDate(p.date);
      if (!contactId) return "set_follow_up needs a contactId from the CRM.";
      if (!date) return "set_follow_up needs date as YYYY-MM-DD.";
      return out({ contactId, date }, "Set follow-up");
    }
    case "add_note": {
      const contactId = uuidOrNull(p.contactId), note = str(p.note, 2000);
      if (!contactId) return "add_note needs a contactId from the CRM.";
      if (!note) return "add_note needs the note text.";
      return out({ contactId, note }, "Add note");
    }
    case "create_task": {
      const title = str(p.title, 240);
      if (!title) return "create_task needs a title.";
      const priority = str(p.priority, 10).toLowerCase() || "medium";
      if (!["low", "medium", "high", "urgent"].includes(priority)) return "priority must be low, medium, high or urgent.";
      const dueDate = p.dueDate ? validDate(p.dueDate) : null;
      if (p.dueDate && !dueDate) return "dueDate must be YYYY-MM-DD.";
      return out({ title, description: str(p.description, 2000), priority, dueDate, contactId: uuidOrNull(p.contactId), dealId: uuidOrNull(p.dealId) }, "Create task");
    }
    case "create_deal": {
      const tier = str(p.tier, 10).toLowerCase();
      const offer = tier === "tier1" || tier === "tier2" ? ASK_TIERS[tier] : null;
      const title = str(p.title, 240);
      if (!title) return "create_deal needs a title.";
      const stage = str(p.stage, 20) || "new";
      if (!(ASK_STAGES as readonly string[]).includes(stage) || stage === "won" || stage === "lost") return "create_deal stage must be an open stage (new, contacted, meeting_booked, meeting_held, proposal, nurture).";
      const fee = (v: unknown, d: number) => { const n = v === undefined || v === null || v === "" ? d : Number(v); return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : NaN; };
      const setupFee = fee(p.setupFee, offer?.setupFee ?? 0), monthlyFee = fee(p.monthlyFee, offer?.monthlyFee ?? 0);
      if (Number.isNaN(setupFee) || Number.isNaN(monthlyFee)) return "Fees must be non-negative numbers.";
      return out({ title, contactId: uuidOrNull(p.contactId), stage, serviceType: offer?.serviceType ?? "custom_ai_implementation", setupFee, monthlyFee }, "Create deal");
    }
    case "move_deal": {
      const dealId = uuidOrNull(p.dealId), stage = str(p.stage, 20);
      if (!dealId) return "move_deal needs a dealId from the CRM.";
      if (!(ASK_STAGES as readonly string[]).includes(stage)) return `stage must be one of ${ASK_STAGES.join(", ")}.`;
      const lostReason = str(p.lostReason, 500);
      if (stage === "lost" && !lostReason) return "Moving a deal to lost needs a lostReason.";
      return out({ dealId, stage, lostReason: lostReason || null }, "Move deal");
    }
    case "schedule_event": {
      const title = str(p.title, 240), startsAt = validDateTime(p.startsAt);
      if (!title) return "schedule_event needs a title.";
      if (!startsAt) return "schedule_event needs startsAt as an ISO date-time with offset.";
      const minutes = Number(p.durationMinutes ?? 30);
      if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) return "durationMinutes must be between 5 and 600.";
      const type = str(p.eventType, 20) || "meeting";
      if (!["meeting", "call", "focus", "personal", "deadline", "other"].includes(type)) return "eventType must be meeting, call, focus, personal, deadline or other.";
      return out({ title, startsAt, durationMinutes: Math.round(minutes), eventType: type, contactId: uuidOrNull(p.contactId), dealId: uuidOrNull(p.dealId) }, "Add to calendar");
    }
  }
}

/** Client tools the model can call. All reads are scoped to the signed-in owner. */
export const ASK_TOOLS = [
  {
    name: "search_contacts",
    description: "Search the founder's CRM contacts (prospects, leads, customers). Combine filters freely. Returns up to `limit` rows plus the total match count.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Free text matched against company, name, location, email, phone and notes (e.g. 'pool', 'El Paso')." },
        status: { type: "string", enum: ["lead", "contact", "customer", "partner"] },
        location: { type: "string", description: "City/state substring." },
        missing_website: { type: "boolean", description: "Only contacts with no website on file." },
        has_phone: { type: "boolean" },
        follow_up: { type: "string", enum: ["overdue", "today", "this_week", "any", "none"] },
        never_contacted: { type: "boolean", description: "No logged call outcome yet." },
        last_outcome: { type: "string", description: "Most recent call outcome, e.g. no_answer, voicemail, interested, meeting_booked, callback_requested, not_a_fit." },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "get_contact",
    description: "Full record for one contact: details, notes, recent call activity, deals, open tasks, upcoming events and the latest business audit verdict.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_deals",
    description: "Sales pipeline deals with stage, fees, contact and dates.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: [...ASK_STAGES] },
        open_only: { type: "boolean", description: "Exclude won and lost." },
        text: { type: "string", description: "Matches deal title or company." },
      },
    },
  },
  {
    name: "business_snapshot",
    description: "Numbers across the business right now: contacts by status, follow-ups due, pipeline value by stage, active monthly recurring revenue, money expected/overdue/collected, expenses this month, tasks and active projects.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "today_queue",
    description: "The ranked My Day action queue for today: overdue follow-ups, callbacks, today's fresh prospects to call, meetings needing prep, stale deals, delivery blockers and money due. Use for 'who should I call', 'what should I do today'.",
    input_schema: { type: "object", properties: { group: { type: "string", enum: ["revenue", "prospects", "meetings", "deals", "delivery", "admin"] } } },
  },
  {
    name: "list_tasks",
    description: "Open tasks, optionally only those due by a date.",
    input_schema: { type: "object", properties: { due_by: { type: "string", description: "YYYY-MM-DD" }, include_done: { type: "boolean" } } },
  },
  {
    name: "calendar",
    description: "Calendar events between two dates (inclusive), in the founder's time zone.",
    input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }, required: ["from", "to"] },
  },
  {
    name: "list_audits",
    description: "Saved business audits (research reports on prospects) with their verdict line.",
    input_schema: { type: "object", properties: { text: { type: "string", description: "Matches company or title." } } },
  },
  {
    name: "get_audit",
    description: "The full text of one saved business audit.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "money",
    description: "Revenue entries (expected, overdue, paid) and recent expenses. Read-only.",
    input_schema: { type: "object", properties: { status: { type: "string", enum: ["expected", "overdue", "paid", "all"] }, days: { type: "integer", description: "Look back/ahead window in days (default 60)." } } },
  },
  {
    name: "propose_action",
    description:
      "Propose ONE change for the founder to confirm (shown as a card with a Confirm button). Nothing changes until they confirm. " +
      "Kinds and params: create_contact{name,company,phone,email,website,location,notes,status}; set_follow_up{contactId,date}; add_note{contactId,note}; " +
      "create_task{title,description,priority,dueDate,contactId,dealId}; create_deal{title,contactId,tier:'tier1'|'tier2',stage,setupFee,monthlyFee}; " +
      "move_deal{dealId,stage,lostReason}; schedule_event{title,startsAt(ISO with offset),durationMinutes,eventType,contactId,dealId}. " +
      "Use real ids from earlier tool results. Call once per change; several calls are fine.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...ACTION_KINDS] },
        label: { type: "string", description: "Button-sized title, e.g. 'Follow up with Able Pool & Spa Friday'." },
        summary: { type: "string", description: "One line on what will change." },
        params: { type: "object" },
      },
      required: ["kind", "label", "params"],
    },
  },
] as const;

export type AskContext = { today: string; now: string; timeZone: string; weekday: string };

export function buildSystemPrompt(ctx: AskContext) {
  return `You are Cinder, the AI built into Samuel's private agency CRM. Samuel runs Contractor Growth Co (CGC), selling AI speed-to-lead and revenue systems to contractors (pool, fence, etc.). Offers: Tier 1 Speed to Lead $1,500 setup + $997/mo; Tier 2 Revenue System $3,000 setup + $1,500/mo.

Today is ${ctx.weekday} ${ctx.today}; local time ${ctx.now} (${ctx.timeZone}). Resolve relative dates ("Friday", "next week") from this.

The search bar is a search engine for his whole business plus the web. Whatever he types — a name, a question, a filter, an instruction, a general question — do it:
- Business questions: use the CRM tools; never guess numbers or records. Look things up before answering.
- Outside facts (a company, a market, a person, how-to): use web_search.
- To change anything (add a contact, set a follow-up, create a deal, move a stage, add a task/note, book a calendar slot): look up the records first, then call propose_action. Never claim a change was made — say it's ready to confirm.
- A bare name or company: find it and give the useful summary (status, last touch, deal, next step).
- When he's about to make calls, point him to [Call mode](/crm/call): one prospect at a time with the brief, script and objection answers.

Hard rules:
- You never send emails/texts, place calls, or contact anyone. Do not write SMS or text-message drafts. You may show a phone number so he can call himself.
- Never mark money as paid and never treat a won deal as paid. Never delete anything.
- Do-not-contact / suppressed contacts must not be suggested for outreach.

Answer style: direct and short, like a sharp chief of staff. Lead with the answer. Use short bullets or a compact table for lists. Bold sparingly. No preamble, no "Great question", no restating the query.
Link every CRM record you mention, using exactly these link forms so the UI makes them clickable:
[Company or name](cinder://contact/<id>)  [Deal title](cinder://deal/<id>)  [Audit title](cinder://audit/<id>)
Pages: [Call mode](/crm/call) [Scoreboard](/crm/scoreboard) [Needs you](/crm/needs-you) [Pipeline](/crm/pipeline) [Money](/crm/finance) [Calendar](/crm/calendar) [Tasks](/crm/tasks) [Audit a company](/crm/audit?contact=<id>).
If something is missing (no data, no match), say so plainly and suggest the next move.`;
}

/** Turn cinder:// links into app routes. Anything else that isn't a safe http(s) or in-app path is dropped. */
export function resolveLink(href: string): string | null {
  const m = /^cinder:\/\/(contact|deal|audit)\/([0-9a-f-]{36})$/i.exec(href.trim());
  if (m) {
    const [, type, id] = m;
    if (type === "contact") return "/crm?contact=" + id;
    if (type === "deal") return "/crm/deals/" + id;
    return "/crm/preparation?artifact=" + id;
  }
  if (/^\/(?!\/)[\w\-/?=&%.#]*$/.test(href)) return href;
  if (/^https?:\/\/[^\s"'<>]+$/i.test(href)) return href;
  return null;
}
