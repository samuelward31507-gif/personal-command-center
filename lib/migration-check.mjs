// Migration guard: works out, from the files in db/migrations, which tables, columns and indexes the code expects,
// so a deploy can stop before it ships code that reads something the database doesn't have yet. There is no
// migrations table here (migrations are applied by hand), so the guard checks the schema itself, not a ledger.
// Plain JavaScript on purpose: it runs in Vercel's build before anything is compiled. It never writes to the database.

/** Split SQL into statements on top-level semicolons, skipping comments, quoted strings and $$ blocks. */
export function statements(sql) {
  const out = []; let cur = "", i = 0;
  while (i < sql.length) {
    const c = sql[i], two = sql.slice(i, i + 2);
    if (two === "--") { const j = sql.indexOf("\n", i); i = j < 0 ? sql.length : j; continue; }
    if (two === "/*") { const j = sql.indexOf("*/", i + 2); i = j < 0 ? sql.length : j + 2; continue; }
    if (c === "'") { const j = endQuote(sql, i); cur += sql.slice(i, j); i = j; continue; }
    if (c === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) { const j = sql.indexOf(m[0], i + m[0].length); const end = j < 0 ? sql.length : j + m[0].length; cur += sql.slice(i, end); i = end; continue; }
    }
    if (c === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function endQuote(s, i) { let j = i + 1; while (j < s.length) { if (s[j] === "'") { if (s[j + 1] === "'") { j += 2; continue; } return j + 1; } j++; } return s.length; }

const ident = String.raw`(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const qname = String.raw`(?:${ident}\.)?${ident}`;
const unq = (s) => s.replace(/"/g, "");
/** "public.client_threads" or "client_threads" → "client_threads" (everything here lives in public). */
const tbl = (s) => { const p = unq(s).split("."); return p[p.length - 1].toLowerCase(); };
const col = (s) => unq(s).toLowerCase();

/** Split on commas that aren't inside parentheses or quotes. */
function topLevelCommas(s) {
  const out = []; let depth = 0, cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") q = !q;
    if (!q) { if (c === "(") depth++; else if (c === ")") depth--; else if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; } }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
const CONSTRAINT_WORDS = /^(constraint|primary|unique|check|foreign|exclude|like)\b/i;

/**
 * What the migrations add, in file order, with anything a later file drops taken back out.
 * files: [{ name, sql }] sorted by name. Returns { tables: Set, columns: Set("table.col"), indexes: Set }.
 */
export function expectedSchema(files) {
  const tables = new Set(), columns = new Set(), indexes = new Set(), indexTable = new Map();
  for (const f of files) {
    for (const st of statements(f.sql)) {
      const s = st.replace(/\s+/g, " ");
      let m;
      if ((m = new RegExp(String.raw`^create (?:unlogged )?table (?:if not exists )?(${qname}) ?\((.*)\)[^)]*$`, "i").exec(s))) {
        const t = tbl(m[1]); tables.add(t);
        for (const part of topLevelCommas(m[2])) {
          if (CONSTRAINT_WORDS.test(part)) continue;
          const cm = new RegExp(`^(${ident})`).exec(part); if (cm) columns.add(t + "." + col(cm[1]));
        }
        continue;
      }
      if ((m = new RegExp(String.raw`^create (?:unique )?index (?:concurrently )?(?:if not exists )?(${ident}) on (?:only )?(${qname})`, "i").exec(s))) { indexes.add(col(m[1])); indexTable.set(col(m[1]), tbl(m[2])); continue; }
      if ((m = new RegExp(String.raw`^drop table (?:if exists )?(.+?)(?: cascade| restrict)?$`, "i").exec(s))) {
        for (const n of m[1].split(",")) { const t = tbl(n.trim()); tables.delete(t); for (const c of [...columns]) if (c.startsWith(t + ".")) columns.delete(c); for (const [ix, it] of indexTable) if (it === t) indexes.delete(ix); }
        continue;
      }
      if ((m = new RegExp(String.raw`^drop index (?:concurrently )?(?:if exists )?(.+?)(?: cascade| restrict)?$`, "i").exec(s))) { for (const n of m[1].split(",")) indexes.delete(tbl(n.trim())); continue; }
      if ((m = new RegExp(String.raw`^alter table (?:if exists )?(?:only )?(${qname}) (.*)$`, "i").exec(s))) {
        const t = tbl(m[1]), rest = m[2];
        let rm;
        if ((rm = new RegExp(String.raw`^rename to (${ident})$`, "i").exec(rest))) {
          const nt = col(rm[1]); if (tables.delete(t)) tables.add(nt);
          for (const c of [...columns]) if (c.startsWith(t + ".")) { columns.delete(c); columns.add(nt + c.slice(t.length)); }
          continue;
        }
        if ((rm = new RegExp(String.raw`^rename (?:column )?(${ident}) to (${ident})$`, "i").exec(rest))) {
          if (columns.delete(t + "." + col(rm[1]))) columns.add(t + "." + col(rm[2])); continue;
        }
        for (const action of topLevelCommas(rest)) {
          let am;
          if ((am = new RegExp(String.raw`^add column (?:if not exists )?(${ident})`, "i").exec(action))) columns.add(t + "." + col(am[1]));
          else if ((am = new RegExp(String.raw`^add (?!constraint\b|primary\b|unique\b|check\b|foreign\b|exclude\b)(?:if not exists )?(${ident}) `, "i").exec(action))) columns.add(t + "." + col(am[1]));
          else if ((am = new RegExp(String.raw`^drop column (?:if exists )?(${ident})`, "i").exec(action))) columns.delete(t + "." + col(am[1]));
        }
      }
    }
  }
  return { tables, columns, indexes };
}

/**
 * Named in a migration file but deliberately not in production, each with the reason. Keep this list short; an entry
 * here means the file and the database disagree on purpose.
 */
export const KNOWN_DIFFERENCES = {
  // 0006_projects_and_milestones.sql and 0007_client_projects.sql both create projects and project_milestones.
  // Production was built from 0007, whose indexes cover the same lookups under other names.
  "projects_owner_status_updated_idx": "superseded by 0007 projects_owner_status_target_idx",
  "projects_owner_target_date_idx": "superseded by 0007 projects_owner_status_target_idx",
  "project_milestones_owner_project_order_idx": "superseded by 0007 project_milestones_owner_project_idx",
  "project_milestones_owner_status_due_idx": "superseded by 0007 project_milestones_owner_due_idx",
};

/** What the database is missing, given what it has. Each list is sorted so the message is stable. */
export function missingFrom(expected, actual) {
  const miss = (want, have) => [...want].filter(x => !have.has(x) && !(x in KNOWN_DIFFERENCES)).sort();
  const tables = miss(expected.tables, actual.tables);
  const gone = new Set(tables);
  return {
    tables,
    // A missing table already says its columns are missing; list only columns on tables that exist.
    columns: miss(expected.columns, actual.columns).filter(c => !gone.has(c.split(".")[0])),
    indexes: miss(expected.indexes, actual.indexes),
  };
}

/** Which migration file adds each missing object, so the message says what to apply. */
export function filesFor(files, missing) {
  const want = new Set([...missing.tables, ...missing.columns, ...missing.indexes]);
  const hit = new Set();
  for (const f of files) {
    const one = expectedSchema([f]);
    for (const x of [...one.tables, ...one.columns, ...one.indexes]) if (want.has(x)) hit.add(f.name);
    // A file that adds columns to a missing table has to be applied too, after the one that creates it.
    for (const c of one.columns) if (missing.tables.includes(c.split(".")[0])) hit.add(f.name);
  }
  return [...hit].sort();
}
