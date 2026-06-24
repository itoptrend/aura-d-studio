import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { decryptSecret } from '@/lib/encryption';
import { generateAudio } from '@/lib/ai/tts';

const runSchema = z.object({
  text:        z.string().min(1, 'กรอกข้อความที่ต้องการแปลงเป็นเสียง').max(5000),
  voice:       z.string().optional().default(''),
  speed:       z.number().min(0.25).max(4.0).optional().default(1.0),
  credentialId: z.string().uuid(),
  modelCode:   z.string().min(1)
});

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { text, voice, speed, credentialId, modelCode } = parsed.data;

  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, teamId },
    include: { provider: true }
  });
  if (!credential) return NextResponse.json({ error: 'ไม่พบ API Key ที่เลือก' }, { status: 404 });

  const model = await prisma.aiModel.findUnique({
    where: { providerCode_modelCode: { providerCode: credential.providerCode, modelCode } }
  });
  if (!model) return NextResponse.json({ error: 'ไม่พบโมเดลที่เลือก' }, { status: 404 });

  const workflow = await prisma.workflow.create({
    data: { teamId, name: `TTS: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`, category: 'audio_tts' }
  });
  const run = await prisma.run.create({
    data: { workflowId: workflow.id, status: 'running', startedAt: new Date() }
  });
  const nodeExecution = await prisma.nodeExecution.create({
    data: {
      runId: run.id, taskName: 'สร้างเสียงพากย์',
      status: 'running', credentialId: credential.id, resolvedModelId: model.id,
      inputJson: { text: text.slice(0, 100), voice, modelCode },
      startedAt: new Date()
    }
  });

  try {
    const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);
    const result = await generateAudio(credential.providerCode, {
      apiKey, model: modelCode, text,
      voice: voice || undefined,
      speed
    });

    const costCredit = Math.max(1, Math.round(text.length / 100));

    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: {
        status: 'succeeded',
        outputJson: { mimeType: result.mimeType, voice: result.voiceUsed, duration: result.durationEstimate },
        costCredit,
        finishedAt: new Date()
      }
    });
    await prisma.run.update({ where: { id: run.id }, data: { status: 'succeeded', finishedAt: new Date() } });

    const asset = await prisma.asset.create({
      data: {
        teamId, type: 'audio',
        title: text.slice(0, 80),
        contentText: result.dataUrl, // base64 data URL
        sourceNodeExecutionId: nodeExecution.id,
        sourceRunId: run.id
      }
    });

    return NextResponse.json({
      assetId: asset.id,
      dataUrl: result.dataUrl,
      mimeType: result.mimeType,
      durationEstimate: result.durationEstimate,
      costCredit
    });

  } catch (err) {
    await prisma.nodeExecution.update({
      where: { id: nodeExecution.id },
      data: { status: 'failed', errorMessage: err instanceof Error ? err.message : 'error', finishedAt: new Date() }
    });
    await prisma.run.update({ where: { id: run.id }, data: { status: 'failed', finishedAt: new Date() } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'สร้างเสียงไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
