'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist';

interface Credential { id: string; displayName: string; providerCode: string; }
interface Provider { code: string; models: { modelCode: string; displayName: string }[]; }
interface Character { id: string; name: string; avatarEmoji: string; }
interface Skill { id: string; name: string; category: string; }
interface Asset { id: string; title: string; type: string; contentText?: string | null; createdAt: string; }

const AD_TYPES = [
  { code: 'facebook_video',  label: 'Facebook/IG Video Ad', emoji: '📘', description: 'สคริปต์โฆษณาวิดีโอ + visual direction' },
  { code: 'tiktok_video',    label: 'TikTok Video Ad',      emoji: '🎵', description: 'สคริปต์แบบ organic ไม่ดูเป็นโฆษณา' },
  { code: 'youtube_preroll', label: 'YouTube Pre-roll',      emoji: '▶️',  description: 'ดึงดูดใน 5 วินาทีก่อน Skip' },
  { code: 'storyboard',      label: 'Storyboard',            emoji: '🎬', description: 'Shot by shot พร้อม camera + action' },
  { code: 'ad_package',      label: 'Complete Ad Package',   emoji: '📦', description: 'Hook + Script + Storyboard + CTA' },
];

const DURATION_OPTIONS: Record<string, string[]> = {
  facebook_video:  ['15 วินาที', '30 วินาที', '60 วินาที'],
  tiktok_video:    ['15 วินาที', '30 วินาที', '60 วินาที'],
  youtube_preroll: ['6 วินาที (Bumper)', '15 วินาที (Non-skip)', '30 วินาที (Skippable)'],
  storyboard:      ['15 วินาที', '30 วินาที', '60 วินาที'],
  ad_package:      ['15 วินาที', '30 วินาที'],
};

const PLATFORM_OPTIONS = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'LINE'];

export default function VideoAdPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Input mode: 'new' = กรอกใหม่, 'asset' = เลือกจากคลังไฟล์
  
  
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  
  
  
  
  
  
  
  

  
  
  
  

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; costCredit: number; assetId: string } | null>(null);

  // Persist form data across navigation
  const { values: form, setField, clearForm, saveForm, savedAt } = useFormPersist('video', {
    adType: 'facebook_video', platform: '', inputMode: 'new',
    product: '', brand: '', target: '', usp: '', duration: '', extra: '',
    credentialId: '', modelCode: '', characterId: '', skillId: '',
    selectedAssetId: ''
  });
  const { adType, platform, inputMode, product, brand, target, usp, duration, extra,
    credentialId, modelCode, characterId, skillId, selectedAssetId } = form;

  useEffect(() => {
    Promise.all([
      fetch('/api/credentials').then((r) => r.json()),
      fetch('/api/ai-providers?capability=text').then((r) => r.json()),
      fetch('/api/characters').then((r) => r.json()),
      fetch('/api/skills').then((r) => r.json()),
      fetch('/api/assets').then((r) => r.json()),
    ]).then(([cred, prov, char, skill, asset]) => {
      setCredentials(cred.credentials ?? []);
      setProviders(prov.providers ?? []);
      setCharacters(char.characters ?? []);
      setSkills(skill.skills ?? []);
      setAssets((asset.assets ?? []).filter((a: Asset) => a.contentText));
    });
  }, []);

  // When asset is selected, fetch its full content
  async function handleAssetSelect(id: string) {
    setField('selectedAssetId', id);
    setSelectedAsset(null);
    if (!id) return;
    const res = await fetch(`/api/assets/${id}`);
    const data = await res.json();
    setSelectedAsset(data.asset ?? null);
  }

  const selectedCredential = credentials.find((c) => c.id === credentialId);
  const selectedProvider = providers.find((p) => p.code === selectedCredential?.providerCode);
  const currentAdType = AD_TYPES.find((t) => t.code === adType)!;
  const hasInputNew = product || brand || target || usp;
  const hasInputAsset = selectedAsset?.contentText;
  const canSubmit = inputMode === 'new' ? hasInputNew : !!hasInputAsset;

  function handleAdTypeChange(code: string) {
    setField('adType', code);
    setField('duration', '');
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setResult(null);
    setLoading(true);

    // Build the topic/content to send to API
    let topicPayload: Record<string, string> = {};
    if (inputMode === 'asset' && selectedAsset?.contentText) {
      // Use asset content as source — pass as "extra" with context
      topicPayload = {
        product: selectedAsset.title,
        brand: brand,
        target: target,
        usp: '',
        extra: `เนื้อหาต้นฉบับจากคลังไฟล์:\n\n${selectedAsset.contentText}\n\n${extra ? `ข้อมูลเพิ่มเติม: ${extra}` : ''}`
      };
    } else {
      topicPayload = { product, brand, target, usp, extra };
    }

    const res = await fetch('/api/workflows/video-ad/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        adType, platform, duration, ...topicPayload,
        credentialId, modelCode,
        characterId: characterId || undefined,
        skillId: skillId || undefined
      })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'สร้างไม่สำเร็จ'); return; }
    clearForm();
    setResult(data);
  }

  if (credentials.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl mb-3">Video/Ad Pipeline</h1>
        <p className="text-sm text-[#9C9690] mb-4">ยังไม่ได้เชื่อมต่อ AI</p>
        <Link href="/settings/connected-ai" className="text-sm font-semibold text-gold">ไปที่ Connected AI →</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">Video/Ad Pipeline</h1>
          <p className="text-sm text-[#9C9690] mt-1">สร้างสคริปต์โฆษณา Storyboard และชุด Ad ครบวงจร</p>
        </div>
        <div className="flex flex-col items-end gap-1 mt-1 flex-shrink-0">
          <span className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-full px-2.5 py-1">
            Script & Storyboard Phase
          </span>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-[10px] text-[#9C9690]">
                💾 {formatSavedAt(savedAt)}
              </span>
            )}
            {(product || brand || target || usp) && (
              <button onClick={() => { clearForm(); setResult(null); }}
                className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
                ล้างข้อมูล
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ad Type selector */}
      <div className="mt-6 mb-5">
        <label className="block text-xs text-[#9C9690] mb-2">ประเภทโฆษณา</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AD_TYPES.map((t) => (
            <button key={t.code} onClick={() => handleAdTypeChange(t.code)}
              className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                adType === t.code ? 'border-gold bg-gold/10' : 'border-[#2C2A35] hover:border-[#9C9690]'
              }`}>
              <span className="text-2xl flex-shrink-0">{t.emoji}</span>
              <div>
                <p className={`text-sm font-semibold ${adType === t.code ? 'text-gold' : 'text-bone'}`}>{t.label}</p>
                <p className="text-xs text-[#9C9690] mt-0.5">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">

        {/* Input mode toggle */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">แหล่งข้อมูล</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setField('inputMode', 'new'); setResult(null); }}
              className={`flex-1 text-sm py-2.5 rounded-xl border transition-colors font-semibold ${
                inputMode === 'new' ? 'border-gold bg-gold/10 text-gold' : 'border-[#2C2A35] text-[#9C9690]'
              }`}>
              ✏️ กรอกข้อมูลใหม่
            </button>
            <button type="button" onClick={() => { setField('inputMode', 'asset'); setResult(null); }}
              className={`flex-1 text-sm py-2.5 rounded-xl border transition-colors font-semibold ${
                inputMode === 'asset' ? 'border-gold bg-gold/10 text-gold' : 'border-[#2C2A35] text-[#9C9690]'
              }`}>
              📂 เลือกจากคลังไฟล์
            </button>
          </div>
        </div>

        {/* Asset selector mode */}
        {inputMode === 'asset' && (
          <div className="rounded-2xl border border-[#2C2A35] p-4 space-y-3">
            <p className="text-xs text-[#9C9690] font-semibold uppercase tracking-wider">
              เลือกไฟล์จากคลังไฟล์
            </p>
            {assets.length === 0 ? (
              <p className="text-sm text-[#9C9690]">
                ยังไม่มีไฟล์ในคลัง —{' '}
                <Link href="/seo" className="text-gold">ไปสร้างบทความ SEO ก่อน</Link>
              </p>
            ) : (
              <select value={selectedAssetId} onChange={(e) => handleAssetSelect(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">เลือกไฟล์...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} · {new Date(a.createdAt).toLocaleDateString('th-TH')}
                  </option>
                ))}
              </select>
            )}

            {/* Preview selected asset */}
            {selectedAsset?.contentText && (
              <div className="rounded-xl bg-[#15151A] border border-[#2C2A35] p-3">
                <p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1.5">Preview เนื้อหาที่เลือก</p>
                <p className="text-xs text-[#9C9690] leading-relaxed line-clamp-4">
                  {selectedAsset.contentText.slice(0, 300)}
                  {selectedAsset.contentText.length > 300 && '...'}
                </p>
              </div>
            )}

            {/* Optional extra info even when using asset */}
            <div>
              <label className="block text-xs text-[#9C9690] mb-1">
                ข้อมูลเพิ่มเติม <span className="text-[10px] opacity-60">(optional) เช่น แบรนด์ กลุ่มเป้าหมาย โปรโมชัน</span>
              </label>
              <textarea value={extra} onChange={(e) => setField('extra', e.target.value)}
                placeholder="เช่น แบรนด์: Aura Grow | กลุ่ม: ผู้หญิง 25-35 | โปร: ซื้อ 2 แถม 1"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[60px] resize-none" />
            </div>
          </div>
        )}

        {/* Manual input mode */}
        {inputMode === 'new' && (
          <div className="rounded-2xl border border-[#2C2A35] p-4 space-y-3">
            <p className="text-xs text-[#9C9690] font-semibold uppercase tracking-wider">
              ข้อมูลสินค้า/โฆษณา — กรอกอย่างน้อย 1 ช่อง
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9C9690] mb-1">สินค้า <span className="text-[10px] opacity-60">เช่น ครีมกันแดด SPF50</span></label>
                <input value={product} onChange={(e) => setField('product', e.target.value)}
                  placeholder="เช่น ครีมกันแดด SPF50"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[#9C9690] mb-1">แบรนด์ <span className="text-[10px] opacity-60">เช่น Aura Glow</span></label>
                <input value={brand} onChange={(e) => setField('brand', e.target.value)}
                  placeholder="เช่น Aura Glow"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#9C9690] mb-1">กลุ่มเป้าหมาย <span className="text-[10px] opacity-60">เช่น ผู้หญิง 25-35 ปี</span></label>
              <input value={target} onChange={(e) => setField('target', e.target.value)}
                placeholder="เช่น ผู้หญิง 25-35 ปี ชอบดูแลผิว"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#9C9690] mb-1">จุดขาย / USP <span className="text-[10px] opacity-60">เช่น ซึมเร็ว ไม่เหนียว กันน้ำ 8 ชม.</span></label>
              <textarea value={usp} onChange={(e) => setField('usp', e.target.value)}
                placeholder="เช่น ซึมเร็ว ไม่เหนียว กันน้ำ 8 ชั่วโมง ทดสอบแพทย์แล้ว"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[60px] resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9C9690] mb-1">ความยาววิดีโอ</label>
                <select value={duration} onChange={(e) => setField('duration', e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                  <option value="">ไม่ระบุ</option>
                  {(DURATION_OPTIONS[adType] ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {(adType === 'storyboard' || adType === 'ad_package') && (
                <div>
                  <label className="block text-xs text-[#9C9690] mb-1">Platform หลัก</label>
                  <select value={platform} onChange={(e) => setField('platform', e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                    <option value="">ไม่ระบุ</option>
                    {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-[#9C9690] mb-1">รายละเอียดเพิ่มเติม <span className="text-[10px] opacity-60">เช่น สี mood โปรโมชัน</span></label>
              <textarea value={extra} onChange={(e) => setField('extra', e.target.value)}
                placeholder="เช่น สีพาสเทล บรรยากาศสดใส โปรซื้อ 2 แถม 1 ราคา 590 บาท"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[60px] resize-none" />
            </div>
          </div>
        )}

        {/* AI + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
            <select required value={credentialId}
              onChange={(e) => { setField('credentialId', e.target.value); setField('modelCode', ''); }}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">เลือก AI</option>
              {credentials.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
          </div>
          {selectedProvider && (
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
              <select required value={modelCode} onChange={(e) => setField('modelCode', e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">เลือกโมเดล</option>
                {selectedProvider.models.map((m) => (
                  <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Character + Skill */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ตัวละคร <span className="text-[10px] opacity-60">(optional)</span></label>
            <select value={characterId} onChange={(e) => setField('characterId', e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ไม่ใช้ตัวละคร</option>
              {characters.map((c) => <option key={c.id} value={c.id}>{c.avatarEmoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">Skill <span className="text-[10px] opacity-60">(optional)</span></label>
            <select value={skillId} onChange={(e) => setField('skillId', e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ใช้ prompt เริ่มต้น</option>
              {skills.filter((s) => s.category === 'video' || s.category === 'social').map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!canSubmit && inputMode === 'new' && <p className="text-xs text-[#9C9690]">กรอกอย่างน้อย 1 ช่องด้านบน</p>}
        {!canSubmit && inputMode === 'asset' && <p className="text-xs text-[#9C9690]">เลือกไฟล์จากคลังไฟล์ก่อน</p>}
        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={loading || !canSubmit || !credentialId || !modelCode}
            className="flex-1 rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50">
            {loading
              ? `กำลังสร้าง ${currentAdType.emoji}...`
              : `สร้าง ${currentAdType.emoji} ${currentAdType.label}`}
          </button>
          <button type="button" onClick={saveForm}
            className="rounded-xl border border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690] px-4 py-2.5 text-sm flex-shrink-0">
            💾 บันทึก
          </button>
        </div>
        {savedAt && (
          <p className="text-xs text-[#9C9690]">
            บันทึกแล้ว {new Date(savedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </form>

      {/* Result */}
      {result && (
        <div className="mt-10 border-t border-[#2C2A35] pt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl">{currentAdType.emoji} ผลลัพธ์</h2>
            <span className="text-xs text-[#9C9690] font-mono">~{result.costCredit} เครดิต</span>
          </div>
          <article className="whitespace-pre-line text-sm leading-relaxed bg-[#1C1B23] rounded-2xl p-5 border border-[#2C2A35]">
            {result.text}
          </article>
          <div className="flex gap-3 mt-4">
            <Link href={`/assets/${result.assetId}`} className="text-sm font-semibold text-gold">
              ดู Generation Recipe →
            </Link>
            <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text)}`}
              download={`${adType}.txt`}
              className="text-sm font-semibold text-[#9C9690]">
              ดาวน์โหลด .txt
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
