// src/lib/retention.ts
// นโยบายเก็บไฟล์: asset ที่ generate ใหม่มีอายุ ASSET_RETENTION_DAYS วัน (default 7)
// เมื่อหมดอายุ cron จะลบไฟล์ออกจาก Blob และฐานข้อมูลอัตโนมัติ
// ตั้ง ASSET_RETENTION_DAYS=0 ถ้าต้องการปิดระบบหมดอายุ (เก็บถาวรทุกไฟล์)

export function getRetentionDays(): number {
  const n = Number(process.env.ASSET_RETENTION_DAYS ?? 7)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** วันหมดอายุสำหรับ asset ที่สร้างตอนนี้ — คืน null ถ้าปิดระบบหมดอายุ */
export function getAssetExpiry(): Date | null {
  const days = getRetentionDays()
  if (days <= 0) return null
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
