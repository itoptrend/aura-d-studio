// รัน: npx tsx prisma/seed-skills.ts
// Seeds the Official Skill Library (spec §18.9)
// Skills ที่ Aura-D Studio ดูแลให้ — ผู้ใช้อ่านได้อย่างเดียว ไม่สามารถแก้ไข

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const officialSkills = [
  // ─── SEO ────────────────────────────────────────────────────────────────────
  {
    name: 'เขียนบทความ SEO ภาษาไทย',
    description: 'เขียนบทความ SEO คุณภาพสูง 600-900 คำ เน้นคีย์เวิร์ดอย่างเป็นธรรมชาติ มีโครงสร้าง H1/H2 ชัดเจน',
    category: 'seo',
    promptTemplate: 'คุณเป็นนักเขียนคอนเทนต์ SEO ภาษาไทยมืออาชีพ เขียนบทความให้เน้นคีย์เวิร์ดหลักอย่างเป็นธรรมชาติ ไม่ยัดคีย์เวิร์ดจนอ่านไม่ลื่น จัดโครงสร้างด้วย Heading ชัดเจน ความยาวรวมประมาณ 600-900 คำ ตอบเป็นข้อความธรรมดา ใช้ ## แทน HTML tag',
    isOfficial: true
  },
  {
    name: 'คำอธิบายสินค้า SEO',
    description: 'เขียนคำอธิบายสินค้าที่ติด Google ดึงดูดผู้ซื้อ เน้น benefit มากกว่า feature',
    category: 'seo',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญด้าน SEO สำหรับ e-commerce ภาษาไทย เขียนคำอธิบายสินค้าที่ (1) เน้นประโยชน์ที่ผู้ซื้อได้รับ ไม่ใช่แค่คุณสมบัติ (2) ใช้คีย์เวิร์ดอย่างเป็นธรรมชาติ (3) มี call-to-action ชัดเจน ความยาว 150-300 คำ',
    isOfficial: true
  },
  {
    name: 'บทความรีวิวสินค้า',
    description: 'รีวิวสินค้าแบบ honest และ SEO-friendly ครอบคลุมข้อดี ข้อเสีย และผู้ที่เหมาะ',
    category: 'seo',
    promptTemplate: 'คุณเป็นนักรีวิวสินค้ามืออาชีพภาษาไทยที่เขียน SEO content เขียนรีวิวที่ (1) ซื่อสัตย์และให้ข้อมูลจริง (2) ครอบคลุมข้อดี ข้อเสีย ราคา และกลุ่มเป้าหมาย (3) มีโครงสร้างชัดเจน ความยาว 500-800 คำ',
    isOfficial: true
  },
  // ─── SOCIAL MEDIA ────────────────────────────────────────────────────────────
  {
    name: 'แคปชั่น Facebook/Instagram',
    description: 'เขียนแคปชั่นโซเชียลที่น่าสนใจ กระตุ้นการ engagement พร้อม hashtag',
    category: 'social',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญด้าน Social Media Marketing ภาษาไทย เขียนแคปชั่นที่ (1) ดึงดูดความสนใจใน 2 บรรทัดแรก (2) เล่าเรื่องหรือให้คุณค่า (3) มี call-to-action (4) แนะนำ hashtag ที่เกี่ยวข้อง 5-10 อัน ความยาว 50-150 คำ',
    isOfficial: true
  },
  {
    name: 'โฆษณา Facebook Ads',
    description: 'คัดลอกโฆษณา Facebook ที่แปลง conversion สูง ใช้หลัก AIDA',
    category: 'social',
    promptTemplate: 'คุณเป็น copywriter มืออาชีพที่เชี่ยวชาญ Facebook Ads ภาษาไทย เขียนโฆษณาตามหลัก AIDA (Attention, Interest, Desire, Action) (1) พาดหัวดึงดูด (2) เนื้อหาสร้างความต้องการ (3) CTA ชัดเจน รวม 3 versions สั้น/กลาง/ยาว',
    isOfficial: true
  },
  {
    name: 'โพสต์ LinkedIn',
    description: 'เขียนโพสต์ LinkedIn แบบ professional สร้าง thought leadership',
    category: 'social',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญด้าน LinkedIn content ภาษาไทย เขียนโพสต์ที่ (1) เริ่มด้วย hook ที่แข็งแกร่ง (2) แชร์ insight หรือ lesson learned (3) กระตุ้นให้เกิด conversation ความยาว 150-300 คำ ใช้ emoji อย่างพอเหมาะ',
    isOfficial: true
  },
  // ─── CHARACTER / CREATIVE ────────────────────────────────────────────────────
  {
    name: 'สร้างตัวละครแบรนด์',
    description: 'สร้าง brand character ที่มีบุคลิกชัดเจน เหมาะกับกลุ่มเป้าหมาย',
    category: 'character',
    promptTemplate: 'คุณเป็นนักสร้าง Brand Character มืออาชีพ สร้างตัวละครที่มี (1) ชื่อและลักษณะภายนอก (2) บุคลิก นิสัย และค่านิยม (3) น้ำเสียงและวิธีพูด (4) backstory ที่สอดคล้องกับแบรนด์ (5) ตัวอย่างประโยคที่ตัวละครจะพูด',
    isOfficial: true
  },
  {
    name: 'สคริปต์วิดีโอ YouTube',
    description: 'เขียนสคริปต์ YouTube ที่ดึงดูดผู้ชม ครบตั้งแต่ hook จนถึง CTA',
    category: 'video',
    promptTemplate: 'คุณเป็น YouTube scriptwriter มืออาชีพภาษาไทย เขียนสคริปต์ที่มี (1) Hook ใน 15 วินาทีแรกที่ทำให้คนอยากดูต่อ (2) เนื้อหาหลักแบ่งเป็น section ชัดเจน (3) transition ระหว่าง section (4) CTA ท้ายคลิป ระบุเวลาคร่าวๆ ของแต่ละส่วน',
    isOfficial: true
  }
];

async function main() {
  console.log('Seeding Official Skill Library...');
  let count = 0;
  for (const skill of officialSkills) {
    await prisma.skill.upsert({
      where: {
        // upsert by name+category combination
        name_category: { name: skill.name, category: skill.category }
      },
      update: { description: skill.description, promptTemplate: skill.promptTemplate },
      create: skill
    });
    console.log(`✓ [${skill.category}] ${skill.name}`);
    count++;
  }
  console.log(`\nเสร็จแล้ว: ${count} official skills`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
