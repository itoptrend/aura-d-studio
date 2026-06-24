// รัน: npx tsx prisma/fix-models.ts
// ลบโมเดลที่ใช้ไม่ได้ออกจากระบบ และ upsert โมเดลที่ถูกต้อง

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// โมเดลที่ต้องปิดการใช้งาน (ไม่มีอยู่จริงใน AI Studio API)
const DEACTIVATE = [
  'imagen-3.0-generate-002',           // Vertex AI only — ไม่ใช่ AI Studio
  'gemini-2.0-flash-preview-image-generation', // deprecated ต.ค. 2025
  'gemini-2.5-flash-image-preview',    // deprecated ต.ค. 2025
];

// โมเดลที่ถูกต้องสำหรับสร้างภาพผ่าน AI Studio
const CORRECT_IMAGE_MODELS = [
  {
    providerCode: 'google',
    modelCode: 'gemini-2.5-flash-image',
    displayName: 'Nano Banana — สร้างภาพเร็ว (รองรับทุก aspect ratio)',
    capability: 'image',
    isActive: true
  },
  {
    providerCode: 'google',
    modelCode: 'gemini-3.1-flash-image',
    displayName: 'Nano Banana 2 — สร้างภาพ HD คุณภาพสูงขึ้น',
    capability: 'image',
    isActive: true
  },
  {
    providerCode: 'google',
    modelCode: 'gemini-3-pro-image',
    displayName: 'Nano Banana Pro — คุณภาพสูงสุด 4K รองรับข้อความในภาพ',
    capability: 'image',
    isActive: true
  }
];

async function main() {
  console.log('🔧 แก้ไขโมเดลสร้างภาพ...\n');

  // ปิดโมเดลเก่าที่ใช้ไม่ได้
  for (const modelCode of DEACTIVATE) {
    const result = await prisma.aiModel.updateMany({
      where: { modelCode },
      data: { isActive: false }
    });
    if (result.count > 0) {
      console.log(`❌ ปิด: ${modelCode} (${result.count} รายการ)`);
    }
  }

  // upsert โมเดลที่ถูกต้อง
  for (const m of CORRECT_IMAGE_MODELS) {
    await prisma.aiModel.upsert({
      where: { providerCode_modelCode: { providerCode: m.providerCode, modelCode: m.modelCode } },
      update: { displayName: m.displayName, capability: m.capability, isActive: true },
      create: m
    });
    console.log(`✅ พร้อมใช้: ${m.displayName}`);
  }

  console.log('\nเสร็จแล้ว — รีเฟรชหน้าสร้างภาพ แล้วเลือก "Nano Banana" ครับ');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
