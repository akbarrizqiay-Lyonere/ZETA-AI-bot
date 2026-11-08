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
  kategori: string;
  motif: string;
  warna: string;
};

export const KATEGORI = ["Dress", "Tas", "Sepatu", "Jaket", "Elektronik"] as const;

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

export type Order = {
  kode: string;
  produk: Product;
  mode: Mode;
  mulai: number;
  penerima: Penerima;
  metode: string;
  cod: boolean;
};

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
  { id: "p1", nama: "Tas Selempang Kanvas", harga: 89000, rating: 4.8, toko: "Toko Maju Jaya", alamat: "Jl. Pancasila No. 12", jarakKm: 0.8, kategori: "Tas", motif: "Polos", warna: "Krem" },
  { id: "p5", nama: "Dress Bunga Cokelat", harga: 135000, rating: 4.7, toko: "Toko Fashion Ayu", alamat: "Jl. Sudirman No. 3", jarakKm: 1.1, kategori: "Dress", motif: "Bunga", warna: "Cokelat" },
  { id: "p2", nama: "Sepatu Sneakers Putih", harga: 149000, rating: 4.6, toko: "Toko Sinar Baru", alamat: "Jl. Ahmad Yani No. 45", jarakKm: 1.5, kategori: "Sepatu", motif: "Polos", warna: "Putih" },
  { id: "p3", nama: "Jaket Hoodie Polos", harga: 275000, rating: 4.7, toko: "Toko Berkah", alamat: "Jl. Veteran No. 8", jarakKm: 2.7, kategori: "Jaket", motif: "Polos", warna: "Abu-abu" },
  { id: "p6", nama: "Dress Bunga Biru", harga: 159000, rating: 4.5, toko: "Toko Berkah", alamat: "Jl. Veteran No. 8", jarakKm: 2.7, kategori: "Dress", motif: "Bunga", warna: "Biru" },
  { id: "p4", nama: "Headphone Bluetooth", harga: 1250000, rating: 4.5, toko: "Toko Mega Elektronik", alamat: "Jl. Diponegoro No. 101", jarakKm: 4.2, kategori: "Elektronik", motif: "Polos", warna: "Hitam" },
];

/** DEMO: kategori ditebak dari nama file. Nanti diganti hasil model computer vision di backend. */
export function tebakKategoriDemo(namaFile: string): { kategori: string; motif: string } {
  const n = namaFile.toLowerCase();
  if (/(^|[^a-z])(tas|bag)([^a-z]|$)/.test(n)) return { kategori: "Tas", motif: "Polos" };
  if (/sepatu|shoe|sneaker/.test(n)) return { kategori: "Sepatu", motif: "Polos" };
  if (/jaket|hoodie|jacket/.test(n)) return { kategori: "Jaket", motif: "Polos" };
  if (/headphone|earphone|speaker/.test(n)) return { kategori: "Elektronik", motif: "Polos" };
  return { kategori: "Dress", motif: "Bunga" };
}

async function searchProducts(file: File): Promise<{ kategori: string; motif: string; items: Product[] }> {
  // TODO: ganti dengan panggilan ke backend, contoh:
  // const form = new FormData(); form.append("image", file);
  // const res = await fetch(`${apiBase()}/api/v1/zeta/search`, { method: "POST", body: form });
  // return await res.json(); // { kategori, motif, items }
  await new Promise((r) => setTimeout(r, 800));
  return { ...tebakKategoriDemo(file.name), items: [...DEMO_PRODUCTS].sort((a, b) => a.jarakKm - b.jarakKm) };
}

// ---------- Deteksi warna dominan (pengolahan citra sungguhan di browser) ----------
export const DAFTAR_WARNA: { nama: string; rgb: [number, number, number] }[] = [
  { nama: "Hitam", rgb: [25, 25, 25] },
  { nama: "Putih", rgb: [240, 240, 240] },
  { nama: "Abu-abu", rgb: [128, 128, 128] },
  { nama: "Merah", rgb: [200, 30, 40] },
  { nama: "Oranye", rgb: [240, 130, 30] },
  { nama: "Kuning", rgb: [240, 210, 40] },
  { nama: "Hijau", rgb: [40, 150, 70] },
  { nama: "Biru", rgb: [40, 90, 200] },
  { nama: "Ungu", rgb: [130, 60, 160] },
  { nama: "Pink", rgb: [240, 130, 170] },
  { nama: "Cokelat", rgb: [120, 75, 45] },
  { nama: "Krem", rgb: [225, 205, 170] },
];

/** Nama warna terdekat (jarak Euclidean di ruang RGB). */
export function namaWarna(r: number, g: number, b: number): string {
  let terbaik = DAFTAR_WARNA[0];
  let jarakMin = Infinity;
  for (const w of DAFTAR_WARNA) {
    const d = (w.rgb[0] - r) ** 2 + (w.rgb[1] - g) ** 2 + (w.rgb[2] - b) ** 2;
    if (d < jarakMin) {
      jarakMin = d;
      terbaik = w;
    }
  }
  return terbaik.nama;
}

/** Rata-rata warna area tengah foto (diperkecil ke 32x32). Null jika browser tidak mendukung. */
export async function deteksiWarna(file: File): Promise<{ nama: string; rgb: [number, number, number] } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, 32, 32);
    const d = ctx.getImageData(8, 8, 16, 16).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n++;
    }
    if (n === 0) return null;
    const rgb: [number, number, number] = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    return { nama: namaWarna(...rgb), rgb };
  } catch {
    return null;
  }
}

// ---------- Penerima / alamat ----------
export type Penerima = { nama: string; hp: string; alamat: string; catatan: string };

/** Samakan format HP ke 08xxxxxxxxxx. Terima +62, 62, 08, atau 8 di depan. */
export function normalisasiHp(h: string): string {
  const x = h.replace(/[\s\-().]/g, "");
  if (x.startsWith("+62")) return "0" + x.slice(3);
  if (x.startsWith("62")) return "0" + x.slice(2);
  if (x.startsWith("8")) return "0" + x;
  return x;
}

export function validasiPenerima(mode: Mode, d: Penerima): Partial<Record<keyof Penerima, string>> {
  const e: Partial<Record<keyof Penerima, string>> = {};
  if (d.nama.trim().length < 3) e.nama = "Nama minimal 3 huruf.";
  if (!/^08\d{8,12}$/.test(normalisasiHp(d.hp))) e.hp = "Nomor HP tidak valid (contoh: 081234567890).";
  if (mode === "antar" && d.alamat.trim().length < 10)
    e.alamat = "Alamat terlalu singkat. Tulis jalan, nomor, dan kelurahan.";
  return e;
}

export function hitungTotal(p: Product, mode: Mode) {
  const fee = hitungBiayaLayanan(p.harga);
  const ongkir = mode === "antar" ? ongkirAntar(p.jarakKm) : 0;
  return { ...fee, ongkir, grand: fee.total + ongkir };
}

export const BANK = ["BCA", "BRI", "Mandiri", "BNI"] as const;
export const WALLET = ["ShopeePay", "GoPay", "DANA", "OVO"] as const;
export const HUBUNGAN_ANTAR = ["Penerima langsung", "Keluarga serumah", "Tetangga", "Satpam/resepsionis", "Lainnya"];
export const HUBUNGAN_AMBIL = ["Pemesan langsung", "Diwakilkan"];

const acakDigit = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
const PREFIX_VA: Record<string, string> = { BCA: "39358", BRI: "26215", Mandiri: "88608", BNI: "88100" };
const nomorVa = (bank: string) => (PREFIX_VA[bank] + acakDigit(11)).replace(/(\d{4})(?=\d)/g, "$1 ");

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const apiBase = () =>
  (window as unknown as { ELIZA_CONFIG?: { apiBase?: string } }).ELIZA_CONFIG?.apiBase?.replace(/\/$/, "") ?? "";

// ---------- Model pesan ----------
type Msg =
  | { id: number; from: "bot" | "user"; kind: "text"; text: string }
  | { id: number; from: "user"; kind: "image"; url: string }
  | { id: number; from: "bot"; kind: "analisis"; kategori: string; motif: string; warna: string; rgb: [number, number, number] | null }
  | { id: number; from: "bot"; kind: "products"; items: Product[]; foto: string; kategori: string }
  | { id: number; from: "bot"; kind: "summary"; produk: Product; mode: Mode; penerima: Penerima }
  | { id: number; from: "bot"; kind: "qris"; total: number }
  | { id: number; from: "bot"; kind: "tagihan"; judul: string; total: number; rows: { label: string; value: string; testId?: string }[]; catatan: string }
  | { id: number; from: "bot"; kind: "tracking"; kode: string }
  | { id: number; from: "bot"; kind: "bukti"; url: string; penerima: string; hubungan: string; jam: string; mode: Mode };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type Stage = "idle" | "choosing" | "mode" | "alamat" | "summary" | "metode" | "bank" | "wallet" | "paying" | "done";

export type Bukti = { url: string; penerima: string; hubungan: string; jam: string };

const BOLEH_PILIH: Stage[] = ["choosing", "mode", "alamat", "summary", "metode", "bank", "wallet"];

const jam = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// ---------- Komponen ----------
export default function ZetaShop({ trackingTickMs = 1000 }: { trackingTickMs?: number } = {}) {
  const nextId = React.useRef(1);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const urls = React.useRef<string[]>([]);
  const timers = React.useRef<number[]>([]);
  const tickRef = React.useRef(0);
  const lastIdx = React.useRef(0);

  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [stage, setStage] = React.useState<Stage>("idle");
  const [typing, setTyping] = React.useState(false);
  const [text, setText] = React.useState("");
  const [produk, setProduk] = React.useState<Product | null>(null);
  const [mode, setMode] = React.useState<Mode>("ambil");
  const [penerima, setPenerima] = React.useState<Penerima | null>(null);
  const [metode, setMetode] = React.useState("QRIS");
  const [katalog, setKatalog] = React.useState<Product[]>([]);
  const [fotoUrl, setFotoUrl] = React.useState("");
  const [kategoriAktif, setKategoriAktif] = React.useState<string | null>(null);
  const [botOnline, setBotOnline] = React.useState<boolean | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [tick, setTick] = React.useState(0);
  const [showTrack, setShowTrack] = React.useState(false);
  const [bukti, setBukti] = React.useState<Bukti | null>(null);

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
    void botSay({ kind: "text", text: "Halo! Aku Zeta 👋 Kirim foto produk yang kamu cari, nanti aku analisis dan carikan di toko terdekat." }, 300);
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

  // Notifikasi ke chat tiap status berganti (seperti notifikasi Shopee).
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
  }, [msgs, typing, stage]);

  // ---------- Alur: foto -> analisis -> produk ----------
  async function kirimFoto(file: File | undefined) {
    if (!file) return;
    const err = validasiFile(file);
    if (err) {
      await botSay({ kind: "text", text: err }, 300);
      return;
    }
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setFotoUrl(url);
    add({ from: "user", kind: "image", url });
    setStage("idle");
    await botSay({ kind: "text", text: "Oke, lagi aku analisis fotonya... 🔍" }, 400);
    try {
      const [hasil, warna] = await Promise.all([searchProducts(file), deteksiWarna(file)]);
      setKatalog(hasil.items);
      setKategoriAktif(hasil.kategori);
      await botSay(
        { kind: "analisis", kategori: hasil.kategori, motif: hasil.motif, warna: warna?.nama ?? "Tidak terdeteksi", rgb: warna?.rgb ?? null },
        400,
      );
      const items = hasil.items.filter((p) => p.kategori === hasil.kategori);
      setStage("choosing");
      if (items.length === 0) {
        await botSay({ kind: "text", text: `Belum ada produk kategori ${hasil.kategori}. Coba pilih kategori lain di bawah.` }, 300);
      } else {
        await botSay({ kind: "products", items, foto: url, kategori: hasil.kategori }, 400);
        await botSay({ kind: "text", text: "Kategorinya kurang pas? Pilih kategori lain di bawah ya." }, 300);
      }
    } catch (e) {
      await botSay({ kind: "text", text: e instanceof Error ? e.message : "Gagal menganalisis foto." }, 300);
    }
  }

  async function ubahKategori(k: string | null) {
    setKategoriAktif(k);
    add({ from: "user", kind: "text", text: k ? `Kategori: ${k}` : "Semua kategori" });
    const items = katalog.filter((p) => !k || p.kategori === k);
    if (items.length === 0) {
      await botSay({ kind: "text", text: `Belum ada produk kategori ${k}.` }, 300);
      return;
    }
    await botSay({ kind: "text", text: `Ini produk ${k ? `kategori ${k}` : "dari semua kategori"}, dari toko terdekat:` }, 300);
    await botSay({ kind: "products", items, foto: fotoUrl, kategori: k ?? "" }, 300);
  }

  async function lihatToko(p: Product) {
    add({ from: "user", kind: "text", text: `Lihat toko ${p.toko}` });
    const lain = katalog.filter((x) => x.toko === p.toko).map((x) => x.nama).join(", ");
    await botSay({ kind: "text", text: `🏪 ${p.toko}\n📍 ${p.alamat} (${p.jarakKm} km dari kamu)\nProduk di toko ini: ${lain}` }, 400);
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
      if (katalog.length === 0) {
        await botSay({ kind: "text", text: "Kirim foto produknya dulu ya, baru aku filter harganya." }, 300);
        return;
      }
      const items = katalog.filter(
        (p) => (!kategoriAktif || p.kategori === kategoriAktif) && p.harga >= Number(m[1]) && p.harga <= Number(m[2]),
      );
      if (items.length === 0) {
        await botSay({ kind: "text", text: "Tidak ada produk di rentang harga itu." }, 300);
        return;
      }
      await botSay({ kind: "text", text: `Ini ${items.length} produk di rentang ${rupiah(Number(m[1]))} - ${rupiah(Number(m[2]))}:` }, 300);
      await botSay({ kind: "products", items, foto: fotoUrl, kategori: kategoriAktif ?? "" }, 300);
      setStage("choosing");
      return;
    }
    await botSay({ kind: "text", text: "Kirim foto produk pakai tombol 📎, atau ketik: filter harga 100000 sampai 300000" }, 400);
  }

  // ---------- Alur: pilih -> ambil/antar -> alamat -> ringkasan ----------
  async function pilih(p: Product) {
    setProduk(p);
    setPenerima(null);
    setStage("mode");
    add({ from: "user", kind: "text", text: `Pilih ${p.nama} (${p.toko})` });
    await botSay({ kind: "text", text: `Mantap! ${p.toko} jaraknya ${p.jarakKm} km dari kamu. Mau diambil sendiri atau diantar?` }, 500);
  }

  async function pilihMode(md: Mode) {
    if (!produk) return;
    setMode(md);
    add({ from: "user", kind: "text", text: md === "ambil" ? "Ambil di toko" : "Antar ke rumah" });
    setStage("alamat");
    await botSay(
      {
        kind: "text",
        text: md === "antar" ? "Kirim ke mana? Isi alamat lengkapmu ya 🏠" : "Siapa yang akan mengambil? Isi nama dan nomor HP-nya ya.",
      },
      500,
    );
  }

  async function kirimPenerima(d: Penerima) {
    if (!produk) return;
    setPenerima(d);
    add({ from: "user", kind: "text", text: `${d.nama} · ${d.hp}${mode === "antar" ? `\n${d.alamat}` : ""}${d.catatan ? `\nCatatan: ${d.catatan}` : ""}` });
    setStage("summary");
    await botSay({ kind: "summary", produk, mode, penerima: d }, 600);
  }

  // ---------- Alur: pembayaran ----------
  async function pilihPembayaran() {
    setStage("metode");
    add({ from: "user", kind: "text", text: "Pilih pembayaran" });
    await botSay({ kind: "text", text: "Mau bayar pakai apa?" }, 400);
  }

  const totalBayar = produk ? hitungTotal(produk, mode).grand : 0;

  async function pilihMetode(m: "qris" | "va" | "ewallet" | "cod") {
    if (m === "qris") {
      setMetode("QRIS");
      add({ from: "user", kind: "text", text: "Bayar pakai QRIS" });
      setStage("paying");
      await botSay({ kind: "qris", total: totalBayar }, 500);
    } else if (m === "va") {
      add({ from: "user", kind: "text", text: "Transfer Bank (Virtual Account)" });
      setStage("bank");
      await botSay({ kind: "text", text: "Pilih banknya:" }, 300);
    } else if (m === "ewallet") {
      add({ from: "user", kind: "text", text: "E-wallet" });
      setStage("wallet");
      await botSay({ kind: "text", text: "Pilih e-wallet-nya:" }, 300);
    } else {
      const label = mode === "antar" ? "Bayar di tempat (COD)" : "Bayar di toko";
      setMetode(label);
      add({ from: "user", kind: "text", text: label });
      await buatPesanan(label, true);
    }
  }

  async function pilihBank(b: string) {
    setMetode(`Transfer ${b} (VA)`);
    add({ from: "user", kind: "text", text: `Transfer ${b}` });
    setStage("paying");
    await botSay(
      {
        kind: "tagihan",
        judul: `Virtual Account ${b}`,
        total: totalBayar,
        rows: [
          { label: "Bank", value: b },
          { label: "Nomor VA", value: nomorVa(b), testId: "va-nomor" },
          { label: "Atas nama", value: "ZETA via DOKU (demo)" },
          { label: "Batas bayar", value: "24 jam" },
        ],
        catatan: "Nomor VA ini demo, bukan rekening sungguhan.",
      },
      500,
    );
  }

  async function pilihWallet(w: string) {
    setMetode(w);
    add({ from: "user", kind: "text", text: `Bayar pakai ${w}` });
    setStage("paying");
    await botSay(
      {
        kind: "tagihan",
        judul: `Bayar lewat ${w}`,
        total: totalBayar,
        rows: [
          { label: "Aplikasi", value: w },
          { label: "Nomor tagihan", value: `INV-${acakDigit(8)}`, testId: "tagihan-nomor" },
          { label: "Batas bayar", value: "15 menit" },
        ],
        catatan: `Buka aplikasi ${w}, lalu konfirmasi tagihan ini. (Demo, bukan pembayaran sungguhan.)`,
      },
      500,
    );
  }

  async function simulasiBayar() {
    add({ from: "user", kind: "text", text: "Sudah bayar" });
    await buatPesanan(metode, false);
  }

  async function buatPesanan(metodeLabel: string, cod: boolean) {
    if (!produk || !penerima) return;
    setStage("done");
    const kode = `ZT-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!cod) await botSay({ kind: "text", text: "Pembayaran diterima ✅ (simulasi)" }, 500);
    const info =
      mode === "ambil"
        ? `Pesanan ${kode} akan disiapkan di ${produk.toko}, ${produk.alamat}. Tunjukkan kode ini ke kasir saat mengambil.`
        : `Pesanan ${kode} diteruskan ke ${produk.toko} dan akan diantar ke alamat ${penerima.nama}. Kamu bisa melacaknya di peta.`;
    await botSay(
      {
        kind: "text",
        text: cod ? `Pesanan dibuat. Siapkan uang pas ${rupiah(totalBayar)} saat ${mode === "antar" ? "paket tiba" : "mengambil di toko"}.\n${info}` : info,
      },
      600,
    );
    lastIdx.current = 0;
    setBukti(null);
    setOrder({ kode, produk, mode, mulai: Date.now(), penerima, metode: metodeLabel, cod });
    await botSay({ kind: "tracking", kode }, 400);
  }

  /** Simpan foto bukti penerimaan. Mengembalikan pesan error, atau null jika berhasil. */
  function simpanBukti(file: File, nama: string, hubungan: string): string | null {
    const err = validasiFile(file);
    if (err) return err;
    if (nama.trim().length < 2) return "Isi nama penerima (minimal 2 huruf).";
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    const b: Bukti = { url, penerima: nama.trim(), hubungan, jam: jam() };
    setBukti(b);
    add({ from: "bot", kind: "bukti", ...b, mode: order?.mode ?? "antar" });
    return null;
  }

  function ulang() {
    setStage("idle");
    setProduk(null);
    setPenerima(null);
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
            <div className="font-semibold leading-tight">ZETA AI</div>
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
              {renderMsg(m, stage, { pilih, toko: lihatToko }, { order, tick, buka: () => setShowTrack(true) })}
            </Bubble>
          ))}
          {typing && (
            <Bubble from="bot">
              <span className="text-[#667781]">• • •</span>
            </Bubble>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Form alamat */}
        {stage === "alamat" && <FormPenerima mode={mode} onSubmit={kirimPenerima} />}

        {/* Balasan cepat */}
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto px-3 pb-2">
          {stage === "choosing" && (
            <>
              <span className="w-full text-[11px] font-semibold text-[#667781]">Ganti kategori (opsional), atau tekan "Pilih" di produk:</span>
              {KATEGORI.map((k) => (
                <Chip key={k} onClick={() => void ubahKategori(k)} testId={`kat-${k.toLowerCase()}`} aktif={kategoriAktif === k}>
                  {k}
                </Chip>
              ))}
              <Chip onClick={() => void ubahKategori(null)} testId="kat-semua" aktif={kategoriAktif === null}>
                Semua
              </Chip>
            </>
          )}
          {stage === "mode" && (
            <>
              <Chip onClick={() => pilihMode("ambil")} testId="qr-ambil">🏪 Ambil di toko</Chip>
              <Chip onClick={() => pilihMode("antar")} testId="qr-antar">🛵 Antar ke rumah</Chip>
            </>
          )}
          {stage === "summary" && <Chip onClick={pilihPembayaran} testId="btn-pilih-bayar">💳 Pilih pembayaran</Chip>}
          {stage === "metode" && (
            <>
              <Chip onClick={() => pilihMetode("qris")} testId="pay-qris">QRIS</Chip>
              <Chip onClick={() => pilihMetode("va")} testId="pay-va">🏦 Transfer Bank (VA)</Chip>
              <Chip onClick={() => pilihMetode("ewallet")} testId="pay-ewallet">📱 E-wallet</Chip>
              <Chip onClick={() => pilihMetode("cod")} testId="pay-cod">
                {mode === "antar" ? "💵 Bayar di tempat (COD)" : "💵 Bayar di toko"}
              </Chip>
            </>
          )}
          {stage === "bank" && BANK.map((b) => (
            <Chip key={b} onClick={() => pilihBank(b)} testId={`bank-${b.toLowerCase()}`}>{b}</Chip>
          ))}
          {stage === "wallet" && WALLET.map((w) => (
            <Chip key={w} onClick={() => pilihWallet(w)} testId={`wallet-${w.toLowerCase()}`}>{w}</Chip>
          ))}
          {(stage === "bank" || stage === "wallet") && (
            <Chip onClick={() => setStage("metode")} testId="btn-ganti-metode">← Ganti metode</Chip>
          )}
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
        <TrackingScreen order={order} tick={tick} bukti={bukti} onBukti={simpanBukti} onClose={() => setShowTrack(false)} onSkip={lewatiKeAkhir} />
      )}
    </main>
  );
}

function FormPenerima({ mode, onSubmit }: { mode: Mode; onSubmit: (d: Penerima) => void }) {
  const [d, setD] = React.useState<Penerima>({ nama: "", hp: "", alamat: "", catatan: "" });
  const [err, setErr] = React.useState<Partial<Record<keyof Penerima, string>>>({});
  const set = (k: keyof Penerima) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD((prev) => ({ ...prev, [k]: e.target.value }));
  const kelas = "mt-1 w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm";
  const merah = (k: keyof Penerima) => (err[k] ? `${kelas} !border-[#9d2f2f]` : kelas);
  return (
    <div className="max-h-[48vh] space-y-2 overflow-y-auto border-t border-[#d1d7db] bg-white px-3 py-3" data-testid="alamat-form">
      <div className="text-sm font-semibold">{mode === "antar" ? "Alamat pengiriman" : "Data pengambil"}</div>
      <label className="block text-xs">
        {mode === "antar" ? "Nama penerima" : "Nama pengambil"}
        <input value={d.nama} onChange={set("nama")} data-testid="in-nama" className={merah("nama")} />
        {err.nama && <span role="alert" data-testid="err-nama" className="text-[#9d2f2f]">{err.nama}</span>}
      </label>
      <label className="block text-xs">
        Nomor HP
        <input value={d.hp} onChange={set("hp")} inputMode="tel" data-testid="in-hp" className={merah("hp")} />
        {err.hp && <span role="alert" data-testid="err-hp" className="text-[#9d2f2f]">{err.hp}</span>}
      </label>
      {mode === "antar" && (
        <label className="block text-xs">
          Alamat lengkap
          <textarea value={d.alamat} onChange={set("alamat")} rows={2} data-testid="in-alamat" className={merah("alamat")} />
          {err.alamat && <span role="alert" data-testid="err-alamat" className="text-[#9d2f2f]">{err.alamat}</span>}
        </label>
      )}
      <label className="block text-xs">
        Catatan (opsional)
        <input value={d.catatan} onChange={set("catatan")} placeholder="Misal: pagar hijau, titip satpam" data-testid="in-catatan" className={kelas} />
      </label>
      {Object.keys(err).length > 0 && (
        <p role="alert" data-testid="err-ringkas" className="rounded-md bg-[#fdecec] px-3 py-2 text-xs font-semibold text-[#9d2f2f]">
          Ada isian yang belum benar. Cek kolom yang bertanda merah di atas.
        </p>
      )}
      <button
        type="button"
        data-testid="btn-submit-alamat"
        onClick={() => {
          const e = validasiPenerima(mode, d);
          setErr(e);
          if (Object.keys(e).length === 0) onSubmit({ ...d, nama: d.nama.trim(), hp: normalisasiHp(d.hp), alamat: d.alamat.trim(), catatan: d.catatan.trim() });
        }}
        className="w-full rounded-md bg-[#075e54] py-2 text-sm font-semibold text-white"
      >
        {mode === "antar" ? "Simpan alamat" : "Simpan"}
      </button>
    </div>
  );
}

type TrackCtx = { order: Order | null; tick: number; buka: () => void };

function renderMsg(
  m: Msg,
  stage: Stage,
  aksi: { pilih: (p: Product) => void; toko: (p: Product) => void },
  track: TrackCtx,
) {
  switch (m.kind) {
    case "text":
      return <p className="whitespace-pre-wrap text-sm">{m.text}</p>;
    case "image":
      return <img src={m.url} alt="Foto produk" className="max-h-56 rounded-md" data-testid="preview" />;
    case "analisis":
      return (
        <div className="space-y-1 text-sm" data-testid="analisis">
          <div className="font-bold">Hasil analisis</div>
          <div>Kategori: <b data-testid="an-kategori">{m.kategori}</b></div>
          <div>Motif: <span data-testid="an-motif">{m.motif}</span></div>
          <div className="flex items-center gap-2">
            Warna: <span data-testid="an-warna">{m.warna}</span>
            {m.rgb && (
              <span
                className="inline-block h-4 w-4 rounded-full border border-black/20"
                style={{ background: `rgb(${m.rgb[0]}, ${m.rgb[1]}, ${m.rgb[2]})` }}
                aria-hidden="true"
              />
            )}
          </div>
          <p className="pt-1 text-[10px] font-semibold text-[#8a5a00]">
            Warna dihitung dari foto. Kategori dan motif masih demo (nanti dari model computer vision).
          </p>
        </div>
      );
    case "products":
      return (
        <div className="space-y-2" data-testid="product-list">
          {m.foto && <img src={m.foto} alt="Foto produk" className="h-28 w-full rounded-md object-cover" />}
          <div className="text-sm font-semibold">Produk mirip{m.kategori ? ` · ${m.kategori}` : ""}</div>
          {m.items.map((p) => (
            <div key={p.id} className="rounded-lg border border-[#e1e5e8] bg-[#f7f8fa] p-3" data-testid={`product-${p.id}`}>
              <div className="text-sm font-semibold">{p.nama}</div>
              <div className="font-bold text-[#075e54]">{rupiah(p.harga)}</div>
              <div className="text-xs text-[#667781]">
                📍 {p.toko} · {p.jarakKm} km · ⭐ {p.rating.toFixed(1)}
              </div>
              <div className="text-[11px] text-[#667781]">
                {p.kategori} · {p.motif} · {p.warna}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => aksi.toko(p)}
                  data-testid={`toko-${p.id}`}
                  className="flex-1 rounded-md border border-[#075e54] py-1.5 text-xs font-semibold text-[#075e54]"
                >
                  Lihat toko
                </button>
                <button
                  type="button"
                  disabled={!BOLEH_PILIH.includes(stage)}
                  onClick={() => aksi.pilih(p)}
                  data-testid={`pilih-${p.id}`}
                  className="flex-1 rounded-md bg-[#075e54] py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Pilih
                </button>
              </div>
            </div>
          ))}
          <p className="text-[10px] font-semibold text-[#8a5a00]">Data demo</p>
        </div>
      );
    case "summary": {
      const t = hitungTotal(m.produk, m.mode);
      return (
        <div className="space-y-1 text-sm" data-testid="ringkasan">
          <div className="font-semibold">Ringkasan pesanan</div>
          <div className="text-xs text-[#667781]" data-testid="ringkasan-alamat">
            {m.mode === "ambil"
              ? `Ambil di ${m.produk.toko}, ${m.produk.alamat}\nPengambil: ${m.penerima.nama} (${m.penerima.hp})`
              : `Diantar dari ${m.produk.toko}\nKe: ${m.penerima.nama} (${m.penerima.hp})\n${m.penerima.alamat}${m.penerima.catatan ? `\nCatatan: ${m.penerima.catatan}` : ""}`}
          </div>
          <Line label={m.produk.nama} value={rupiah(t.subtotal)} testId="subtotal" />
          {m.mode === "antar" && <Line label={`Ongkir (${m.produk.jarakKm} km)`} value={rupiah(t.ongkir)} testId="ongkir" />}
          <Line label={`Biaya layanan (${t.persen}%)`} value={rupiah(t.biaya)} testId="fee" />
          <div className="border-t border-[#e1e5e8] pt-1">
            <Line label="Total bayar" value={rupiah(t.grand)} bold testId="total" />
          </div>
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
    case "tagihan":
      return (
        <div className="space-y-1 text-sm" data-testid="tagihan">
          <div className="font-semibold">{m.judul}</div>
          {m.rows.map((r) => (
            <Line key={r.label} label={r.label} value={r.value} testId={r.testId ?? `tagihan-${r.label.toLowerCase().replace(/\s+/g, "-")}`} />
          ))}
          <div className="border-t border-[#e1e5e8] pt-1">
            <Line label="Total" value={rupiah(m.total)} bold testId="tagihan-total" />
          </div>
          <p className="pt-1 text-[10px] font-semibold text-[#8a5a00]">{m.catatan}</p>
        </div>
      );
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
          <div className="text-xs text-[#667781]">Pembayaran: {o.metode}</div>
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
    case "bukti":
      return (
        <div className="space-y-2 text-sm" data-testid="bukti-chat">
          <div className="font-semibold">📸 {m.mode === "antar" ? "Bukti penerimaan paket" : "Bukti pengambilan pesanan"}</div>
          <img src={m.url} alt="Foto bukti penerimaan" className="max-h-48 rounded-md" />
          <div>
            Diterima oleh <b>{m.penerima}</b> ({m.hubungan}) pukul {m.jam}
          </div>
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

function Chip({ children, onClick, testId, aktif }: { children: React.ReactNode; onClick: () => void; testId: string; aktif?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`rounded-full border border-[#075e54] px-4 py-1.5 text-sm font-semibold hover:bg-[#e7f5f2] ${aktif ? "bg-[#075e54] text-white hover:bg-[#075e54]" : "bg-white text-[#075e54]"}`}
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

function TrackingScreen({
  order,
  tick,
  bukti,
  onBukti,
  onClose,
  onSkip,
}: {
  order: Order;
  tick: number;
  bukti: Bukti | null;
  onBukti: (file: File, nama: string, hubungan: string) => string | null;
  onClose: () => void;
  onSkip: () => void;
}) {
  const { produk, mode, kode, mulai, penerima, metode } = order;
  const st = statusTracking(mode, tick, produk.jarakKm);
  const langkah = langkahUntuk(mode);
  const aktif = langkah[st.idx];
  const opsi = mode === "antar" ? HUBUNGAN_ANTAR : HUBUNGAN_AMBIL;
  const [nama, setNama] = React.useState(penerima.nama);
  const [hubungan, setHubungan] = React.useState(opsi[0]);
  const [errBukti, setErrBukti] = React.useState<string | null>(null);
  const fileBukti = React.useRef<HTMLInputElement>(null);

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
            <div className="mt-3 space-y-0.5 border-t border-[#e1e5e8] pt-3 text-xs text-[#667781]" data-testid="tracking-alamat">
              <div className="font-semibold text-[#172033]">{mode === "antar" ? "Dikirim ke" : "Pengambil"}</div>
              <div>{penerima.nama} · {penerima.hp}</div>
              {mode === "antar" && <div>{penerima.alamat}</div>}
              <div>Pembayaran: {metode}</div>
            </div>
          </div>

          {st.selesai && (
            <div className="mx-3 mb-3 rounded-lg bg-white p-4 shadow-sm" data-testid="bukti-card">
              <div className="mb-2 text-sm font-semibold">
                {mode === "antar" ? "Bukti penerimaan paket" : "Bukti pengambilan pesanan"}
              </div>
              {bukti ? (
                <div className="space-y-2 text-sm" data-testid="bukti-info">
                  <img src={bukti.url} alt="Foto bukti penerimaan" className="max-h-48 w-full rounded-md object-cover" data-testid="bukti-foto" />
                  <div>
                    Diterima oleh <b>{bukti.penerima}</b> ({bukti.hubungan}) pukul {bukti.jam}
                  </div>
                  <div className="text-[10px] font-semibold text-[#8a5a00]">Bukti tersimpan (demo, hanya di browser ini).</div>
                </div>
              ) : (
                <div className="space-y-2" data-testid="bukti-form">
                  <p className="text-xs text-[#667781]">
                    Isi nama yang menerima, lalu ambil foto saat paket diterima sebagai bukti.
                  </p>
                  <label className="block text-xs">
                    Diterima oleh
                    <input
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      data-testid="bukti-nama"
                      className="mt-1 w-full rounded-md border border-[#cdd6e3] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs">
                    Hubungan dengan pemesan
                    <select
                      value={hubungan}
                      onChange={(e) => setHubungan(e.target.value)}
                      data-testid="bukti-hubungan"
                      className="mt-1 w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm"
                    >
                      {opsi.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    ref={fileBukti}
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    className="hidden"
                    data-testid="bukti-file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) setErrBukti(onBukti(f, nama, hubungan));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileBukti.current?.click()}
                    data-testid="bukti-ambil"
                    className="w-full rounded-md bg-[#075e54] py-2 text-sm font-semibold text-white"
                  >
                    📸 Ambil / unggah foto
                  </button>
                  {errBukti && (
                    <p role="alert" data-testid="bukti-error" className="text-xs text-[#9d2f2f]">
                      {errBukti}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mx-3 mb-3 rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold">Riwayat perjalanan</div>
            <ol className="space-y-0">
              {langkah.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => {
                const sampai = i <= st.idx;
                const sekarang = i === st.idx;
                const terakhir = i === langkah.length - 1;
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
                      {sampai && terakhir && bukti && (
                        <div className="text-xs font-semibold text-[#075e54]">
                          Diterima oleh {bukti.penerima} ({bukti.hubungan}), bukti foto terlampir.
                        </div>
                      )}
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
