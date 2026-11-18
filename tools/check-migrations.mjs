// Stops a production build when the production database is missing a table, column or index that a file in
// db/migrations adds, so code never ships ahead of its migration. Runs as `prebuild`; on anything but a Vercel
// production build it exits quietly. Read-only: it only queries the schema catalogs.
//
//   node tools/check-migrations.mjs           check against DATABASE_URL (any environment)
//   SKIP_MIGRATION_CHECK=1                    let one build through (say why in the deploy notes)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedSchema, missingFrom, filesFor } from "../lib/migration-check.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const lifecycle = process.env.npm_lifecycle_event === "prebuild";

if (lifecycle && process.env.VERCEL_ENV !== "production") process.exit(0);
if (process.env.SKIP_MIGRATION_CHECK === "1") { console.warn("Migration check skipped (SKIP_MIGRATION_CHECK=1)."); process.exit(0); }
if (!process.env.DATABASE_URL) { fail("DATABASE_URL isn't set, so the migration check can't reach the database."); }

const dir = path.join(root, "db", "migrations");
const files = fs.readdirSync(dir).filter(n => n.endsWith(".sql")).sort().map(name => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
const expected = expectedSchema(files);

let actual;
try {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  const [t, c, i] = await Promise.all([
    sql`SELECT table_name AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    sql`SELECT table_name || '.' || column_name AS n FROM information_schema.columns WHERE table_schema = 'public'`,
    sql`SELECT indexname AS n FROM pg_indexes WHERE schemaname = 'public'`,
  ]);
  const set = rows => new Set(rows.map(r => String(r.n).toLowerCase()));
  actual = { tables: set(t), columns: set(c), indexes: set(i) };
} catch (e) {
  fail("The migration check couldn't read the database schema: " + (e instanceof Error ? e.message : String(e)));
}

const missing = missingFrom(expected, actual);
const count = missing.tables.length + missing.columns.length + missing.indexes.length;
if (!count) { console.log(`Migration check: the database has everything in ${files.length} migration files.`); process.exit(0); }

const lines = [
  `The database is missing ${count} thing${count === 1 ? "" : "s"} the migrations add, so this build stops before the code ships.`,
  ...missing.tables.map(x => "  table   " + x),
  ...missing.columns.map(x => "  column  " + x),
  ...missing.indexes.map(x => "  index   " + x),
  "Apply these files to the production database first, in order, then deploy again:",
  ...filesFor(files, missing).map(n => "  db/migrations/" + n),
];
fail(lines.join("\n"));

function fail(msg) { console.error("\n" + msg + "\n"); process.exit(1); }
