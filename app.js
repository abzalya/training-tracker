import { PROFILE, WEEK, GYM, RUNS, HR_ZONES } from "./data.js";
import * as DB from "./db.js";
import { lineChart, stackedBars } from "./charts.js";

// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const todayISO = () => isoOf(new Date());
function isoOf(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); }
function dayName(iso) { return new Date(iso + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
function weekdayNum(iso) { return new Date(iso + "T00:00").getDay(); }

function parseDur(str) { // "44:58" or "44" -> seconds
  if (!str) return 0;
  const parts = String(str).split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60;
}
function fmtPace(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}
function zoneOf(hr) { if (!hr) return null; return HR_ZONES.find((z) => hr <= z.max); }
function epley(w, reps) { return w > 0 && reps > 0 ? w * (1 + reps / 30) : 0; }
function weekKey(iso) { // ISO week-ish bucket: year-Wn from plan start
  const start = new Date(PROFILE.startDate + "T00:00");
  const d = new Date(iso + "T00:00");
  const wk = Math.floor((d - start) / (7 * 864e5)) + 1;
  return wk;
}

// ---------- state ----------
const state = { tab: "today", date: todayISO(), editing: null };
let curGym = null, curRun = null; // working objects bound to the open form

// ---------- root render ----------
const app = $("#app");
const tabs = [
  ["today", "Today", "M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M7 11v8m10-8v8"],
  ["history", "History", "M12 8v4l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"],
  ["progress", "Progress", "M4 19V5m0 14h16M8 16l3-4 3 2 4-6"],
  ["export", "Export", "M12 3v12m0-12l-4 4m4-4l4 4M5 21h14"],
];

function renderNav() {
  return `<nav class="tabbar">${tabs.map(([id, label, d]) =>
    `<button class="tabitem ${state.tab === id ? "on" : ""}" data-tab="${id}">
      <svg viewBox="0 0 24 24"><path d="${d}"/></svg><span>${label}</span></button>`).join("")}</nav>`;
}

async function render() {
  let body = "";
  if (state.tab === "today") body = await renderToday();
  else if (state.tab === "history") body = await renderHistory();
  else if (state.tab === "progress") body = await renderProgress();
  else if (state.tab === "export") body = await renderExport();
  app.innerHTML = `<main class="scroll">${body}</main>${renderNav()}`;
  wireNav();
  if (state.tab === "today") wireToday();
  if (state.tab === "history") wireHistory();
  if (state.tab === "progress") wireProgress();
  if (state.tab === "export") wireExport();
}

function wireNav() {
  app.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => { state.tab = b.dataset.tab; state.editing = null; render(); }));
}

// ---------- TODAY ----------
async function renderToday() {
  const iso = state.date;
  const plan = WEEK[weekdayNum(iso)];
  const existing = (await DB.allSessions()).find((s) => s.date === iso && !state.editing) || null;
  const editing = state.editing;
  const wk = weekKey(iso);

  let header = `
    <header class="topbar">
      <div>
        <p class="eyebrow">${wk >= 1 ? `Week ${wk}` : "Pre-plan"} · ${PROFILE.goal}</p>
        <h1>${dayName(iso)}</h1>
      </div>
      <input type="date" id="datePick" value="${iso}" class="datepick"/>
    </header>`;

  // pick what to show: an editing session, an existing logged session, or the plan template
  if (editing) return header + (editing.type === "run" ? runForm(editing) : gymForm(editing, await DB.lastGym(editing.key, editing.id)));
  if (existing) return header + loggedCard(existing);

  // fresh from template
  if (plan.type === "gym") {
    const blank = blankGym(iso, plan);
    return header + (await gymForm(blank, await DB.lastGym(plan.key)));
  }
  if (plan.type === "run") return header + runForm(blankRun(iso, plan));
  // rest
  return header + `
    <div class="card rest">
      <div class="rest-emoji">🌙</div>
      <h2>Rest day</h2>
      <p>Recovery is where adaptation happens. Nothing to log.</p>
      <button class="btn ghost" id="logAnyway">Log something anyway</button>
    </div>`;
}

function blankGym(iso, plan) {
  const g = GYM[plan.key];
  return {
    id: DB.uid(), date: iso, type: "gym", key: plan.key, label: g.label,
    exercises: g.exercises.map((e) => ({
      name: e.name, plan: e, muscles: e.muscles,
      sets: Array.from({ length: e.sets }, () => ({ weight: "", reps: "" })),
      note: "",
    })),
    note: "",
  };
}
function blankRun(iso, plan) {
  const r = RUNS[plan.key];
  return { id: DB.uid(), date: iso, type: "run", key: plan.key, label: r.label,
           dist: "", dur: "", avgHr: "", maxHr: "", cadence: "", note: "" };
}

async function gymForm(sess, last) {
  curGym = sess; // live working reference for input handlers
  const g = GYM[sess.key];
  const warn = g?.warning ? `<div class="warnbox">⚠︎ ${esc(g.warning)}</div>` : "";
  const rows = sess.exercises.map((ex, ei) => {
    const lastEx = last?.exercises?.find((x) => x.name === ex.name);
    const ghost = lastEx ? bestSetLabel(lastEx) : null;
    const plan = ex.plan || GYM[sess.key].exercises.find((e) => e.name === ex.name) || {};
    const setRows = ex.sets.map((st, si) => {
      const g2 = lastEx?.sets?.[si];
      return `<div class="setrow">
        <span class="setn">${si + 1}</span>
        <input class="num" inputmode="decimal" data-e="${ei}" data-s="${si}" data-f="weight" value="${esc(st.weight)}" placeholder="${g2?.weight ?? "kg"}"/>
        <span class="x">×</span>
        <input class="num" inputmode="numeric" data-e="${ei}" data-s="${si}" data-f="reps" value="${esc(st.reps)}" placeholder="${g2?.reps ?? "reps"}"/>
      </div>`;
    }).join("");
    return `<div class="ex">
      <div class="ex-head">
        <div><h3>${esc(ex.name)}</h3>
          <p class="ex-meta">${plan.sets || ex.sets.length}×${esc(plan.reps || "")} · rest ${esc(plan.rest || "—")}</p></div>
        ${ghost ? `<span class="ghost">last: ${esc(ghost)}</span>` : ""}
      </div>
      ${plan.note ? `<p class="ex-note">${esc(plan.note)}</p>` : ""}
      <div class="sets">${setRows}
        <button class="addset" data-e="${ei}">+ set</button>
      </div>
      <input class="exnote" data-e="${ei}" placeholder="Note (e.g. felt strong, left shoulder tight)" value="${esc(ex.note)}"/>
    </div>`;
  }).join("");

  return `<div class="planlabel">${esc(sess.label)}</div>${warn}
    <form id="gymForm">${rows}
      <textarea id="sessNote" class="sessnote" placeholder="Session notes — sleep, energy, anything to feed back to Claude later">${esc(sess.note)}</textarea>
      <div class="actions">
        <button type="submit" class="btn primary">Save session</button>
      </div>
    </form>`;
}

function bestSetLabel(ex) {
  let best = null;
  for (const s of ex.sets || []) {
    const w = parseFloat(s.weight), r = parseFloat(s.reps);
    if (w > 0 && r > 0 && (!best || w > best.w)) best = { w, r };
  }
  return best ? `${best.w}×${best.r}` : null;
}

function runForm(sess) {
  curRun = sess; // live working reference for input handlers
  const r = RUNS[sess.key] || {};
  const dist = parseFloat(sess.dist), sec = parseDur(sess.dur);
  const pace = dist > 0 && sec > 0 ? fmtPace(sec / dist) : "—";
  const zone = zoneOf(parseFloat(sess.avgHr));
  return `<div class="planlabel">${esc(sess.label)}</div>
    ${r.desc ? `<div class="runtip"><strong>Target:</strong> ${esc(r.targetDist)}k · HR ${esc(r.hr)} · ${esc(r.pace)}<br>${esc(r.desc)}</div>` : ""}
    <form id="runForm" class="card">
      <div class="field2">
        <label>Distance (km)<input id="r_dist" inputmode="decimal" value="${esc(sess.dist)}" placeholder="${r.targetDist ?? ""}"/></label>
        <label>Time (mm:ss)<input id="r_dur" inputmode="numeric" value="${esc(sess.dur)}" placeholder="44:58"/></label>
      </div>
      <div class="field2">
        <label>Avg HR<input id="r_avg" inputmode="numeric" value="${esc(sess.avgHr)}" placeholder="bpm"/></label>
        <label>Max HR<input id="r_max" inputmode="numeric" value="${esc(sess.maxHr)}" placeholder="bpm"/></label>
      </div>
      <label>Cadence (spm)<input id="r_cad" inputmode="numeric" value="${esc(sess.cadence)}" placeholder="spm"/></label>
      <div class="computed">
        <div><span>Pace</span><strong id="o_pace">${pace}</strong></div>
        <div><span>Zone</span><strong id="o_zone" class="${zone ? "z" + zone.z : ""}">${zone ? zone.label : "—"}</strong></div>
      </div>
      <textarea id="r_note" class="sessnote" placeholder="How it felt — legs, breathing, weather, HR drift at the end">${esc(sess.note)}</textarea>
      <button type="submit" class="btn primary">Save run</button>
    </form>`;
}

function loggedCard(s) {
  let inner;
  if (s.type === "run") {
    const dist = parseFloat(s.dist), sec = parseDur(s.dur);
    const pace = dist > 0 && sec > 0 ? fmtPace(sec / dist) : "—";
    const zone = zoneOf(parseFloat(s.avgHr));
    inner = `<div class="stats4">
        ${stat(s.dist + "k", "distance")}${stat(s.dur || "—", "time")}
        ${stat(pace, "pace")}${stat((s.avgHr || "—"), "avg HR")}</div>
      ${zone ? `<span class="zonepill z${zone.z}">${zone.label}</span>` : ""}
      ${s.cadence ? `<p class="muted">Cadence ${esc(s.cadence)} spm · Max HR ${esc(s.maxHr || "—")}</p>` : ""}
      ${s.note ? `<p class="lognote">${esc(s.note)}</p>` : ""}`;
  } else {
    const ex = (s.exercises || []).map((e) => {
      const sets = (e.sets || []).filter((x) => x.weight || x.reps)
        .map((x) => `${esc(x.weight || "?")}×${esc(x.reps || "?")}`).join("  ");
      return `<div class="logex"><strong>${esc(e.name)}</strong><span>${sets || "—"}</span>${e.note ? `<em>${esc(e.note)}</em>` : ""}</div>`;
    }).join("");
    inner = ex + (s.note ? `<p class="lognote">${esc(s.note)}</p>` : "");
  }
  return `<div class="card logged">
      <div class="logged-head"><span class="done">✓ Logged</span><h2>${esc(s.label)}</h2></div>
      ${inner}
      <div class="actions">
        <button class="btn ghost" data-edit="${s.id}">Edit</button>
        <button class="btn danger" data-del="${s.id}">Delete</button>
      </div>
    </div>`;
}
const stat = (v, l) => `<div class="stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`;

function wireToday() {
  const dp = $("#datePick");
  if (dp) dp.addEventListener("change", (e) => { state.date = e.target.value; state.editing = null; render(); });

  const logAnyway = $("#logAnyway");
  if (logAnyway) logAnyway.addEventListener("click", () => {
    state.editing = blankGym(state.date, { key: "push" }); state.editing.label = "Ad-hoc session"; render();
  });

  app.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
    const all = await DB.allSessions(); state.editing = hydrate(all.find((s) => s.id === b.dataset.edit)); render();
  }));
  app.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (confirm("Delete this session?")) { await DB.deleteSession(b.dataset.del); state.editing = null; render(); }
  }));

  const gf = $("#gymForm");
  if (gf) {
    gf.addEventListener("input", (e) => {
      const t = e.target;
      if (t.classList.contains("num")) {
        const ex = curGym.exercises[+t.dataset.e]; ex.sets[+t.dataset.s][t.dataset.f] = t.value;
      } else if (t.classList.contains("exnote")) curGym.exercises[+t.dataset.e].note = t.value;
      else if (t.id === "sessNote") curGym.note = t.value;
    });
    gf.querySelectorAll(".addset").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault(); curGym.exercises[+b.dataset.e].sets.push({ weight: "", reps: "" }); state.editing = curGym; render();
    }));
    gf.addEventListener("submit", async (e) => {
      e.preventDefault(); curGym.createdAt = Date.now();
      // strip plan refs before save
      const clean = { ...curGym, exercises: curGym.exercises.map((x) => ({ name: x.name, muscles: x.muscles, sets: x.sets, note: x.note })) };
      await DB.saveSession(clean); state.editing = null; flash("Session saved ✓"); render();
    });
  }
  const rf = $("#runForm");
  if (rf) {
    const recompute = () => {
      const dist = parseFloat($("#r_dist").value), sec = parseDur($("#r_dur").value);
      $("#o_pace").textContent = dist > 0 && sec > 0 ? fmtPace(sec / dist) : "—";
      const zone = zoneOf(parseFloat($("#r_avg").value));
      const oz = $("#o_zone"); oz.textContent = zone ? zone.label : "—"; oz.className = zone ? "z" + zone.z : "";
    };
    rf.addEventListener("input", recompute);
    rf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const s = curRun;
      Object.assign(s, {
        dist: $("#r_dist").value, dur: $("#r_dur").value, avgHr: $("#r_avg").value,
        maxHr: $("#r_max").value, cadence: $("#r_cad").value, note: $("#r_note").value, createdAt: Date.now(),
      });
      await DB.saveSession(s); state.editing = null; flash("Run saved ✓"); render();
    });
  }
}
// Re-attach plan metadata when editing a saved session (saved sessions are stripped of plan refs).
function hydrate(s) {
  if (!s) return null;
  if (s.type === "gym") s.exercises = s.exercises.map((e) => ({ ...e, plan: GYM[s.key]?.exercises.find((p) => p.name === e.name) }));
  return s;
}

// ---------- HISTORY ----------
async function renderHistory() {
  const all = (await DB.allSessions()).reverse();
  if (!all.length) return emptyState("📋", "No sessions yet", "Log your first workout from the Today tab.");
  const items = all.map((s) => {
    const sub = s.type === "run"
      ? `${esc(s.dist || "?")}k · ${esc(s.dur || "?")} · HR ${esc(s.avgHr || "—")}`
      : `${(s.exercises || []).length} exercises · ${totalSets(s)} sets`;
    const cls = s.type === "run" ? "run" : "gym";
    return `<button class="histrow ${cls}" data-go="${esc(s.date)}">
      <div class="histdate"><strong>${new Date(s.date + "T00:00").getDate()}</strong><span>${new Date(s.date + "T00:00").toLocaleDateString(undefined, { month: "short" })}</span></div>
      <div class="histbody"><h3>${esc(s.label)}</h3><p>${sub}</p></div>
      <span class="chev">›</span></button>`;
  }).join("");
  return `<header class="topbar"><h1>History</h1></header><div class="histlist">${items}</div>`;
}
const totalSets = (s) => (s.exercises || []).reduce((n, e) => n + (e.sets || []).filter((x) => x.weight || x.reps).length, 0);
function wireHistory() {
  app.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
    state.date = b.dataset.go; state.tab = "today"; state.editing = null; render();
  }));
}

// ---------- PROGRESS ----------
async function renderProgress() {
  const all = await DB.allSessions();
  const gym = all.filter((s) => s.type === "gym");
  const runs = all.filter((s) => s.type === "run");

  // exercise list for 1RM picker
  const exNames = [...new Set(gym.flatMap((s) => (s.exercises || []).map((e) => e.name)))];
  const pick = state.exPick || exNames[0];

  // 1RM series for picked exercise
  let oneRM = [];
  if (pick) {
    oneRM = gym.filter((s) => (s.exercises || []).some((e) => e.name === pick)).map((s) => {
      const e = s.exercises.find((x) => x.name === pick);
      const best = Math.max(0, ...(e.sets || []).map((x) => epley(parseFloat(x.weight), parseFloat(x.reps))));
      return { y: best, label: new Date(s.date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }) };
    }).filter((p) => p.y > 0);
  }

  // weekly volume per muscle group
  const muscleKeys = ["chest", "back", "legs", "shoulder", "arms", "core"];
  const groupMap = { chest: "chest", "front delt": "shoulder", "side delt": "shoulder", "rear delt": "shoulder", shoulder: "shoulder", tricep: "arms", bicep: "arms", lats: "back", "mid back": "back", quads: "legs", glutes: "legs", hamstrings: "legs", core: "core" };
  const wkBuckets = {};
  for (const s of gym) {
    const wk = weekKey(s.date); if (wk < 1) continue;
    wkBuckets[wk] = wkBuckets[wk] || { label: "W" + wk, values: {} };
    for (const e of s.exercises || []) {
      const setsDone = (e.sets || []).filter((x) => x.weight || x.reps).length;
      const grp = (e.muscles || []).map((m) => groupMap[m] || "core");
      for (const g of new Set(grp)) wkBuckets[wk].values[g] = (wkBuckets[wk].values[g] || 0) + setsDone;
    }
  }
  const weeks = Object.keys(wkBuckets).sort((a, b) => a - b).map((k) => wkBuckets[k]);
  const colors = ["#185FA5", "#3B6D11", "#854F0B", "#3C3489", "#A32D2D", "#888780"];

  // running: easy-run avg HR trend (the week-6 same-route check) + pace trend
  const easy = runs.filter((r) => r.key === "easy" && r.avgHr).map((r) => ({
    y: parseFloat(r.avgHr), label: new Date(r.date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  }));
  const paceSeries = runs.filter((r) => parseFloat(r.dist) > 0 && parseDur(r.dur) > 0).map((r) => ({
    y: parseDur(r.dur) / parseFloat(r.dist), label: new Date(r.date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  }));

  return `<header class="topbar"><h1>Progress</h1></header>

    <section class="card">
      <h2 class="cardh">Estimated 1RM</h2>
      ${exNames.length ? `<select id="exPick" class="select">${exNames.map((n) => `<option ${n === pick ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
        ${lineChart(oneRM, { color: "#185FA5", height: 150 })}
        <p class="muted small">Epley estimate from your best set each session. Up and to the right = progressive overload working.</p>`
      : `<p class="muted">Log a gym session to see strength trends.</p>`}
    </section>

    <section class="card">
      <h2 class="cardh">Weekly volume by muscle group</h2>
      ${stackedBars(weeks, muscleKeys, colors, { height: 170 })}
      <div class="legendrow">${muscleKeys.map((k, i) => `<span><i style="background:${colors[i]}"></i>${k}</span>`).join("")}</div>
      <p class="muted small">Working sets per muscle per week. Watch for balance and steady volume.</p>
    </section>

    <section class="card">
      <h2 class="cardh">Easy-run avg HR <span class="tag">aerobic base</span></h2>
      ${lineChart(easy, { color: "#3B6D11", height: 140, ymin: PROFILE.zone2.low - 6, ymax: PROFILE.zone2.high + 8 })}
      <p class="muted small">Same effort, dropping HR = base building. Target: 3–5 bpm lower on your Week-6 Queen's Park re-run.</p>
    </section>

    <section class="card">
      <h2 class="cardh">Pace trend (all runs)</h2>
      ${lineChart(paceSeries.map((p) => ({ ...p, y: p.y / 60 })), { color: "#854F0B", height: 140 })}
      <p class="muted small">Minutes per km. Lower is faster.</p>
    </section>`;
}
function wireProgress() {
  const sel = $("#exPick");
  if (sel) sel.addEventListener("change", () => { state.exPick = sel.value; render(); });
}

// ---------- EXPORT ----------
async function renderExport() {
  const all = await DB.allSessions();
  return `<header class="topbar"><h1>Export</h1></header>
    <div class="card">
      <h2 class="cardh">Feed your data to Claude</h2>
      <p class="muted">Generates a clean summary of every session. Copy it into a Claude chat and ask for progression analysis or plan tweaks. Your data never leaves this device until you paste it.</p>
      <div class="actions col">
        <button class="btn primary" id="copyMd">Copy summary for Claude</button>
        <button class="btn ghost" id="dlJson">Download backup (.json)</button>
        <label class="btn ghost filebtn">Restore from backup<input type="file" id="restore" accept="application/json" hidden></label>
      </div>
      <p class="muted small">${all.length} sessions stored · ${all.filter((s) => s.type === "gym").length} gym · ${all.filter((s) => s.type === "run").length} runs</p>
    </div>
    <div class="card">
      <h2 class="cardh">Preview</h2>
      <pre class="preview" id="mdPreview">${esc(await buildMarkdown(all))}</pre>
    </div>`;
}

async function buildMarkdown(all) {
  if (!all.length) return "No sessions logged yet.";
  let md = `# Training log export\nProfile: ${PROFILE.name}, ${PROFILE.weightKg}kg · Goal: ${PROFILE.goal}\nZone 2: ${PROFILE.zone2.low}–${PROFILE.zone2.high} bpm\n\n`;
  for (const s of all) {
    md += `## ${s.date} — ${s.label}\n`;
    if (s.type === "run") {
      const dist = parseFloat(s.dist), sec = parseDur(s.dur);
      md += `- ${s.dist}km in ${s.dur} (${dist && sec ? fmtPace(sec / dist) : "—"}), avg HR ${s.avgHr || "—"}, max ${s.maxHr || "—"}, cadence ${s.cadence || "—"}\n`;
      const z = zoneOf(parseFloat(s.avgHr)); if (z) md += `- Zone: ${z.label}\n`;
      if (s.note) md += `- Note: ${s.note}\n`;
    } else {
      for (const e of s.exercises || []) {
        const sets = (e.sets || []).filter((x) => x.weight || x.reps).map((x) => `${x.weight || "?"}×${x.reps || "?"}`).join(", ");
        const e1 = Math.max(0, ...(e.sets || []).map((x) => epley(parseFloat(x.weight), parseFloat(x.reps))));
        md += `- ${e.name}: ${sets || "—"}${e1 ? ` (est 1RM ${e1.toFixed(1)}kg)` : ""}${e.note ? ` — ${e.note}` : ""}\n`;
      }
      if (s.note) md += `- Session note: ${s.note}\n`;
    }
    md += `\n`;
  }
  md += `---\nPlease analyse my progression vs a sub-50 10k + hypertrophy goal. Flag stalls, imbalances, and one change for next week.\n`;
  return md;
}

function wireExport() {
  $("#copyMd")?.addEventListener("click", async () => {
    const md = await buildMarkdown(await DB.allSessions());
    try { await navigator.clipboard.writeText(md); flash("Copied — paste into Claude ✓"); }
    catch { fallbackCopy(md); }
  });
  $("#dlJson")?.addEventListener("click", async () => {
    const data = JSON.stringify({ profile: PROFILE, sessions: await DB.allSessions(), exported: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `training-backup-${todayISO()}.json`; a.click();
    flash("Backup downloaded ✓");
  });
  $("#restore")?.addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!confirm("Restore will replace all current sessions. Continue?")) return;
    const txt = await file.text();
    try { const obj = JSON.parse(txt); await DB.replaceAll(obj.sessions || []); flash("Restored ✓"); render(); }
    catch { flash("Couldn't read that file"); }
  });
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
  ta.select(); document.execCommand("copy"); ta.remove(); flash("Copied ✓");
}

// ---------- misc ----------
function emptyState(emoji, title, sub) {
  return `<div class="empty"><div class="emoji">${emoji}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>`;
}
let flashTimer;
function flash(msg) {
  let el = $("#flash"); if (!el) { el = document.createElement("div"); el.id = "flash"; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("show");
  clearTimeout(flashTimer); flashTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// service worker
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

render();
