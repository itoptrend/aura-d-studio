แตก zip แล้วคัดลอก src/ ไปวางทับที่ D:\Aura-D-Studio\

Workflow Continuity — ต่อยอดเนื้อหาระหว่างโมดูล:

1. Generation Recipe → ปุ่ม "ต่อยอดจากเนื้อหานี้"
   - 📱 สร้าง Social Content (ใช้หัวข้อเดิม)
   - 🖼️ สร้างภาพประกอบ (ใช้หัวข้อเป็น prompt)
   - 🔊 สร้างเสียงพากย์ (ใช้ 300 ตัวแรกของเนื้อหา)
   - 🎬 สร้าง Video Script (ใช้หัวข้อเดิม)

2. URL Params ทุกหน้ารับค่าได้:
   - social: ?characterId=, ?topic=
   - image: ?prompt=
   - audio: ?text=
   - video: ?characterId=, ?topic=
   (กดจาก Character Engine หรือ Generation Recipe แล้ว pre-fill ทันที)

รัน:
  git add .
  git commit -m "add workflow continuity - continue from any content to next module"
  git push
