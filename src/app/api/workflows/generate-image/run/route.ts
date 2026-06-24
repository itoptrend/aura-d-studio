import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { decryptSecret } from '@/lib/encryption';
import { generateImage } from '@/lib/ai/imagen';

const runSchema = z.object({
  prompt:         z.string().min(3, 'กรอก prompt อย่างน้อย 3 ตัวอักษร'),
  negativePrompt: z.string().optional().default(''),
  style:          z.string().optional().default(''),
  credentialId:   z.string().uuid(),
  modelCode:      z.string().min(1)
});

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { prompt, negativePrompt, style, credentialId, modelCode } = parsed.data;

  // Load credential + model
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, teamId },
    include: { provider: true }
  });
  if (!credential) return NextResponse.json({ error: 'ไม่พบ API Key ที่เลือก' }, { status: 404 });

  const model = await prisma.aiModel.findUnique({
    where: { providerCode_modelCode: { providerCode: credential.providerCode, modelCode } }
  });
  if (!model) return NextResponse.json({ error: 'ไม่พบโมเดลที่เลือก' }, { status: 404 });

  // Build final prompt with style if provided
  const finalPrompt = style ? `${prompt}, ${style} style, high quality` : prompt;

  // Create workflow records
  const workflow = await prisma.workflow.create({
    data: { teamId, name: `Image: ${prompt.slice(0, 60)}`, category: 'image_generation' }
  });
  const run = await prisma.run.create({
    data: { workflowId: workflow.id, status: 'running', startedAt: new Date() }
  });
  const nodeExecution = await prisma.nodeExecution.create({
    data: {
      runId: run.id,
      taskName: 'สร้างภาพ AI',
      status: 'running',
      credentialId: credential.id,
      resolvedModelId: model.id,
      inputJson: { prompt, negativePrompt, style, finalPrompt },
      startedAt: new Date()
    }
  });

  try {
    const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);
    const result = await generateImage(credential.providerCode, {
      apiKey,
      model: modelCode,
      prompt: finalPrompt,
      negativePrompt
    });

    // Store image as base64 data URL in contentText (Phase 2 approach)
    // Phase 3: upload to object storage, store URL instead
    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: {
        status: 'succeeded',
        outputJson: { mimeType: result.mimeType, provider: result.provider, model: result.model },
        costCredit: 5, // flat credit cost per image — refine when pricing is known
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
        type: 'image',
        title: prompt.slice(0, 80),
        contentText: result.dataUrl, // base64 data URL
        sourceNodeExecutionId: nodeExecution.id,
        sourceRunId: run.id
      }
    });

    return NextResponse.json({
      assetId: asset.id,
      dataUrl: result.dataUrl,
      mimeType: result.mimeType,
      costCredit: 5
    });

  } catch (err) {
    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        finishedAt: new Date()
      }
    });
    await prisma.run.update({ where: { id: run.id }, data: { status: 'failed', finishedAt: new Date() } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'สร้างภาพไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
