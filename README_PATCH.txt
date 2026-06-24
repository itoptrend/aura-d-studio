แตก zip แล้วคัดลอกไฟล์ไปวางทับที่ D:\Aura-D-Studio\
(tsconfig.json และ vercel.json วางที่ root โปรเจค)

แก้ build error 3 จุด:
1. tsconfig.json: exclude "prisma/**/*.ts" จาก TypeScript check
   (prisma scripts ไม่ควรถูก check ใน Next.js build)
2. prisma/seed-skills.ts: ใช้ findFirst+update/create แทน upsert
   (Prisma ไม่รองรับ null ใน composite unique where clause)
3. skills/page.tsx: ย้าย SkillCard ออกนอก component function
4. vercel.json: ยืนยัน buildCommand ใช้ "prisma generate && next build"

รัน:
  $env:DATABASE_URL="postgresql://neondb_owner:npg_ZEYd5msyxQ8D@ep-red-sunset-ao5s21w9.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  $env:DIRECT_URL="postgresql://neondb_owner:npg_ZEYd5msyxQ8D@ep-red-sunset-ao5s21w9.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  npx prisma db push

  git add .
  git commit -m "fix build - exclude prisma from tscheck, fix seed-skills null issue"
  git push
