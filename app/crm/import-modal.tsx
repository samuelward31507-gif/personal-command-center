"use client";
import { useMemo, useState } from "react";
import {
  MAX_IMPORT_ROWS,
  buildHeaderIndex,
  normalizeImportRow,
  normalizePhoneDigits,
  parseCsv,
  type NormalizedImportRow,
} from "@/lib/contact-import";

type ExistingContact = { email: string; phone: string };

type PreviewRow =
  | { rowNum: number; kind: "valid"; data: NormalizedImportRow; duplicate: boolean }
  | { rowNum: number; kind: "invalid"; reason: string };

type ImportReportEntry = { row: number; name?: string; reason?: string; id?: string };
type ImportSummary = {
  totalRows: number; imported: number; skipped: number; failed: number;
  enrollOutreach: boolean; enrolled: number; enrollmentFailed: number;
};
type ImportResponse = {
  summary: ImportSummary;
  imported: ImportReportEntry[]; skipped: ImportReportEntry[]; failed: ImportReportEntry[];
  enrolled: ImportReportEntry[]; enrollmentFailed: ImportReportEntry[];
};

export default function ImportModal({ existingContacts, onClose, onImported }: {
  existingContacts: ExistingContact[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [stage, setStage] = useState<"pick" | "preview" | "result">("pick");
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState("");
  const [enrollOutreach, setEnrollOutreach] = useState(true);
  const [niche, setNiche] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [retried, setRetried] = useState<Set<number>>(new Set());

  function handleFile(file: File) {
    setParseError(""); setStage("pick");
    file.text().then((text) => {
      const rows = parseCsv(text);
      if (rows.length < 2) { setParseError("CSV needs a header row and at least one contact."); return; }
      const [headerRow, ...rest] = rows;
      if (rest.length > MAX_IMPORT_ROWS) { setParseError(`Import up to ${MAX_IMPORT_ROWS} contacts at a time (found ${rest.length}).`); return; }
      setHeader(headerRow); setDataRows(rest); setStage("preview");
    }).catch(() => setParseError("Could not read this file."));
  }

  const preview = useMemo<PreviewRow[]>(() => {
    if (stage === "pick") return [];
    const headerIndex = buildHeaderIndex(header);
    const existingEmails = new Set(existingContacts.map((c) => c.email.trim().toLowerCase()).filter(Boolean));
    const existingPhones = new Set(existingContacts.map((c) => normalizePhoneDigits(c.phone)).filter((v) => v.length > 0));
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    return dataRows.map((cells, i): PreviewRow => {
      const rowNum = i + 1;
      const outcome = normalizeImportRow(cells, headerIndex);
      if (outcome.kind === "invalid") return { rowNum, kind: "invalid", reason: outcome.reason };
      const emailKey = outcome.row.email.toLowerCase();
      const phoneKey = normalizePhoneDigits(outcome.row.phone);
      const duplicate =
        (!!emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) ||
        (!!phoneKey && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey)));
      if (emailKey) seenEmails.add(emailKey);
      if (phoneKey) seenPhones.add(phoneKey);
      return { rowNum, kind: "valid", data: outcome.row, duplicate };
    });
  }, [stage, header, dataRows, existingContacts]);

  const willImportCount = preview.filter((p) => p.kind === "valid" && !p.duplicate).length;
  const duplicateCount = preview.filter((p) => p.kind === "valid" && p.duplicate).length;
  const invalidCount = preview.filter((p) => p.kind === "invalid").length;

  async function confirmImport() {
    setSubmitting(true); setSubmitError("");
    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header, rows: dataRows, enrollOutreach, niche, painPoint }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not import contacts.");
      setResult(data as ImportResponse);
      setStage("result");
      onImported();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not import contacts.");
    } finally {
      setSubmitting(false);
    }
  }

  async function retryEnrollment(entry: ImportReportEntry) {
    if (!entry.id) return;
    setRetrying(entry.row);
    try {
      const response = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: entry.id, niche, painPoint }),
      });
      if (response.ok) setRetried((old) => new Set(old).add(entry.row));
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="crm-modal crm-import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header>
          <div><div className="crm-eyebrow">IMPORT LEADS</div><h2 id="import-title">
            {stage === "pick" ? "Import contacts from CSV" : stage === "preview" ? "Review before import" : "Import complete"}
          </h2></div>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        {stage === "pick" && (
          <div className="crm-import-pick">
            <p>Upload a CSV with company/business name, contact name, phone, email, website, location, job title, source, and notes — whichever columns your spreadsheet has. Up to {MAX_IMPORT_ROWS} rows at a time.</p>
            {parseError && <p role="alert" className="crm-import-error">{parseError}</p>}
            <label className="crm-btn crm-btn-primary" style={{ cursor: "pointer", display: "inline-block" }}>
              Choose CSV file
              <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.currentTarget.value = ""; }} />
            </label>
          </div>
        )}

        {stage === "preview" && (
          <div className="crm-import-preview">
            <div className="crm-import-summary-bar">
              <span className="crm-import-pill ok">{willImportCount} will import</span>
              <span className="crm-import-pill warn">{duplicateCount} duplicate (skipped)</span>
              <span className="crm-import-pill bad">{invalidCount} invalid (skipped)</span>
            </div>
            <div className="crm-import-table-wrap">
              <table className="crm-import-table">
                <thead><tr><th>#</th><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead>
                <tbody>
                  {preview.slice(0, 500).map((p) => (
                    <tr key={p.rowNum} className={p.kind === "invalid" ? "row-invalid" : p.duplicate ? "row-duplicate" : "row-ok"}>
                      <td>{p.rowNum}</td>
                      {p.kind === "invalid" ? (
                        <td colSpan={5}>Invalid — {p.reason}</td>
                      ) : (
                        <>
                          <td>{p.data.name}</td>
                          <td>{p.data.company}</td>
                          <td>{p.data.email}</td>
                          <td>{p.data.phone}</td>
                          <td>{p.duplicate ? "Duplicate — will skip" : "Will import"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="crm-import-options">
              <label className="crm-import-check">
                <input type="checkbox" checked={enrollOutreach} onChange={(e) => setEnrollOutreach(e.target.checked)} />
                Enroll imported leads in the outreach queue
              </label>
              {enrollOutreach && (
                <div className="crm-import-enroll-fields">
                  <label>Niche<input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="HVAC, garage doors…" /></label>
                  <label>Reason for outreach<input value={painPoint} onChange={(e) => setPainPoint(e.target.value)} placeholder="e.g. missed calls and slow lead follow-up" /></label>
                </div>
              )}
            </div>
            {submitError && <p role="alert" className="crm-import-error">{submitError}</p>}
            <footer className="crm-import-footer">
              <button type="button" onClick={() => setStage("pick")} disabled={submitting}>Back</button>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void confirmImport()} disabled={submitting || willImportCount === 0}>
                {submitting ? "Importing…" : `Import ${willImportCount} contact${willImportCount === 1 ? "" : "s"}`}
              </button>
            </footer>
          </div>
        )}

        {stage === "result" && result && (
          <div className="crm-import-result">
            <div className="crm-import-summary-bar">
              <span className="crm-import-pill ok">{result.summary.imported} imported</span>
              <span className="crm-import-pill warn">{result.summary.skipped} skipped</span>
              <span className="crm-import-pill bad">{result.summary.failed} failed</span>
              {result.summary.enrollOutreach && <span className="crm-import-pill ok">{result.summary.enrolled} enrolled</span>}
              {result.summary.enrollOutreach && result.summary.enrollmentFailed > 0 && (
                <span className="crm-import-pill bad">{result.summary.enrollmentFailed} enrollment failed</span>
              )}
            </div>
            {result.failed.length > 0 && (
              <div className="crm-import-detail">
                <h3>Failed rows</h3>
                <ul>{result.failed.map((f) => <li key={f.row}>Row {f.row}{f.name ? ` (${f.name})` : ""}: {f.reason}</li>)}</ul>
              </div>
            )}
            {result.skipped.length > 0 && (
              <div className="crm-import-detail">
                <h3>Skipped rows</h3>
                <ul>{result.skipped.map((s) => <li key={s.row}>Row {s.row}{s.name ? ` (${s.name})` : ""}: {s.reason}</li>)}</ul>
              </div>
            )}
            {result.enrollmentFailed.length > 0 && (
              <div className="crm-import-detail">
                <h3>Enrollment failures — contact was imported, outreach enrollment was not. Retry without reimporting:</h3>
                <ul>
                  {result.enrollmentFailed.map((f) => (
                    <li key={f.row}>
                      Row {f.row}{f.name ? ` (${f.name})` : ""}: {f.reason}{" "}
                      {retried.has(f.row) ? <span>— retried</span> : (
                        <button type="button" onClick={() => void retryEnrollment(f)} disabled={retrying === f.row}>
                          {retrying === f.row ? "Retrying…" : "Retry enrollment"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <footer className="crm-import-footer">
              <button type="button" className="crm-btn crm-btn-primary" onClick={onClose}>Done</button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
