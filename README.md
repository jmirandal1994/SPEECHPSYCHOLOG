# HealthOps · Plataforma Digital de Gestión de Servicios de Salud

Stack: **React 18 + Vite + Supabase + Vercel**

---

## 🚀 Deploy rápido (3 pasos)

### 1. Supabase — Ejecutar schema SQL

1. Ve a: https://supabase.com/dashboard/project/irodzmlnddwkjyshcgct/sql/new
2. Copia y ejecuta el contenido completo de `supabase_schema.sql`
3. Ve a **Storage → New bucket** y crea:
   - `documents` (público: ✓)
   - `boletas` (público: ✗)

### 2. GitHub — Subir código

```bash
cd healthops
git init
git add .
git commit -m "feat: initial HealthOps platform"
git remote add origin https://github.com/jmirandal1994/healthops.git
git branch -M main
git push -u origin main
```

### 3. Vercel — Deploy automático

1. Ve a https://vercel.com/new
2. Importa el repo `jmirandal1994/healthops`
3. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL` = `https://irodzmlnddwkjyshcgct.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOi...` (tu anon key)
4. Click **Deploy** ✓

---

## 🗂 Estructura del proyecto

```
src/
├── lib/
│   └── supabase.js          # Cliente Supabase
├── hooks/
│   └── useAuth.jsx          # Contexto de autenticación
├── styles/
│   └── global.css           # Design system completo
├── components/
│   └── layout/
│       └── AppShell.jsx     # Shell con sidebar + routing
└── pages/
    ├── LoginPage.jsx
    ├── admin/
    │   ├── Dashboard.jsx    # Panel principal con KPIs en vivo
    │   ├── Workers.jsx      # CRUD de personal
    │   ├── Shifts.jsx       # Gestión de turnos
    │   ├── Alerts.jsx       # Control de atrasos
    │   ├── Requests.jsx     # Solicitudes del personal
    │   ├── Documents.jsx    # Repositorio con Supabase Storage
    │   ├── Boletas.jsx      # Honorarios y pagos
    │   └── Settings.jsx     # Configuración del sistema
    └── worker/
        ├── WorkerHome.jsx   # Panel trabajador con timer
        ├── WorkerCheckin.jsx # Marcaje GPS
        ├── WorkerShifts.jsx  # Mis turnos
        ├── WorkerRequests.jsx # Enviar solicitudes
        └── WorkerBoletas.jsx  # Subir boletas
```

---

## 👤 Crear primer usuario admin

En Supabase → Authentication → Users → "Add user":
- Email: `admin@healthops.cl`
- Password: (lo que quieras)

Luego en SQL Editor:
```sql
UPDATE public.profiles
SET role = 'admin', full_name = 'Administrador', role_label = 'Administrador del Sistema'
WHERE email = 'admin@healthops.cl';
```

---

## 🗄 Tablas Supabase

| Tabla | Descripción |
|-------|------------|
| `profiles` | Perfiles de usuarios (extiende auth.users) |
| `shifts` | Turnos programados |
| `attendances` | Registros de entrada/salida con GPS |
| `requests` | Solicitudes de inasistencia, reclamos, cambios |
| `boletas` | Boletas de honorarios con archivo adjunto |
| `documents` | Repositorio de documentos |
| `alerts` | Alertas automáticas del sistema |

---

## 🔧 Desarrollo local

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## 📦 Variables de entorno

```env
VITE_SUPABASE_URL=https://irodzmlnddwkjyshcgct.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
