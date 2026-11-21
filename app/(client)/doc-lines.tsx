// Line items for the customer's quote and invoice pages: what, how many, at what price, the total.
// QuoteOptions: a quote with options, where the customer picks one (Good, Better, Best) and ticks any add-ons.
import { chosen, tiersOf, totals, type Choice, type Item as BItem } from "@/lib/billing";
type Item = { name: string; qty: number; unit: string; price: number };
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const qty = (n: number) => (n % 1 ? n.toFixed(2).replace(/0$/, "") : String(n));

export function DocLines({ items, taxRate, total }: { items: Item[]; taxRate: number; total: number }) {
  const sub = Math.round(items.reduce((a, i) => a + i.qty * i.price, 0) * 100) / 100;
  const tax = Math.round(sub * (taxRate / 100) * 100) / 100;
  return <div className="doc-lines">
    <ul>{items.map((i, k) => <li key={k}>
      <span><b>{i.name}</b>{(i.qty !== 1 || i.unit) && <small>{qty(i.qty)}{i.unit ? ` ${i.unit}` : ""} × {usd(i.price)}{i.unit ? `/${i.unit}` : ""}</small>}</span>
      <em>{usd(i.qty * i.price)}</em></li>)}</ul>
    <dl>
      {taxRate > 0 && <><div><dt>Subtotal</dt><dd>{usd(sub)}</dd></div><div><dt>Tax ({taxRate}%)</dt><dd>{usd(tax)}</dd></div></>}
      <div className="sum"><dt>Total</dt><dd>{usd(total)}</dd></div>
    </dl>
  </div>;
}

/** The options on a quote: one to pick, add-ons to tick, what's always included, and the total for what's picked. */
/** src turns a line's photo into an image address; an option shows the first photo on its lines. */
export function QuoteOptions({ items, taxRate, choice, onChoice, src }: { items: BItem[]; taxRate: number; choice: Choice; onChoice?: (c: Choice) => void; src?: (photo?: string) => string }) {
  const tiers = tiersOf(items), base = items.filter(i => !i.tier && !i.opt);
  const pick = choice.tier && tiers.includes(choice.tier) ? choice.tier : tiers[0] ?? null;
  const live = !!onChoice, total = totals(chosen(items, { tier: pick, addons: choice.addons }), taxRate).total;
  return <div className="doc-opts">
    {tiers.length > 0 && <fieldset className="doc-tiers" disabled={!live}><legend>{live ? "Pick one" : "Options"}</legend>
      {tiers.map(tr => { const lines = items.filter(i => i.tier === tr), tt = totals(chosen(items, { tier: tr, addons: [] }), taxRate).total, img = src?.(lines.find(l => l.photo)?.photo) ?? "";
        return <label key={tr} className={"doc-tier" + (pick === tr ? " on" : "") + (img ? " has-img" : "")}>{img && <img className="doc-tier-img" src={img} alt={`${tr}: ${lines[0]?.name ?? ""}`} loading="lazy" />}
          <input type="radio" name="tier" checked={pick === tr} onChange={() => onChoice?.({ tier: tr, addons: choice.addons })} />
          <span className="t"><b>{tr}</b><small>{lines.map(l => l.name).join(", ")}</small></span><em>{usd(tt)}</em>
        </label>; })}
    </fieldset>}
    {base.length > 0 && tiers.length > 0 && <div className="doc-incl"><h2>Included with every option</h2><ul>{base.map((i, k) => <li key={k}>{i.name}{(i.qty !== 1 || i.unit) ? <small> {qty(i.qty)}{i.unit ? ` ${i.unit}` : ""}</small> : null}</li>)}</ul></div>}
    {items.some(i => i.opt) && <fieldset className="doc-addons" disabled={!live}><legend>Add-ons</legend>
      {items.map((i, k) => i.opt ? <label key={k} className={"doc-addon" + (choice.addons.includes(k) ? " on" : "")}>
        <input type="checkbox" checked={choice.addons.includes(k)} onChange={e => onChoice?.({ tier: pick, addons: e.target.checked ? [...choice.addons, k] : choice.addons.filter(x => x !== k) })} />
        <span className="t"><b>{i.name}</b>{(i.qty !== 1 || i.unit) && <small>{qty(i.qty)}{i.unit ? ` ${i.unit}` : ""} × {usd(i.price)}</small>}</span><em>+{usd(i.qty * i.price)}</em>
      </label> : null)}
    </fieldset>}
    <DocLines items={chosen(items, { tier: pick, addons: choice.addons })} taxRate={taxRate} total={total} />
  </div>;
}
export const hasOptions = (items: BItem[]) => items.some(i => i.tier || i.opt);

/** Photos on a quote without options: each line that has one, with its name under it. */
export function DocPhotos({ items, src }: { items: BItem[]; src: (photo?: string) => string }) {
  const shown = items.filter(i => i.photo).slice(0, 4);
  if (!shown.length) return null;
  return <div className={"doc-photos n" + shown.length}>{shown.map((i, k) => <figure key={k}><img src={src(i.photo)} alt={i.name} loading="lazy" /><figcaption>{i.name}</figcaption></figure>)}</div>;
}
