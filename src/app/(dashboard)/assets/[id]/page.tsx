'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface RecipeStep {
  taskName: string;
  status: string;
  modelDisplayName: string | null;
  providerCode: string | null;
  costCredit: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface AssetDetail {
  id: string;
  type: string;
  title: string;
  contentText: string | null;
  isFavorited: boolean;
  createdAt: string;
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [recipe, setRecipe] = useState<RecipeStep[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/assets/${params.id}`);
      const data = await res.json();
      setAsset(data.asset);
      setRecipe(data.recipe ?? []);
      setTotalCost(data.totalCostCredit ?? 0);
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) return <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>;
  if (!asset) return <p className="text-sm text-[#9C9690]">ไม่พบไฟล์นี้</p>;

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[#9C9690] mb-2">Generation Recipe</p>
      <h1 className="font-serif text-2xl mb-8">{asset.title}</h1>

      <div className="flex items-center justify-between rounded-2xl bg-gold/10 border border-gold/30 px-4 py-3 mb-6">
        <span className="text-sm">ต้นทุนรวมที่ใช้สร้างไฟล์นี้</span>
        <span className="font-mono font-bold text-gold">~{totalCost} เครดิต</span>
      </div>

      <div className="space-y-3 mb-10">
        {recipe.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-gold mt-1.5 flex-shrink-0" />
            <div className="flex-1 pb-2 border-b border-[#2C2A35]">
              <p className="text-sm font-semibold">{step.taskName}</p>
              <p className="text-xs text-[#9C9690] mt-1">
                {step.modelDisplayName ?? 'ไม่ทราบโมเดล'} ({step.providerCode}) · ~{step.costCredit} เครดิต ·{' '}
                {step.status}
              </p>
            </div>
          </div>
        ))}
        {recipe.length === 0 && <p className="text-sm text-[#9C9690]">ไม่มีข้อมูลขั้นตอนการสร้าง</p>}
      </div>

      {asset.contentText && (
        <article className="whitespace-pre-line text-sm leading-relaxed bg-[#1C1B23] rounded-2xl p-5 border border-[#2C2A35]">
          {asset.contentText}
        </article>
      )}
    </div>
  );
}
