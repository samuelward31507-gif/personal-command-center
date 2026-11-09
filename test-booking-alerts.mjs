// Checks the new-booking alert is wired: API reads Cal.com bookings, the CRM layout mounts the alert.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const api = readFileSync("app/api/alerts/bookings/route.ts", "utf8");
const ui = readFileSync("app/crm/booking-alerts.tsx", "utf8");
const layout = readFileSync("app/crm/layout.tsx", "utf8");
assert.match(api, /provider = 'cal_ai'/); assert.match(api, /owner_id = \$\{o\}/); assert.match(api, /status <> 'cancelled'/);
assert.match(ui, /\/api\/alerts\/bookings\?since=/); assert.match(ui, /check\(\), 30000\)/); assert.match(ui, /new Notification/);
assert.match(layout, /<BookingAlerts \/>/);
console.log("Booking alert checks passed.");
