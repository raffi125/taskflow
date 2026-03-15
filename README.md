# TaskFlow — Manajemen Tugas Mahasiswa

Full-stack web app: **HTML/CSS/JS** + **Express.js** + **Neon PostgreSQL**

---

## Struktur Project

```
taskflow/
├── backend/
│   ├── db/
│   │   ├── connection.js     ← Koneksi Neon PostgreSQL
│   │   └── migrate.js        ← Buat tabel di database
│   ├── middleware/
│   │   └── auth.js           ← JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js           ← Register, Login, Logout, Me
│   │   └── tasks.js          ← CRUD tugas + notifikasi
│   ├── server.js             ← Entry point Express
│   ├── package.json
│   └── .env.example          ← Template env variables
│
└── frontend/
    ├── css/
    │   └── style.css         ← Design system lengkap
    ├── js/
    │   ├── api.js            ← API client (fetch wrapper)
    │   └── app.js            ← App logic & DOM rendering
    └── index.html            ← Single-page HTML
```

---

## Cara Setup

### 1. Buat Database di Neon

1. Buka https://console.neon.tech dan buat akun
2. Klik **"New Project"** → beri nama (contoh: `taskflow`)
3. Setelah project dibuat, buka tab **"Connection Details"**
4. Copy **Connection String** format:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Buat file .env dari template
cp .env.example .env
```

Edit file `.env`:
```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=isi_dengan_random_string_panjang_minimal_32_karakter
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5500
```

```bash
# Jalankan migrasi (buat tabel)
npm run migrate

# Jalankan server
npm run dev
```

Server berjalan di: http://localhost:3001

### 3. Jalankan Frontend

Buka folder `frontend/` dengan **Live Server** di VS Code:
- Install extension **Live Server**
- Klik kanan `index.html` → **Open with Live Server**
- Buka: http://localhost:5500

Atau pakai http-server:
```bash
npx http-server frontend -p 5500
```

---

## API Endpoints

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/auth/register` | Daftar akun baru |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout (hapus cookie) |
| `GET`  | `/api/auth/me` | Data user saat ini |

### Tasks
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/tasks` | Ambil semua tugas + stats |
| `GET` | `/api/tasks?filter=high&sort=deadline` | Filter & sort |
| `GET` | `/api/tasks/notifications` | Tugas mendesak (≤3 hari) |
| `POST` | `/api/tasks` | Buat tugas baru |
| `PUT` | `/api/tasks/:id` | Edit tugas |
| `PATCH` | `/api/tasks/:id/toggle` | Toggle selesai/belum |
| `DELETE` | `/api/tasks/:id` | Hapus tugas |

### Query Params `/api/tasks`
- `filter`: `all` | `pending` | `done` | `high` | `medium` | `low`
- `sort`: `deadline` | `priority` | `created`

---

## Skema Database

### Tabel `users`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | SERIAL PK | Auto increment |
| name | VARCHAR(100) | Nama lengkap |
| username | VARCHAR(50) UNIQUE | Username login |
| email | VARCHAR(150) UNIQUE | Email |
| password | VARCHAR(255) | Bcrypt hash |
| created_at | TIMESTAMPTZ | Waktu daftar |
| updated_at | TIMESTAMPTZ | Auto-update trigger |

### Tabel `tasks`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | SERIAL PK | Auto increment |
| user_id | INTEGER FK | Referensi ke users |
| name | VARCHAR(200) | Nama tugas |
| subject | VARCHAR(100) | Mata kuliah |
| priority | VARCHAR(10) | `low` / `medium` / `high` |
| deadline | DATE | Tanggal deadline |
| is_done | BOOLEAN | Status selesai |
| notes | TEXT | Catatan (nullable) |
| created_at | TIMESTAMPTZ | Waktu dibuat |
| updated_at | TIMESTAMPTZ | Auto-update trigger |

---

## Fitur

- ✅ **Register & Login** dengan JWT (httpOnly cookie + Bearer token)
- ✅ **CRUD Tugas** — tambah, edit, hapus, toggle selesai
- ✅ **Prioritas** — Tinggi / Sedang / Rendah
- ✅ **Notifikasi Deadline** — badge & panel untuk tugas ≤3 hari
- ✅ **Filter & Sort** — berdasarkan prioritas, status, deadline
- ✅ **Statistik** — total, pending, selesai, terlambat
- ✅ **Catatan** per tugas
- ✅ **Auto-polling** notifikasi setiap 60 detik
- ✅ **Neon PostgreSQL** dengan index & trigger

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js, Express.js |
| Database | Neon PostgreSQL (serverless) |
| Auth | JWT + bcrypt + httpOnly Cookie |
| ORM | `@neondatabase/serverless` (native SQL) |
