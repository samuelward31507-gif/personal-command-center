// The migration guard: what the files add, what a database is missing, and which files to apply.
import assert from "node:assert/strict";
import fs from "node:fs";
import { statements, expectedSchema, missingFrom, filesFor, KNOWN_DIFFERENCES } from "./lib/migration-check.mjs";

let n = 0; const ok = (name, fn) => { fn(); n++; console.log("ok - " + name); };

ok("statements split on top-level semicolons only", () => {
  const s = statements(`-- a; comment\nCREATE TABLE a (x text DEFAULT 'a;b');\nDO $$ BEGIN PERFORM 1; END $$;\n/* c; */ ALTER TABLE a ADD COLUMN y int;`);
  assert.equal(s.length, 3);
  assert.match(s[1], /^DO \$\$ BEGIN PERFORM 1; END \$\$$/);
});

ok("tables, columns and indexes come out of creates and alters", () => {
  const e = expectedSchema([{ name: "1.sql", sql: `
    CREATE TABLE IF NOT EXISTS public.jobs (
      id uuid PRIMARY KEY, owner_id text NOT NULL, amount numeric(10,2) DEFAULT 0,
      CONSTRAINT jobs_amt CHECK (amount >= 0), UNIQUE (owner_id, id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS jobs_owner_idx ON public.jobs (owner_id);
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS measure jsonb, ADD COLUMN paperwork jsonb;
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_x CHECK (true);` }]);
  assert.deepEqual([...e.tables], ["jobs"]);
  assert.deepEqual([...e.columns].sort(), ["jobs.amount", "jobs.id", "jobs.measure", "jobs.owner_id", "jobs.paperwork"]);
  assert.deepEqual([...e.indexes], ["jobs_owner_idx"]);
});

ok("a later drop takes the table, its columns and its indexes back out", () => {
  const e = expectedSchema([
    { name: "1.sql", sql: `CREATE TABLE public.old (id int); CREATE INDEX old_idx ON public.old (id); ALTER TABLE public.keep ADD COLUMN a int, ADD COLUMN b int;` },
    { name: "2.sql", sql: `DROP TABLE IF EXISTS public.old; ALTER TABLE public.keep DROP COLUMN IF EXISTS b; ALTER TABLE public.keep RENAME COLUMN a TO c;` },
  ]);
  assert.deepEqual([...e.tables], []);
  assert.deepEqual([...e.indexes], []);
  assert.deepEqual([...e.columns], ["keep.c"]);
});

ok("missing columns on a missing table are folded into the table", () => {
  const exp = { tables: new Set(["a", "b"]), columns: new Set(["a.x", "b.y", "b.z"]), indexes: new Set(["b_idx"]) };
  const m = missingFrom(exp, { tables: new Set(["a"]), columns: new Set(["a.x"]), indexes: new Set() });
  assert.deepEqual(m, { tables: ["b"], columns: [], indexes: ["b_idx"] });
});

// The real files, against a database that has all of them except what one deploy forgot.
const dir = "db/migrations/";
const files = fs.readdirSync(dir).filter(x => x.endsWith(".sql")).sort().map(name => ({ name, sql: fs.readFileSync(dir + name, "utf8") }));
const all = expectedSchema(files);
const without = (set, ...drop) => new Set([...set].filter(x => !drop.includes(x)));

ok("every real migration file parses into something the guard can check", () => {
  assert.ok(all.tables.size > 50 && all.columns.size > 500 && all.indexes.size > 100);
  for (const c of all.columns) assert.match(c, /^[a-z0-9_]+\.[a-z0-9_]+$/, c);
  assert.ok(all.columns.has("client_threads.measure") && all.columns.has("client_threads.paperwork"));
  assert.ok(!all.tables.has("expenses"), "0028 drops expenses");
});

ok("a database that has everything passes", () => {
  const m = missingFrom(all, all);
  assert.equal(m.tables.length + m.columns.length + m.indexes.length, 0);
});

ok("today's incident: code shipped before 0094 and 0095 is caught, and names those files", () => {
  const m = missingFrom(all, { ...all, columns: without(all.columns, "client_threads.measure", "client_threads.paperwork") });
  assert.deepEqual(m.columns, ["client_threads.measure", "client_threads.paperwork"]);
  assert.deepEqual(filesFor(files, m), ["0094_client_measure.sql", "0095_client_paperwork.sql"]);
});

ok("a missing new table names the file that creates it and the files that add to it", () => {
  const m = missingFrom(all, { ...all, tables: without(all.tables, "agent_keys"), indexes: without(all.indexes, "agent_keys_owner_idx") });
  assert.deepEqual(m.tables, ["agent_keys"]);
  assert.ok(filesFor(files, m).includes("0094_agent_keys.sql"));
});

ok("known differences are never reported, and each one is named in a file", () => {
  for (const k of Object.keys(KNOWN_DIFFERENCES)) assert.ok(all.indexes.has(k) || all.tables.has(k) || all.columns.has(k), k + " is in no file; take it off the list");
  const m = missingFrom(all, { ...all, indexes: without(all.indexes, ...Object.keys(KNOWN_DIFFERENCES)) });
  assert.equal(m.indexes.length, 0);
});

console.log(`\n${n} migration guard checks passed`);
