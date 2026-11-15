// Line items for the customer's quote and invoice pages: what, how many, at what price, the total.
type Item = { name: string; qty: number; unit: string; price: number };
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const qty = (n: number) => (n % 1 ? n.toFixed(2).replace(/0$/, "") : String(n));

export function DocLines({ items, taxRate, total }: { items: Item[]; taxRate: number; total: number }) {
  const sub = Math.round(items.reduce((a, i) => a + i.qty * i.price, 0) * 100) / 100;
  const tax = Math.round(sub * (taxRate / 100) * 100) / 100;
  return <div className="qp-lines">
    <ul>{items.map((i, k) => <li key={k}>
      <span><b>{i.name}</b>{(i.qty !== 1 || i.unit) && <small>{qty(i.qty)}{i.unit ? ` ${i.unit}` : ""} × {usd(i.price)}{i.unit ? `/${i.unit}` : ""}</small>}</span>
      <em>{usd(i.qty * i.price)}</em></li>)}</ul>
    <dl>
      {taxRate > 0 && <><div><dt>Subtotal</dt><dd>{usd(sub)}</dd></div><div><dt>Tax ({taxRate}%)</dt><dd>{usd(tax)}</dd></div></>}
      <div className="sum"><dt>Total</dt><dd>{usd(total)}</dd></div>
    </dl>
  </div>;
}
