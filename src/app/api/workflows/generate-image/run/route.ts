import { NextResponse } from 'next/server';
import { getAssetExpiry } from '@/lib/retention';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { decryptSecret } from '@/lib/encryption';
import { generateImage } from '@/lib/ai/imagen';

const runSchema = z.object({
  prompt:         z.string().min(3, 'กรอก prompt อย่างน้อย 3 ตัวอักษร'),
  negativePrompt: z.string().optional().default(''),
  style:          z.string().optional().default(''),
  aspectRatio:    z.string().optional().default('1:1'),
  credentialId:   z.string().uuid(),
  modelCode:      z.string().min(1)
});

// Retry with exponential backoff for transient errors (503, 429)
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 3000
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      const isRetryable = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('rate limit');
      if (!isRetryable || attempt === maxAttempts) throw lastError;
      console.log(`Attempt ${attempt} failed (${msg.slice(0, 60)}...) — retrying in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs * attempt)); // progressive delay
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { prompt, negativePrompt, style, aspectRatio, credentialId, modelCode } = parsed.data;

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
      inputJson: { prompt, negativePrompt, style, aspectRatio, finalPrompt },
      startedAt: new Date()
    }
  });

  try {
    const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);

    // Retry up to 3 times for 503/UNAVAILABLE (common with high-demand models like Nano Banana Pro)
    const result = await withRetry(
      () => generateImage(credential.providerCode, { apiKey, model: modelCode, prompt: finalPrompt, negativePrompt, aspectRatio }),
      3,
      3000
    );

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
        sourceRunId: run.id,
        expiresAt: getAssetExpiry()
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
