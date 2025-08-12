import React, { useEffect, useMemo, useState } from "react";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Search, Download, Upload, CheckCircle2, AlertTriangle, Clock,
  Home, UserPlus, List, SlidersHorizontal, ArrowUpDown, Phone, Send, Link as LinkIcon, Bug
} from "lucide-react";
import {
  BrowserRouter as Router, Routes, Route, Navigate, Outlet,
  useLocation, useNavigate
} from "react-router-dom";

/* ====================== Error Boundary (enhanced) ====================== */
class PageBoundary extends React.Component {
  constructor(p){ super(p); this.state = { hasError: false, err: null }; }
  static getDerivedStateFromError(err){ return { hasError: true, err }; }
  componentDidCatch(err, info){ console.error("Page error:", err, info); window.__lastPageError = {err, info}; }
  render(){
    if (this.state.hasError) {
      const message = this.state.err?.message || String(this.state.err || "Unknown error");
      const stack = (this.state.err && this.state.err.stack) ? String(this.state.err.stack).split("\n").slice(0,3).join("\n") : "";
      return <div className="p-6 border rounded-xl bg-rose-50 text-rose-700 text-sm space-y-2">
        <div className="font-semibold">Terjadi error saat menampilkan halaman.</div>
        <div><b>Pesan:</b> <code>{message}</code></div>
        {stack && <pre className="text-xs whitespace-pre-wrap bg-white/60 p-3 rounded border">{stack}</pre>}
        <div className="text-slate-600">Detail lengkap ada di Console (window.__lastPageError).</div>
      </div>;
    }
    return this.props.children;
  }
}

/* ====================== Safe Date Helpers ====================== */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const todayYMD = () => new Date().toISOString().slice(0, 10);
const toDate = (v) => parseDate(v);
const addYears = (date, years) => {
  const d = parseDate(date);
  if (!d) return null;
  const c = new Date(d);
  c.setFullYear(c.getFullYear() + years);
  return c;
};
const ymd = (d) => {
  const dt = parseDate(d);
  return dt ? dt.toISOString().slice(0, 10) : "";
};
const human = (d) => {
  const dt = parseDate(d);
  return dt
    ? dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : "-";
};
const daysUntil = (d) => {
  const dt = parseDate(d);
  if (!dt) return null;
  return Math.ceil((dt - new Date()) / MS_PER_DAY);
};
const withinNextDays = (d, days) => {
  const n = daysUntil(d);
  return typeof n === "number" && n >= 0 && n <= days;
};

/* ====================== Self tests ====================== */
function runSelfTests() {
  try {
    const base = new Date("2020-03-15");
    console.assert(ymd(addYears(base, 2)) === "2022-03-15");
    console.assert(ymd(addYears(base, 4)) === "2024-03-15");
    console.assert(human("bukan tanggal") === "-");
    console.assert(daysUntil("bukan tanggal") === null);
  } catch {}
}

const AppCtx = React.createContext(null);
const useApp = () => React.useContext(AppCtx);

/* ====================== Dexie ====================== */
const db = new Dexie("asnMonitoringDB");
db.version(1).stores({
  asns: "++id, nama, nip, tmtPns, riwayatTmtKgb, riwayatTmtPangkat, jadwalKgbBerikutnya, jadwalPangkatBerikutnya",
});
db.version(2).stores({
  asns: "++id, nama, nip, telp, telegramChatId, tmtPns, riwayatTmtKgb, riwayatTmtPangkat, jadwalKgbBerikutnya, jadwalPangkatBerikutnya",
});

export default function App() {
  useEffect(() => runSelfTests(), []);
  const asns = useLiveQuery(() => db.table("asns").toArray(), [], []);

  const notif = useMemo(() => {
    try {
      if (!asns) return { soon: [], overdue: [] };
      const soon = []; const overdue = []; const in90 = (d) => withinNextDays(d, 90);
      (Array.isArray(asns) ? asns : []).forEach((row) => {
        const items = [];
        if (row.jadwalKgbBerikutnya) items.push({ jenis: "Kenaikan Gaji Berikutnya", tanggal: row.jadwalKgbBerikutnya });
        if (row.jadwalPangkatBerikutnya) items.push({ jenis: "Kenaikan Pangkat Berikutnya", tanggal: row.jadwalPangkatBerikutnya });
        items.forEach((it) => {
          const dt = parseDate(it.tanggal);
          if (!dt) return;
          if (in90(dt)) soon.push({ ...row, ...it });
          else if (dt < new Date()) overdue.push({ ...row, ...it });
        });
      });
      const byDate = (a, b) => (parseDate(a.tanggal)?.getTime() ?? 0) - (parseDate(b.tanggal)?.getTime() ?? 0);
      return { soon: soon.sort(byDate), overdue: overdue.sort(byDate) };
    } catch (e) {
      console.error("notif calc error", e);
      return { soon: [], overdue: [] };
    }
  }, [asns]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Shell><AppCtx.Provider value={{ asns: asns || [], notif }}><Outlet /></AppCtx.Provider></Shell>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PanelDashboard />} />
          <Route path="notifikasi" element={<PanelNotifikasi />} />
          <Route path="input" element={<FormInput />} />
          <Route path="data" element={<PageBoundary><TabelData /></PageBoundary>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function Shell({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/75 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-content-center font-bold">A</div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-tight">Monitoring Kenaikan Gaji & Pangkat Berikutnya (ASN)</h1>
            <p className="text-xs text-slate-500 -mt-0.5">Pantau otomatis & kirim pengingat via Telegram.</p>
          </div>
          <NavButton icon={<Bell className="w-4 h-4" />} active={pathname.startsWith("/notifikasi")} onClick={() => navigate("/notifikasi")}>Notifikasi</NavButton>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <TopLink active={pathname.startsWith("/dashboard")} onClick={() => navigate("/dashboard")} icon={<Home className="w-4 h-4" />} label="Dashboard" />
            <TopLink active={pathname.startsWith("/notifikasi")} onClick={() => navigate("/notifikasi")} icon={<Bell className="w-4 h-4" />} label="Notifikasi" />
            <TopLink active={pathname.startsWith("/input")} onClick={() => navigate("/input")} icon={<UserPlus className="w-4 h-4" />} label="Input Data Pegawai" />
            <TopLink active={pathname.startsWith("/data")} onClick={() => navigate("/data")} icon={<List className="w-4 h-4" />} label="Tampilkan Data Pegawai" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ====================== Form Input ====================== */
function FormInput() {
  const [form, setForm] = useState({
    nama: "", nip: "", telp: "", telegramChatId: "",
    tmtPns: "", riwayatTmtKgb: "", riwayatTmtPangkat: "",
    jadwalKgbBerikutnya: "", jadwalPangkatBerikutnya: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const kgb = form.riwayatTmtKgb ? ymd(addYears(toDate(form.riwayatTmtKgb), 2)) : "";
    const pangkat = form.riwayatTmtPangkat ? ymd(addYears(toDate(form.riwayatTmtPangkat), 4)) : "";
    setForm((f) => ({ ...f, jadwalKgbBerikutnya: kgb, jadwalPangkatBerikutnya: pangkat }));
  }, [form.riwayatTmtKgb, form.riwayatTmtPangkat]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const doSave = async () => {
    await db.table("asns").add({ ...form, createdAt: new Date().toISOString() });
    setForm({ nama: "", nip: "", telp: "", telegramChatId: "", tmtPns: "", riwayatTmtKgb: "", riwayatTmtPangkat: "", jadwalKgbBerikutnya: "", jadwalPangkatBerikutnya: "" });
    setConfirmOpen(false);
    alert("Data ASN disimpan.");
  };

  const submit = (e) => { e.preventDefault(); if (!form.nama || !form.nip) return alert("Nama & NIP wajib diisi"); setConfirmOpen(true); };

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card title="Input Data Pegawai" subtitle="Lengkapi data; jadwal otomatis dihitung.">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label="Nama" required><input name="nama" value={form.nama} onChange={onChange} className="w-full border rounded-lg px-3 py-2" /></FormRow>
          <FormRow label="Nomor Pegawai (NIP)" required><input name="nip" value={form.nip} onChange={onChange} className="w-full border rounded-lg px-3 py-2" /></FormRow>
          <FormRow label="Nomor HP"><input name="telp" value={form.telp} onChange={onChange} className="w-full border rounded-lg px-3 py-2" placeholder="08xxxxxxxxxx" /></FormRow>
          <FormRow label="Telegram Chat ID (opsional)"><input name="telegramChatId" value={form.telegramChatId} onChange={onChange} className="w-full border rounded-lg px-3 py-2" placeholder="(otomatis saat registrasi)" /></FormRow>
          <FormRow label="TMT PNS"><input type="date" name="tmtPns" value={form.tmtPns} onChange={onChange} className="w-full border rounded-lg px-3 py-2" max={todayYMD()} /></FormRow>
          <FormRow label="Riwayat TMT Kenaikan Gaji"><input type="date" name="riwayatTmtKgb" value={form.riwayatTmtKgb} onChange={onChange} className="w-full border rounded-lg px-3 py-2" /></FormRow>
          <FormRow label="Riwayat TMT Pangkat"><input type="date" name="riwayatTmtPangkat" value={form.riwayatTmtPangkat} onChange={onChange} className="w-full border rounded-lg px-3 py-2" /></FormRow>
          <FormRow label="Jadwal Kenaikan Gaji Berikutnya (+2 thn)"><input type="date" name="jadwalKgbBerikutnya" value={form.jadwalKgbBerikutnya} readOnly className="w-full border rounded-lg px-3 py-2 bg-slate-50" /></FormRow>
          <FormRow label="Jadwal Kenaikan Pangkat Berikutnya (+4 thn)"><input type="date" name="jadwalPangkatBerikutnya" value={form.jadwalPangkatBerikutnya} readOnly className="w-full border rounded-lg px-3 py-2 bg-slate-50" /></FormRow>
          <div className="md:col-span-2 flex gap-3 mt-2">
            <button className="bg-indigo-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-indigo-700">Simpan</button>
            <button type="button" onClick={() => setForm({ nama: "", nip: "", telp: "", telegramChatId: "", tmtPns: "", riwayatTmtKgb: "", riwayatTmtPangkat: "", jadwalKgbBerikutnya: "", jadwalPangkatBerikutnya: "" })} className="border rounded-lg px-4 py-2 hover:bg-slate-50">Reset</button>
          </div>
        </form>
      </Card>

      <ConfirmDialog open={confirmOpen} title="Verifikasi Data Pegawai" onCancel={() => setConfirmOpen(false)} onConfirm={doSave}>
        <ul className="text-sm text-slate-700 space-y-1">
          <li><b>Nama:</b> {form.nama || '-'}</li>
          <li><b>NIP:</b> {form.nip || '-'}</li>
          <li><b>Nomor HP:</b> {form.telp || '-'}</li>
          <li><b>Telegram Chat ID:</b> {form.telegramChatId || '-'}</li>
          <li><b>TMT PNS:</b> {human(form.tmtPns)}</li>
          <li><b>Riwayat TMT Kenaikan Gaji:</b> {human(form.riwayatTmtKgb)}</li>
          <li><b>Jadwal Kenaikan Gaji Berikutnya:</b> {human(form.jadwalKgbBerikutnya)}</li>
          <li><b>Riwayat TMT Pangkat:</b> {human(form.riwayatTmtPangkat)}</li>
          <li><b>Jadwal Kenaikan Pangkat Berikutnya:</b> {human(form.jadwalPangkatBerikutnya)}</li>
        </ul>
      </ConfirmDialog>
    </div>
  );
}

/* ====================== Tabel Data (extra guards) ====================== */
function TabelData() {
  const asns = useLiveQuery(() => db.table("asns").toArray(), [], []);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [compact, setCompact] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    try {
      const src = Array.isArray(asns) ? asns : [];
      const term = q.trim().toLowerCase();
      const withMeta = src.map((r) => {
        const dueInKgb = daysUntil(r.jadwalKgbBerikutnya);
        const dueInPangkat = daysUntil(r.jadwalPangkatBerikutnya);
        const nearest = Math.min(dueInKgb ?? Infinity, dueInPangkat ?? Infinity);
        let status = "ok";
        if (!Number.isFinite(nearest)) status = "ok";
        else if (nearest < 0) status = "overdue";
        else if (nearest <= 90) status = "soon";
        return { ...r, dueInKgb, dueInPangkat, nearest, status };
      });
      let list = withMeta;
      if (term) list = list.filter((r) => (r.nama || "").toLowerCase().includes(term) || (r.nip || "").toLowerCase().includes(term) || (r.telp || "").toLowerCase().includes(term));
      if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
      list.sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id", { sensitivity: "base" }));
      if (!sortAsc) list.reverse();
      return list;
    } catch (e) {
      console.error("table calc error", e);
      return [];
    }
  }, [asns, q, statusFilter, sortAsc]);

  return (
    <Card title="Tampilkan Data Pegawai" subtitle="Cari, filter, dan urutkan data pegawai." extra={
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama/NIP/HP..." className="border rounded-lg pl-9 pr-3 py-2 w-72 max-w-full" />
        </div>
        <SegmentedControl value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "Semua" },
          { value: "soon", label: "≤3 bln" },
          { value: "overdue", label: "Terlewat" },
          { value: "ok", label: "Aman" },
        ]} />
        <button onClick={() => setSortAsc((x) => !x)} className="inline-flex items-center gap-1 border rounded-lg px-2.5 py-2 hover:bg-slate-50">
          <ArrowUpDown className="w-4 h-4" /><span className="text-sm">Nama {sortAsc ? "A→Z" : "Z→A"}</span>
        </button>
        <button onClick={() => setCompact((x) => !x)} className="inline-flex items-center gap-2 border rounded-lg px-2.5 py-2 hover:bg-slate-50">
          <SlidersHorizontal className="w-4 h-4" /><span className="text-sm">{compact ? "Padat" : "Normal"}</span>
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <IconButton onClick={() => exportJSON(asns || [])} title="Export JSON"><Download className="w-4 h-4" /></IconButton>
          <IconButton onClick={() => importJSON()} title="Import JSON"><Upload className="w-4 h-4" /></IconButton>
        </div>
      </div>
    }>
      <div className={`overflow-auto rounded-xl border border-slate-200 ${compact ? "text-xs" : "text-sm"}`}>
        <table className="min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-white/95 backdrop-blur text-slate-600 border-b">
              <Th>Nama</Th><Th>NIP</Th><Th>No. HP</Th><Th>Telegram</Th><Th>TMT PNS</Th><Th>Riwayat TMT Kenaikan Gaji</Th><Th>Jadwal Kenaikan Gaji Berikutnya</Th><Th>Riwayat TMT Pangkat</Th><Th>Jadwal Kenaikan Pangkat Berikutnya</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={r.id ?? idx} className={`group transition ${idx % 2 ? "bg-white" : "bg-slate-50/40"} hover:bg-indigo-50/30`}>
                <Td>{r.nama}</Td>
                <Td>{r.nip}</Td>
                <Td>{r.telp || "-"}</Td>
                <Td>{r.telegramChatId ? <span className="text-emerald-700 font-medium">Terhubung</span> : <span className="text-slate-400">Belum</span>}</Td>
                <Td>{human(r.tmtPns)}</Td>
                <Td>{human(r.riwayatTmtKgb)}</Td>
                <Td>{human(r.jadwalKgbBerikutnya)}</Td>
                <Td>{human(r.riwayatTmtPangkat)}</Td>
                <Td>{human(r.jadwalPangkatBerikutnya)}</Td>
                <Td><div className="flex flex-wrap gap-2">
                  <StatusPill label="Kenaikan Gaji Berikutnya" target={r.jadwalKgbBerikutnya} />
                  <StatusPill label="Kenaikan Pangkat Berikutnya" target={r.jadwalPangkatBerikutnya} />
                </div></Td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="p-8 text-center text-slate-500" colSpan={10}>Belum ada data.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ====================== Dashboard & Notifikasi (unchanged logic) ====================== */
function PanelDashboard() {
  const { asns = [], notif = { soon: [], overdue: [] } } = useApp() || {};
  const total = asns.length;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Ringkasan" subtitle="Ikhtisar status pegawai & jadwal">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50"><div className="text-xs text-slate-500">Total Pegawai</div><div className="text-2xl font-semibold mt-1">{total}</div></div>
          <div className="rounded-xl border border-amber-200 p-4 bg-amber-50"><div className="text-xs text-amber-700">Segera (≤3 bln)</div><div className="text-2xl font-semibold mt-1">{(notif.soon||[]).length}</div></div>
          <div className="rounded-xl border border-rose-200 p-4 bg-rose-50"><div className="text-xs text-rose-700">Terlewat</div><div className="text-2xl font-semibold mt-1">{(notif.overdue||[]).length}</div></div>
        </div>
      </Card>

      <Card title="Notifikasi (Per Jenis)" subtitle="3 teratas per status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {["Kenaikan Gaji Berikutnya", "Kenaikan Pangkat Berikutnya"].map((type) => (
            <div key={type} className="space-y-3">
              <div className="text-sm font-medium">{type}</div>
              <div><div className="text-xs font-medium text-amber-700 mb-2">Segera (≤3 bln)</div><NotifList items={(notif.soon||[]).filter(x=>x.jenis===type).slice(0,3)} tone="amber" emptyText="—" /></div>
              <div><div className="text-xs font-medium text-rose-700 mb-2">Terlewat</div><NotifList items={(notif.overdue||[]).filter(x=>x.jenis===type).slice(0,3)} tone="rose" overdue emptyText="—" /></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PanelNotifikasi() {
  const { notif = { soon: [], overdue: [] } } = useApp() || {};
  const [chatId, setChatId] = useState(() => localStorage.getItem("tg_chat_id") || "");
  const [busy, setBusy] = useState(false);
  const saveChatId = () => { localStorage.setItem("tg_chat_id", chatId.trim()); alert("Chat ID disimpan."); };

  const groupText = (items, jenis) => {
    const list = items.filter((x) => x.jenis === jenis);
    if (!list.length) return "(tidak ada)";
    const fmtDate = (d) => {
      const dt = parseDate(d);
      return dt ? dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";
    };
    return list.map((r) => `• <b>${r.nama}</b> (${r.nip}) — ${r.jenis}: <b>${fmtDate(r.tanggal)}</b>` + (parseDate(r.tanggal) && parseDate(r.tanggal) < new Date() ? ` (terlewat ${Math.abs(daysUntil(r.tanggal))}h)` : ` (sisa ${daysUntil(r.tanggal) ?? "-"}h)`)).join("\\n");
  };

  const buildDigest = () => {
    const header = `<b>🔔 Ringkasan Notifikasi ASN</b>\\n${new Date().toLocaleString("id-ID")}\\n\\n`;
    const body = [
      `<b>Segera (≤ 90 hari)</b>`,
      `• <u>Kenaikan Gaji Berikutnya</u>`, groupText(notif.soon || [], "Kenaikan Gaji Berikutnya") || "(tidak ada)",
      `• <u>Kenaikan Pangkat Berikutnya</u>`, groupText(notif.soon || [], "Kenaikan Pangkat Berikutnya") || "(tidak ada)",
      "",
      `<b>Terlewat</b>`,
      `• <u>Kenaikan Gaji Berikutnya</u>`, groupText(notif.overdue || [], "Kenaikan Gaji Berikutnya") || "(tidak ada)",
      `• <u>Kenaikan Pangkat Berikutnya</u>`, groupText(notif.overdue || [], "Kenaikan Pangkat Berikutnya") || "(tidak ada)",
    ].join("\\n");
    return header + body;
  };

  const sendNow = async () => {
    try {
      setBusy(true);
      const text = buildDigest();
      const res = await fetch("/api/telegram/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: chatId.trim(), text }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      alert("Ringkasan terkirim ke Telegram");
    } catch (e) {
      alert(e.message || "Gagal kirim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card title="Kirim Ringkasan (Manual)" subtitle="Masukkan Chat ID & kirim ringkasan notifikasi.">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
          <div className="flex-1">
            <FormRow label="Telegram Chat ID" required>
              <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="contoh: 123456789" className="w-full border rounded-lg px-3 py-2" />
            </FormRow>
            <p className="text-xs text-slate-500 mt-1">Kirim pesan ke bot, lalu dapatkan Chat ID via @userinfobot atau @RawDataBot.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={saveChatId} className="border rounded-lg px-4 py-2 hover:bg-slate-50">Simpan</button>
            <button onClick={sendNow} disabled={!chatId || busy} className={`rounded-lg px-4 py-2 text-white ${busy ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"}`}>{busy ? "Mengirim..." : "Kirim Sekarang"}</button>
          </div>
        </div>
      </Card>

      <DiagnosticsCard />
    </div>
  );
}

function NotifItem({ r, tone = "amber", overdue = false }) {
  const Icon = overdue ? AlertTriangle : Bell;
  const d = daysUntil(r.tanggal);
  const days = typeof d === "number" ? Math.abs(d) : "-";
  return (
    <div className={`border rounded-xl p-3 flex items-center justify-between ${tone === "amber" ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg grid place-content-center ${tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="font-medium">{r.nama} <span className="text-xs text-slate-500">({r.nip})</span></div>
          <div className="text-xs text-slate-600">{r.jenis} pada <b>{human(r.tanggal)}</b> {overdue ? `(${days} hari yang lalu)` : `(sisa ${days} hari)`}</div>
        </div>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full border ${tone === "amber" ? "bg-white text-amber-700 border-amber-300" : "bg-white text-rose-700 border-rose-300"}`}>Pengingat</span>
    </div>
  );
}

function NotifList({ items = [], tone = "amber", overdue = false, emptyText = "Tidak ada data." }) {
  if (!items.length) return <EmptyState text={emptyText} />;
  return <div className="space-y-3">{items.map((r, idx) => (<NotifItem key={`${r.id ?? idx}-${r.jenis}`} r={r} tone={tone} overdue={overdue} />))}</div>;
}

/* ====================== Diagnostics ====================== */
function DiagnosticsCard() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const cek = async () => {
    try {
      setBusy(true);
      const res = await fetch("/api/telegram/diag");
      const data = await res.json();
      setStatus({ ok: res.ok, ...data });
      window.__diag = data;
    } catch (e) {
      setStatus({ ok: false, error: String(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Diagnostik Bot Telegram" subtitle="Cek env di server & koneksi ke Telegram." extra={
      <button onClick={cek} disabled={busy} className="rounded-lg px-3 py-1.5 border bg-white hover:bg-slate-50 inline-flex items-center gap-2">
        <Bug className="w-4 h-4" /> {busy ? "Memeriksa..." : "Cek Status Bot"}
      </button>
    }>
      {!status && <div className="text-sm text-slate-500">Klik "Cek Status Bot" untuk mulai.</div>}
      {status && (
        <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto">{JSON.stringify(status, null, 2)}</pre>
      )}
    </Card>
  );
}

/* ====================== Reusable UI ====================== */
function Card({ title, subtitle, extra, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>{title && <h3 className="text-base font-semibold">{title}</h3>}{subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}</div>
        {extra}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
function FormRow({ label, required, children }) { return (<div><label className="block text-sm mb-1">{label} {required && <span className="text-rose-600">*</span>}</label>{children}</div>); }
function NavButton({ icon, active, onClick, children }) { return (<button onClick={onClick} className={`px-3 py-1.5 rounded-lg border text-sm inline-flex items-center gap-2 ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-slate-50"}`}>{icon}{children}</button>); }
function TopLink({ active, onClick, icon, label }) { return (<button onClick={onClick} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-slate-50"}`}>{icon}<span>{label}</span></button>); }
function StatusPill({ label, target }) {
  const dd = daysUntil(target);
  if (dd === null) return null;
  const base = "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium";
  if (dd < 0) return (<span className={`${base} bg-rose-50 text-rose-700 border-rose-200`}><AlertTriangle className="w-3 h-3" /> {label}: Terlewat {Math.abs(dd)}h</span>);
  if (dd <= 90) return (<span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}><Clock className="w-3 h-3" /> {label}: {dd}h lagi</span>);
  return (<span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}><CheckCircle2 className="w-3 h-3" /> {label}: {dd}h lagi</span>);
}
function EmptyState({ text }) { return <div className="text-sm text-slate-500 border border-dashed rounded-xl p-4">{text}</div>; }
function IconButton({ children, onClick, title }) { return (<button onClick={onClick} title={title} className="px-2.5 py-2 rounded-lg border inline-flex items-center gap-2 hover:bg-slate-50">{children}</button>); }
function Th({ children, align = "left" }) { return <th className={`p-3 border-b text-${align}`}>{children}</th>; }
function Td({ children, align = "left" }) { return <td className={`p-3 border-b text-${align}`}>{children}</td>; }

/* ====================== Export/Import ====================== */
function exportJSON(rows = []) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "data-asn.json"; a.click(); URL.revokeObjectURL(url);
}
function importJSON() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "application/json";
  input.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return alert("Format JSON tidak valid");
    await db.table("asns").bulkPut(data.map((r) => ({ ...r })));
    alert("Import selesai");
  };
  input.click();
}
