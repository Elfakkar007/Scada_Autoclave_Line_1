/**
 * fase1/tests/matrix.mjs — uji matriks role × endpoint (13.3 + endpoint PLC).
 *
 * Cara kerja: login sebagai tiap akun uji, baca izin ASLI akun itu dari /api/auth/me,
 * hitung "seharusnya boleh/ditolak" untuk tiap endpoint memakai tabel penegakan (handover 11.3),
 * lalu bandingkan dengan status HTTP sebenarnya. Hanya yang MENYIMPANG yang dicetak.
 *
 *   boleh    -> status BUKAN 401/403 dan BUKAN 5xx (404/400/409 untuk id/body palsu itu wajar).
 *               Bila entri punya `expect`, status HARUS persis itu (probe berhenti di validasi).
 *   ditolak  -> status HARUS 403
 *
 * KEAMANAN (prinsip: tes tidak boleh menggerakkan mesin):
 *  - Hanya jalan ke localhost dan hanya bila CONFIRM_DEV=yes. Jalankan HANYA di server dev + DB dev.
 *  - Tulis dicoba dengan body kosong/palsu atau id/username yang tidak ada, jadi data tidak berubah.
 *    Efek samping yang wajar: baris audit login dan baris audit export_*.
 *  - Endpoint PLC memakai PROBE: body yang sengaja salah supaya ditolak 400 oleh validasi SESUDAH guard
 *    izin dan SEBELUM menulis apa pun ke PLC/DB:
 *      plc-door   POST {action:"chain", mode:"bogus"}      -> 400 bila izin lolos, 403 bila tidak
 *      plc-manual POST {action:"bogus"}                     -> 400 / 403
 *      plc-clock  PUT  tanggal mustahil + alasan 1 huruf    -> 400 / 403
 *      plc-params PUT  {group, changes:{}}                  -> 400 / 403
 *      batch/start POST {}                                  -> 400 / 403 (field batchNo kosong, sebelum DB/PLC)
 *  - batch/stop dan plc/reset TIDAK punya validasi body: pemegang izin yang memanggilnya benar-benar
 *    mengeksekusi STOP/reset. Maka akun yang BERHAK tidak pernah dipanggil. Sisi-TOLAK (akun tanpa izin
 *    dan tanpa sesi harus 403/401) hanya dijalankan bila PROBE_MACHINE_DENY=yes, karena bila guard
 *    ternyata bocor, panggilan itu ikut mengeksekusi aksi mesin. Default: dilewati.
 *
 * Pemakaian (Git Bash, server dev sudah jalan; variabel ditulis SEBELUM "node"):
 *   ACC_OPERATOR="wsa:PASSWORD" ACC_QA="KKV:PASSWORD" ACC_ADMIN="Hammam:PASSWORD" \
 *   ACC_DASH="uji_dash:PASSWORD" CONFIRM_DEV=yes node fase1/tests/matrix.mjs
 *
 * Opsional: BASE_URL (default http://localhost:3001), VERBOSE=1 (cetak semua baris),
 *           ACC_MAINTAINER (sama seperti ACC_* lain),
 *           PROBE_MACHINE_DENY=yes (uji sisi-tolak batch/stop dan plc/reset; lihat KEAMANAN).
 *
 * Belum tercakup: POST /api/auth/unlock (probe aman belum diverifikasi: tanpa password bisa dihitung
 * sebagai percobaan gagal), field "restricted" plc-params (Safety/Alarm/Select Press →
 * action.write_safety_params; butuh rentang nilai valid dari plcParamCatalog.js).
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const VERBOSE = process.env.VERBOSE === "1";
const PROBE_MACHINE = process.env.PROBE_MACHINE_DENY === "yes";

// ── Pengaman ────────────────────────────────────────────────────────────────
// BASE_URL dan ACC_* adalah variabel lingkungan: harus ditulis SEBELUM "node", bukan sesudah nama skrip.
if (process.argv.length > 2) {
    console.error(`Argumen tak dikenal: ${process.argv.slice(2).join(" ")}\nTulis BASE_URL=... dan ACC_*=... SEBELUM "node", bukan sesudah nama skrip.`);
    process.exit(2);
}
const host = new URL(BASE).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) || process.env.CONFIRM_DEV !== "yes") {
    console.error("Ditolak: skrip hanya jalan ke localhost dan butuh CONFIRM_DEV=yes (server dev + DB dev saja).");
    process.exit(2);
}

// ── Akun uji dari environment ───────────────────────────────────────────────
const ACCOUNT_VARS = [
    ["OPERATOR", "ACC_OPERATOR"],
    ["MAINTAINER", "ACC_MAINTAINER"],
    ["QA", "ACC_QA"],
    ["ADMIN", "ACC_ADMIN"],
    ["DASH", "ACC_DASH"],
];
const accounts = [];
for (const [label, envName] of ACCOUNT_VARS) {
    const raw = process.env[envName];
    if (!raw) continue;
    const i = raw.indexOf(":");
    if (i < 1) { console.error(`${envName} harus berbentuk username:password`); process.exit(2); }
    accounts.push({ label, username: raw.slice(0, i), password: raw.slice(i + 1) });
}
if (accounts.length === 0) { console.error("Tidak ada akun uji. Isi minimal satu ACC_*."); process.exit(2); }

// ── Pastikan targetnya memang aplikasi SCADA ini ────────────────────────────
// GET /api/auth/users publik (dropdown login) dan harus 200 + JSON. Aplikasi lain di port itu
// biasanya menjawab 401/404, dan tanpa pemeriksaan ini hasil "tanpa sesi" bisa lolos palsu.
try {
    const r = await fetch(BASE + "/api/auth/users", { redirect: "manual" });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    await r.json();
} catch (e) {
    console.error(`Server di ${BASE} tampaknya bukan aplikasi SCADA ini (GET /api/auth/users harus 200 + JSON): ${e.message}\nPeriksa port server dev.`);
    process.exit(2);
}
console.log(`Target: ${BASE}`);
console.log(PROBE_MACHINE
    ? "PROBE_MACHINE_DENY=yes: batch/stop dan plc/reset diuji HANYA dari sisi-tolak."
    : "batch/stop dan plc/reset dilewati (aksi mesin). Set PROBE_MACHINE_DENY=yes untuk uji sisi-tolak.");

// ── Izin ────────────────────────────────────────────────────────────────────
const LV = { none: 0, view: 1, edit: 2 };
const lvl = (p, res) => LV[p?.[res] ?? "none"] ?? 0;
const ge = (res, min) => (p) => lvl(p, res) >= LV[min];
const or = (...fs) => (p) => fs.some((f) => f(p));
const and = (...fs) => (p) => fs.every((f) => f(p));
const AUTH = () => true; // cukup login

function normPerms(x) {
    if (!x || typeof x !== "object") return null;
    if (Array.isArray(x)) {
        const o = {};
        for (const e of x) if (e?.resource) o[e.resource] = e.level;
        return o;
    }
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = typeof v === "string" ? v : (v?.level ?? "none");
    return o;
}

// ── Tabel endpoint: [metode, path, aturan "boleh", opsi?]  (sumber: handover 11.3 + kode route) ─
// opsi: { body, expect, note, machine }
//   body    : isi JSON untuk POST/PUT (default {})
//   expect  : status persis yang diharapkan bila izin lolos (probe yang berhenti di validasi)
//   note    : keterangan tambahan di cetakan (mis. grup plc-params)
//   machine : endpoint aksi mesin TANPA validasi body; hanya sisi-tolak, hanya bila PROBE_MACHINE_DENY=yes
// id/username palsu dipilih supaya yang lolos guard mendapat 404/400, bukan mengubah data.
const NOID = "2147483647";
const NOSTR = "ZZ-TIDAK-ADA";

// Guard ganda START/STOP/Reset: dashboard >= edit DAN action.batch_control = edit.
const BATCH_CTRL = and(ge("dashboard", "edit"), ge("action.batch_control", "edit"));
// Door Operate (semua aksi): manual_control = edit ATAU (dashboard = edit DAN action.batch_control = edit).
const DOOR_POST = or(ge("manual_control", "edit"), BATCH_CTRL);
// Jam PLC mustahil + alasan 1 huruf: ditolak 400 oleh validasi, tidak pernah sampai ke PLC.
const CLOCK_BAD = { year: 1900, month: 13, day: 32, hour: 25, minute: 61, second: 61, reason: "x" };

const E = [
    // baca
    ["GET", "/api/status", or(ge("dashboard", "view"), ge("trend", "view"))],
    ["GET", "/api/batch-records", or(ge("data_report", "view"), ge("trend", "view"))],
    ["GET", `/api/batch-records/${NOSTR}`, or(ge("data_report", "view"), ge("trend", "view"))],
    ["GET", "/api/batch-records/export?format=json&from=2000-01-01&to=2000-01-02", ge("data_report", "view")],
    ["GET", "/api/alarms", ge("alarm", "view")],
    ["GET", "/api/alarms/event-types", ge("alarm", "view")],
    ["GET", "/api/alarms/print-data?from=2000-01-01&to=2000-01-02", ge("alarm", "view")],
    ["GET", `/api/alarms/by-batch/${NOSTR}`, ge("data_report", "view")],
    ["GET", "/api/alarms/active", AUTH],
    ["GET", "/api/formulas", or(ge("formula", "view"), ge("dashboard", "view"))],
    ["GET", `/api/formulas/${NOSTR}`, ge("formula", "view")],
    ["GET", "/api/products", or(ge("products", "view"), ge("dashboard", "view"))],
    ["GET", "/api/product-specs", or(ge("products", "view"), ge("dashboard", "view"))],
    ["GET", `/api/products/${NOID}`, ge("products", "view")],
    ["GET", `/api/product-specs/${NOID}`, ge("products", "view")],
    ["GET", "/api/audit-log", ge("audit_log", "view")],
    ["GET", "/api/audit-log/filters", ge("audit_log", "view")],
    ["GET", "/api/audit-log/export?format=json&from=2000-01-01&to=2000-01-02", ge("audit_log", "view")],
    ["GET", "/api/users", ge("users", "view")],
    ["GET", "/api/roles", ge("roles", "view")],
    ["GET", "/api/roles/options", or(ge("users", "view"), ge("roles", "view"))],
    ["GET", `/api/roles/${NOID}`, ge("roles", "view")],
    // tulis (body {} atau id palsu)
    ["POST", "/api/formulas", ge("formula", "edit")],
    ["PUT", `/api/formulas/${NOSTR}`, ge("formula", "edit")],
    ["DELETE", `/api/formulas/${NOSTR}`, ge("formula", "edit")],
    ["POST", "/api/products", ge("products", "edit")],
    ["PUT", `/api/products/${NOID}`, ge("products", "edit")],
    ["DELETE", `/api/products/${NOID}`, ge("products", "edit")],
    ["POST", "/api/product-specs", ge("products", "edit")],
    ["PUT", `/api/product-specs/${NOID}`, ge("products", "edit")],
    ["DELETE", `/api/product-specs/${NOID}`, ge("products", "edit")],
    ["POST", "/api/users", ge("users", "edit")],
    ["PUT", `/api/users/zz_tidak_ada`, ge("users", "edit")],
    ["POST", `/api/users/zz_tidak_ada/reset-password`, ge("users", "edit")],
    ["POST", `/api/users/zz_tidak_ada/delete`, ge("users", "edit")],
    ["POST", "/api/roles", ge("roles", "edit")],
    ["PUT", `/api/roles/${NOID}`, ge("roles", "edit")],
    ["DELETE", `/api/roles/${NOID}`, ge("roles", "edit")],

    // ── Endpoint PLC (gelombang HMI + Door Operate). Probe aman: lihat KEAMANAN di atas. ──
    ["GET", "/api/auth/me", AUTH],
    ["GET", "/api/plc-door", ge("manual_control", "view")],
    ["POST", "/api/plc-door", DOOR_POST, { body: { action: "chain", mode: "bogus" }, expect: 400 }],
    ["GET", "/api/plc-manual", ge("manual_control", "view")],
    ["POST", "/api/plc-manual", ge("manual_control", "edit"), { body: { action: "bogus" }, expect: 400 }],
    ["GET", "/api/plc-clock", ge("plc_clock", "view")],
    ["PUT", "/api/plc-clock", ge("plc_clock", "edit"), { body: CLOCK_BAD, expect: 400 }],
    // plc-params memeriksa "group" SEBELUM guard: group tak dikenal = 400 untuk semua orang. Pakai group valid.
    ["GET", "/api/plc-params?group=param1", ge("machine_params", "view")],
    ["GET", "/api/plc-params?group=calibration", ge("calibration", "view")],
    ["PUT", "/api/plc-params", ge("machine_params", "edit"),
        { body: { group: "param1", changes: {} }, expect: 400, note: "group=param1" }],
    ["PUT", "/api/plc-params", and(ge("calibration", "edit"), ge("action.write_calibration", "edit")),
        { body: { group: "calibration", changes: {} }, expect: 400, note: "group=calibration" }],
    // START: body {} berhenti di "Field batchNo tidak boleh kosong" (400) sebelum menyentuh DB/PLC.
    ["POST", "/api/batch/start", BATCH_CTRL, { body: {}, expect: 400 }],
    // STOP dan Reset: tanpa validasi body → hanya sisi-tolak, hanya bila PROBE_MACHINE_DENY=yes.
    ["POST", "/api/batch/stop", BATCH_CTRL, { machine: true }],
    ["POST", "/api/plc/reset", BATCH_CTRL, { machine: true }],
];

// Kunci izin yang dipakai aturan di atas. Bila /api/auth/me tidak memuatnya, dianggap "none"
// (dan penyimpangan yang muncul bisa palsu): akun diberi peringatan.
const NEEDED_KEYS = ["manual_control", "machine_params", "calibration", "plc_clock",
    "action.batch_control", "action.write_calibration"];

// ── HTTP ────────────────────────────────────────────────────────────────────
async function call(cookie, m, path, o = {}) {
    const init = { method: m, headers: {}, redirect: "manual" };
    if (cookie) init.headers.cookie = cookie;
    if (m === "POST" || m === "PUT") {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(o.body ?? {});
    }
    const r = await fetch(BASE + path, init);
    await r.text().catch(() => "");
    return r.status;
}

async function login(a) {
    const r = await fetch(BASE + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: a.username, password: a.password }),
        redirect: "manual",
    });
    const body = await r.text();
    const set = r.headers.getSetCookie?.() ?? [];
    const cookie = set
        .map((c) => c.split(";")[0])
        .filter((c) => !/=\s*$/.test(c))
        .join("; ");
    if (!r.ok || !cookie) {
        throw new Error(`login ${a.username} gagal: HTTP ${r.status} ${body.slice(0, 160)}`);
    }
    return cookie;
}

async function readPerms(cookie) {
    const r = await fetch(BASE + "/api/auth/me", { headers: { cookie }, redirect: "manual" });
    const j = await r.json().catch(() => null);
    const u = j?.user ?? j;
    const perms = normPerms(u?.permissions);
    if (!perms) throw new Error(`/api/auth/me tanpa permissions. Kunci respons: ${j ? Object.keys(u ?? j).join(",") : "(bukan JSON)"}`);
    return { perms, roleName: u.roleName ?? u.role ?? "?" };
}

// ── Penilaian ───────────────────────────────────────────────────────────────
function judge(status, allowed, expect) {
    if (allowed) {
        if (status === 401 || status === 403) return "DITOLAK padahal seharusnya BOLEH";
        if (status >= 500) return "5xx pada jalur yang seharusnya lolos (cek log server)";
        if (expect !== undefined && status !== expect) {
            return `izin lolos tetapi status bukan ${expect}: probe tidak berhenti di validasi (cek log server dan efek ke PLC)`;
        }
        return null;
    }
    if (status === 403) return null;
    if (status === 401) return "401 (seharusnya 403)";
    return "BOCOR: seharusnya DITOLAK";
}

const label = (path, o) => (o.note ? `${path} [${o.note}]` : path);

// ── Jalankan ────────────────────────────────────────────────────────────────
let bad = 0, total = 0, skippedAll = 0;
const KEY_RES = ["dashboard", "trend", "data_report", "alarm", "formula", "products", "audit_log", "users", "roles",
    "calibration", "machine_params", "plc_clock", "manual_control",
    "action.batch_control", "action.write_calibration", "action.write_safety_params"];

for (const a of accounts) {
    let cookie, info;
    try {
        cookie = await login(a);
        info = await readPerms(cookie);
    } catch (e) {
        console.error(`\n[${a.label}] ${e.message}`);
        bad++;
        continue;
    }
    const p = info.perms;
    console.log(`\n=== ${a.label}  (${a.username}, role ${info.roleName})`);
    console.log("izin: " + KEY_RES.map((r) => `${r}=${p[r] ?? "none"}`).join("  "));
    const missing = NEEDED_KEYS.filter((k) => !(k in p));
    if (missing.length) console.log(`PERINGATAN: /api/auth/me tidak memuat ${missing.join(", ")} (dianggap none; penyimpangan terkait bisa palsu)`);
    let n = 0, allowedN = 0, deniedN = 0, mism = 0, skipped = 0;
    for (const [m, path, rule, o = {}] of E) {
        const allowed = rule(p);
        // Aksi mesin tanpa validasi body: akun berhak TIDAK PERNAH dipanggil; sisi-tolak hanya dengan PROBE_MACHINE_DENY=yes.
        if (o.machine && (allowed || !PROBE_MACHINE)) {
            skipped++;
            if (VERBOSE) console.log(`   ${m.padEnd(6)} ${label(path, o).padEnd(64)} -> dilewati (aksi mesin)`);
            continue;
        }
        const status = await call(cookie, m, path, o);
        const problem = judge(status, allowed, o.expect);
        n++; total++;
        allowed ? allowedN++ : deniedN++;
        if (problem) { mism++; bad++; }
        if (problem || VERBOSE) {
            console.log(`${problem ? "!! " : "   "}${m.padEnd(6)} ${label(path, o).padEnd(64)} -> ${status}  (seharusnya ${allowed ? (o.expect !== undefined ? `lolos guard, ${o.expect}` : "boleh") : "ditolak"})${problem ? "  " + problem : ""}`);
        }
    }
    skippedAll += skipped;
    console.log(`ringkas: ${n} uji (${allowedN} seharusnya boleh, ${deniedN} seharusnya ditolak), ${mism} menyimpang${skipped ? `, ${skipped} dilewati (aksi mesin)` : ""}`);
}

// Tanpa sesi: semuanya harus 401/403 atau dialihkan (3xx). auth/login|logout|users sengaja publik.
// Aksi mesin (batch/stop, plc/reset) ikut hanya bila PROBE_MACHINE_DENY=yes.
console.log("\n=== TANPA SESI (tanpa cookie)");
let u = 0, ub = 0, us = 0;
for (const [m, path, , o = {}] of E) {
    if (o.machine && !PROBE_MACHINE) { us++; continue; }
    const status = await call(null, m, path, o);
    const ok = status === 401 || status === 403 || (status >= 300 && status < 400);
    u++; total++;
    if (!ok) { ub++; bad++; }
    if (!ok || VERBOSE) console.log(`${ok ? "   " : "!! "}${m.padEnd(6)} ${label(path, o).padEnd(64)} -> ${status}${ok ? "" : "  BOCOR: seharusnya 401/403/alihan"}`);
}
console.log(`ringkas: ${u} uji, ${ub} menyimpang${us ? `, ${us} dilewati (aksi mesin)` : ""}`);

console.log(`\nTOTAL: ${total} uji, ${bad} menyimpang`);
if (!PROBE_MACHINE) console.log("Catatan: batch/stop dan plc/reset belum diuji di sini; tetap diuji manual di mesin (lihat handover bagian 6.3).");
process.exit(bad === 0 ? 0 : 1);
