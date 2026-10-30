# TangHai Design System Guidelines (Minimal Clean Edition)

## 1. Design Principles
- **Privacy-First Clarity:** นำเสนอข้อมูลการเงินที่ซับซ้อนให้เข้าใจง่าย ตรงไปตรงมา และไม่ดึงดูดสายตาด้วยสีฉูดฉาดเกินไป
- **Minimal Clean Palette:** ใช้โทนสี Zinc Neutral เป็นหลัก เพื่อให้ข้อมูลตัวเลขเด่นชัดที่สุด
- **Responsive & Touch-Friendly:** รองรับการใช้งานราบรื่นทั้ง Desktop ตารางรายละเอียด และ Mobile Bottom Tab Bar

## 2. Color Palette
- **Backgrounds:** Body `#f8fafc` (`bg-slate-50`), Cards `#ffffff`, Elevated `#fafafa` (`bg-zinc-50`)
- **Text & Borders:**
  - Headings/Primary Text: `#0f172a` (`text-zinc-900`)
  - Body/Secondary Text: `#52525b` (`text-zinc-600`) / `#71717a` (`text-zinc-500`)
  - Borders: `#e4e4e7` (`border-zinc-200`)
- **Brand & Action Buttons:**
  - Primary Action: `#18181b` (`bg-zinc-900`), Hover `#27272a` (`bg-zinc-800`)
  - Secondary Action: Surface `#ffffff`, Border `#e4e4e7`, Hover `#f4f4f5` (`bg-zinc-100`)
- **Category Semantic Accents:**
  - Food: `#ea580c` (Orange) | Grocery: `#059669` (Emerald) | Transport: `#0284c7` (Sky)
  - Shopping: `#db2777` (Pink) | Health/Edu: `#4f46e5` (Indigo) | Bills: `#2563eb` (Blue)
  - Wallet: `#7c3aed` (Violet) | Cash: `#475569` (Slate) | Self-Transfer: `#64748b` (Zinc-Gray)

## 3. Typography
- **Font Family:** `'Inter'`, `'IBM Plex Sans Thai'`, sans-serif
- **Scale:**
  - Page Title: 18px (`text-lg`), font-semibold
  - Section Header: 16px (`text-base`), font-semibold
  - Card Title / Subhead: 14px (`text-sm`), font-semibold
  - Body & Form Controls: 12px–14px (`text-xs` / `text-sm`)
  - Badges & Microcopy: 10px–11px (`text-[11px]`)

## 4. UI Components & Spacing
- **Border Radius:**
  - Cards & Containers: `rounded-2xl` (16px)
  - Buttons, Inputs, Modals: `rounded-xl` (12px)
  - Badges & Chips: `rounded-lg` (8px) / `rounded-full`
- **Focus States:** `focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2`
