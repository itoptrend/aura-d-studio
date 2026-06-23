import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { decryptSecret } from '@/lib/encryption';
import { generateText, estimateCreditCost } from '@/lib/ai/anthropic';
import { generateTextGemini } from '@/lib/ai/google';
import { generateTextGrok } from '@/lib/ai/grok';

type GenerateParams = { apiKey: string; model: string; system?: string; prompt: string; maxTokens?: number };

async function callAI(providerCode: string, params: GenerateParams) {
  switch (providerCode) {
    case 'anthropic': return generateText(params);
    case 'google':    return generateTextGemini(params);
    case 'xai':       return generateTextGrok(params);
    default: throw new Error(`ยังไม่รองรับ provider "${providerCode}"`);
  }
}

// System prompts per ad type
const SYSTEM_PROMPTS: Record<string, string> = {
  facebook_video: 'คุณเป็น Creative Director ผู้เชี่ยวชาญ Facebook/Instagram Video Ads ภาษาไทย เขียนสคริปต์โฆษณาวิดีโอที่ดึงดูดใจ มีโครงสร้างชัดเจน และกระตุ้นให้ซื้อ',
  tiktok_video:   'คุณเป็น TikTok Ad Creator มืออาชีพไทย เขียนสคริปต์โฆษณา TikTok ที่ดูเป็นธรรมชาติ ไม่ขายของโจ่งแจ้ง แต่กระตุ้นความสนใจและ conversion',
  youtube_preroll:'คุณเป็นผู้เชี่ยวชาญ YouTube Ads ไทย เขียนสคริปต์โฆษณา Pre-roll ที่ดึงดูดใน 5 วินาทีแรก ก่อนที่คนจะกด Skip',
  storyboard:     'คุณเป็น Storyboard Artist และ Creative Director ผู้เชี่ยวชาญโฆษณาไทย เขียน Storyboard แบบละเอียด ระบุทุก Shot อย่างชัดเจน',
  ad_package:     'คุณเป็น Creative Director ผู้เชี่ยวชาญโฆษณาดิจิตอลไทย สร้างชุดโฆษณาครบวงจรที่พร้อมใช้งานจริง'
};

function buildPrompt(adType: string, data: {
  product: string; brand: string; target: string;
  usp: string; duration: string; platform: string; extra: string;
}): string {
  const base = [
    data.product && `สินค้า: ${data.product}`,
    data.brand && `แบรนด์: ${data.brand}`,
    data.target && `กลุ่มเป้าหมาย: ${data.target}`,
    data.usp && `จุดขาย/USP: ${data.usp}`,
    data.extra && `ข้อมูลเพิ่มเติม: ${data.extra}`
  ].filter(Boolean).join(' | ');

  const prompts: Record<string, string> = {
    facebook_video: `สร้างสคริปต์โฆษณาวิดีโอ Facebook/Instagram สำหรับ ${base}
ความยาว: ${data.duration || '15-30 วินาที'}
ประกอบด้วย:
1. Hook (3 วินาทีแรก) — หยุดคนเลื่อนได้ทันที
2. Problem — ระบุปัญหาที่สินค้าแก้ได้
3. Solution — แนะนำสินค้า พร้อม benefit หลัก
4. Social Proof — ความน่าเชื่อถือ
5. CTA — Call to Action ชัดเจน
6. Visual Direction — บอก shot แต่ละช่วง`,

    tiktok_video: `สร้างสคริปต์โฆษณา TikTok สำหรับ ${base}
ความยาว: ${data.duration || '15-30 วินาที'}
สไตล์: ดูเป็น organic content ไม่ใช่โฆษณาโจ่งแจ้ง
ประกอบด้วย:
1. Hook (2 วินาที) — ประโยคหรือ visual ที่หยุดทุกคน
2. Story/เนื้อหา — เล่าแบบ TikTok creator ธรรมชาติ
3. Product Reveal — แสดงสินค้าอย่างเป็นธรรมชาติ
4. CTA — กระตุ้นให้คลิก link in bio หรือ shop now
5. Text Overlay แต่ละช่วง
6. เพลง/Sound ที่แนะนำ`,

    youtube_preroll: `สร้างสคริปต์โฆษณา YouTube Pre-roll สำหรับ ${base}
ความยาว: ${data.duration || '15 วินาที (non-skippable) หรือ 30 วินาที (skippable)'}
ประกอบด้วย:
1. วินาที 0-5: Hook แรงมาก — ก่อน Skip Ads
2. วินาที 5-15: ข้อความหลัก + benefit
3. วินาที 15-30: CTA + Brand recall (ถ้า 30 วินาที)
4. Visual Direction แต่ละ shot
5. Voiceover script
6. Title Card ที่แนะนำ`,

    storyboard: `สร้าง Storyboard โฆษณาวิดีโอสำหรับ ${base}
Platform: ${data.platform || 'Facebook/Instagram'}
ความยาว: ${data.duration || '30 วินาที'}
รูปแบบ Storyboard:
แต่ละ Shot ระบุ:
- Shot #: [เลข]
- Duration: [วินาที]
- Camera: [Wide/Medium/Close-up/Extreme Close-up]
- Visual: [อธิบายภาพที่เห็นในจอ]
- Action: [สิ่งที่เกิดขึ้นในภาพ]
- Voiceover/Dialogue: [คำพูด]
- Music/Sound: [เสียงประกอบ]
- Text Overlay: [ข้อความบนจอ]`,

    ad_package: `สร้างชุดโฆษณาครบวงจรสำหรับ ${base}
Platform: ${data.platform || 'Facebook/Instagram/TikTok'}
ประกอบด้วย:

## 1. HOOK (5 แบบ)
Hook วิดีโอ 5 แบบที่แตกต่างกัน ทดสอบ A/B

## 2. สคริปต์หลัก (30 วินาที)
สคริปต์เต็มพร้อม visual direction

## 3. STORYBOARD สั้น
5-7 shots หลัก

## 4. Caption + Hashtag
สำหรับโพสต์พร้อมสคริปต์วิดีโอ

## 5. CTA หลายแบบ
3 แบบสำหรับ Test`
  };

  return prompts[adType] ?? `สร้างโฆษณาวิดีโอสำหรับ ${base}`;
}

const runSchema = z.object({
  adType:      z.string().min(1),
  platform:    z.string().optional().default(''),
  product:     z.string().optional().default(''),
  brand:       z.string().optional().default(''),
  target:      z.string().optional().default(''),
  usp:         z.string().optional().default(''),
  duration:    z.string().optional().default(''),
  extra:       z.string().optional().default(''),
  credentialId: z.string().uuid(),
  modelCode:   z.string().min(1),
  characterId: z.string().uuid().optional(),
  skillId:     z.string().uuid().optional()
});

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { adType, credentialId, modelCode, characterId, skillId, ...inputData } = parsed.data;

  const credential = await prisma.credential.findFirst({ where: { id: credentialId, teamId }, include: { provider: true } });
  if (!credential) return NextResponse.json({ error: 'ไม่พบ AI ที่เลือก' }, { status: 404 });

  const model = await prisma.aiModel.findUnique({
    where: { providerCode_modelCode: { providerCode: credential.providerCode, modelCode } }
  });
  if (!model) return NextResponse.json({ error: 'ไม่พบโมเดลที่เลือก' }, { status: 404 });

  let system = SYSTEM_PROMPTS[adType] ?? 'คุณเป็น Creative Director มืออาชีพด้านโฆษณาดิจิตอลไทย';

  if (skillId) {
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (skill) system = skill.promptTemplate;
  }
  if (characterId) {
    const character = await prisma.character.findFirst({ where: { id: characterId, teamId } });
    if (character) system += ` เขียนในฐานะ "${character.name}": ${character.personality} น้ำเสียง: ${character.tone}`;
  }

  const prompt = buildPrompt(adType, inputData as Parameters<typeof buildPrompt>[1]);

  const workflow = await prisma.workflow.create({
    data: { teamId, name: `Video Ad: ${adType} — ${inputData.product || inputData.brand}`, category: 'video_ad' }
  });
  const run = await prisma.run.create({ data: { workflowId: workflow.id, status: 'running', startedAt: new Date() } });
  const nodeExecution = await prisma.nodeExecution.create({
    data: { runId: run.id, taskName: `สร้าง ${adType}`, status: 'running',
      credentialId: credential.id, resolvedModelId: model.id,
      inputJson: { adType, ...inputData }, startedAt: new Date() }
  });

  try {
    const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);
    const result = await callAI(credential.providerCode, { apiKey, model: modelCode, system, prompt, maxTokens: 3000 });
    const costCredit = estimateCreditCost(result.outputTokens);

    await prisma.nodeExecution.update({ where: { id: nodeExecution.id },
      data: { status: 'succeeded', outputJson: { text: result.text }, costCredit, finishedAt: new Date() } });
    await prisma.run.update({ where: { id: run.id }, data: { status: 'succeeded', finishedAt: new Date() } });

    const label = { facebook_video:'FB Video', tiktok_video:'TikTok Ad', youtube_preroll:'YT Pre-roll', storyboard:'Storyboard', ad_package:'Ad Package' }[adType] ?? adType;
    const asset = await prisma.asset.create({
      data: { teamId, type: 'document',
        title: `[${label.toUpperCase()}] ${inputData.product || inputData.brand || adType}`,
        contentText: result.text, sourceNodeExecutionId: nodeExecution.id, sourceRunId: run.id }
    });

    return NextResponse.json({ assetId: asset.id, text: result.text, costCredit });
  } catch (err) {
    await prisma.nodeExecution.update({ where: { id: nodeExecution.id },
      data: { status: 'failed', errorMessage: err instanceof Error ? err.message : 'error', finishedAt: new Date() } });
    await prisma.run.update({ where: { id: run.id }, data: { status: 'failed', finishedAt: new Date() } });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'สร้างไม่สำเร็จ' }, { status: 500 });
  }
}
