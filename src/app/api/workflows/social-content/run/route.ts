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

// Default system prompts per platform + content type
function buildDefaultPrompt(platform: string, contentType: string, topic: string): string {
  const prompts: Record<string, Record<string, string>> = {
    facebook: {
      caption:  `เขียนแคปชั่น Facebook ภาษาไทยสำหรับ: ${topic} ให้น่าสนใจ กระตุ้น engagement มี CTA และแนะนำ hashtag 5 อัน`,
      ads:      `เขียนโฆษณา Facebook Ads ภาษาไทยสำหรับ: ${topic} ตามหลัก AIDA พาดหัว + เนื้อหา + CTA ทำ 3 versions`,
    },
    instagram: {
      caption:  `เขียนแคปชั่น Instagram ภาษาไทยสำหรับ: ${topic} ให้ aesthetic ดึงดูด มี emoji และ hashtag 10-15 อัน`,
      reels:    `เขียนสคริปต์ Instagram Reels ภาษาไทยสำหรับ: ${topic} Hook 3 วินาที + เนื้อหา 30-60 วินาที + CTA`,
    },
    tiktok: {
      script:   `เขียนสคริปต์ TikTok ภาษาไทยสำหรับ: ${topic} Hook 2 วินาที + เนื้อหาเร็วสนุก 30-60 วินาที + CTA กระตุ้น follow`,
      hook:     `เขียน Hook TikTok ภาษาไทย 5 แบบสำหรับ: ${topic} แต่ละแบบต้องหยุดคนเลื่อนได้ใน 2 วินาที`,
    },
    youtube: {
      script:   `เขียนสคริปต์ YouTube ภาษาไทยสำหรับ: ${topic} Hook 15 วินาที + เนื้อหาแบ่ง section + CTA ระบุเวลาแต่ละส่วน`,
      seo:      `สร้าง YouTube SEO สำหรับ: ${topic} ได้แก่ (1) ชื่อวิดีโอ 5 ตัวเลือก (2) คำอธิบาย 150-200 คำ (3) Tags 15 คำ`,
    },
    linkedin: {
      post:     `เขียนโพสต์ LinkedIn ภาษาไทยสำหรับ: ${topic} แบบ professional thought leadership กระตุ้น engagement 150-300 คำ`,
    },
    twitter: {
      tweet:    `เขียน tweet ภาษาไทยสำหรับ: ${topic} กระชับ น่าสนใจ ไม่เกิน 280 ตัวอักษร ทำ 5 versions`,
      thread:   `เขียน Twitter thread ภาษาไทยสำหรับ: ${topic} 5-8 tweets แต่ละ tweet ให้คุณค่า tweet แรกดึงดูดมากพอ`,
    }
  };
  return prompts[platform]?.[contentType] ?? `สร้าง ${contentType} สำหรับ ${platform} เกี่ยวกับ: ${topic}`;
}

const runSchema = z.object({
  platform:    z.string().min(1),   // facebook | instagram | tiktok | youtube | linkedin | twitter
  contentType: z.string().min(1),   // caption | ads | reels | script | seo | post | tweet | thread | hook
  topic:       z.string().min(2, 'กรอกหัวข้อ/สินค้า/เนื้อหาที่ต้องการสร้าง'),
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
  const { platform, contentType, topic, credentialId, modelCode, characterId, skillId } = parsed.data;

  const credential = await prisma.credential.findFirst({ where: { id: credentialId, teamId }, include: { provider: true } });
  if (!credential) return NextResponse.json({ error: 'ไม่พบ AI ที่เลือก' }, { status: 404 });

  const model = await prisma.aiModel.findUnique({
    where: { providerCode_modelCode: { providerCode: credential.providerCode, modelCode } }
  });
  if (!model) return NextResponse.json({ error: 'ไม่พบโมเดลที่เลือก' }, { status: 404 });

  // Build system prompt — priority: skill > character + default > default only
  let systemParts: string[] = [];

  if (skillId) {
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (skill) systemParts.push(skill.promptTemplate);
  } else {
    systemParts.push(`คุณเป็น Social Media content creator มืออาชีพภาษาไทย`);
  }

  if (characterId) {
    const character = await prisma.character.findFirst({ where: { id: characterId, teamId } });
    if (character) {
      systemParts.push(`เขียนในฐานะตัวละคร "${character.name}": บุคลิก — ${character.personality}. น้ำเสียง — ${character.tone}.`);
      if (character.examples) systemParts.push(`ตัวอย่างประโยคที่ตัวละครนี้พูด: ${character.examples}`);
    }
  }

  const system = systemParts.join(' ');
  const prompt = buildDefaultPrompt(platform, contentType, topic);

  // Create workflow records
  const workflow = await prisma.workflow.create({
    data: { teamId, name: `Social: ${platform} ${contentType} — ${topic}`, category: 'social_content' }
  });
  const run = await prisma.run.create({
    data: { workflowId: workflow.id, status: 'running', startedAt: new Date() }
  });
  const nodeExecution = await prisma.nodeExecution.create({
    data: {
      runId: run.id, taskName: `สร้าง ${platform} ${contentType}`,
      status: 'running', credentialId: credential.id, resolvedModelId: model.id,
      inputJson: { platform, contentType, topic, characterId, skillId }, startedAt: new Date()
    }
  });

  try {
    const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);
    const result = await callAI(credential.providerCode, { apiKey, model: modelCode, system, prompt, maxTokens: 2048 });
    const costCredit = estimateCreditCost(result.outputTokens);

    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: { status: 'succeeded', outputJson: { text: result.text }, costCredit, finishedAt: new Date() }
    });
    await prisma.run.update({ where: { id: run.id }, data: { status: 'succeeded', finishedAt: new Date() } });

    const asset = await prisma.asset.create({
      data: {
        teamId, type: 'document',
        title: `[${platform.toUpperCase()}] ${topic}`,
        contentText: result.text,
        sourceNodeExecutionId: nodeExecution.id, sourceRunId: run.id
      }
    });

    return NextResponse.json({ assetId: asset.id, text: result.text, costCredit });
  } catch (err) {
    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: { status: 'failed', errorMessage: err instanceof Error ? err.message : 'error', finishedAt: new Date() }
    });
    await prisma.run.update({ where: { id: run.id }, data: { status: 'failed', finishedAt: new Date() } });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'สร้างคอนเทนต์ไม่สำเร็จ' }, { status: 500 });
  }
}
