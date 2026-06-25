// src/app/(dashboard)/video-generate/page.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Credential {
  id:           string
  displayName:  string
  providerCode: string
  status:       string
}

interface Provider {
  code:   string
  models: { modelCode: string; displayName: string; capability: string }[]
}

type JobStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed' | 'stalled' | 'cancelled'

interface JobPollResponse {
  id:            string
  status:        JobStatus
  progress:      number
  blobUrl?:      string
  assetId?:      string
  errorMessage?: string
  errorCode?:    string
  attempts:      number
  maxAttempts:   number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', w: 40, h: 23, desc: 'Landscape — YouTube / Banner' },
  { value: '9:16', label: '9:16', w: 23, h: 40, desc: 'Portrait — TikTok / Reels' },
  { value: '1:1',  label: '1:1',  w: 36, h: 36, desc: 'Square — โซเชียลทั่วไป' },
]

const DURATION_OPTIONS = [
  { value: '5', label: '5 วินาที' },
  { value: '8', label: '8 วินาที' },
]

const POLL_INTERVAL_MS = 5_000

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoGeneratePage() {
  const { success, error: toastError, info } = useToast()

  const { values, setField, clearForm, savedAt } = useFormPersist('video-generate-form', {
    prompt:         '',
    negativePrompt: '',
    aspectRatio:    '16:9',
    durationSecs:   '8',
    credentialId:   '',
    modelCode:      '',
  })

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [providers,   setProviders]   = useState<Provider[]>([])

  const [jobId,    setJobId]    = useState<string | null>(null)
  const [jobState, setJobState] = useState<JobPollResponse | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // — Load credentials + video providers
  useEffect(() => {
    Promise.all([
      fetch('/api/credentials').then(r => r.json()),
      fetch('/api/ai-providers?capability=video').then(r => r.json()),
    ]).then(([credData, provData]) => {
      const allCreds = (credData.credentials ?? []) as Credential[]
      const allProvs = (provData.providers   ?? []) as Provider[]
      setProviders(allProvs)
      // กรองเฉพาะ credential ที่ provider รองรับ video
      const videoCreds = allCreds.filter(
        c => c.status === 'active' && allProvs.some(p => p.code === c.providerCode)
      )
      setCredentials(videoCreds)
      if (videoCreds.length === 1 && !values.credentialId) {
        setField('credentialId', videoCreds[0].id)
      }
    }).catch(() => toastError('โหลด API Keys ล้มเหลว'))
  }, [])

  // — หา provider ของ credential ที่เลือก
  const selectedCredential = credentials.find(c => c.id === values.credentialId)
  const selectedProvider   = providers.find(p => p.code === selectedCredential?.providerCode)
  const videoModels        = selectedProvider?.models.filter(m => m.capability === 'video') ?? []

  // — Polling
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
        if (data.status === 'succeeded') { stopPolling(); success('สร้างวิดีโอสำเร็จแล้ว! 🎉') }
        else if (data.status === 'failed')  { stopPolling(); toastError(data.errorMessage ?? 'สร้างวิดีโอไม่สำเร็จ') }
        else if (data.status === 'stalled') { stopPolling(); toastError('งานค้างนานเกินไป — กรุณาลองใหม่') }
      } catch { /* network error — รอรอบหน้า */ }
    }, POLL_INTERVAL_MS)
  }, [stopPolling, success, toastError])

  useEffect(() => () => stopPolling(), [stopPolling])

  // — Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.prompt.trim())   { toastError('กรุณาใส่ prompt'); return }
    if (!values.credentialId)    { toastError('กรุณาเลือก AI Key'); return }
    if (!values.modelCode)       { toastError('กรุณาเลือกโมเดล'); return }

    setJobId(null)
    setJobState(null)

    try {
      const res = await fetch('/api/workflows/generate-video/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:         values.prompt.trim(),
          negativePrompt: values.negativePrompt?.trim() || undefined,
          aspectRatio:    values.aspectRatio,
          durationSecs:   Number(values.durationSecs),
          credentialId:   values.credentialId,
          provider:       selectedCredential?.providerCode ?? 'google',
          modelCode:      values.modelCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toastError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      setJobId(data.jobId)
      setJobState({ id: data.jobId, status: 'pending', progress: 0, attempts: 0, maxAttempts: 3 })
      startPolling(data.jobId)
      info('ส่งงานสร้างวิดีโอแล้ว — กำลังประมวลผล…')
    } catch {
      toastError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    }
  }


  // — Cancel
  async function handleCancel() {
    if (!jobId) return
    if (jobState?.status === 'running') {
      info('กำลังสร้างวิดีโออยู่ กรุณารอสักครู่ — ไม่สามารถยกเลิกได้ในขณะนี้')
      return
    }
    try {
      const res  = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.status === 409 && data.cannotCancel) {
        info('กำลังสร้างวิดีโออยู่ กรุณารอสักครู่')
        return
      }
      if (!res.ok) { toastError(data.error ?? 'ยกเลิกไม่สำเร็จ'); return }
      stopPolling()
      setJobState(prev => prev ? { ...prev, status: 'cancelled' } : null)
      info('ยกเลิกงานแล้ว')
    } catch {
      toastError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    }
  }

  const isRunning = jobState?.status === 'pending' || jobState?.status === 'running'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">สร้างวิดีโอ AI</h1>
          <p className="text-sm text-[#9C9690] mt-1">สร้างวิดีโอด้วย Google Veo 3.1 และ Grok Imagine Video</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-[#9C9690]">💾 {formatSavedAt(savedAt)}</span>}
          {values.prompt && !isRunning && (
            <button
              onClick={() => { clearForm(); setJobState(null) }}
              className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>

      {/* No credentials warning */}
      {credentials.length === 0 && (
        <div className="mt-4 p-4 rounded-2xl border border-[#2C2A35] text-sm text-[#9C9690]">
          ยังไม่มี API Key ที่รองรับการสร้างวิดีโอ — ต้องใช้{' '}
          <strong className="text-bone">Google Gemini</strong> (Veo 3.1) หรือ{' '}
          <strong className="text-bone">xAI Grok</strong> (Grok Imagine Video){' '}
          <Link href="/settings/connected-ai" className="text-gold font-semibold">ไปที่ Connected AI →</Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 max-w-xl">

        {/* Prompt */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">
            Prompt — บอกว่าต้องการวิดีโออะไร
          </label>
          <textarea
            required
            rows={4}
            value={values.prompt}
            onChange={e => setField('prompt', e.target.value)}
            disabled={isRunning}
            placeholder="เช่น: ผีเสื้อบินอยู่เหนือทุ่งดอกไม้ท่ามกลางแสงทองยามเช้า ภาพระยะใกล้ชัดเจน"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[100px] resize-none disabled:opacity-50"
          />
          <p className="text-[10px] text-[#9C9690] mt-1">{values.prompt.length} / 1,000 ตัวอักษร</p>
        </div>

        {/* Negative Prompt */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">
            Negative Prompt <span className="text-[10px] opacity-60">(ไม่บังคับ) — สิ่งที่ไม่ต้องการในวิดีโอ</span>
          </label>
          <input
            value={values.negativePrompt ?? ''}
            onChange={e => setField('negativePrompt', e.target.value)}
            disabled={isRunning}
            placeholder="เช่น: ข้อความ, โลโก้, ภาพเบลอ, คุณภาพต่ำ"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-50"
          />
        </div>

        {/* Aspect Ratio */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">สัดส่วนวิดีโอ</label>
          <div className="flex items-end gap-3">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar.value}
                type="button"
                onClick={() => setField('aspectRatio', ar.value)}
                disabled={isRunning}
                title={ar.desc}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors disabled:opacity-50 ${
                  values.aspectRatio === ar.value
                    ? 'border-gold bg-gold/10'
                    : 'border-[#2C2A35] hover:border-[#9C9690]'
                }`}
              >
                <div
                  className={`rounded border-2 ${values.aspectRatio === ar.value ? 'border-gold bg-gold/20' : 'border-[#9C9690]'}`}
                  style={{ width: ar.w, height: ar.h }}
                />
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

        {/* Duration */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">ความยาว</label>
          <div className="flex gap-3">
            {DURATION_OPTIONS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => setField('durationSecs', d.value)}
                disabled={isRunning}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
                  values.durationSecs === d.value
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI + Model — grid เหมือนหน้า image */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
            <select
              required
              value={values.credentialId}
              onChange={e => {
                setField('credentialId', e.target.value)
                setField('modelCode', '')
              }}
              disabled={isRunning}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-50"
            >
              <option value="">เลือก AI</option>
              {credentials.map(c => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>

          {selectedProvider && videoModels.length > 0 && (
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
              <select
                required
                value={values.modelCode}
                onChange={e => setField('modelCode', e.target.value)}
                disabled={isRunning}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-50"
              >
                <option value="">เลือกโมเดล</option>
                {videoModels.map(m => (
                  <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isRunning || !values.prompt.trim() || !values.credentialId || !values.modelCode}
          className="w-full rounded-xl bg-gold text-black font-semibold py-2.5 text-sm disabled:opacity-50"
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              กำลังสร้างวิดีโอ… (ใช้เวลา 2–4 นาที)
            </span>
          ) : '🎬 สร้างวิดีโอ'}
        </button>

        {/* Cancel button — โผล่เมื่อมี jobState และยังไม่เสร็จ */}
        {jobState && !['succeeded', 'failed', 'cancelled'].includes(jobState.status) && (
          <button
            type="button"
            onClick={handleCancel}
            className="w-full rounded-xl border border-[#C9716A]/50 text-[#C9716A] py-2 text-sm hover:bg-[#C9716A]/10 transition-colors"
          >
            {jobState.status === 'running' ? '⏸ กำลังสร้างอยู่ — ยกเลิกไม่ได้ในขณะนี้' : '✕ ยกเลิกงาน'}
          </button>
        )}

      </form>

      {/* Progress / Result */}
      {jobState && (
        <div className="mt-8 max-w-xl border-t border-[#2C2A35] pt-6 space-y-4">

          <div className="flex items-center justify-between">
            <span className="text-xs text-[#9C9690]">สถานะงาน</span>
            <StatusBadge status={jobState.status} />
          </div>

          {isRunning && (
            <div className="space-y-1">
              <div className="h-1.5 bg-[#2C2A35] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-1000"
                  style={{ width: `${jobState.progress}%` }}
                />
              </div>
              <p className="text-[10px] text-[#9C9690]">
                {jobState.status === 'pending' ? 'รอคิวประมวลผล…' : `กำลังสร้างวิดีโอ — ${jobState.progress}%`}
              </p>
            </div>
          )}

          {jobState.attempts > 1 && isRunning && (
            <p className="text-[10px] text-[#C9716A]">⚠ ลองครั้งที่ {jobState.attempts} / {jobState.maxAttempts}</p>
          )}

          {jobState.status === 'failed' && jobState.errorMessage && (
            <div className="p-3 rounded-xl border border-[#C9716A]/30 bg-[#C9716A]/10">
              <p className="text-sm text-[#C9716A] font-medium">สร้างวิดีโอไม่สำเร็จ</p>
              <p className="text-xs text-[#C9716A]/80 mt-0.5">{jobState.errorMessage}</p>
              {jobState.errorCode === 'content_policy' && (
                <p className="text-xs text-[#9C9690] mt-1">💡 ลอง prompt อื่นที่ไม่มีเนื้อหาที่ถูกจำกัดโดย provider</p>
              )}
            </div>
          )}

          {jobState.status === 'succeeded' && jobState.blobUrl && (
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden border border-[#2C2A35] bg-[#1C1B23]">
                <video
                  src={jobState.blobUrl}
                  controls
                  autoPlay
                  className="w-full max-h-[480px] object-contain"
                />
              </div>
              <div className="flex gap-3">
                <a
                  href={jobState.blobUrl}
                  download
                  className="text-sm font-semibold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10"
                >
                  ↓ ดาวน์โหลดวิดีโอ
                </a>
                {jobState.assetId && (
                  <Link
                    href={`/assets/${jobState.assetId}`}
                    className="text-sm font-semibold text-[#9C9690] border border-[#2C2A35] rounded-xl px-4 py-2 hover:border-[#9C9690]"
                  >
                    ดู Generation Recipe →
                  </Link>
                )}
              </div>
              <button
                onClick={() => { setJobState(null); setJobId(null) }}
                className="text-xs text-[#9C9690] underline"
              >
                สร้างวิดีโอใหม่อีกครั้ง
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; className: string }> = {
    idle:      { label: '-',              className: 'text-[#9C9690]' },
    pending:   { label: '⏳ รอคิว',       className: 'text-amber-400' },
    running:   { label: '🔄 กำลังสร้าง',  className: 'text-blue-400' },
    succeeded: { label: '✓ สำเร็จ',       className: 'text-emerald-400' },
    failed:    { label: '✕ ล้มเหลว',      className: 'text-[#C9716A]' },
    stalled:   { label: '⚠ ค้างอยู่',     className: 'text-orange-400' },
    cancelled: { label: 'ยกเลิกแล้ว',    className: 'text-[#9C9690]' },
  }
  const { label, className } = map[status] ?? map.idle
  return <span className={`text-xs font-medium ${className}`}>{label}</span>
}