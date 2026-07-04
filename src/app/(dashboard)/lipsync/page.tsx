// src/app/(dashboard)/lipsync/page.tsx
// Lip Sync — เอาวิดีโอที่มีอยู่ + เสียงพูด → Kling ขยับปากตัวละครให้ตรงเสียง
// เหมาะกับพากย์ไทย: สร้างเสียงจากหน้า "สร้างเสียง" (TTS พูดไทยได้) แล้วนำมาซิงค์ที่นี่
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'

interface Credential {
  id: string; displayName: string; providerCode: string; status: string
}
interface AssetOption { id: string; type: string; title: string }
type JobStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed' | 'stalled' | 'cancelled'
interface JobPollResponse {
  id: string; status: JobStatus; progress: number
  blobUrl?: string; assetId?: string; errorMessage?: string
}

const POLL_INTERVAL_MS = 8_000

export default function LipSyncPage() {
  const { success, error: toastError, info } = useToast()

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [videoAssets, setVideoAssets] = useState<AssetOption[]>([])
  const [audioAssets, setAudioAssets] = useState<AssetOption[]>([])

  const [credentialId, setCredentialId] = useState('')
  const [videoSource,  setVideoSource]  = useState<'asset' | 'url'>('asset')
  const [videoAssetId, setVideoAssetId] = useState('')
  const [videoUrl,     setVideoUrl]     = useState('')
  const [audioSource,  setAudioSource]  = useState<'asset' | 'url' | 'text'>('asset')
  const [audioAssetId, setAudioAssetId] = useState('')
  const [audioUrl,     setAudioUrl]     = useState('')
  const [text,         setText]         = useState('')

  const [jobState, setJobState] = useState<JobPollResponse | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/credentials').then(r => r.json()),
      fetch('/api/assets').then(r => r.json()),
    ]).then(([credData, assetData]) => {
      const klingCreds = ((credData.credentials ?? []) as Credential[])
        .filter(c => c.status === 'active' && c.providerCode === 'kling')
      setCredentials(klingCreds)
      if (klingCreds.length === 1) setCredentialId(klingCreds[0].id)

      const assets = (assetData.assets ?? []) as AssetOption[]
      setVideoAssets(assets.filter(a => a.type === 'video'))
      setAudioAssets(assets.filter(a => a.type === 'audio'))
    }).catch(() => toastError('โหลดข้อมูลล้มเหลว'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])
  useEffect(() => stopPolling, [stopPolling])

  const startPolling = useCallback((id: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`)
        if (!res.ok) return
        const data: JobPollResponse = await res.json()
        setJobState(data)
        if (data.status === 'succeeded') { stopPolling(); success('Lip Sync สำเร็จแล้ว! 🎉 ดูผลได้ที่คลังไฟล์') }
        else if (data.status === 'failed' || data.status === 'stalled') {
          stopPolling(); toastError(data.errorMessage ?? 'Lip Sync ไม่สำเร็จ')
        }
      } catch { /* เงียบไว้ poll รอบถัดไป */ }
    }, POLL_INTERVAL_MS)
  }, [stopPolling, success, toastError])

  const isRunning = jobState?.status === 'pending' || jobState?.status === 'running'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isRunning) return

    const body: Record<string, string> = { credentialId }
    if (videoSource === 'asset') body.videoAssetId = videoAssetId
    else body.videoUrl = videoUrl
    if (audioSource === 'asset')     body.audioAssetId = audioAssetId
    else if (audioSource === 'url')  body.audioUrl = audioUrl
    else                             body.text = text

    try {
      const res = await fetch('/api/workflows/lip-sync/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toastError(data.error ?? 'ส่งงานไม่สำเร็จ'); return }
      setJobState({ id: data.jobId, status: 'pending', progress: 0 })
      startPolling(data.jobId)
      info('ส่งงาน Lip Sync แล้ว — ใช้เวลาประมาณ 5-15 นาที ผลลัพธ์จะเข้าคลังไฟล์อัตโนมัติ')
    } catch { toastError('เกิดข้อผิดพลาดในการส่งงาน') }
  }

  const selectCls = 'w-full rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-50'
  const tabCls = (active: boolean) =>
    `text-xs px-3 py-1.5 rounded-xl border transition-colors ${
      active ? 'border-gold bg-gold/10 text-gold font-semibold' : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
    }`

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-2xl">🗣️ Lip Sync</h1>
      <p className="text-sm text-[#9C9690] mt-1 mb-6">
        เอาวิดีโอที่มีอยู่ + เสียงพูด → ขยับปากตัวละครให้ตรงเสียง (พากย์ไทยได้ผ่านโหมดไฟล์เสียง)
      </p>

      {credentials.length === 0 && (
        <p className="text-sm text-amber-400/90 mb-6">
          ⚠ Lip Sync ใช้ API Key ของ Kling AI (official) —{' '}
          <Link href="/settings/connected-ai" className="underline">เพิ่ม Key ที่ Connected AI</Link>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* วิดีโอต้นทาง */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">1) วิดีโอต้นทาง (ต้องเห็นหน้าตัวละครชัด, 2-60 วินาที)</label>
          <div className="flex gap-2 mb-2">
            <button type="button" className={tabCls(videoSource === 'asset')} onClick={() => setVideoSource('asset')}>จากคลังไฟล์</button>
            <button type="button" className={tabCls(videoSource === 'url')}   onClick={() => setVideoSource('url')}>ลิงก์ URL</button>
          </div>
          {videoSource === 'asset' ? (
            <select value={videoAssetId} onChange={e => setVideoAssetId(e.target.value)} disabled={isRunning} className={selectCls}>
              <option value="">เลือกวิดีโอจากคลังไฟล์ ({videoAssets.length} รายการ)</option>
              {videoAssets.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          ) : (
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} disabled={isRunning}
              placeholder="https://... (mp4/mov ≤100MB ลิงก์เข้าถึงได้สาธารณะ)" className={selectCls} />
          )}
        </div>

        {/* เสียง */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">2) เสียงพูด</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            <button type="button" className={tabCls(audioSource === 'asset')} onClick={() => setAudioSource('asset')}>จากหน้า &quot;สร้างเสียง&quot;</button>
            <button type="button" className={tabCls(audioSource === 'url')}   onClick={() => setAudioSource('url')}>ลิงก์ URL</button>
            <button type="button" className={tabCls(audioSource === 'text')}  onClick={() => setAudioSource('text')}>พิมพ์ข้อความ (en/zh)</button>
          </div>
          {audioSource === 'asset' && (
            <>
              <select value={audioAssetId} onChange={e => setAudioAssetId(e.target.value)} disabled={isRunning} className={selectCls}>
                <option value="">เลือกไฟล์เสียงจากคลัง ({audioAssets.length} รายการ)</option>
                {audioAssets.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <p className="text-[10px] text-[#9C9690] mt-1.5">
                💡 พากย์ไทย: สร้างเสียงไทยได้ที่เมนู <Link href="/audio" className="underline text-gold">สร้างเสียง</Link> แล้วกลับมาเลือกที่นี่ (≤5MB / 2-60 วินาที)
              </p>
            </>
          )}
          {audioSource === 'url' && (
            <input value={audioUrl} onChange={e => setAudioUrl(e.target.value)} disabled={isRunning}
              placeholder="https://... (mp3/wav/m4a ≤5MB)" className={selectCls} />
          )}
          {audioSource === 'text' && (
            <>
              <textarea value={text} onChange={e => setText(e.target.value)} disabled={isRunning} maxLength={120} rows={2}
                placeholder='เช่น: "Discover glowing skin in 7 days!" (อังกฤษ/จีนเท่านั้น — Kling อ่านให้เอง)' className={selectCls} />
              <p className="text-[10px] text-[#9C9690] mt-1">{text.length} / 120 · ข้อความไทยยังไม่รองรับในโหมดนี้ — ใช้โหมดไฟล์เสียงแทน</p>
            </>
          )}
        </div>

        {/* Key */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">3) Kling API Key</label>
          <select required value={credentialId} onChange={e => setCredentialId(e.target.value)} disabled={isRunning} className={selectCls}>
            <option value="">เลือก Key</option>
            {credentials.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
        </div>

        <button type="submit"
          disabled={isRunning || !credentialId
            || (videoSource === 'asset' ? !videoAssetId : !videoUrl.trim())
            || (audioSource === 'asset' ? !audioAssetId : audioSource === 'url' ? !audioUrl.trim() : !text.trim())}
          className="w-full rounded-xl bg-gold text-black font-semibold py-2.5 text-sm disabled:opacity-50">
          {isRunning
            ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span>กำลังซิงค์ปาก…</span>
            : '🗣️ เริ่ม Lip Sync'}
        </button>

        <p className="text-[10px] text-amber-400/70 text-center">
          ⏳ ผลลัพธ์เก็บในคลังไฟล์ 7 วัน — กรุณาดาวน์โหลดเก็บไว้ก่อนหมดอายุ · ค่าใช้จ่ายฝั่ง Kling ~ตามความยาวคลิป
        </p>
      </form>

      {jobState && (
        <div className="mt-8 border-t border-[#2C2A35] pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#9C9690]">สถานะงาน</span>
            <span className={`text-xs font-semibold ${
              jobState.status === 'succeeded' ? 'text-emerald-400'
              : jobState.status === 'failed' || jobState.status === 'stalled' ? 'text-red-400'
              : 'text-gold'
            }`}>
              {jobState.status === 'pending' ? '⏳ รอคิว'
                : jobState.status === 'running' ? '🔄 กำลังประมวลผล (5-15 นาที)'
                : jobState.status === 'succeeded' ? '✅ สำเร็จ'
                : jobState.status === 'stalled' ? '⚠ งานค้าง'
                : '✕ ล้มเหลว'}
            </span>
          </div>
          {jobState.status === 'succeeded' && (
            <Link href="/assets" className="block text-center text-sm text-gold underline">เปิดคลังไฟล์เพื่อดูผลลัพธ์ →</Link>
          )}
          {jobState.errorMessage && (
            <p className="text-xs text-red-400">{jobState.errorMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}
