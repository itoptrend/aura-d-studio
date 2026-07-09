// prisma/add-openrouter-text-models.ts
// เพิ่มโมเดลสายข้อความ (text) ให้ provider OpenRouter
// → ทำให้ Key OpenRouter ตัวเดียวใช้ได้ทั้งสร้างวิดีโอ และงานข้อความ
//   (สร้างรายละเอียดตัวละคร, 🎤 แยกคำพูดเข้าช่อง, ฯลฯ)
//
// วิธีรัน:  npx tsx prisma/add-openrouter-text-models.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TEXT_MODELS = [
  { modelCode: 'openai/gpt-4o-mini',              displayName: 'GPT-4o mini — เร็ว ประหยัด (OpenRouter)' },
  { modelCode: 'anthropic/claude-3.5-haiku',      displayName: 'Claude 3.5 Haiku — ฉลาด คุ้มราคา (OpenRouter)' },
  { modelCode: 'meta-llama/llama-3.3-70b-instruct', displayName: 'Llama 3.3 70B — ถูกมาก (OpenRouter)' },
]

async function main() {
  const provider = await prisma.aiProvider.findUnique({ where: { code: 'openrouter' } })
  if (!provider) {
    console.log('ไม่พบ provider openrouter ในระบบ — ข้าม')
    return
  }

  for (const m of TEXT_MODELS) {
    await prisma.aiModel.upsert({
      where: { providerCode_modelCode: { providerCode: 'openrouter', modelCode: m.modelCode } },
      update: { displayName: m.displayName, capability: 'text', isActive: true },
      create: {
        providerCode: 'openrouter',
        modelCode:    m.modelCode,
        displayName:  m.displayName,
        capability:   'text',
        isActive:     true,
      },
    })
    console.log(`✓ ${m.displayName}`)
  }

  console.log('\nเสร็จแล้ว — รีเฟรชหน้า Character แล้วเลือก OpenRouter จะเห็นโมเดลให้เลือก')
}

main().catch(console.error).finally(() => prisma.$disconnect())
