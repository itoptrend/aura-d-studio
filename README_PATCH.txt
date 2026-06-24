แตก zip แล้วคัดลอก src/ ไปวางทับที่ D:\Aura-D-Studio\

2 features ใหม่:

🌟 Character × Content:
- characters/page.tsx: เพิ่มปุ่มลัดใต้แต่ละ Character
  "สร้างเนื้อหาด้วย [ชื่อ]" → ✍️ SEO / 📱 Social / 🎬 Video/Ad
- seo/page.tsx: เพิ่ม Character dropdown
  รองรับ URL param ?characterId=... (กดจาก Character page)
- seo-article/run/route.ts: ส่ง character context ให้ AI

⚡ Quick Duplicate:
- assets/[id]/page.tsx: ปุ่ม "⎘ ก๊อป" ใน Generation Recipe
  กดแล้วไป SEO page พร้อมหัวข้อเดิมกรอกให้อัตโนมัติ

รัน:
  git add .
  git commit -m "add Character x Content shortcuts and Quick Duplicate"
  git push
