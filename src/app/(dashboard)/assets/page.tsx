'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AssetRow {
  id: string;
  type: string;
  title: string;
  isFavorited: boolean;
  createdAt: string;
  hasContent: boolean;
  thumbnail: string | null;
  isAudio: boolean;
  sourceNodeExecution: { costCredit: string } | null;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch (e) {
      console.error('load error', e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggleFavorite(e: React.MouseEvent, id: string, current: boolean) {
    e.stopPropagation();
    e.preventDefault();
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, isFavorited: !current } : a)));
    await fetch(`/api/assets/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isFavorited: !current })
    });
  }

  async function downloadAsset(e: React.MouseEvent, id: string, title: string, type: string) {
    e.stopPropagation();
    e.preventDefault();
    // ดึงเนื้อหาเต็มจาก asset detail
    const res = await fetch(`/api/assets/${id}`);
    const data = await res.json();
    const content: string = data.asset?.contentText;
    if (!content) return;
    const a = document.createElement('a');
    a.href = content;
    if (content.startsWith('data:image')) {
      a.download = `${title}.${content.split(';')[0].split('/')[1] ?? 'png'}`;
    } else if (content.startsWith('data:audio')) {
      a.download = `${title}.${content.includes('wav') ? 'wav' : 'mp3'}`;
    } else {
      a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      a.download = `${title}.txt`;
    }
    a.click();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function enterSelectMode() { setSelectMode(true); setSelected(new Set()); setConfirmDelete(false); }
  function exitSelectMode()  { setSelectMode(false); setSelected(new Set()); setConfirmDelete(false); }
  function toggleSelectAll() {
    setSelected(selected.size === assets.length ? new Set() : new Set(assets.map((a) => a.id)));
  }

  async function handleBulkDelete() {
    if (selected.size === 0 || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/assets/bulk-delete', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) })
      });

      // Safe JSON parse — response อาจไม่ใช่ JSON ถ้า server crash
      let data: { deleted?: number; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ถ้าแปลง JSON ไม่ได้ ให้แสดง HTTP status แทน
        data = { error: `Server error (HTTP ${res.status})` };
      }

      if (res.ok) {
        exitSelectMode();
        await load();
      } else {
        alert(data.error ?? `ลบไม่สำเร็จ (${res.status})`);
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + (err instanceof Error ? err.message : 'network error'));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const TYPE_EMOJI: Record<string, string> = {
    document: '📄', image: '🖼️', audio: '🔊', video: '🎬', storyboard: '🎭'
  };

  if (loading) return <p className="text-sm text-[#9C9690] mt-8">กำลังโหลด...</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-serif text-2xl">คลังไฟล์</h1>
          <p className="text-sm text-[#9C9690] mt-1">
            {assets.length} รายการ
            {selectMode && selected.size > 0 && (
              <span className="text-gold font-semibold ml-2">· เลือกแล้ว {selected.size} รายการ</span>
            )}
          </p>
        </div>
        {assets.length > 0 && !selectMode && (
          <button onClick={enterSelectMode}
            className="text-xs px-3 py-1.5 rounded-xl border border-[#2C2A35] text-[#9C9690] hover:border-red-500/60 hover:text-red-400 flex-shrink-0 mt-1 transition-colors">
            ☑ เลือกเพื่อลบ
          </button>
        )}
      </div>

      {/* Select mode toolbar */}
      {selectMode && (
        <div className="rounded-2xl bg-[#1C1B23] border border-[#2C2A35] px-4 py-3 mb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll}
                className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected.size === assets.length && assets.length > 0
                    ? 'bg-gold border-gold' : 'border-[#9C9690] hover:border-gold'
                }`}>
                {selected.size === assets.length && assets.length > 0 && (
                  <span className="text-black text-[10px] font-bold">✓</span>
                )}
              </button>
              <span className="text-xs text-[#9C9690]">
                {selected.size === assets.length && assets.length > 0 ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exitSelectMode}
                className="text-xs text-[#9C9690] px-3 py-1.5 rounded-xl border border-[#2C2A35] hover:border-[#9C9690]">
                ยกเลิก
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={selected.size === 0}
                className="text-xs font-semibold text-white bg-red-600/70 hover:bg-red-600 rounded-xl px-4 py-1.5 disabled:opacity-40 transition-colors">
                🗑️ ลบ {selected.size > 0 ? `${selected.size} รายการ` : ''}
              </button>
            </div>
          </div>

          {/* Inline confirm — ไม่ใช้ confirm() เพราะ browser อาจ block */}
          {confirmDelete && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-300 mb-3">
                ยืนยันลบ <strong>{selected.size} รายการ</strong>? ไม่สามารถกู้คืนได้
              </p>
              <div className="flex gap-2">
                <button onClick={handleBulkDelete} disabled={deleting}
                  className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-4 py-1.5 disabled:opacity-50 transition-colors">
                  {deleting ? '⏳ กำลังลบ...' : 'ยืนยันลบ'}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-xs text-[#9C9690] px-4 py-1.5 rounded-lg border border-[#2C2A35] hover:border-[#9C9690]">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {assets.length === 0 && (
        <p className="text-sm text-[#9C9690]">
          ยังไม่มีผลงาน —{' '}
          <Link href="/seo" className="text-gold font-semibold">ไปสร้างบทความ SEO ชิ้นแรก</Link>
        </p>
      )}

      <div className="space-y-2">
        {assets.map((a) => (
          <div key={a.id}
            onClick={selectMode ? () => toggleSelect(a.id) : undefined}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
              selectMode
                ? `cursor-pointer ${selected.has(a.id) ? 'border-gold bg-gold/5' : 'border-[#2C2A35] hover:border-[#9C9690]'}`
                : 'border-[#2C2A35]'
            }`}>

            {/* Checkbox */}
            {selectMode && (
              <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                selected.has(a.id) ? 'bg-gold border-gold' : 'border-[#9C9690]'
              }`}>
                {selected.has(a.id) && <span className="text-black text-[10px] font-bold">✓</span>}
              </div>
            )}

            {/* Thumbnail */}
            {a.thumbnail && (
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#1C1B23]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.thumbnail} alt={a.title} className="w-full h-full object-cover" />
              </div>
            )}
            {a.isAudio && !a.thumbnail && (
              <div className="w-10 h-10 rounded-xl bg-[#1C1B23] flex items-center justify-center flex-shrink-0 text-xl">🔊</div>
            )}

            {/* Title + meta */}
            {selectMode ? (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{TYPE_EMOJI[a.type] ?? '📁'} {a.title}</p>
                <p className="text-xs text-[#9C9690] mt-0.5">
                  {a.type} · {new Date(a.createdAt).toLocaleString('th-TH')}
                  {a.sourceNodeExecution && ` · ~${a.sourceNodeExecution.costCredit} เครดิต`}
                </p>
              </div>
            ) : (
              <Link href={`/assets/${a.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{TYPE_EMOJI[a.type] ?? '📁'} {a.title}</p>
                <p className="text-xs text-[#9C9690] mt-0.5">
                  {a.type} · {new Date(a.createdAt).toLocaleString('th-TH')}
                  {a.sourceNodeExecution && ` · ~${a.sourceNodeExecution.costCredit} เครดิต`}
                </p>
              </Link>
            )}

            {/* Actions */}
            {!selectMode && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {a.hasContent && (
                  <button onClick={(e) => downloadAsset(e, a.id, a.title, a.type)}
                    className="text-xs text-[#9C9690] hover:text-bone px-2 py-1 rounded-lg border border-[#2C2A35] hover:border-[#9C9690]"
                    title="ดาวน์โหลด">↓</button>
                )}
                <button onClick={(e) => toggleFavorite(e, a.id, a.isFavorited)}
                  className={`text-lg px-2 ${a.isFavorited ? 'text-red-400' : 'text-[#9C9690]'}`}>
                  {a.isFavorited ? '♥' : '♡'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
