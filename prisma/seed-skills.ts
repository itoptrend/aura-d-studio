// รัน: npx tsx prisma/seed-skills.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const officialSkills = [
  // ─── SEO ────────────────────────────────────────────────────────────────────
  { name: 'เขียนบทความ SEO ภาษาไทย', description: 'บทความ SEO คุณภาพสูง 600-900 คำ เน้นคีย์เวิร์ดอย่างเป็นธรรมชาติ มีโครงสร้าง H1/H2', category: 'seo',
    promptTemplate: 'คุณเป็นนักเขียนคอนเทนต์ SEO ภาษาไทยมืออาชีพ เขียนบทความให้เน้นคีย์เวิร์ดหลักอย่างเป็นธรรมชาติ ไม่ยัดคีย์เวิร์ด จัดโครงสร้างด้วย Heading ชัดเจน ความยาว 600-900 คำ ตอบเป็นข้อความธรรมดา ใช้ ## แทน HTML tag', isOfficial: true },
  { name: 'คำอธิบายสินค้า SEO', description: 'คำอธิบายสินค้าที่ติด Google เน้น benefit มากกว่า feature', category: 'seo',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญ SEO สำหรับ e-commerce ไทย เขียนคำอธิบายสินค้าที่ (1) เน้นประโยชน์ผู้ซื้อ (2) ใช้คีย์เวิร์ดอย่างเป็นธรรมชาติ (3) มี CTA ชัดเจน ความยาว 150-300 คำ', isOfficial: true },
  { name: 'บทความรีวิวสินค้า', description: 'รีวิวสินค้าแบบ honest และ SEO-friendly ครอบคลุมข้อดี ข้อเสีย', category: 'seo',
    promptTemplate: 'คุณเป็นนักรีวิวสินค้ามืออาชีพไทยที่เขียน SEO content เขียนรีวิวที่ซื่อสัตย์ ครอบคลุมข้อดี ข้อเสีย ราคา กลุ่มเป้าหมาย มีโครงสร้างชัดเจน ความยาว 500-800 คำ', isOfficial: true },

  // ─── SOCIAL MEDIA ────────────────────────────────────────────────────────────
  { name: 'แคปชั่น Facebook/Instagram', description: 'แคปชั่นโซเชียลน่าสนใจ กระตุ้น engagement พร้อม hashtag', category: 'social',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญ Social Media Marketing ไทย เขียนแคปชั่นที่ (1) ดึงดูดใน 2 บรรทัดแรก (2) เล่าเรื่องหรือให้คุณค่า (3) มี CTA (4) แนะนำ hashtag 5-10 อัน ความยาว 50-150 คำ', isOfficial: true },
  { name: 'โฆษณา Facebook Ads', description: 'copy โฆษณา Facebook ที่แปลง conversion สูง ใช้หลัก AIDA', category: 'social',
    promptTemplate: 'คุณเป็น copywriter มืออาชีพด้าน Facebook Ads ไทย เขียนโฆษณาตามหลัก AIDA (1) พาดหัวดึงดูด (2) เนื้อหาสร้างความต้องการ (3) CTA ชัดเจน รวม 3 versions สั้น/กลาง/ยาว', isOfficial: true },
  { name: 'สคริปต์ Instagram Reels', description: 'สคริปต์วิดีโอ Reels 15-60 วินาที hook แรง จบด้วย CTA', category: 'social',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญ Instagram Reels content ไทย เขียนสคริปต์วิดีโอที่ (1) Hook ใน 3 วินาทีแรกที่หยุดคนเลื่อน (2) เนื้อหา 15-60 วินาที กระชับและน่าสนใจ (3) CTA ท้ายวิดีโอ ระบุ visual/action แต่ละช่วง', isOfficial: true },
  { name: 'สคริปต์ TikTok', description: 'สคริปต์วิดีโอ TikTok hook แรงมาก เหมาะกับคนรุ่นใหม่', category: 'social',
    promptTemplate: 'คุณเป็น TikTok content creator มืออาชีพไทย เขียนสคริปต์วิดีโอที่ (1) Hook ใน 2 วินาทีแรก — ต้องทำให้หยุดเลื่อนทันที (2) เล่าเรื่องหรือสอนอะไรบางอย่างในสไตล์ TikTok — เร็ว กระชับ สนุก (3) CTA ที่กระตุ้นให้ follow/like/share ความยาว 30-60 วินาที ระบุ visual + text overlay แต่ละช่วง', isOfficial: true },
  { name: 'โพสต์ LinkedIn', description: 'โพสต์ LinkedIn แบบ professional สร้าง thought leadership', category: 'social',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญ LinkedIn content ไทย เขียนโพสต์ที่ (1) เริ่มด้วย hook แข็งแกร่ง (2) แชร์ insight หรือ lesson learned (3) กระตุ้นให้เกิด conversation ความยาว 150-300 คำ ใช้ emoji พอเหมาะ', isOfficial: true },
  { name: 'Thread Twitter/X', description: 'เขียน thread ที่คนอยากอ่านต่อ แชร์ความรู้หรือเรื่องราว', category: 'social',
    promptTemplate: 'คุณเป็น Twitter/X content creator มืออาชีพ เขียน thread ที่ (1) Tweet แรกดึงดูดมากพอให้คนคลิก (2) แต่ละ tweet ให้คุณค่าและทำให้อยากอ่านต่อ (3) Tweet สุดท้ายสรุปและมี CTA รวม 5-8 tweets แต่ละ tweet ไม่เกิน 280 ตัวอักษร', isOfficial: true },

  // ─── YOUTUBE ────────────────────────────────────────────────────────────────
  { name: 'สคริปต์วิดีโอ YouTube', description: 'สคริปต์ YouTube ดึงดูดผู้ชม ครบตั้งแต่ hook จนถึง CTA', category: 'video',
    promptTemplate: 'คุณเป็น YouTube scriptwriter มืออาชีพไทย เขียนสคริปต์ที่มี (1) Hook ใน 15 วินาทีแรก (2) เนื้อหาหลักแบ่ง section ชัดเจน (3) transition ระหว่าง section (4) CTA ท้ายคลิป ระบุเวลาคร่าวๆ แต่ละส่วน', isOfficial: true },
  { name: 'Title + Description YouTube SEO', description: 'ชื่อวิดีโอและคำอธิบายที่ติด YouTube Search', category: 'video',
    promptTemplate: 'คุณเป็นผู้เชี่ยวชาญ YouTube SEO ไทย สร้าง (1) ชื่อวิดีโอ 5 ตัวเลือก ที่ดึงดูดและมีคีย์เวิร์ด (2) คำอธิบายวิดีโอ 150-200 คำ ที่มีคีย์เวิร์ดอย่างเป็นธรรมชาติ (3) Tags 10-15 คำ', isOfficial: true },

  // ─── CHARACTER ───────────────────────────────────────────────────────────────
  { name: 'สร้างตัวละครแบรนด์', description: 'สร้าง brand character ที่มีบุคลิกชัดเจน เหมาะกับกลุ่มเป้าหมาย', category: 'character',
    promptTemplate: 'คุณเป็นนักสร้าง Brand Character มืออาชีพ สร้างตัวละครที่มี (1) ชื่อและลักษณะภายนอก (2) บุคลิก นิสัย ค่านิยม (3) น้ำเสียงและวิธีพูด (4) backstory ที่สอดคล้องกับแบรนด์ (5) ตัวอย่างประโยคที่ตัวละครจะพูด', isOfficial: true },
];

async function main() {
  console.log('Seeding Official Skill Library...');
  for (const skill of officialSkills) {
    await prisma.skill.upsert({
      where: { name_category_team: { name: skill.name, category: skill.category, teamId: null } },
      update: { description: skill.description, promptTemplate: skill.promptTemplate },
      create: skill
    });
    console.log(`✓ [${skill.category}] ${skill.name}`);
  }
  console.log(`\nเสร็จแล้ว: ${officialSkills.length} official skills`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
