'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AssetRow {
  id: string;
  type: string;
  title: string;
  isFavorited: boolean;
  createdAt: string;
  contentText?: string | null;
  sourceNodeExecution: { costCredit: string } | null;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false); // inline confirm state
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/assets');
    const data = await res.json();
    setAssets(data.assets ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleFavorite(id: string, current: boolean) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, isFavorited: !current } : a)));
    await fetch(`/api/assets/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isFavorited: !current })
    });
  }

  function downloadAsset(title: string, content: string, type: string) {
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

  function enterSelectMode() { setSelectMode(true); setSelected(new Set()); setDeleteError(null); }
  function exitSelectMode()  { setSelectMode(false); setSelected(new Set()); setConfirmDelete(false); setDeleteError(null); }

  function toggleSelectAll() {
    setSelected(selected.size === assets.length ? new Set() : new Set(assets.map((a) => a.id)));
  }

  // Step 1: show inline confirm bar
  function requestDelete() {
    if (selected.size === 0) return;
    setConfirmDelete(true);
    setDeleteError(null);
  }

  // Step 2: actually delete
  async function doDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/assets/bulk-delete', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) })
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? 'ลบไม่สำเร็จ กรุณาลองใหม่');
        setDeleting(false);
        setConfirmDelete(false);
        return;
      }
      exitSelectMode();
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const TYPE_EMOJI: Record<string, string> = {
    document: '📄', image: '🖼️', audio: '🔊', video: '🎬', storyboard: '🎭'
  };

  if (loading) return <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>;

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
            🗑️ เลือกเพื่อลบ
          </button>
        )}
      </div>

      {/* Toolbar — select mode */}
      {selectMode && !confirmDelete && (
        <div className="flex items-center justify-between rounded-2xl bg-[#1C1B23] border border-[#2C2A35] px-4 py-3 mb-4 gap-3">
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll}
              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                selected.size === assets.length && assets.length > 0 ? 'bg-gold border-gold' : 'border-[#9C9690] hover:border-gold'
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
            <button onClick={requestDelete} disabled={selected.size === 0}
              className="text-xs font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-xl px-4 py-1.5 disabled:opacity-40 transition-colors">
              🗑️ ลบ {selected.size > 0 ? `${selected.size} รายการ` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Inline confirm dialog */}
      {confirmDelete && (
        <div className="rounded-2xl bg-red-950/40 border border-red-700/50 px-4 py-4 mb-4">
          <p className="text-sm font-semibold text-red-300 mb-1">
            ⚠️ ยืนยันการลบ {selected.size} รายการ?
          </p>
          <p className="text-xs text-[#9C9690] mb-3">ไม่สามารถกู้คืนได้หลังจากลบแล้ว</p>
          {deleteError && <p className="text-xs text-red-400 mb-3">{deleteError}</p>}
          <div className="flex gap-2">
            <button onClick={doDelete} disabled={deleting}
              className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl px-5 py-2 disabled:opacity-50 transition-colors">
              {deleting ? '⏳ กำลังลบ...' : `ยืนยัน — ลบ ${selected.size} รายการ`}
            </button>
            <button onClick={() => setConfirmDelete(false)} disabled={deleting}
              className="text-xs text-[#9C9690] px-4 py-2 rounded-xl border border-[#2C2A35] hover:border-[#9C9690] disabled:opacity-50">
              ยกเลิก
            </button>
          </div>
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

            {/* Image thumbnail */}
            {a.type === 'image' && a.contentText?.startsWith('data:image') && (
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#1C1B23]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.contentText} alt={a.title} className="w-full h-full object-cover" />
              </div>
            )}
            {a.type === 'audio' && (
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
                {a.contentText && (
                  <button onClick={(e) => { e.stopPropagation(); downloadAsset(a.title, a.contentText!, a.type); }}
                    className="text-xs text-[#9C9690] hover:text-bone px-2 py-1 rounded-lg border border-[#2C2A35] hover:border-[#9C9690]"
                    title="ดาวน์โหลด">↓</button>
                )}
                <button onClick={(e) => { e.stopPropagation(); toggleFavorite(a.id, a.isFavorited); }}
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
