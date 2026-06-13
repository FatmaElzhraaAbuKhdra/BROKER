import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  api, formatPrice,
  type Unit, type UnitType, type Project, type Building, type Floor, type Villa, type Installment,
} from "@/lib/api";
import { ArrowRight, Save, Plus, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & pure helpers  (defined at module scope — never inside a component)
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function getMonthLabel(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return `${MONTHS_AR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return dateStr.slice(0, 10); }
}

interface AdjInst extends Installment {
  required: number;   // dynamically recalculated required amount this month
  paid: number;       // PAID_AMOUNT as number
  shortfall: number;  // max(0, required - paid)
  balance: number;    // running balance AFTER this month
  dynStatus: "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "PENDING";
}

/**
 * Redistribute unpaid/partially-paid amounts over remaining months.
 *  - totalScheduled = sum of AMOUNT fields (original schedule total)
 *  - Each month's "required" = runningBalance / monthsLeft
 *  - runningBalance decreases by PAID_AMOUNT each month
 */
function calcAdjusted(installments: Installment[]): AdjInst[] {
  if (!installments.length) return [];
  const totalScheduled = installments.reduce((s, i) => s + Number(i.AMOUNT), 0);
  if (totalScheduled <= 0) {
    return installments.map((i, idx) => ({
      ...i,
      required: Number(i.AMOUNT),
      paid: Number(i.PAID_AMOUNT ?? 0),
      shortfall: 0,
      balance: 0,
      dynStatus: "PENDING" as const,
    }));
  }

  let balance = totalScheduled;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return installments.map((inst, idx) => {
    const remaining = installments.length - idx;
    const required = remaining > 0 ? balance / remaining : 0;
    const paid = Number(inst.PAID_AMOUNT ?? 0);
    const shortfall = Math.max(0, required - paid);
    balance = Math.max(0, balance - paid);

    const due = new Date(inst.DUE_DATE);
    due.setHours(0, 0, 0, 0);
    const past = due < today;

    let dynStatus: AdjInst["dynStatus"];
    if (paid >= required - 0.5 && required > 0) dynStatus = "PAID";
    else if (paid > 0) dynStatus = "PARTIALLY_PAID";
    else if (past) dynStatus = "OVERDUE";
    else dynStatus = "PENDING";

    return {
      ...inst,
      required: Math.round(required),
      paid,
      shortfall: Math.round(shortfall),
      balance: Math.round(balance),
      dynStatus,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Status display config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { icon: string; label: string; badge: string; rowBg: string }> = {
  PAID:           { icon: "✅", label: "مدفوع",         badge: "bg-emerald-100 text-emerald-700", rowBg: "bg-emerald-50/30" },
  PARTIALLY_PAID: { icon: "⚠️", label: "مدفوع جزئياً",  badge: "bg-blue-100 text-blue-700",      rowBg: "bg-blue-50/20"   },
  OVERDUE:        { icon: "❌", label: "متأخر",          badge: "bg-rose-100 text-rose-700",       rowBg: "bg-rose-50/20"   },
  PENDING:        { icon: "⬜", label: "معلق",           badge: "bg-gray-100 text-gray-500",       rowBg: ""                },
};

// ─────────────────────────────────────────────────────────────────────────────
// Field wrapper
// ─────────────────────────────────────────────────────────────────────────────
function F({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">
        {label}{req && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary tile
// ─────────────────────────────────────────────────────────────────────────────
function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="font-bold text-sm" style={{ color }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PayRow — single installment row with inline paid-amount editing
// MUST be defined outside any component to avoid remount / focus loss
// ─────────────────────────────────────────────────────────────────────────────
function PayRow({
  adj, rowNum, editingId, editPaid,
  onEdit, onSavePaid, onCancel,
  isAdmin, saving,
}: {
  adj: AdjInst;
  rowNum: number;
  editingId: number | null;
  editPaid: string;
  onEdit: (id: number, value: string) => void;
  onSavePaid: (adj: AdjInst, paid: string) => void;
  onCancel: () => void;
  isAdmin: boolean;
  saving: boolean;
}) {
  const cfg = STATUS_CFG[adj.dynStatus] ?? STATUS_CFG.PENDING;
  const isEditing = editingId === adj.INSTALLMENT_ID;
  const isFuture = adj.dynStatus === "PENDING";

  return (
    <tr className={`${cfg.rowBg} border-b border-gray-100 last:border-0 transition-colors`}>
      {/* # + icon */}
      <td className="px-2 py-2 text-center w-12">
        <div className="text-xs text-gray-400 leading-none">{rowNum}</div>
        <div className="text-sm leading-tight">{cfg.icon}</div>
      </td>

      {/* Month */}
      <td className="px-3 py-2.5">
        <div className="font-semibold text-sm text-gray-800 whitespace-nowrap">{getMonthLabel(adj.DUE_DATE)}</div>
        <div className="text-xs text-gray-400">{adj.DUE_DATE ? adj.DUE_DATE.slice(0, 10) : ""}</div>
      </td>

      {/* Required (recalculated) */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className={`text-sm font-bold ${isFuture && adj.required !== Math.round(Number(adj.AMOUNT)) ? "text-amber-600" : "text-[#0D4D3A]"}`}>
          {adj.required > 0 ? `${adj.required.toLocaleString("ar-SA")} ر.س` : "-"}
        </span>
        {/* Show redistribution indicator */}
        {!isFuture && adj.dynStatus !== "PAID" && adj.shortfall > 0 && (
          <div className="text-xs text-rose-500">نقص: {adj.shortfall.toLocaleString("ar-SA")}</div>
        )}
      </td>

      {/* Paid (editable) */}
      <td className="px-3 py-2.5">
        {isEditing ? (
          <input
            type="number"
            autoFocus
            value={editPaid}
            onChange={e => onEdit(adj.INSTALLMENT_ID, e.target.value)}
            className="w-28 border-2 border-[#1A8A6C] rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]/40"
            min={0}
            step={1}
          />
        ) : (
          <span className={`text-sm ${adj.paid > 0 ? "font-bold text-[#2e7d32]" : "text-gray-300"}`}>
            {adj.paid > 0 ? `${adj.paid.toLocaleString("ar-SA")} ر.س` : "—"}
          </span>
        )}
      </td>

      {/* Running balance (after this month) */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {!isFuture ? (
          <span className={`text-sm ${adj.balance === 0 ? "text-emerald-600 font-bold" : "text-gray-600"}`}>
            {adj.balance.toLocaleString("ar-SA")} ر.س
          </span>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        )}
      </td>

      {/* Status badge */}
      <td className="px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cfg.badge}`}>
          {cfg.label}
        </span>
      </td>

      {/* Action */}
      {isAdmin && (
        <td className="px-3 py-2.5 w-36">
          {isEditing ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => onSavePaid(adj, editPaid)}
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-[#1A8A6C] text-white rounded-md hover:bg-[#147A5E] disabled:opacity-60 font-medium">
                {saving ? "..." : "حفظ"}
              </button>
              <button
                onClick={onCancel}
                className="text-xs px-2 py-1.5 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50">
                ✕
              </button>
            </div>
          ) : adj.dynStatus !== "PAID" ? (
            <button
              onClick={() => onEdit(adj.INSTALLMENT_ID, String(adj.required))}
              className="text-xs px-3 py-1.5 bg-[#0D4D3A] text-white rounded-md hover:bg-[#1A8A6C] transition-colors font-medium">
              تسديد
            </button>
          ) : null}
        </td>
      )}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ManualAddRow — quick inline add for a single custom installment
// ─────────────────────────────────────────────────────────────────────────────
function ManualAddRow({ unitId, onSaved, onCancel }: {
  unitId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ dueDate: "", amount: "", paidAmount: "0", status: "PENDING", notes: "" });
  const [saving, setSaving] = useState(false);
  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1A8A6C]";
  const handleSave = async () => {
    if (!form.dueDate || !form.amount) { toast.error("تاريخ الاستحقاق والمبلغ مطلوبان"); return; }
    setSaving(true);
    try {
      await api.post("/installments", {
        unitId: Number(unitId), dueDate: form.dueDate, amount: Number(form.amount),
        paidAmount: Number(form.paidAmount || 0), status: form.status, notes: form.notes || null,
      });
      toast.success("تمت إضافة القسط");
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل الحفظ"); }
    finally { setSaving(false); }
  };
  return (
    <div className="border-b border-blue-100 bg-blue-50/40 px-4 py-3">
      <div className="text-xs font-semibold text-[#0D4D3A] mb-2">إضافة قسط يدوي</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
        <div><div className="text-xs text-gray-500 mb-1">تاريخ الاستحقاق *</div><input type="date" className={ic} value={form.dueDate} onChange={sf("dueDate")} /></div>
        <div><div className="text-xs text-gray-500 mb-1">المبلغ *</div><input type="number" className={ic} value={form.amount} onChange={sf("amount")} placeholder="0" /></div>
        <div><div className="text-xs text-gray-500 mb-1">المدفوع</div><input type="number" className={ic} value={form.paidAmount} onChange={sf("paidAmount")} placeholder="0" /></div>
        <div>
          <div className="text-xs text-gray-500 mb-1">الحالة</div>
          <select className={ic} value={form.status} onChange={sf("status")}>
            <option value="PENDING">معلق</option>
            <option value="PAID">مدفوع</option>
            <option value="PARTIALLY_PAID">جزئي</option>
            <option value="OVERDUE">متأخر</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 text-xs py-1.5 bg-[#1A8A6C] text-white rounded hover:bg-[#147A5E] disabled:opacity-60">
            {saving ? "..." : "حفظ"}
          </button>
          <button onClick={onCancel}
            className="flex-1 text-xs py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GenerateScheduleModal
// ─────────────────────────────────────────────────────────────────────────────
function GenerateScheduleModal({ unitId, unitPrice, onClose, onGenerated }: {
  unitId: string;
  unitPrice: number;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const now = new Date();
  const [form, setForm] = useState({
    totalAmount: unitPrice > 0 ? String(unitPrice) : "",
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
    numberOfMonths: "12",
  });
  const [loading, setLoading] = useState(false);
  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const total = Number(form.totalAmount) || 0;
  const months = Math.max(1, Number(form.numberOfMonths) || 1);
  const monthly = months > 0 ? Math.round(total / months) : 0;
  const lastMonthly = total - monthly * (months - 1);

  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]";

  const handleGenerate = async () => {
    if (!form.totalAmount || !form.month || !form.year) { toast.error("الرجاء ملء جميع الحقول"); return; }
    if (total <= 0) { toast.error("المبلغ يجب أن يكون أكبر من 0"); return; }
    if (!confirm(`سيتم حذف جميع الأقساط الحالية وإنشاء ${months} قسط شهري. هل أنت متأكد؟`)) return;
    setLoading(true);
    try {
      await api.post("/installments/generate", {
        unitId: Number(unitId),
        totalAmount: total,
        startDate: `${form.year}-${form.month}`,
        numberOfMonths: months,
      });
      toast.success(`تم إنشاء ${months} قسط شهري بنجاح`);
      onGenerated();
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل الإنشاء"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" dir="rtl">
        <div className="bg-[#0D4D3A] text-white px-5 py-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#25B897]" />
            <span className="font-semibold">توليد جدول الأقساط الشهرية</span>
          </div>
          <button onClick={onClose} className="hover:text-white/70 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">إجمالي مبلغ الأقساط (ريال) *</label>
            <input type="number" className={ic} value={form.totalAmount} onChange={sf("totalAmount")} min={1} placeholder="مثال: 500000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">شهر البداية *</label>
              <select className={ic} value={form.month} onChange={sf("month")}>
                {MONTHS_AR.map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">السنة *</label>
              <input type="number" className={ic} value={form.year} onChange={sf("year")} min={2020} max={2060} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">عدد الأشهر (الأقساط)</label>
            <div className="flex gap-2">
              {[6, 12, 18, 24, 36].map(n => (
                <button key={n} type="button"
                  onClick={() => setForm(f => ({ ...f, numberOfMonths: String(n) }))}
                  className={`flex-1 py-1.5 text-xs rounded border font-medium transition-colors
                    ${Number(form.numberOfMonths) === n ? "bg-[#1A8A6C] text-white border-[#1A8A6C]" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {n} شهر
                </button>
              ))}
              <input type="number" className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#1A8A6C]"
                value={form.numberOfMonths} onChange={sf("numberOfMonths")} min={1} max={360} />
            </div>
          </div>

          {/* Preview */}
          {total > 0 && (
            <div className="bg-gradient-to-l from-[#0D4D3A]/5 to-[#25B897]/5 rounded-xl p-4 border border-[#1A8A6C]/20">
              <div className="text-xs text-gray-500 mb-3 font-medium">معاينة الجدول</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">الإجمالي</div>
                  <div className="font-bold text-[#0D4D3A] text-sm">{total.toLocaleString("ar-SA")} ر.س</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">القسط الشهري</div>
                  <div className="font-bold text-[#1A8A6C] text-lg">{monthly.toLocaleString("ar-SA")} ر.س</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">القسط الأخير</div>
                  <div className="font-bold text-[#147A5E] text-sm">{lastMonthly.toLocaleString("ar-SA")} ر.س</div>
                </div>
              </div>
              <div className="mt-3 text-center text-xs text-gray-500">
                {months} قسط · من {MONTHS_AR[Number(form.month) - 1]} {form.year}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleGenerate} disabled={loading || total <= 0}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1A8A6C] text-white py-3 rounded-lg font-semibold hover:bg-[#147A5E] disabled:opacity-60 transition-colors">
              <Zap className="w-4 h-4" />{loading ? "جارٍ الإنشاء..." : "إنشاء الجدول"}
            </button>
            <button onClick={onClose} className="border border-gray-300 text-gray-600 px-5 py-3 rounded-lg hover:bg-gray-50">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InstallmentsSection — interactive annual grid
// MUST be defined outside UnitForm to avoid remount / focus loss
// ─────────────────────────────────────────────────────────────────────────────
function InstallmentsSection({ unitId, unitPrice }: { unitId: string; unitPrice: number }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPaid, setEditPaid] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: raw = [], isLoading } = useQuery<Installment[]>({
    queryKey: ["installments", unitId],
    queryFn: () => api.get(`/installments?unitId=${unitId}`),
    enabled: Boolean(unitId),
    staleTime: 0,
  });

  const adjusted = calcAdjusted(raw);
  const totalScheduled = raw.reduce((s, i) => s + Number(i.AMOUNT), 0);
  const totalPaid     = adjusted.reduce((s, a) => s + a.paid, 0);
  const remaining     = Math.max(0, totalScheduled - totalPaid);
  const paidPct       = totalScheduled > 0 ? Math.round((totalPaid / totalScheduled) * 100) : 0;
  const paidCount     = adjusted.filter(a => a.dynStatus === "PAID").length;
  const overdueCount  = adjusted.filter(a => a.dynStatus === "OVERDUE").length;

  // ── edit helpers ────────────────────────────────────────────────────────────
  const handleEdit = (id: number, prefill: string) => { setEditingId(id); setEditPaid(prefill); };
  const handleCancel = () => { setEditingId(null); setEditPaid(""); };

  const handleSavePaid = async (adj: AdjInst, paidStr: string) => {
    const paidAmount = Math.max(0, Number(paidStr ?? 0));
    setSaving(true);
    try {
      let status: string;
      if (paidAmount >= adj.required - 0.5) status = "PAID";
      else if (paidAmount > 0) status = "PARTIALLY_PAID";
      else status = "PENDING";

      await api.put(`/installments/${adj.INSTALLMENT_ID}`, {
        unitId: adj.UNIT_ID,
        dueDate: adj.DUE_DATE ? adj.DUE_DATE.slice(0, 10) : "",
        amount: adj.AMOUNT,
        paidAmount,
        paidDate: paidAmount > 0 ? new Date().toISOString().slice(0, 10) : null,
        status,
        notes: adj.NOTES,
      });
      setEditingId(null);
      setEditPaid("");
      toast.success("تم تسجيل الدفعة ✓");
      qc.invalidateQueries({ queryKey: ["installments", unitId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل التحديث");
    } finally { setSaving(false); }
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["installments", unitId] });

  // progress bar color
  const barColor = paidPct === 100 ? "#2e7d32" : paidPct >= 60 ? "#1A8A6C" : paidPct >= 30 ? "#f59e0b" : "#dc3545";

  return (
    <div className="space-y-4">
      {/* ── Summary card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#0D4D3A] text-base">ملخص خطة الأقساط</h2>
          <div className="flex gap-2 text-xs">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{paidCount} مدفوع</span>
            {overdueCount > 0 && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">{overdueCount} متأخر</span>}
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{adjusted.length} إجمالي</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span style={{ color: barColor }}>المدفوع: {totalPaid.toLocaleString("ar-SA")} ر.س ({paidPct}%)</span>
            <span className="text-gray-500">المتبقي: {remaining.toLocaleString("ar-SA")} ر.س</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
              style={{ width: `${Math.max(paidPct, paidPct > 0 ? 6 : 0)}%`, backgroundColor: barColor }}>
              {paidPct >= 12 && <span className="text-white text-xs font-bold">{paidPct}%</span>}
            </div>
          </div>
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="الإجمالي المجدول" value={`${totalScheduled.toLocaleString("ar-SA")} ر.س`} color="#1A8A6C" />
          <Tile label="المدفوع فعلياً" value={`${totalPaid.toLocaleString("ar-SA")} ر.س`} color="#2e7d32" />
          <Tile label="الرصيد المتبقي" value={`${remaining.toLocaleString("ar-SA")} ر.س`} color={remaining > 0 ? "#dc3545" : "#2e7d32"} />
          <Tile label="سعر الوحدة" value={formatPrice(unitPrice)} color="#147A5E" />
        </div>
      </div>

      {/* ── Interactive grid ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Header bar */}
        <div className="bg-gradient-to-l from-[#0D4D3A] to-[#1A6A54] text-white px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">جدول الأقساط الشهرية</h2>
            {adjusted.length > 0 && (
              <div className="text-xs text-white/60 mt-0.5">
                يتم إعادة توزيع النقص تلقائياً على الأشهر المتبقية
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setShowGenerate(true)}
                className="flex items-center gap-1.5 text-xs bg-[#25B897] hover:bg-[#1A8A6C] text-white px-3 py-1.5 rounded-lg transition-colors font-semibold">
                <Zap className="w-3.5 h-3.5" /> توليد جدول
              </button>
              <button onClick={() => setShowAdd(v => !v)}
                className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>
          )}
        </div>

        {/* Manual add row */}
        {showAdd && isAdmin && (
          <ManualAddRow
            unitId={unitId}
            onSaved={() => { invalidate(); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Redistribution note (if any shortfall exists) */}
        {adjusted.some(a => a.dynStatus === "PARTIALLY_PAID" || (a.dynStatus === "OVERDUE" && a.paid < a.required)) && (
          <div className="bg-amber-50 border-b border-amber-100 px-5 py-2 flex items-center gap-2 text-xs text-amber-700">
            <span>⚠️</span>
            <span>يوجد نقص في بعض الأقساط — تم إعادة توزيعه تلقائياً على الأشهر القادمة (المبالغ المُعدَّلة تظهر بالخط الأصفر)</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {(["#", "الشهر", "المطلوب (معدَّل)", "المدفوع", "الرصيد بعد السداد", "الحالة", isAdmin ? "إجراءات" : ""] as string[])
                  .filter(Boolean)
                  .map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold text-gray-600 text-right whitespace-nowrap">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-14 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#1A8A6C] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">جارٍ التحميل...</span>
                    </div>
                  </td>
                </tr>
              ) : adjusted.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Zap className="w-10 h-10 text-gray-200" />
                      <div className="text-sm font-medium">لا توجد أقساط بعد</div>
                      {isAdmin && (
                        <button onClick={() => setShowGenerate(true)}
                          className="flex items-center gap-2 bg-[#1A8A6C] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#147A5E] transition-colors">
                          <Zap className="w-4 h-4" /> توليد جدول أقساط شهري
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                adjusted.map((adj, i) => (
                  <PayRow
                    key={adj.INSTALLMENT_ID}
                    adj={adj}
                    rowNum={i + 1}
                    editingId={editingId}
                    editPaid={editPaid}
                    onEdit={handleEdit}
                    onSavePaid={handleSavePaid}
                    onCancel={handleCancel}
                    isAdmin={isAdmin}
                    saving={saving}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate modal */}
      {showGenerate && (
        <GenerateScheduleModal
          unitId={unitId}
          unitPrice={unitPrice}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => { invalidate(); setShowGenerate(false); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UnitForm — main page component
// ─────────────────────────────────────────────────────────────────────────────
export default function UnitForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    unitCode: "", unitName: "", typeId: "", projectId: "",
    buildingId: "", floorId: "", area: "", saleableArea: "",
    rooms: "0", bathrooms: "0", price: "", description: "", villaId: "",
  });

  const { data: existing } = useQuery<Unit>({
    queryKey: ["unit", id],
    queryFn: () => api.get(`/units/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        unitCode: existing.UNIT_CODE, unitName: existing.UNIT_NAME,
        typeId: String(existing.TYPE_ID), projectId: String(existing.PROJECT_ID),
        buildingId: String(existing.BUILDING_ID), floorId: String(existing.FLOOR_ID),
        area: String(existing.AREA),
        saleableArea: existing.SALEABLE_AREA != null ? String(existing.SALEABLE_AREA) : "",
        rooms: String(existing.ROOMS), bathrooms: String(existing.BATHROOMS),
        price: String(existing.PRICE), description: existing.DESCRIPTION || "",
        villaId: existing.VILLA_ID != null ? String(existing.VILLA_ID) : "",
      });
    }
  }, [existing]);

  const { data: types = [] }     = useQuery<UnitType[]>({ queryKey: ["unit-types"],  queryFn: () => api.get("/unit-types")  });
  const { data: projects = [] }  = useQuery<Project[]>({ queryKey: ["projects"],     queryFn: () => api.get("/projects")    });
  const { data: villas = [] }    = useQuery<Villa[]>({   queryKey: ["villas"],        queryFn: () => api.get("/villas")      });
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ["buildings", form.projectId],
    queryFn:  () => api.get(`/buildings?projectId=${form.projectId}`),
    enabled: Boolean(form.projectId),
  });
  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ["floors", form.buildingId],
    queryFn:  () => api.get(`/floors?buildingId=${form.buildingId}`),
    enabled: Boolean(form.buildingId),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitCode || !form.unitName || !form.typeId || !form.projectId ||
        !form.buildingId || !form.floorId || !form.area || !form.price) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة"); return;
    }
    if (Number(form.price) <= 0) { toast.error("السعر يجب أن يكون أكبر من 0"); return; }
    if (Number(form.area)  <= 0) { toast.error("المساحة يجب أن تكون أكبر من 0"); return; }
    setLoading(true);
    try {
      const body = {
        ...form,
        typeId:       Number(form.typeId),
        projectId:    Number(form.projectId),
        buildingId:   Number(form.buildingId),
        floorId:      Number(form.floorId),
        area:         Number(form.area),
        saleableArea: form.saleableArea ? Number(form.saleableArea) : null,
        rooms:        Number(form.rooms),
        bathrooms:    Number(form.bathrooms),
        price:        Number(form.price),
        villaId:      form.villaId ? Number(form.villaId) : null,
      };
      if (isEdit) {
        await api.put(`/units/${id}`, body);
        toast.success("تم تحديث الوحدة");
      } else {
        await api.post("/units", body);
        toast.success("تمت إضافة الوحدة");
      }
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["unit", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      qc.invalidateQueries({ queryKey: ["villas"] });
      navigate("/units");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally { setLoading(false); }
  };

  const inp = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]";

  return (
    <div dir="rtl" className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/units")}
          className="text-[#1A8A6C] hover:underline flex items-center gap-1 text-sm">
          <ArrowRight className="w-4 h-4" /> الوحدات
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium">{isEdit ? "تعديل الوحدة" : "إضافة وحدة جديدة"}</span>
      </div>

      {/* Main form card */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h1 className="text-xl font-bold text-[#0D4D3A] mb-6">
          {isEdit ? "تعديل الوحدة" : "إضافة وحدة جديدة"}
        </h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <F label="كود الوحدة" req><input className={inp} value={form.unitCode} onChange={set("unitCode")} placeholder="AND-A-101" /></F>
          <F label="اسم الوحدة" req><input className={inp} value={form.unitName} onChange={set("unitName")} placeholder="شقة 101 - مبنى A" /></F>
          <F label="نوع الوحدة" req>
            <select className={inp} value={form.typeId} onChange={set("typeId")}>
              <option value="">-- اختر النوع --</option>
              {types.map(t => <option key={t.TYPE_ID} value={t.TYPE_ID}>{t.TYPE_NAME}</option>)}
            </select>
          </F>
          <F label="الفيلا">
            <select className={inp} value={form.villaId} onChange={set("villaId")}>
              <option value="">-- بدون فيلا --</option>
              {villas.map(v => <option key={v.VILLA_ID} value={v.VILLA_ID}>{v.VILLA_NAME} ({v.VILLA_CODE})</option>)}
            </select>
          </F>
          <F label="المشروع" req>
            <select className={inp} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value, buildingId: "", floorId: "" }))}>
              <option value="">-- اختر المشروع --</option>
              {projects.map(p => <option key={p.PROJECT_ID} value={p.PROJECT_ID}>{p.PROJECT_NAME}</option>)}
            </select>
          </F>
          <F label="المبنى" req>
            <select className={inp} value={form.buildingId} onChange={e => setForm(f => ({ ...f, buildingId: e.target.value, floorId: "" }))} disabled={!form.projectId}>
              <option value="">-- اختر المبنى --</option>
              {buildings.map(b => <option key={b.BUILDING_ID} value={b.BUILDING_ID}>{b.BUILDING_NAME}</option>)}
            </select>
          </F>
          <F label="الطابق" req>
            <select className={inp} value={form.floorId} onChange={set("floorId")} disabled={!form.buildingId}>
              <option value="">-- اختر الطابق --</option>
              {floors.map(f => <option key={f.FLOOR_ID} value={f.FLOOR_ID}>{f.FLOOR_NAME || f.FLOOR_NUMBER}</option>)}
            </select>
          </F>
          <F label="السعر (ريال)" req>
            <input className={inp} type="number" value={form.price} onChange={set("price")} min={1} />
          </F>
          <F label="المساحة الإنشائية (م²)" req>
            <input className={inp} type="number" step="0.01" value={form.area} onChange={set("area")} min={1} />
          </F>
          <F label="المساحة البيعية (م²)">
            <input className={inp} type="number" step="0.01" value={form.saleableArea} onChange={set("saleableArea")} min={0} placeholder="اختياري" />
          </F>
          <F label="عدد الغرف">
            <input className={inp} type="number" value={form.rooms} onChange={set("rooms")} min={0} />
          </F>
          <F label="عدد الحمامات">
            <input className={inp} type="number" value={form.bathrooms} onChange={set("bathrooms")} min={0} />
          </F>
          <div className="md:col-span-2">
            <F label="الوصف">
              <textarea className={inp} value={form.description} onChange={set("description")} rows={3} />
            </F>
          </div>
          <div className="md:col-span-2 flex gap-3 pt-4 border-t">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-[#1A8A6C] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#147A5E] disabled:opacity-60 transition-colors">
              <Save className="w-4 h-4" />{loading ? "جارٍ الحفظ..." : "حفظ الوحدة"}
            </button>
            <button type="button" onClick={() => navigate("/units")}
              className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg hover:bg-gray-50">
              إلغاء
            </button>
          </div>
        </form>
      </div>

      {/* Installments — only in edit mode */}
      {isEdit && id && (
        <InstallmentsSection unitId={id} unitPrice={Number(form.price)} />
      )}
    </div>
  );
}
