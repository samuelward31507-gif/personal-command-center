// Autopilot: first lines are safe and land after the greeting; daily allowance math.
import assert from "node:assert/strict";
import { parseLines, insertLine, runAllowance, personalPrompt } from "./lib/autopilot.ts";
import { htmlToText } from "./lib/website-text.ts";
let n = 0; const ok = f => { f(); n++; };
ok(() => assert.deepEqual(parseLines('Here: ["Saw you do cedar and vinyl fencing around Spartanburg.", "Amazing work!", ""]', 3), ["Saw you do cedar and vinyl fencing around Spartanburg.", "", ""]));
ok(() => assert.deepEqual(parseLines("not json", 2), ["", ""], "bad output means no line, not a crash"));
ok(() => assert.equal(parseLines('["Do you want more jobs?"]', 1)[0], "", "no questions"));
ok(() => assert.equal(insertLine("Hi Mark,\n\nWhen you're out on a job...", "Saw you do vinyl fencing in Mesa."), "Hi Mark,\n\nSaw you do vinyl fencing in Mesa.\n\nWhen you're out on a job..."));
ok(() => assert.equal(insertLine("Hi Mark,\n\nBody", ""), "Hi Mark,\n\nBody"));
ok(() => assert.equal(runAllowance(40, 12), 28)); ok(() => assert.equal(runAllowance(40, 55), 0)); ok(() => assert.equal(runAllowance(500, 0), 200, "hard ceiling"));
ok(() => assert.match(personalPrompt([{ company: "JC Fence", niche: "fence", city: "Austin", site: "Cedar fences" }]), /^#1 JC Fence \(fence, Austin\)\nWebsite text: Cedar fences$/));
ok(() => assert.equal(htmlToText("<title>JC Fence</title><script>x()</script><p>Cedar &amp; vinyl</p>"), "JC Fence | Cedar & vinyl"));
console.log(`Autopilot checks passed (${n} assertions).`);

{
  const { fullSendFor, MISSED_CALL_LINE } = await import("./lib/autopilot.ts");
  const assert = (await import("node:assert/strict")).default;
  assert.equal(fullSendFor("no_answer", 1, false), true);
  assert.equal(fullSendFor("voicemail", 1, false), true);
  assert.equal(fullSendFor("gatekeeper", 1, false), true);
  assert.equal(fullSendFor("no_answer", 2, false), false, "only the first missed call");
  assert.equal(fullSendFor("no_answer", 1, true), false, "never a second intro");
  assert.equal(fullSendFor("interested", 1, false), false);
  assert.ok(MISSED_CALL_LINE.includes("tried giving you a call"));
  console.log("Full send checks passed (7 assertions).");
}
