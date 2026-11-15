# Connecting a client's CRM through n8n

Cinder works on its own (the Jobs board is the CRM) or alongside whatever the client already uses. Jobber has a
direct connection; anything else goes through n8n, both ways.

## Out: Cinder → their CRM

1. In n8n, create a workflow that starts with a **Webhook** node (POST). Copy its production URL.
2. In Cinder's CRM, open the client's setup sheet and paste it into **Send events to (n8n webhook)**. It must be `https://`.
3. Every event below is POSTed there as JSON within a few seconds. A failed post never affects the client's texts.

| Event | When |
| --- | --- |
| `lead.new` | A missed call, a first text, a web or paid lead, or a lead the owner added by hand |
| `lead.updated` | The owner edited the job details, value or notes on a card |
| `estimate.booked` | Cinder booked an estimate by text |
| `quote.sent` | The owner moved a card to Quoted (follow-ups start) |
| `job.won` / `job.lost` | The owner marked the job won or lost (follow-ups stop) |
| `stage.changed` | Moved back to New or Estimate booked |
| `invoice.sent` / `invoice.paid` | An invoice was texted, or the owner marked it paid |

Body:

```json
{
  "event": "lead.new",
  "business": "Front Range Fence",
  "project": "<client id>",
  "at": "2026-11-15T18:02:11.000Z",
  "data": { "customer": { "id": "<card id>", "name": "Dana Ruiz", "phone": "+17205550148" }, "source": "angi", "message": "150 ft cedar privacy" }
}
```

Headers: `X-Cinder-Event` (the event name) and, when `CINDER_WEBHOOK_SECRET` is set in Vercel, `X-Cinder-Signature: sha256=<hex>`,
an HMAC-SHA256 of the raw body with that secret. Check it in an n8n **Code** node before trusting the data:

```js
const crypto = require('crypto');
const raw = JSON.stringify($json.body);            // or the raw body if the Webhook node keeps it
const want = 'sha256=' + crypto.createHmac('sha256', $env.CINDER_WEBHOOK_SECRET).update(raw).digest('hex');
if ($json.headers['x-cinder-signature'] !== want) throw new Error('Bad signature');
return $input.all();
```

Then add one branch per CRM: HubSpot / Pipedrive / GoHighLevel nodes create or update the contact from
`data.customer`; a Google Sheets node can log every lead.

## In: their CRM or lead source → Cinder

POST the lead to `https://<crm>/api/intake?key=<the client's website key>` (add `&source=angi|thumbtack|facebook`
for paid leads). JSON with a name and 10-digit phone is enough. Cinder texts them right away and the lead lands
on the Jobs board. This is the same endpoint the client's website forms use.

## Not yet

- Ready-made n8n workflow files per CRM. Build them once a client needs one, and test against their account.
- Pulling open quotes out of Jobber automatically (next on the list).
