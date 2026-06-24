แตก zip แล้วคัดลอก src/ ไปวางทับที่ D:\Aura-D-Studio\

Social Content improvements:
- เพิ่ม Tone selector (6 แบบ): ไม่ระบุ/เป็นกันเอง/มืออาชีพ/สนุกสนาน/โน้มน้าว/อารมณ์สัมผัส
- tone จะถูกใส่ใน prompt อัตโนมัติ
- รองรับ URL param ?characterId= และ ?topic= แล้ว

รัน:
  git add .
  git commit -m "add tone selector to Social Content"
  git push
