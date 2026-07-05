// src/app/(dashboard)/video-generate/page.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { getSupportedDurations, hasNativeAudio } from '@/lib/videoModelCaps'
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist'

interface Credential {
  id: string; displayName: string; providerCode: string; status: string
}
interface Provider {
  code: string; models: { modelCode: string; displayName: string; capability: string }[]
}
type JobStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed' | 'stalled' | 'cancelled'
interface JobPollResponse {
  id: string; status: JobStatus; progress: number
  blobUrl?: string; assetId?: string; errorMessage?: string; errorCode?: string
  attempts: number; maxAttempts: number
}
interface RecentJob {
  id: string; status: JobStatus; modelCode: string; prompt: string
  assetId: string | null; errorMessage: string | null; createdAt: string
}

const ACTIVE_JOB_KEY = 'video-generate-active-job'  // จำงานที่กำลังทำ ข้ามการสลับหน้า

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', w: 40, h: 23, desc: 'Landscape — YouTube / Banner' },
  { value: '9:16', label: '9:16', w: 23, h: 40, desc: 'Portrait — TikTok / Reels' },
  { value: '1:1',  label: '1:1',  w: 36, h: 36, desc: 'Square — โซเชียลทั่วไป' },
]
const POLL_INTERVAL_MS = 8_000

// Note แสดงใต้ dropdown (ไม่มี warning อีกต่อไป — Veo ใช้ Gemini Key ได้แล้ว)
const PROVIDER_NOTES: Record<string, { color: string; text: string }> = {
  kling: { color: 'text-[#9C9690]', text: '📹 Kling — ความยาวจะแสดงเฉพาะค่าที่โมเดลรองรับ' },
  openrouter: { color: 'text-[#9C9690]', text: '🔀 OpenRouter — ความยาวจะแสดงเฉพาะค่าที่โมเดลที่เลือกรองรับ' },
  xai:   { color: 'text-[#9C9690]', text: '🚀 xAI Grok Imagine Video — text-to-video คุณภาพสูง' },
  google: { color: 'text-emerald-400', text: '✅ Veo 3.1 พร้อมใช้งานผ่าน Gemini API Key' },
}

export default function VideoGeneratePage() {
  const { success, error: toastError, info } = useToast()
  const { values, setField, clearForm, savedAt } = useFormPersist('video-generate-form', {
    prompt: '', negativePrompt: '', aspectRatio: '16:9',
    durationSecs: '8', credentialId: '', modelCode: '',
  })
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [providers,   setProviders]   = useState<Provider[]>([])
  const [jobId,    setJobId]    = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [jobState, setJobState] = useState<JobPollResponse | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/credentials').then(r => r.json()),
      fetch('/api/ai-providers?capability=video').then(r => r.json()),
    ]).then(([credData, provData]) => {
      const allCreds = (credData.credentials ?? []) as Credential[]
      const allProvs = (provData.providers   ?? []) as Provider[]
      setProviders(allProvs)
      const videoCreds = allCreds.filter(
        c => c.status === 'active' && allProvs.some(p => p.code === c.providerCode)
      )
      setCredentials(videoCreds)
      if (videoCreds.length === 1 && !values.credentialId) {
        setField('credentialId', videoCreds[0].id)
      }
    }).catch(() => toastError('โหลด API Keys ล้มเหลว'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCredential = credentials.find(c => c.id === values.credentialId)
  const selectedProvider   = providers.find(p => p.code === selectedCredential?.providerCode)
  const videoModels        = selectedProvider?.models.filter(m => m.capability === 'video') ?? []
  const providerNote       = selectedCredential ? PROVIDER_NOTES[selectedCredential.providerCode] : undefined

  // ความยาวที่เลือกได้ ขึ้นกับโมเดลที่เลือก — แสดงเฉพาะค่าที่ AI ตัวนั้นทำได้จริง
  const durationOptions = getSupportedDurations(
    selectedCredential?.providerCode ?? '',
    values.modelCode
  )

  // ถ้าค่าที่เลือกอยู่ไม่รองรับกับโมเดลใหม่ ให้เด้งไปค่าที่ใกล้ที่สุดอัตโนมัติ
  useEffect(() => {
    const cur = Number(values.durationSecs)
    if (!durationOptions.includes(cur)) {
      const nearest = durationOptions.reduce((best, c) =>
        Math.abs(c - cur) < Math.abs(best - cur) ? c : best, durationOptions[0])
      setField('durationSecs', String(nearest))
    }
  }, [values.modelCode, selectedCredential?.providerCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const startPolling = useCallback((id: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/jobs/${id}`)
        const data: JobPollResponse = await res.json()
        setJobState(data)
        if (data.status === 'succeeded') { stopPolling(); localStorage.removeItem(ACTIVE_JOB_KEY); loadRecentJobs(); success('สร้างวิดีโอสำเร็จแล้ว! 🎉') }
        else if (data.status === 'failed')  { stopPolling(); localStorage.removeItem(ACTIVE_JOB_KEY); loadRecentJobs(); toastError(data.errorMessage ?? 'สร้างวิดีโอไม่สำเร็จ') }
        else if (data.status === 'stalled') { stopPolling(); toastError('งานค้างนานเกินไป — กรุณาลองใหม่') }
      } catch { /* รอรอบหน้า */ }
    }, POLL_INTERVAL_MS)
  }, [stopPolling, success, toastError])

  useEffect(() => () => stopPolling(), [stopPolling])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.prompt.trim()) { toastError('กรุณาใส่ prompt'); return }
    if (!values.credentialId)  { toastError('กรุณาเลือก AI Key'); return }
    if (!values.modelCode)     { toastError('กรุณาเลือกโมเดล'); return }
    setJobId(null); setJobState(null)
    try {
      const res = await fetch('/api/workflows/generate-video/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:         values.prompt.trim(),
          negativePrompt: values.negativePrompt?.trim() || undefined,
          aspectRatio:    values.aspectRatio,
          durationSecs:   Number(values.durationSecs),
          credentialId:   values.credentialId,
          provider:       selectedCredential?.providerCode ?? '',
          modelCode:      values.modelCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toastError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      setJobId(data.jobId)
      localStorage.setItem(ACTIVE_JOB_KEY, data.jobId)
      setJobState({ id: data.jobId, status: 'pending', progress: 0, attempts: 0, maxAttempts: 3 })
      startPolling(data.jobId)
      loadRecentJobs()
      info('ส่งงานสร้างวิดีโอแล้ว — ระบบจะประมวลผลและแจ้งเมื่อเสร็จ (ใช้เวลา 2-8 นาที)')
    } catch { toastError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้') }
  }

  async function handleCancel() {
    if (jobState?.status === 'running') { info('กำลังสร้างวิดีโออยู่ — กรุณารอสักครู่'); return }
    try {
      await fetch('/api/jobs/cancel-all', { method: 'DELETE' })
      stopPolling(); setJobState(null); setJobId(null); clearForm()
      info('ล้างข้อมูลและยกเลิกงานที่รออยู่แล้ว')
    } catch { toastError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้') }
  }

  const loadRecentJobs = useCallback(() => {
    fetch('/api/jobs').then(r => r.json())
      .then(d => setRecentJobs(d.jobs ?? []))
      .catch(() => {})
  }, [])

  // เมื่อเปิดหน้า: โหลดรายการงานล่าสุด + ถ้ามีงานค้างจากรอบก่อน ให้เฝ้าต่ออัตโนมัติ
  useEffect(() => {
    loadRecentJobs()
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_JOB_KEY) : null
    if (savedId && !jobId) {
      fetch(`/api/jobs/${savedId}`).then(r => r.ok ? r.json() : null).then((data: JobPollResponse | null) => {
        if (!data) { localStorage.removeItem(ACTIVE_JOB_KEY); return }
        setJobId(savedId)
        setJobState(data)
        if (data.status === 'pending' || data.status === 'running') startPolling(savedId)
        else localStorage.removeItem(ACTIVE_JOB_KEY)
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isRunning = jobState?.status === 'pending' || jobState?.status === 'running'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">สร้างวิดีโอ AI</h1>
          <p className="text-sm text-[#9C9690] mt-1">Kling AI · xAI Grok · Google Veo 3.1</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-[#9C9690]">💾 {formatSavedAt(savedAt)}</span>}
          {values.prompt && !isRunning && (
            <button onClick={() => { clearForm(); setJobState(null) }}
              className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>

      {credentials.length === 0 && (
        <div className="mt-4 p-4 rounded-2xl border border-[#2C2A35] text-sm text-[#9C9690]">
          ยังไม่มี API Key ที่รองรับการสร้างวิดีโอ —{' '}
          <Link href="/settings/connected-ai" className="text-gold font-semibold">ไปที่ Connected AI →</Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 max-w-xl">
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">
            Prompt — บอกว่าต้องการวิดีโออะไร (แนะนำ English)
          </label>
          <textarea required rows={4} value={values.prompt}
            onChange={e => setField('prompt', e.target.value)}
            disabled={isRunning}
            placeholder="เช่น: a butterfly flying over a flower field, golden morning light, cinematic close-up"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[100px] resize-none disabled:opacity-50" />
          <p className="text-[10px] text-[#9C9690] mt-1">{values.prompt.length} / 2,500 ตัวอักษร</p>
        </div>

        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">
            Negative Prompt <span className="text-[10px] opacity-60">(ไม่บังคับ)</span>
          </label>
          <input value={values.negativePrompt ?? ''}
            onChange={e => setField('negativePrompt', e.target.value)}
            disabled={isRunning}
            placeholder="เช่น: text, logo, blurry, low quality"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-50" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
            <select required value={values.credentialId}
              onChange={e => { setField('credentialId', e.target.value); setField('modelCode', '') }}
              disabled={isRunning}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-50">
              <option value="">เลือก AI</option>
              {credentials.map(c => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
          {selectedProvider && videoModels.length > 0 && (
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
              <select required value={values.modelCode}
                onChange={e => setField('modelCode', e.target.value)}
                disabled={isRunning}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-50">
                <option value="">เลือกโมเดล</option>
                {videoModels.map(m => (
                  <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {providerNote && (
          <p className={`text-xs ${providerNote.color}`}>{providerNote.text}</p>
        )}

        {values.modelCode && (
          hasNativeAudio(selectedCredential?.providerCode ?? '', values.modelCode) ? (
            <p className="text-xs text-emerald-400">
              🔊 โมเดลนี้สร้างเสียงในตัว — ใส่บทพูดในเครื่องหมายคำพูดใน prompt ได้เลย เช่น She says: &quot;ผิวสวยใสใน 7 วัน&quot;
            </p>
          ) : (
            <p className="text-xs text-[#9C9690]">
              🔇 โมเดลนี้ให้ภาพอย่างเดียว — เพิ่มเสียงพูดตรงปากภายหลังได้ที่เมนู <Link href="/lipsync" className="underline text-gold">Lip Sync</Link>
            </p>
          )
        )}

        <div>
          <label className="block text-xs text-[#9C9690] mb-2">สัดส่วนวิดีโอ</label>
          <div className="flex items-end gap-3">
            {ASPECT_RATIOS.map(ar => (
              <button key={ar.value} type="button"
                onClick={() => setField('aspectRatio', ar.value)}
                disabled={isRunning} title={ar.desc}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors disabled:opacity-50 ${
                  values.aspectRatio === ar.value ? 'border-gold bg-gold/10' : 'border-[#2C2A35] hover:border-[#9C9690]'
                }`}>
                <div className={`rounded border-2 ${values.aspectRatio === ar.value ? 'border-gold bg-gold/20' : 'border-[#9C9690]'}`}
                  style={{ width: ar.w, height: ar.h }} />
                <span className={`text-[10px] font-mono font-bold ${values.aspectRatio === ar.value ? 'text-gold' : 'text-[#9C9690]'}`}>
                  {ar.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#9C9690] mt-1.5">
            {ASPECT_RATIOS.find(r => r.value === values.aspectRatio)?.desc ?? ''}
          </p>
        </div>

        <div>
          <label className="block text-xs text-[#9C9690] mb-2">ความยาว</label>
          <div className="flex gap-3">
            {durationOptions.map(d => (
              <button key={d} type="button"
                onClick={() => setField('durationSecs', String(d))}
                disabled={isRunning}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
                  values.durationSecs === String(d)
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
                }`}>
                {d} วินาที
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit"
            disabled={isRunning || !values.prompt.trim() || !values.credentialId || !values.modelCode}
            className="flex-1 rounded-xl bg-gold text-black font-semibold py-2.5 text-sm disabled:opacity-50">
            {isRunning
              ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span>กำลังสร้าง…</span>
              : '🎬 สร้างวิดีโอ'}
          </button>
          <button type="button" onClick={handleCancel}
            className="px-5 rounded-xl border border-[#2C2A35] text-[#9C9690] text-sm hover:border-[#C9716A] hover:text-[#C9716A] transition-colors whitespace-nowrap">
            {isRunning ? '⏸ รออยู่' : '✕ ล้างข้อมูล'}
          </button>
        </div>

        <p className="text-[10px] text-amber-400/70 text-center">
          ⏳ วิดีโอที่สร้างจะเก็บในคลังไฟล์ 7 วัน — กรุณาดาวน์โหลดเก็บไว้ในเครื่องก่อนหมดอายุ
        </p>

        {isRunning && (
          <p className="text-[10px] text-[#9C9690] text-center">
            กำลังประมวลผล — ระบบทำงานทุก 1 นาที คาดว่าเสร็จใน 3-10 นาที
          </p>
        )}
      </form>

      {jobState && (
        <div className="mt-8 max-w-xl border-t border-[#2C2A35] pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#9C9690]">สถานะงาน</span>
            <StatusBadge status={jobState.status} />
          </div>

          {isRunning && (
            <div className="space-y-1">
              <div className="h-1.5 bg-[#2C2A35] rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full transition-all duration-1000"
                  style={{ width: `${jobState.progress}%` }} />
              </div>
              <p className="text-[10px] text-[#9C9690]">
                {jobState.status === 'pending' ? 'รอ Cron ประมวลผล (ทุก 1 นาที)…' : `กำลังสร้างวิดีโอ — ${jobState.progress}%`}
              </p>
            </div>
          )}

          {jobState.status === 'failed' && jobState.errorMessage && (
            <div className="p-3 rounded-xl border border-[#C9716A]/30 bg-[#C9716A]/10">
              <p className="text-sm text-[#C9716A] font-medium">สร้างวิดีโอไม่สำเร็จ</p>
              <p className="text-xs text-[#C9716A]/80 mt-0.5">{jobState.errorMessage}</p>
              {jobState.errorCode === 'content_policy' && (
                <p className="text-xs text-[#9C9690] mt-1">💡 ลอง prompt ภาษา English และหลีกเลี่ยง content ที่อาจถูก filter</p>
              )}
            </div>
          )}

          {jobState.status === 'succeeded' && jobState.blobUrl && (
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden border border-[#2C2A35] bg-[#1C1B23]">
                <video src={jobState.blobUrl} controls autoPlay
                  className="w-full max-h-[480px] object-contain" />
              </div>
              <div className="flex gap-3">
                <a href={jobState.blobUrl} download
                  className="text-sm font-semibold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10">
                  ↓ ดาวน์โหลดวิดีโอ
                </a>
                {jobState.assetId && (
                  <Link href={`/assets/${jobState.assetId}`}
                    className="text-sm font-semibold text-[#9C9690] border border-[#2C2A35] rounded-xl px-4 py-2 hover:border-[#9C9690]">
                    ดู Generation Recipe →
                  </Link>
                )}
              </div>
              <button onClick={() => { setJobState(null); setJobId(null) }}
                className="text-xs text-[#9C9690] underline">
                สร้างวิดีโอใหม่อีกครั้ง
              </button>
            </div>
          )}
        </div>
      )}

      {/* งานล่าสุด — งานประมวลผลฝั่งเซิร์ฟเวอร์ สลับหน้าไปมาได้ ไม่หายไปไหน */}
      {recentJobs.length > 0 && (
        <div className="mt-8 max-w-xl border-t border-[#2C2A35] pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#9C9690]">งานล่าสุดของคุณ</h2>
            <button onClick={loadRecentJobs}
              className="text-xs text-[#9C9690] hover:text-bone px-2 py-1 rounded-lg border border-[#2C2A35] hover:border-[#9C9690]">
              ↻ รีเฟรช
            </button>
          </div>
          <div className="space-y-2">
            {recentJobs.map(j => (
              <div key={j.id} className="flex items-center gap-3 rounded-xl border border-[#2C2A35] px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{j.prompt}</p>
                  <p className="text-[10px] text-[#9C9690] mt-0.5">
                    {new Date(j.createdAt).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{j.modelCode.replace('openrouter/', '')}
                  </p>
                </div>
                <StatusBadge status={j.status} />
                {j.status === 'succeeded' && j.assetId && (
                  <Link href={`/assets/${j.assetId}`} className="text-xs text-gold underline whitespace-nowrap">ดูผล →</Link>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#9C9690] mt-2">
            💡 งานที่กำลังสร้างจะทำงานต่อฝั่งเซิร์ฟเวอร์แม้ปิดหน้านี้ — ผลลัพธ์เข้า<Link href="/assets" className="underline">คลังไฟล์</Link>อัตโนมัติ
          </p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; className: string }> = {
    idle:      { label: '-',             className: 'text-[#9C9690]' },
    pending:   { label: '⏳ รอคิว',      className: 'text-amber-400' },
    running:   { label: '🔄 กำลังสร้าง', className: 'text-blue-400' },
    succeeded: { label: '✓ สำเร็จ',      className: 'text-emerald-400' },
    failed:    { label: '✕ ล้มเหลว',     className: 'text-[#C9716A]' },
    stalled:   { label: '⚠ ค้างอยู่',    className: 'text-orange-400' },
    cancelled: { label: 'ยกเลิกแล้ว',   className: 'text-[#9C9690]' },
  }
  const { label, className } = map[status] ?? map.idle
  return <span className={`text-xs font-medium ${className}`}>{label}</span>
}
