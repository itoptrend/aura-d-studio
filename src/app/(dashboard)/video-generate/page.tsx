// src/app/(dashboard)/video-generate/page.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '@/components/Toast'
import { useFormPersist } from '@/lib/useFormPersist'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Credential {
  id:          string
  displayName: string
  providerCode: string
  status:      string
}

type JobStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed' | 'stalled' | 'cancelled'

interface JobPollResponse {
  id:           string
  status:       JobStatus
  progress:     number
  blobUrl?:     string
  assetId?:     string
  errorMessage?: string
  errorCode?:   string
  attempts:     number
  maxAttempts:  number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', icon: '▬', desc: 'Landscape' },
  { value: '9:16', label: '9:16', icon: '▮', desc: 'Portrait' },
  { value: '1:1',  label: '1:1',  icon: '■', desc: 'Square'    },
]

const DURATION_OPTIONS = [
  { value: 5, label: '5 วินาที' },
  { value: 8, label: '8 วินาที' },
]

const POLL_INTERVAL_MS = 5_000

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoGeneratePage() {
  const { showToast } = useToast()

  // — Form state (persisted)
  const { values, setField, clearForm, savedAt } = useFormPersist('video-generate-form', {
    prompt:         '',
    negativePrompt: '',
    aspectRatio:    '16:9',
    durationSecs:   8,
    credentialId:   '',
  })

  // — Credentials list
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loadingCreds, setLoadingCreds] = useState(true)

  // — Job state
  const [jobId,    setJobId]    = useState<string | null>(null)
  const [jobState, setJobState] = useState<JobPollResponse | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // — Load credentials (Google only for Phase 3)
  useEffect(() => {
    fetch('/api/credentials?providerCode=google')
      .then(r => r.json())
      .then((data: Credential[]) => {
        const active = data.filter(c => c.status === 'active')
        setCredentials(active)
        // auto-select ถ้ามีแค่ตัวเดียว
        if (active.length === 1 && !values.credentialId) {
          setField('credentialId', active[0].id)
        }
      })
      .catch(() => showToast('โหลด API Keys ล้มเหลว', 'error'))
      .finally(() => setLoadingCreds(false))
  }, [])

  // — Polling
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback((id: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/jobs/${id}`)
        const data: JobPollResponse = await res.json()
        setJobState(data)

        if (data.status === 'succeeded') {
          stopPolling()
          showToast('สร้างวิดีโอสำเร็จแล้ว! 🎉', 'success')
        } else if (data.status === 'failed') {
          stopPolling()
          showToast(data.errorMessage ?? 'สร้างวิดีโอไม่สำเร็จ', 'error')
        } else if (data.status === 'stalled') {
          stopPolling()
          showToast('งานค้างนานเกินไป — กรุณาลองใหม่อีกครั้ง', 'error')
        }
      } catch {
        // network error ระหว่าง poll — ไม่หยุด poll, รอรอบหน้า
      }
    }, POLL_INTERVAL_MS)
  }, [stopPolling, showToast])

  useEffect(() => () => stopPolling(), [stopPolling])

  // — Submit
  async function handleSubmit() {
    if (!values.prompt.trim()) {
      showToast('กรุณาใส่ prompt', 'error')
      return
    }
    if (!values.credentialId) {
      showToast('กรุณาเลือก Google API Key', 'error')
      return
    }

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
          durationSecs:   values.durationSecs,
          credentialId:   values.credentialId,
          provider:       'google',
          modelCode:      'veo-3.0-generate-preview',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error ?? 'เกิดข้อผิดพลาด', 'error')
        return
      }

      setJobId(data.jobId)
      setJobState({ id: data.jobId, status: 'pending', progress: 0, attempts: 0, maxAttempts: 3 })
      startPolling(data.jobId)
      showToast('ส่งงานสร้างวิดีโอแล้ว — กำลังประมวลผล…', 'info')
    } catch {
      showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error')
    }
  }

  // — Cancel
  async function handleCancel() {
    if (!jobId) return
    stopPolling()
    // mark cancelled ใน DB (future: DELETE /api/jobs/[id])
    setJobState(prev => prev ? { ...prev, status: 'cancelled' } : null)
    showToast('ยกเลิกงานแล้ว', 'info')
  }

  const isRunning = jobState?.status === 'pending' || jobState?.status === 'running'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          สร้างวิดีโอด้วย AI
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          ขับเคลื่อนด้วย Google Veo 3.1 — ใช้เวลาประมาณ 2–4 นาทีต่อวิดีโอ
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">

        {/* Prompt */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Prompt <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="เช่น: ผีเสื้อบินอยู่เหนือทุ่งดอกไม้ท่ามกลางแสงทองยามเช้า ภาพระยะใกล้ชัดเจน"
            value={values.prompt}
            onChange={e => setField('prompt', e.target.value)}
            disabled={isRunning}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900
                       text-gray-900 dark:text-white px-3 py-2 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-400">{values.prompt.length} / 1,000 ตัวอักษร</p>
        </div>

        {/* Negative Prompt */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Negative Prompt
            <span className="ml-1.5 text-xs font-normal text-gray-400">(ไม่บังคับ)</span>
          </label>
          <textarea
            rows={2}
            placeholder="เช่น: ข้อความ, โลโก้, ภาพเบลอ, คุณภาพต่ำ"
            value={values.negativePrompt ?? ''}
            onChange={e => setField('negativePrompt', e.target.value)}
            disabled={isRunning}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900
                       text-gray-900 dark:text-white px-3 py-2 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">สัดส่วน</label>
          <div className="flex gap-3">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar.value}
                onClick={() => setField('aspectRatio', ar.value)}
                disabled={isRunning}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border text-sm transition-colors
                  ${values.aspectRatio === ar.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  } disabled:opacity-50`}
              >
                <span className="text-xl leading-none">{ar.icon}</span>
                <span className="font-medium">{ar.label}</span>
                <span className="text-xs text-gray-400">{ar.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ความยาว</label>
          <div className="flex gap-3">
            {DURATION_OPTIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setField('durationSecs', d.value)}
                disabled={isRunning}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${values.durationSecs === d.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  } disabled:opacity-50`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Google API Key <span className="text-red-500">*</span>
          </label>
          {loadingCreds ? (
            <div className="h-9 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
          ) : credentials.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              ยังไม่มี Google API Key —{' '}
              <a href="/settings/connected-ai" className="underline font-medium">เพิ่มได้ที่นี่</a>
            </div>
          ) : (
            <select
              value={values.credentialId}
              onChange={e => setField('credentialId', e.target.value)}
              disabled={isRunning}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900
                         text-gray-900 dark:text-white px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">— เลือก API Key —</option>
              {credentials.map(c => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          )}
        </div>

        {/* Auto-save indicator */}
        {savedAt && !isRunning && (
          <p className="text-xs text-gray-400">
            บันทึกอัตโนมัติเมื่อ {new Date(savedAt).toLocaleTimeString('th-TH')}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isRunning || !values.prompt.trim() || !values.credentialId}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700
                       text-white text-sm font-medium transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? 'กำลังสร้าง…' : '✨ สร้างวิดีโอ'}
          </button>
          {!isRunning && (
            <button
              onClick={() => { clearForm(); showToast('ล้างข้อมูลแล้ว', 'info') }}
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700
                         text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ล้าง
            </button>
          )}
          {isRunning && (
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm
                         hover:bg-red-50 transition-colors"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </div>

      {/* Progress / Result card */}
      {jobState && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">สถานะงาน</span>
            <StatusBadge status={jobState.status} />
          </div>

          {/* Progress bar */}
          {(jobState.status === 'pending' || jobState.status === 'running') && (
            <div className="space-y-1.5">
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                  style={{ width: `${jobState.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-right">{jobState.progress}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {jobState.status === 'pending'
                  ? 'รอคิวประมวลผล…'
                  : 'Veo 3.1 กำลังสร้างวิดีโอ — ใช้เวลาประมาณ 2–4 นาที'}
              </p>
            </div>
          )}

          {/* Retry info */}
          {jobState.attempts > 1 && jobState.status === 'running' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ ลองครั้งที่ {jobState.attempts} / {jobState.maxAttempts}
            </p>
          )}

          {/* Error message */}
          {jobState.status === 'failed' && jobState.errorMessage && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">สร้างวิดีโอไม่สำเร็จ</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{jobState.errorMessage}</p>
              {jobState.errorCode === 'content_policy' && (
                <p className="text-xs text-red-500 mt-1">
                  💡 ลอง prompt อื่นที่ไม่มีเนื้อหาที่ถูกจำกัดโดย Google
                </p>
              )}
            </div>
          )}

          {/* Video player */}
          {jobState.status === 'succeeded' && jobState.blobUrl && (
            <div className="space-y-3">
              <video
                src={jobState.blobUrl}
                controls
                autoPlay
                className="w-full rounded-lg bg-black"
                style={{
                  aspectRatio: values.aspectRatio === '9:16' ? '9/16'
                             : values.aspectRatio === '1:1'  ? '1/1'
                             : '16/9',
                  maxHeight: '480px',
                  objectFit: 'contain',
                }}
              />
              <div className="flex gap-3">
                <a
                  href={jobState.blobUrl}
                  download
                  className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                             text-center text-sm text-gray-700 dark:text-gray-300
                             hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ⬇ ดาวน์โหลด
                </a>
                {jobState.assetId && (
                  <a
                    href={`/assets/${jobState.assetId}`}
                    className="flex-1 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950
                               text-center text-sm text-indigo-700 dark:text-indigo-300
                               hover:bg-indigo-100 transition-colors"
                  >
                    ดูใน Asset Library →
                  </a>
                )}
              </div>
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
    idle:      { label: '-',            className: 'bg-gray-100 text-gray-500' },
    pending:   { label: 'รอคิว',        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    running:   { label: 'กำลังสร้าง',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    succeeded: { label: 'สำเร็จ ✓',     className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
    failed:    { label: 'ล้มเหลว',       className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    stalled:   { label: 'ค้างอยู่',      className: 'bg-orange-100 text-orange-700' },
    cancelled: { label: 'ยกเลิกแล้ว',   className: 'bg-gray-100 text-gray-500' },
  }

  const { label, className } = map[status] ?? map.idle

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {status === 'running' && (
        <span className="mr-1.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse inline-block" />
      )}
      {label}
    </span>
  )
}
