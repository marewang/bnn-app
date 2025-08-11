# Aplikasi Monitoring ASN (Vite + React)

- Input & tampilkan data ASN (IndexedDB/Dexie)
- Hitung otomatis: Kenaikan Gaji Berikutnya (+2 thn), Kenaikan Pangkat Berikutnya (+4 thn)
- Notifikasi (≤90 hari & terlewat), dikelompokkan per jenis
- Kirim ringkasan ke **Telegram** via serverless function
- Siap deploy ke **Vercel**

## Skrip
```bash
npm ci
npm run dev
npm run build
npm run preview
```

## Deploy ke Vercel
- `vercel.json` sudah menyetel SPA fallback
- Build: `npm run build`, Output: `dist`
