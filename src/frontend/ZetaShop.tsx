import React from "react";

/**
 * Layar ZETA bergaya WhatsApp:
 * kirim foto produk -> bot cari toko terdekat -> pilih -> ambil di toko / diantar -> bayar.
 *
 * CATATAN JUJUR: backend belum punya endpoint HTTP untuk alur ini (alur aslinya lewat
 * WhatsApp/WAHA). Data toko, jarak, dan pembayaran di sini adalah DEMO. Ganti isi
 * `searchProducts` dan `buatPembayaran` saat endpoint backend sudah ada.
 */

export type Product = {
  id: string;
  nama: string;
  harga: number;
  rating: number;
  toko: string;
  alamat: string;
  jarakKm: number;
};

// ---------- Aturan bisnis (disamakan dengan src/services/fee.ts) ----------
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export function hitungBiayaLayanan(subtotal: number) {
  if (subtotal < 1000) throw new Error("Minimum transaksi Rp1.000");
  const persen =
    subtotal < 50000 ? 2 : subtotal < 500000 ? 1.5 : subtotal < 1000000 ? 1 : 0.75;
  const biaya = Math.round((subtotal * persen) / 100);
  return { subtotal, persen, biaya, total: subtotal + biaya };
}

export const ongkirAntar = (jarakKm: number) => 3000 + Math.ceil(jarakKm) * 2000;


// ---------- Pelacakan pesanan (simulasi) ----------
export type Mode = "ambil" | "antar";
type Pt = { x: number; y: number };

export type Langkah = {
  judul: string;
  detail: (p: Product, kode: string) => string;
  /** tick simulasi saat langkah ini mulai */
  mulai: number;
  /** menit "virtual" sejak pesanan dibuat (untuk jam di riwayat) */
  menit: number;
};

export const LANGKAH_ANTAR: Langkah[] = [
  { judul: "Pesanan dibuat", detail: () => "Pembayaran diterima, pesanan diteruskan ke toko.", mulai: 0, menit: 0 },
  { judul: "Toko menerima pesanan", detail: (p) => `${p.toko} mengonfirmasi pesananmu.`, mulai: 2, menit: 1 },
  { judul: "Toko mengemas barang", detail: () => "Barang dicek dan dikemas dengan aman.", mulai: 4, menit: 4 },
  { judul: "Pesanan siap, mencari kurir", detail: () => "Kurir terdekat sedang dihubungi.", mulai: 6, menit: 9 },
  { judul: "Kurir menuju toko", detail: (p) => `Kurir dalam perjalanan ke ${p.toko}.`, mulai: 8, menit: 11 },
  { judul: "Kurir mengambil paket", detail: (p) => `Paket diserahkan oleh ${p.toko} ke kurir.`, mulai: 12, menit: 15 },
  { judul: "Paket dalam perjalanan", detail: () => "Kurir menuju alamatmu. Pantau posisinya di peta.", mulai: 14, menit: 17 },
  { judul: "Kurir hampir tiba", detail: () => "Kurang dari 500 m dari alamatmu. Siap-siap ya.", mulai: 24, menit: 28 },
  { judul: "Pesanan tiba", detail: () => "Paket sudah diterima. Selamat berbelanja!", mulai: 28, menit: 31 },
];

export const LANGKAH_AMBIL: Langkah[] = [
  { judul: "Pesanan dibuat", detail: () => "Pembayaran diterima, pesanan diteruskan ke toko.", mulai: 0, menit: 0 },
  { judul: "Toko menerima pesanan", detail: (p) => `${p.toko} mengonfirmasi pesananmu.`, mulai: 2, menit: 1 },
  { judul: "Toko menyiapkan barang", detail: () => "Barang dicek dan disiapkan di kasir.", mulai: 4, menit: 5 },
  { judul: "Siap diambil", detail: (p, k) => `Tunjukkan kode ${k} ke kasir di ${p.toko}, ${p.alamat}.`, mulai: 6, menit: 10 },
];

export const langkahUntuk = (m: Mode) => (m === "antar" ? LANGKAH_ANTAR : LANGKAH_AMBIL);
export const akhirTick = (m: Mode) => {
  const l = langkahUntuk(m);
  return l[l.length - 1].mulai;
};

// Peta ilustrasi (viewBox 0 0 360 240)
export const TOKO: Pt = { x: 70, y: 70 };
export const RUMAH: Pt = { x: 320, y: 200 };
export const RUTE_KURIR_KE_TOKO: Pt[] = [{ x: 40, y: 200 }, { x: 40, y: 70 }, TOKO];
export const RUTE_ANTAR: Pt[] = [TOKO, { x: 150, y: 70 }, { x: 150, y: 130 }, { x: 250, y: 130 }, { x: 250, y: 200 }, RUMAH];

const jarak = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const panjangRute = (r: Pt[]) => r.slice(1).reduce((t, pt, i) => t + jarak(r[i], pt), 0);

/** Titik pada rute (polyline) di posisi p (0..1). */
export function titikPadaRute(rute: Pt[], p: number): Pt {
  const target = Math.min(1, Math.max(0, p)) * panjangRute(rute);
  let sisa = target;
  for (let i = 1; i < rute.length; i++) {
    const seg = jarak(rute[i - 1], rute[i]);
    if (sisa <= seg || i === rute.length - 1) {
      const f = seg === 0 ? 0 : Math.min(1, sisa / seg);
      return { x: rute[i - 1].x + (rute[i].x - rute[i - 1].x) * f, y: rute[i - 1].y + (rute[i].y - rute[i - 1].y) * f };
    }
    sisa -= seg;
  }
  return rute[rute.length - 1];
}

/** Bagian rute yang sudah dilalui sampai p (0..1). */
export function potongRute(rute: Pt[], p: number): Pt[] {
  const target = Math.min(1, Math.max(0, p)) * panjangRute(rute);
  const out: Pt[] = [rute[0]];
  let sisa = target;
  for (let i = 1; i < rute.length; i++) {
    const seg = jarak(rute[i - 1], rute[i]);
    if (sisa >= seg) {
      out.push(rute[i]);
      sisa -= seg;
    } else {
      out.push(titikPadaRute(rute, target / panjangRute(rute)));
      break;
    }
  }
  return out;
}

export function statusTracking(mode: Mode, tick: number, jarakKm: number) {
  const langkah = langkahUntuk(mode);
  let idx = 0;
  langkah.forEach((l, i) => {
    if (tick >= l.mulai) idx = i;
  });
  let courier: Pt | null = null;
  let progresAntar = 0;
  if (mode === "antar") {
    if (tick >= 6 && tick < 8) courier = RUTE_KURIR_KE_TOKO[0];
    else if (tick >= 8 && tick < 12) courier = titikPadaRute(RUTE_KURIR_KE_TOKO, (tick - 8) / 4);
    else if (tick >= 12 && tick < 14) courier = TOKO;
    else if (tick >= 14) {
      progresAntar = Math.min(1, (tick - 14) / 14);
      courier = titikPadaRute(RUTE_ANTAR, progresAntar);
    }
  }
  const sisaKm = mode === "antar" ? Math.max(0, jarakKm * (1 - progresAntar)) : 0;
  const etaMenit = mode === "antar" && tick >= 14 ? Math.ceil(sisaKm * 4) : null;
  return { idx, selesai: idx === langkah.length - 1, courier, progresAntar, sisaKm, etaMenit };
}

export type Order = { kode: string; produk: Product; mode: Mode; mulai: number };

const jamDari = (mulai: number, menit: number) =>
  new Date(mulai + menit * 60000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export function validasiFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type))
    return "Format tidak didukung. Kirim foto JPG atau PNG ya.";
  if (file.size > MAX_FILE_BYTES) return "Ukuran foto terlalu besar (maksimal 5 MB).";
  if (file.size === 0) return "File kosong atau rusak.";
  return null;
}

export function validasiRentangHarga(minText: string, maxText: string): string | null {
  const min = minText === "" ? null : Number(minText);
  const max = maxText === "" ? null : Number(maxText);
  if (min !== null && (!Number.isFinite(min) || min < 0)) return "Harga minimum tidak valid.";
  if (max !== null && (!Number.isFinite(max) || max < 0)) return "Harga maksimum tidak valid.";
  if (min !== null && max !== null && min > max)
    return "Harga minimum tidak boleh lebih besar dari maksimum.";
  return null;
}

// ---------- Data demo (ganti saat backend siap) ----------
const DEMO_PRODUCTS: Product[] = [
  { id: "p1", nama: "Tas Selempang Kanvas", harga: 89000, rating: 4.8, toko: "Toko Maju Jaya", alamat: "Jl. Pancasila No. 12", jarakKm: 0.8 },
  { id: "p2", nama: "Sepatu Sneakers Putih", harga: 149000, rating: 4.6, toko: "Toko Sinar Baru", alamat: "Jl. Ahmad Yani No. 45", jarakKm: 1.5 },
  { id: "p3", nama: "Jaket Hoodie Polos", harga: 275000, rating: 4.7, toko: "Toko Berkah", alamat: "Jl. Veteran No. 8", jarakKm: 2.7 },
  { id: "p4", nama: "Headphone Bluetooth", harga: 1250000, rating: 4.5, toko: "Toko Mega Elektronik", alamat: "Jl. Diponegoro No. 101", jarakKm: 4.2 },
];

async function searchProducts(_file: File): Promise<Product[]> {
  // TODO: ganti dengan panggilan ke backend, contoh:
  // const form = new FormData(); form.append("image", _file);
  // const res = await fetch(`${apiBase()}/api/v1/zeta/search`, { method: "POST", body: form });
  // return (await res.json()).products;
  await new Promise((r) => setTimeout(r, 800));
  return [...DEMO_PRODUCTS].sort((a, b) => a.jarakKm - b.jarakKm);
}

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const apiBase = () =>
  (window as unknown as { ELIZA_CONFIG?: { apiBase?: string } }).ELIZA_CONFIG?.apiBase?.replace(/\/$/, "") ?? "";

// ---------- Model pesan ----------
type Msg =
  | { id: number; from: "bot" | "user"; kind: "text"; text: string }
  | { id: number; from: "user"; kind: "image"; url: string }
  | { id: number; from: "bot"; kind: "products"; items: Product[] }
  | { id: number; from: "bot"; kind: "summary"; produk: Product; mode: Mode }
  | { id: number; from: "bot"; kind: "qris"; total: number }
  | { id: number; from: "bot"; kind: "tracking"; kode: string };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type Stage = "idle" | "choosing" | "mode" | "summary" | "paying" | "done";

const jam = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// ---------- Komponen ----------
export default function ZetaShop({ trackingTickMs = 1000 }: { trackingTickMs?: number } = {}) {
  const nextId = React.useRef(1);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const urls = React.useRef<string[]>([]);
  const timers = React.useRef<number[]>([]);

  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [stage, setStage] = React.useState<Stage>("idle");
  const [typing, setTyping] = React.useState(false);
  const [text, setText] = React.useState("");
  const [produk, setProduk] = React.useState<Product | null>(null);
  const [mode, setMode] = React.useState<Mode>("ambil");
  const [lastFile, setLastFile] = React.useState<File | null>(null);
  const [botOnline, setBotOnline] = React.useState<boolean | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [tick, setTick] = React.useState(0);
  const [showTrack, setShowTrack] = React.useState(false);
  const tickRef = React.useRef(0);
  const lastIdx = React.useRef(0);

  const add = React.useCallback((m: DistOmit<Msg, "id">) => {
    setMsgs((prev) => [...prev, { ...m, id: nextId.current++ } as Msg]);
  }, []);

  /** Bot "mengetik" sebentar lalu mengirim pesan. */
  const botSay = React.useCallback(
    (m: DistOmit<Msg, "id" | "from">, delay = 600) => {
      setTyping(true);
      return new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          setTyping(false);
          add({ ...m, from: "bot" } as DistOmit<Msg, "id">);
          resolve();
        }, delay);
        timers.current.push(t);
      });
    },
    [add],
  );

  // Pesan sambutan + status bot (opsional; gagal = mode demo).
  React.useEffect(() => {
    void botSay({ kind: "text", text: "Halo! Aku Zeta 👋 Kirim foto produk yang kamu cari, nanti aku carikan di toko terdekat." }, 300);
    fetch(`${apiBase()}/api/v1/zeta/status`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setBotOnline(Boolean(d?.waha?.sessionActive)))
      .catch(() => setBotOnline(null));
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [botSay]);


  // Ticker simulasi pelacakan.
  React.useEffect(() => {
    if (!order) return;
    const akhir = akhirTick(order.mode);
    tickRef.current = 0;
    setTick(0);
    const id = window.setInterval(() => {
      if (tickRef.current >= akhir) {
        window.clearInterval(id);
        return;
      }
      tickRef.current += 1;
      setTick(tickRef.current);
    }, trackingTickMs);
    return () => window.clearInterval(id);
  }, [order, trackingTickMs]);

  // Kirim notifikasi ke chat tiap status berganti (seperti notifikasi Shopee).
  React.useEffect(() => {
    if (!order) return;
    const st = statusTracking(order.mode, tick, order.produk.jarakKm);
    if (st.idx > lastIdx.current) {
      lastIdx.current = st.idx;
      const l = langkahUntuk(order.mode)[st.idx];
      add({ from: "bot", kind: "text", text: `📦 Update pesanan ${order.kode}: ${l.judul}` });
    }
  }, [tick, order, add]);

  const lewatiKeAkhir = React.useCallback(() => {
    if (!order) return;
    tickRef.current = akhirTick(order.mode);
    setTick(tickRef.current);
  }, [order]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [msgs, typing]);

  async function kirimFoto(file: File | undefined) {
    if (!file) return;
    const err = validasiFile(file);
    if (err) {
      await botSay({ kind: "text", text: err }, 300);
      return;
    }
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setLastFile(file);
    add({ from: "user", kind: "image", url });
    setStage("idle");
    await botSay({ kind: "text", text: "Oke, lagi aku cari ya... 🔍" }, 400);
    try {
      const items = await searchProducts(file);
      if (items.length === 0) {
        await botSay({ kind: "text", text: "Maaf, aku belum nemu produk yang mirip. Coba foto lain ya." }, 300);
        return;
      }
      await botSay({ kind: "text", text: `Ketemu ${items.length} produk. Aku urutkan dari toko yang paling dekat:` }, 300);
      await botSay({ kind: "products", items }, 300);
      setStage("choosing");
    } catch (e) {
      await botSay({ kind: "text", text: e instanceof Error ? e.message : "Gagal mencari produk." }, 300);
    }
  }

  async function kirimTeks() {
    const t = text.trim();
    if (!t) return;
    setText("");
    add({ from: "user", kind: "text", text: t });

    const m = t.match(/filter\s+harga\s+(\d+)\s*(?:-|sampai|s\/d)\s*(\d+)/i);
    if (m) {
      const err = validasiRentangHarga(m[1], m[2]);
      if (err) {
        await botSay({ kind: "text", text: err }, 300);
        return;
      }
      if (!lastFile) {
        await botSay({ kind: "text", text: "Kirim foto produknya dulu ya, baru aku filter harganya." }, 300);
        return;
      }
      const items = (await searchProducts(lastFile)).filter(
        (p) => p.harga >= Number(m[1]) && p.harga <= Number(m[2]),
      );
      if (items.length === 0) {
        await botSay({ kind: "text", text: "Tidak ada produk di rentang harga itu." }, 300);
        return;
      }
      await botSay({ kind: "text", text: `Ini ${items.length} produk di rentang ${rupiah(Number(m[1]))} - ${rupiah(Number(m[2]))}:` }, 300);
      await botSay({ kind: "products", items }, 300);
      setStage("choosing");
      return;
    }
    await botSay({ kind: "text", text: "Kirim foto produk pakai tombol 📎, atau ketik: filter harga 100000 sampai 300000" }, 400);
  }

  async function pilih(p: Product) {
    setProduk(p);
    setStage("mode");
    add({ from: "user", kind: "text", text: `Pilih ${p.nama} (${p.toko})` });
    await botSay({ kind: "text", text: `Mantap! ${p.toko} jaraknya ${p.jarakKm} km dari kamu. Mau diambil sendiri atau diantar?` }, 500);
  }

  async function pilihMode(md: Mode) {
    if (!produk) return;
    setMode(md);
    setStage("summary");
    add({ from: "user", kind: "text", text: md === "ambil" ? "Ambil di toko" : "Antar ke rumah" });
    await botSay({ kind: "summary", produk, mode: md }, 600);
  }

  async function bayar() {
    if (!produk) return;
    const fee = hitungBiayaLayanan(produk.harga);
    const total = fee.total + (mode === "antar" ? ongkirAntar(produk.jarakKm) : 0);
    setStage("paying");
    add({ from: "user", kind: "text", text: "Bayar pakai QRIS" });
    await botSay({ kind: "qris", total }, 600);
  }

  async function simulasiBayar() {
    if (!produk) return;
    setStage("done");
    add({ from: "user", kind: "text", text: "Sudah bayar" });
    const kode = `ZT-${Math.floor(100000 + Math.random() * 900000)}`;
    await botSay({ kind: "text", text: "Pembayaran diterima ✅ (simulasi)" }, 500);
    await botSay(
      {
        kind: "text",
        text:
          mode === "ambil"
            ? `Pesanan ${kode} akan disiapkan di ${produk.toko}, ${produk.alamat}. Tunjukkan kode ini ke kasir saat mengambil.`
            : `Pesanan ${kode} diteruskan ke ${produk.toko} dan akan diantar kurir. Kamu bisa melacaknya di peta.`,
      },
      600,
    );
    lastIdx.current = 0;
    setOrder({ kode, produk, mode, mulai: Date.now() });
    await botSay({ kind: "tracking", kode }, 400);
  }

  function ulang() {
    setStage("idle");
    setProduk(null);
    add({ from: "user", kind: "text", text: "Cari produk lain" });
    void botSay({ kind: "text", text: "Siap! Kirim foto produk berikutnya 📎" }, 400);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#d9dbd5] sm:p-4" data-testid="zeta-shop">
      <div className="flex h-screen w-full max-w-md flex-col overflow-hidden bg-[#ece5dd] shadow-xl sm:h-[92vh] sm:rounded-xl">
        {/* Header */}
        <header className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25d366] text-lg font-bold">Z</div>
          <div className="flex-1">
            <div className="font-semibold leading-tight">Zeta</div>
            <div className="text-xs text-white/80">{typing ? "sedang mengetik..." : "online"}</div>
          </div>
          <span
            data-testid="status-chip"
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${botOnline ? "bg-[#e6f4ed] text-[#236247]" : "bg-[#fff4df] text-[#8a5a00]"}`}
          >
            {botOnline ? "Bot aktif" : "Mode demo"}
          </span>
        </header>

        {/* Chat */}
        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" data-testid="chat-log">
          {msgs.map((m) => (
            <Bubble key={m.id} from={m.from}>
              {renderMsg(m, stage, pilih, { order, tick, buka: () => setShowTrack(true) })}
            </Bubble>
          ))}
          {typing && (
            <Bubble from="bot">
              <span className="text-[#667781]">• • •</span>
            </Bubble>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Balasan cepat */}
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {stage === "mode" && (
            <>
              <Chip onClick={() => pilihMode("ambil")} testId="qr-ambil">🏪 Ambil di toko</Chip>
              <Chip onClick={() => pilihMode("antar")} testId="qr-antar">🛵 Antar ke rumah</Chip>
            </>
          )}
          {stage === "summary" && <Chip onClick={bayar} testId="btn-bayar">💳 Bayar QRIS</Chip>}
          {stage === "paying" && <Chip onClick={simulasiBayar} testId="btn-simulasi-bayar">✅ Simulasikan sudah bayar</Chip>}
          {stage === "done" && order && (
            <Chip onClick={() => setShowTrack(true)} testId="btn-lacak-chip">📍 Lacak pesanan</Chip>
          )}
          {stage === "done" && <Chip onClick={ulang} testId="btn-ulang">🔄 Cari produk lain</Chip>}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2">
          <button
            type="button"
            aria-label="Kirim foto"
            data-testid="btn-attach"
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-black/5"
          >
            📎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            data-testid="file-input"
            onChange={(e) => {
              void kirimFoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void kirimTeks()}
            placeholder="Ketik pesan"
            data-testid="chat-input"
            className="min-h-10 flex-1 rounded-full bg-white px-4 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => void kirimTeks()}
            data-testid="btn-send"
            className="min-h-10 rounded-full bg-[#075e54] px-4 text-sm font-semibold text-white"
          >
            Kirim
          </button>
        </div>
      </div>
      {showTrack && order && (
        <TrackingScreen order={order} tick={tick} onClose={() => setShowTrack(false)} onSkip={lewatiKeAkhir} />
      )}
    </main>
  );
}

type TrackCtx = { order: Order | null; tick: number; buka: () => void };

function renderMsg(m: Msg, stage: Stage, pilih: (p: Product) => void, track: TrackCtx) {
  switch (m.kind) {
    case "text":
      return <p className="whitespace-pre-wrap text-sm">{m.text}</p>;
    case "image":
      return <img src={m.url} alt="Foto produk" className="max-h-56 rounded-md" data-testid="preview" />;
    case "products":
      return (
        <div className="space-y-2" data-testid="product-list">
          {m.items.map((p) => (
            <div key={p.id} className="rounded-lg border border-[#e1e5e8] bg-[#f7f8fa] p-3" data-testid={`product-${p.id}`}>
              <div className="text-sm font-semibold">{p.nama}</div>
              <div className="font-bold text-[#075e54]">{rupiah(p.harga)}</div>
              <div className="text-xs text-[#667781]">
                📍 {p.toko} · {p.jarakKm} km · ⭐ {p.rating.toFixed(1)}
              </div>
              <button
                type="button"
                disabled={stage !== "choosing"}
                onClick={() => pilih(p)}
                data-testid={`pilih-${p.id}`}
                className="mt-2 w-full rounded-md bg-[#075e54] py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Pilih
              </button>
            </div>
          ))}
          <p className="text-[10px] font-semibold text-[#8a5a00]">Data demo</p>
        </div>
      );
    case "summary": {
      const fee = hitungBiayaLayanan(m.produk.harga);
      const ongkir = m.mode === "antar" ? ongkirAntar(m.produk.jarakKm) : 0;
      return (
        <div className="space-y-1 text-sm" data-testid="ringkasan">
          <div className="font-semibold">Ringkasan pesanan</div>
          <div className="text-xs text-[#667781]">
            {m.mode === "ambil" ? `Ambil di ${m.produk.toko}, ${m.produk.alamat}` : `Diantar dari ${m.produk.toko}`}
          </div>
          <Line label={m.produk.nama} value={rupiah(fee.subtotal)} testId="subtotal" />
          {m.mode === "antar" && <Line label={`Ongkir (${m.produk.jarakKm} km)`} value={rupiah(ongkir)} testId="ongkir" />}
          <Line label={`Biaya layanan (${fee.persen}%)`} value={rupiah(fee.biaya)} testId="fee" />
          <div className="border-t border-[#e1e5e8] pt-1">
            <Line label="Total bayar" value={rupiah(fee.total + ongkir)} bold testId="total" />
          </div>
        </div>
      );
    }
    case "tracking": {
      const o = track.order;
      if (!o || o.kode !== m.kode) {
        return <p className="text-sm">📦 Pesanan {m.kode} selesai.</p>;
      }
      const st = statusTracking(o.mode, track.tick, o.produk.jarakKm);
      const langkah = langkahUntuk(o.mode);
      const persen = Math.round(((st.idx + 1) / langkah.length) * 100);
      return (
        <div className="space-y-2 text-sm" data-testid="kartu-tracking">
          <div className="font-semibold">📦 Pesanan {o.kode}</div>
          <div data-testid="kartu-status">{langkah[st.idx].judul}</div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e1e5e8]">
            <div className="h-full bg-[#25d366] transition-all" style={{ width: `${persen}%` }} />
          </div>
          <button
            type="button"
            onClick={track.buka}
            data-testid="btn-lacak"
            className="w-full rounded-md bg-[#075e54] py-1.5 text-xs font-semibold text-white"
          >
            📍 Lacak pesanan
          </button>
        </div>
      );
    }
    case "qris":
      return (
        <div className="space-y-2 text-center" data-testid="qris">
          <div className="text-sm font-semibold">Bayar {rupiah(m.total)}</div>
          <div className="mx-auto grid h-32 w-32 grid-cols-8 gap-px bg-white p-1" aria-label="QRIS demo">
            {Array.from({ length: 64 }, (_, i) => (
              <div key={i} className={(i * 7 + (i >> 3) * 3) % 5 < 2 ? "bg-black" : "bg-white"} />
            ))}
          </div>
          <p className="text-[10px] font-semibold text-[#8a5a00]">QRIS demo, bukan pembayaran sungguhan</p>
        </div>
      );
  }
}

function Bubble({ from, children }: { from: "bot" | "user"; children: React.ReactNode }) {
  const isUser = from === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        data-testid={isUser ? "user-message" : "bot-message"}
        className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${isUser ? "bg-[#d9fdd3]" : "bg-white"}`}
      >
        {children}
        <div className="mt-0.5 text-right text-[10px] text-[#667781]">{jam()}</div>
      </div>
    </div>
  );
}

function Chip({ children, onClick, testId }: { children: React.ReactNode; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="rounded-full border border-[#075e54] bg-white px-4 py-1.5 text-sm font-semibold text-[#075e54] hover:bg-[#e7f5f2]"
    >
      {children}
    </button>
  );
}

function Line({ label, value, bold, testId }: { label: string; value: string; bold?: boolean; testId: string }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span data-testid={testId}>{value}</span>
    </div>
  );
}

function TrackingScreen({ order, tick, onClose, onSkip }: { order: Order; tick: number; onClose: () => void; onSkip: () => void }) {
  const { produk, mode, kode, mulai } = order;
  const st = statusTracking(mode, tick, produk.jarakKm);
  const langkah = langkahUntuk(mode);
  const aktif = langkah[st.idx];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:p-4" role="dialog" aria-label="Lacak pesanan" data-testid="tracking-screen">
      <div className="flex h-screen w-full max-w-md flex-col overflow-hidden bg-[#f0f2f5] shadow-xl sm:h-[92vh] sm:rounded-xl">
        <header className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          <button type="button" onClick={onClose} aria-label="Kembali" data-testid="btn-tutup-lacak" className="text-xl">
            ←
          </button>
          <div className="flex-1">
            <div className="font-semibold leading-tight">Lacak Pesanan</div>
            <div className="text-xs text-white/80">{kode}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <PetaTracking mode={mode} courier={st.courier} progresAntar={st.progresAntar} produk={produk} />

          <div className="m-3 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-base font-bold text-[#075e54]" data-testid="tracking-status">
              {aktif.judul}
            </div>
            <div className="mt-1 text-sm text-[#667781]">{aktif.detail(produk, kode)}</div>
            {mode === "antar" && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-[#f7f8fa] p-2">
                  <div className="text-[10px] text-[#667781]">Sisa jarak</div>
                  <div className="font-semibold" data-testid="tracking-jarak">
                    {st.selesai ? "0 m" : tick >= 14 ? `${st.sisaKm.toFixed(1)} km` : `${produk.jarakKm} km`}
                  </div>
                </div>
                <div className="rounded-md bg-[#f7f8fa] p-2">
                  <div className="text-[10px] text-[#667781]">Estimasi tiba</div>
                  <div className="font-semibold" data-testid="tracking-eta">
                    {st.selesai ? "Sudah tiba" : st.etaMenit !== null ? `± ${Math.max(1, st.etaMenit)} menit` : "Menunggu kurir"}
                  </div>
                </div>
              </div>
            )}
            {mode === "antar" && tick >= 6 && (
              <div className="mt-3 flex items-center gap-3 border-t border-[#e1e5e8] pt-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7f5f2] text-lg">🛵</div>
                <div>
                  <div className="font-semibold">Pak Slamet</div>
                  <div className="text-xs text-[#667781]">Motor · G 4521 XY (data demo)</div>
                </div>
              </div>
            )}
          </div>

          <div className="mx-3 mb-3 rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold">Riwayat perjalanan</div>
            <ol className="space-y-0">
              {[...langkah].map((l, i) => ({ l, i })).reverse().map(({ l, i }) => {
                const sampai = i <= st.idx;
                const sekarang = i === st.idx;
                return (
                  <li key={i} className="flex gap-3" data-testid={`tracking-step-${i}`} data-state={sekarang ? "now" : sampai ? "done" : "todo"}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                          sekarang ? "bg-[#25d366] ring-4 ring-[#25d366]/30" : sampai ? "bg-[#075e54]" : "bg-[#cfd6db]"
                        }`}
                      />
                      {i !== 0 && <div className={`w-px flex-1 ${sampai ? "bg-[#075e54]" : "bg-[#cfd6db]"}`} />}
                    </div>
                    <div className="pb-4">
                      <div className={`text-sm ${sampai ? "font-semibold" : "text-[#667781]"}`}>{l.judul}</div>
                      <div className="text-xs text-[#667781]">{l.detail(produk, kode)}</div>
                      {sampai && <div className="text-[10px] text-[#667781]">{jamDari(mulai, l.menit)}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-[10px] font-semibold text-[#8a5a00]">
          <span>Simulasi: posisi kurir dan peta hanya ilustrasi.</span>
          {!st.selesai && (
            <button type="button" onClick={onSkip} data-testid="btn-lewati" className="rounded-full border border-[#075e54] px-3 py-1 text-[#075e54]">
              ⏩ Lewati ke akhir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PetaTracking({ mode, courier, progresAntar, produk }: { mode: Mode; courier: Pt | null; progresAntar: number; produk: Product }) {
  const pts = (r: Pt[]) => r.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox="0 0 360 240" className="w-full bg-[#e6eddc]" role="img" aria-label="Peta ilustrasi pelacakan" data-testid="peta">
      {/* blok dan sungai */}
      <path d="M0 40 C 60 20, 120 40, 200 20 S 330 10, 360 30" stroke="#bfdcf0" strokeWidth="14" fill="none" />
      {[[50, 80, 90, 40], [160, 80, 80, 40], [260, 80, 90, 40], [50, 140, 90, 50], [160, 140, 80, 50], [260, 140, 90, 50], [50, 210, 90, 25], [160, 210, 80, 25], [260, 210, 60, 25]].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#d3dcc6" />
      ))}
      {/* jalan */}
      {[70, 130, 200].map((y) => (
        <line key={y} x1="20" y1={y} x2="345" y2={y} stroke="#ffffff" strokeWidth="10" />
      ))}
      {[40, 150, 250].map((x) => (
        <line key={x} x1={x} y1="40" x2={x} y2="225" stroke="#ffffff" strokeWidth="10" />
      ))}

      {mode === "antar" ? (
        <>
          <polyline points={pts(RUTE_ANTAR)} fill="none" stroke="#9aa5ad" strokeWidth="4" strokeDasharray="6 5" strokeLinejoin="round" />
          {progresAntar > 0 && (
            <polyline points={pts(potongRute(RUTE_ANTAR, progresAntar))} fill="none" stroke="#25d366" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          )}
        </>
      ) : (
        <polyline points={`${TOKO.x},${TOKO.y} ${TOKO.x},130 ${RUMAH.x},130 ${RUMAH.x},${RUMAH.y}`} fill="none" stroke="#9aa5ad" strokeWidth="3" strokeDasharray="4 5" />
      )}

      <text x={TOKO.x} y={TOKO.y + 6} fontSize="20" textAnchor="middle">🏪</text>
      <text x={TOKO.x} y={TOKO.y - 14} fontSize="9" textAnchor="middle" fill="#172033" fontWeight="bold">{produk.toko}</text>
      <text x={RUMAH.x} y={RUMAH.y + 6} fontSize="20" textAnchor="middle">🏠</text>
      <text x={RUMAH.x} y={RUMAH.y - 14} fontSize="9" textAnchor="middle" fill="#172033" fontWeight="bold">{mode === "ambil" ? "Kamu" : "Alamatmu"}</text>

      {courier && (
        <g data-testid="courier-marker" transform={`translate(${courier.x} ${courier.y})`}>
          <circle r="13" fill="#ffffff" stroke="#075e54" strokeWidth="2" />
          <text y="6" fontSize="16" textAnchor="middle">🛵</text>
        </g>
      )}
    </svg>
  );
}
