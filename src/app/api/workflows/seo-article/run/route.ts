import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { decryptSecret } from '@/lib/encryption';
import { generateText, estimateCreditCost, AnthropicApiError } from '@/lib/ai/anthropic';
import { generateTextGemini } from '@/lib/ai/google';
import { generateTextGrok } from '@/lib/ai/grok';

const runSchema = z.object({
  topic: z.string().min(3, 'กรอกหัวข้อบทความอย่างน้อย 3 ตัวอักษร'),
  keyword: z.string().min(1, 'กรอกคีย์เวิร์ดหลัก'),
  credentialId: z.string().uuid(),
  modelCode: z.string().min(1)
});

type GenerateParams = {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
};

// AI Gateway — routes each request to the correct provider function.
// Adding a new provider = add one entry here (spec §5.5 Provider-Agnostic).
async function callAI(
  providerCode: string,
  params: GenerateParams
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  switch (providerCode) {
    case 'anthropic':
      return generateText(params);
    case 'google':
      return generateTextGemini(params);
    case 'xai':
      return generateTextGrok(params);
    default:
      throw new Error(`ยังไม่รองรับ provider "${providerCode}" ในโมดูลนี้`);
  }
}

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { topic, keyword, credentialId, modelCode } = parsed.data;

  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, teamId },
    include: { provider: true }
  });
  if (!credential) {
    return NextResponse.json({ error: 'ไม่พบ AI ที่เลือก ลองเชื่อมต่อใหม่ที่หน้า Connected AI' }, { status: 404 });
  }

  const model = await prisma.aiModel.findUnique({
    where: { providerCode_modelCode: { providerCode: credential.providerCode, modelCode } }
  });
  if (!model) {
    return NextResponse.json({ error: 'ไม่พบโมเดลที่เลือก' }, { status: 404 });
  }

  const workflow = await prisma.workflow.create({
    data: { teamId, name: `บทความ SEO: ${topic}`, category: 'seo_article' }
  });
  const run = await prisma.run.create({
    data: { workflowId: workflow.id, status: 'running', startedAt: new Date() }
  });
  const nodeExecution = await prisma.nodeExecution.create({
    data: {
      runId: run.id,
      taskName: 'เขียนบทความ SEO',
      status: 'running',
      credentialId: credential.id,
      resolvedModelId: model.id,
      inputJson: { topic, keyword },
      startedAt: new Date()
    }
  });

  try {
    const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);

    const system = [
      'คุณเป็นนักเขียนคอนเทนต์ SEO ภาษาไทยมืออาชีพ',
      `เขียนบทความให้เน้นคีย์เวิร์ดหลัก "${keyword}" อย่างเป็นธรรมชาติ ไม่ยัดคีย์เวิร์ดจนอ่านไม่ลื่น`,
      'จัดโครงสร้างด้วย Heading ชัดเจน (H1 หนึ่งอัน, H2 หลายอัน) ความยาวรวมประมาณ 600-900 คำ',
      'ตอบเป็นข้อความธรรมดา (plain text) เท่านั้น ห้ามใส่ HTML tag เช่น <h1> <p> <strong> ลงในคำตอบเด็ดขาด',
      'ใช้บรรทัดว่างแบ่งหัวข้อ และนำหน้าหัวข้อด้วย ## แทน HTML tag'
    ].join(' ');

    const result = await callAI(credential.providerCode, {
      apiKey,
      model: modelCode,
      system,
      prompt: `เขียนบทความ SEO หัวข้อ: ${topic}`,
      maxTokens: 2048
    });

    const costCredit = estimateCreditCost(result.outputTokens);

    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: {
        status: 'succeeded',
        outputJson: { text: result.text, inputTokens: result.inputTokens, outputTokens: result.outputTokens },
        costCredit,
        finishedAt: new Date()
      }
    });
    await prisma.run.update({
      where: { id: run.id },
      data: { status: 'succeeded', finishedAt: new Date() }
    });

    const asset = await prisma.asset.create({
      data: {
        teamId,
        type: 'document',
        title: topic,
        contentText: result.text,
        sourceNodeExecutionId: nodeExecution.id,
        sourceRunId: run.id
      }
    });

    return NextResponse.json({ assetId: asset.id, text: result.text, costCredit });

  } catch (err) {
    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
        finishedAt: new Date()
      }
    });
    await prisma.run.update({
      where: { id: run.id },
      data: { status: 'failed', finishedAt: new Date() }
    });

    if (err instanceof AnthropicApiError && err.status === 401) {
      return NextResponse.json({ error: 'API key ไม่ถูกต้องหรือถูกเพิกถอน ลองเชื่อมต่อใหม่' }, { status: 422 });
    }
    if (err instanceof AnthropicApiError && err.status === 429) {
      return NextResponse.json({ error: 'ใช้ครบโควต้าของ key นี้แล้ว ลองอีกครั้งภายหลังหรือสลับ AI' }, { status: 429 });
    }
    const msg = err instanceof Error ? err.message : 'สร้างบทความไม่สำเร็จ';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
