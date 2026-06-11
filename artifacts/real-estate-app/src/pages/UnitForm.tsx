import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { api, formatPrice, type Unit, type UnitType, type Project, type Building, type Floor, type Villa, type Installment } from "@/lib/api";
import { ArrowRight, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

// ── Field wrapper ──────────────────────────────────────────────────────────────
function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">
        {label}{required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Summary tile ──────────────────────────────────────────────────────────────
function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-bold text-sm" style={{ color }}>{value}</div>
    </div>
  );
}

// ── Installment row types ─────────────────────────────────────────────────────
interface IRow {
  INSTALLMENT_ID?: number;
  DUE_DATE: string;
  AMOUNT: string;
  PAID_AMOUNT: string;
  PAID_DATE: string;
  STATUS: string;
  NOTES: string;
  isNew?: boolean;
}

// ── Installment row (MUST be outside parent component to avoid focus loss) ───
function InstallmentRow({ row, rowNumber, unitId, onSaved, onDelete, onCancelNew, isAdmin }: {
  row: IRow;
  rowNumber: number;
  unitId: string;
  onSaved: () => void;
  onDelete: (id: number) => void;
  onCancelNew?: () => void;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(row.isNew ?? false);
  const [form, setForm] = useState({ ...row });
  const [saving, setSaving] = useState(false);

  const ic = "border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1A8A6C] w-full";
  const sf = (k: keyof IRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const STATUS_AR: Record<string, string> = {
    PENDING: "معلق", PAID: "مدفوع", PARTIALLY_PAID: "مدفوع جزئياً", OVERDUE: "متأخر",
  };
  const STATUS_COLOR: Record<string, string> = {
    PENDING: "text-amber-600 bg-amber-50",
    PAID: "text-emerald-600 bg-emerald-50",
    PARTIALLY_PAID: "text-blue-600 bg-blue-50",
    OVERDUE: "text-rose-600 bg-rose-50",
  };

  const handleSave = async () => {
    if (!form.DUE_DATE || !form.AMOUNT) { toast.error("تاريخ الاستحقاق والمبلغ مطلوبان"); return; }
    setSaving(true);
    try {
      const body = {
        unitId: Number(unitId),
        dueDate: form.DUE_DATE,
        amount: Number(form.AMOUNT),
        paidAmount: Number(form.PAID_AMOUNT || 0),
        paidDate: form.PAID_DATE || null,
        status: form.STATUS,
        notes: form.NOTES || null,
      };
      if (row.INSTALLMENT_ID) {
        await api.put(`/installments/${row.INSTALLMENT_ID}`, body);
      } else {
        await api.post("/installments", body);
      }
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <tr className="bg-blue-50/40">
        <td className="px-3 py-2 text-xs text-gray-400">{rowNumber}</td>
        <td className="px-2 py-1.5">
          <input type="number" className={ic} value={form.AMOUNT} onChange={sf("AMOUNT")} placeholder="المبلغ" style={{ minWidth: 80 }} />
        </td>
        <td className="px-2 py-1.5">
          <input type="date" className={ic} value={form.DUE_DATE} onChange={sf("DUE_DATE")} style={{ minWidth: 110 }} />
        </td>
        <td className="px-2 py-1.5">
          <input type="number" className={ic} value={form.PAID_AMOUNT} onChange={sf("PAID_AMOUNT")} placeholder="0" style={{ minWidth: 80 }} />
        </td>
        <td className="px-2 py-1.5">
          <input type="date" className={ic} value={form.PAID_DATE} onChange={sf("PAID_DATE")} style={{ minWidth: 110 }} />
        </td>
        <td className="px-2 py-1.5">
          <select className={ic} value={form.STATUS} onChange={sf("STATUS")} style={{ minWidth: 120 }}>
            <option value="PENDING">معلق</option>
            <option value="PAID">مدفوع</option>
            <option value="PARTIALLY_PAID">مدفوع جزئياً</option>
            <option value="OVERDUE">متأخر</option>
          </select>
        </td>
        <td className="px-2 py-1.5">
          <input className={ic} value={form.NOTES} onChange={sf("NOTES")} placeholder="ملاحظات" style={{ minWidth: 80 }} />
        </td>
        <td className="px-3 py-1.5">
          <div className="flex gap-1.5">
            <button onClick={handleSave} disabled={saving}
              className="text-xs px-2.5 py-1 bg-[#1A8A6C] text-white rounded hover:bg-[#147A5E] disabled:opacity-60 whitespace-nowrap">
              {saving ? "..." : "حفظ"}
            </button>
            <button onClick={() => { if (row.isNew && onCancelNew) onCancelNew(); else setEditing(false); }}
              className="text-xs px-2.5 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 whitespace-nowrap">
              إلغاء
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2.5 text-xs text-gray-400">{rowNumber}</td>
      <td className="px-3 py-2.5 text-sm font-semibold text-[#0D4D3A]">
        {Number(row.AMOUNT).toLocaleString("ar-SA")} ر.س
      </td>
      <td className="px-3 py-2.5 text-sm">
        {row.DUE_DATE ? new Date(row.DUE_DATE).toLocaleDateString("ar-SA") : "-"}
      </td>
      <td className="px-3 py-2.5 text-sm">
        {Number(row.PAID_AMOUNT || 0) > 0 ? `${Number(row.PAID_AMOUNT).toLocaleString("ar-SA")} ر.س` : "-"}
      </td>
      <td className="px-3 py-2.5 text-sm">
        {row.PAID_DATE ? new Date(row.PAID_DATE).toLocaleDateString("ar-SA") : "-"}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[row.STATUS] ?? "text-gray-600 bg-gray-50"}`}>
          {STATUS_AR[row.STATUS] ?? row.STATUS}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">{row.NOTES || "-"}</td>
      <td className="px-3 py-2.5">
        {isAdmin && (
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(true)}
              className="text-xs px-2.5 py-1 border border-[#1A8A6C] text-[#1A8A6C] rounded hover:bg-[#1A8A6C] hover:text-white transition-colors">
              تعديل
            </button>
            <button onClick={() => row.INSTALLMENT_ID && onDelete(row.INSTALLMENT_ID)}
              className="text-xs px-2.5 py-1 border border-red-400 text-red-600 rounded hover:bg-red-50 transition-colors">
              حذف
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Installments section (MUST be outside UnitForm to avoid focus loss) ───────
function InstallmentsSection({ unitId, unitPrice }: { unitId: string; unitPrice: number }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: installments = [], isLoading } = useQuery<Installment[]>({
    queryKey: ["installments", unitId],
    queryFn: () => api.get(`/installments?unitId=${unitId}`),
    enabled: Boolean(unitId),
    staleTime: 0,
  });

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ["installments", unitId] });
    setShowNew(false);
  };

  const handleDelete = async (installmentId: number) => {
    if (!confirm("حذف هذا القسط؟")) return;
    try {
      await api.delete(`/installments/${installmentId}`);
      toast.success("تم حذف القسط");
      qc.invalidateQueries({ queryKey: ["installments", unitId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    }
  };

  const totalPaid = installments.reduce((sum, i) => sum + Number(i.PAID_AMOUNT || 0), 0);
  const paidCount = installments.filter(i => i.STATUS === "PAID").length;
  const nextInstallment = installments
    .filter(i => i.STATUS !== "PAID")
    .sort((a, b) => new Date(a.DUE_DATE).getTime() - new Date(b.DUE_DATE).getTime())[0];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-bold text-[#0D4D3A] mb-3 text-base">ملخص الأقساط</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile label="إجمالي السعر" value={formatPrice(unitPrice)} color="#1A8A6C" />
          <SummaryTile label="إجمالي المدفوع" value={formatPrice(totalPaid)} color="#2e7d32" />
          <SummaryTile label="المتبقي" value={formatPrice(Math.max(0, unitPrice - totalPaid))} color="#dc3545" />
          <SummaryTile label="عدد الأقساط" value={String(installments.length)} color="#147A5E" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <SummaryTile label="أقساط مدفوعة" value={String(paidCount)} color="#2e7d32" />
          <SummaryTile label="أقساط متبقية" value={String(installments.length - paidCount)} color="#dc3545" />
          <SummaryTile
            label="مبلغ القسط التالي"
            value={nextInstallment ? `${Number(nextInstallment.AMOUNT).toLocaleString("ar-SA")} ر.س` : "-"}
            color="#1A8A6C"
          />
          <SummaryTile
            label="تاريخ القسط التالي"
            value={nextInstallment ? new Date(nextInstallment.DUE_DATE).toLocaleDateString("ar-SA") : "-"}
            color="#147A5E"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="bg-[#0D4D3A] text-white px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-sm">جدول الأقساط ({installments.length})</h2>
          {isAdmin && !showNew && (
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded transition-colors">
              <Plus className="w-3.5 h-3.5" /> إضافة قسط
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["#", "المبلغ", "تاريخ الاستحقاق", "المبلغ المدفوع", "تاريخ الدفع", "الحالة", "ملاحظات", "إجراءات"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-right whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">جارٍ التحميل...</td></tr>
              ) : installments.length === 0 && !showNew ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">لا توجد أقساط. اضغط "إضافة قسط" لإضافة أول قسط.</td></tr>
              ) : (
                <>
                  {installments.map((inst, i) => (
                    <InstallmentRow
                      key={inst.INSTALLMENT_ID}
                      row={{
                        INSTALLMENT_ID: inst.INSTALLMENT_ID,
                        DUE_DATE: inst.DUE_DATE ? inst.DUE_DATE.slice(0, 10) : "",
                        AMOUNT: String(inst.AMOUNT),
                        PAID_AMOUNT: String(inst.PAID_AMOUNT || 0),
                        PAID_DATE: inst.PAID_DATE ? inst.PAID_DATE.slice(0, 10) : "",
                        STATUS: inst.STATUS,
                        NOTES: inst.NOTES || "",
                      }}
                      rowNumber={i + 1}
                      unitId={unitId}
                      onSaved={handleSaved}
                      onDelete={handleDelete}
                      isAdmin={isAdmin}
                    />
                  ))}
                  {showNew && (
                    <InstallmentRow
                      key="new"
                      row={{ DUE_DATE: "", AMOUNT: "", PAID_AMOUNT: "0", PAID_DATE: "", STATUS: "PENDING", NOTES: "", isNew: true }}
                      rowNumber={installments.length + 1}
                      unitId={unitId}
                      onSaved={handleSaved}
                      onDelete={() => {}}
                      onCancelNew={() => setShowNew(false)}
                      isAdmin={isAdmin}
                    />
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main form component ───────────────────────────────────────────────────────
export default function UnitForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    unitCode: "", unitName: "", typeId: "", projectId: "",
    buildingId: "", floorId: "", area: "", saleableArea: "", rooms: "0",
    bathrooms: "0", price: "", description: "", villaId: "",
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
        rooms: String(existing.ROOMS),
        bathrooms: String(existing.BATHROOMS), price: String(existing.PRICE),
        description: existing.DESCRIPTION || "",
        villaId: existing.VILLA_ID != null ? String(existing.VILLA_ID) : "",
      });
    }
  }, [existing]);

  const { data: types = [] } = useQuery<UnitType[]>({ queryKey: ["unit-types"], queryFn: () => api.get("/unit-types") });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["projects"], queryFn: () => api.get("/projects") });
  const { data: villas = [] } = useQuery<Villa[]>({ queryKey: ["villas"], queryFn: () => api.get("/villas") });
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ["buildings", form.projectId],
    queryFn: () => api.get(`/buildings?projectId=${form.projectId}`),
    enabled: Boolean(form.projectId),
  });
  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ["floors", form.buildingId],
    queryFn: () => api.get(`/floors?buildingId=${form.buildingId}`),
    enabled: Boolean(form.buildingId),
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitCode || !form.unitName || !form.typeId || !form.projectId || !form.buildingId || !form.floorId || !form.area || !form.price) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة"); return;
    }
    if (Number(form.price) <= 0) { toast.error("السعر يجب أن يكون أكبر من 0"); return; }
    if (Number(form.area) <= 0) { toast.error("المساحة يجب أن تكون أكبر من 0"); return; }
    setLoading(true);
    try {
      const body = {
        ...form,
        typeId: Number(form.typeId), projectId: Number(form.projectId),
        buildingId: Number(form.buildingId), floorId: Number(form.floorId),
        area: Number(form.area),
        saleableArea: form.saleableArea ? Number(form.saleableArea) : null,
        rooms: Number(form.rooms), bathrooms: Number(form.bathrooms),
        price: Number(form.price),
        villaId: form.villaId ? Number(form.villaId) : null,
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
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]";

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/units")} className="text-[#1A8A6C] hover:underline flex items-center gap-1 text-sm">
          <ArrowRight className="w-4 h-4" /> الوحدات
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium">{isEdit ? "تعديل الوحدة" : "إضافة وحدة جديدة"}</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-xl font-bold text-[#0D4D3A] mb-6">{isEdit ? "تعديل الوحدة" : "إضافة وحدة جديدة"}</h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <F label="كود الوحدة" required><input className={inputClass} value={form.unitCode} onChange={set("unitCode")} placeholder="AND-A-101" /></F>
          <F label="اسم الوحدة" required><input className={inputClass} value={form.unitName} onChange={set("unitName")} placeholder="شقة 101 - مبنى A" /></F>
          <F label="نوع الوحدة" required>
            <select className={inputClass} value={form.typeId} onChange={set("typeId")}>
              <option value="">-- اختر النوع --</option>
              {types.map(t => <option key={t.TYPE_ID} value={t.TYPE_ID}>{t.TYPE_NAME}</option>)}
            </select>
          </F>
          <F label="الفيلا">
            <select className={inputClass} value={form.villaId} onChange={set("villaId")}>
              <option value="">-- بدون فيلا --</option>
              {villas.map(v => <option key={v.VILLA_ID} value={v.VILLA_ID}>{v.VILLA_NAME} ({v.VILLA_CODE})</option>)}
            </select>
          </F>
          <F label="المشروع" required>
            <select className={inputClass} value={form.projectId} onChange={e => { setForm(f => ({ ...f, projectId: e.target.value, buildingId: "", floorId: "" })); }}>
              <option value="">-- اختر المشروع --</option>
              {projects.map(p => <option key={p.PROJECT_ID} value={p.PROJECT_ID}>{p.PROJECT_NAME}</option>)}
            </select>
          </F>
          <F label="المبنى" required>
            <select className={inputClass} value={form.buildingId} onChange={e => setForm(f => ({ ...f, buildingId: e.target.value, floorId: "" }))} disabled={!form.projectId}>
              <option value="">-- اختر المبنى --</option>
              {buildings.map(b => <option key={b.BUILDING_ID} value={b.BUILDING_ID}>{b.BUILDING_NAME}</option>)}
            </select>
          </F>
          <F label="الطابق" required>
            <select className={inputClass} value={form.floorId} onChange={set("floorId")} disabled={!form.buildingId}>
              <option value="">-- اختر الطابق --</option>
              {floors.map(f => <option key={f.FLOOR_ID} value={f.FLOOR_ID}>{f.FLOOR_NAME || f.FLOOR_NUMBER}</option>)}
            </select>
          </F>
          <F label="المساحة الإنشائية (م²)" required><input className={inputClass} type="number" step="0.01" value={form.area} onChange={set("area")} min={1} /></F>
          <F label="المساحة البيعية (م²)"><input className={inputClass} type="number" step="0.01" value={form.saleableArea} onChange={set("saleableArea")} min={0} placeholder="اختياري" /></F>
          <F label="السعر (ريال)" required><input className={inputClass} type="number" value={form.price} onChange={set("price")} min={1} /></F>
          <F label="عدد الغرف"><input className={inputClass} type="number" value={form.rooms} onChange={set("rooms")} min={0} /></F>
          <F label="عدد الحمامات"><input className={inputClass} type="number" value={form.bathrooms} onChange={set("bathrooms")} min={0} /></F>
          <div className="md:col-span-2">
            <F label="الوصف">
              <textarea className={inputClass} value={form.description} onChange={set("description")} rows={3} />
            </F>
          </div>
          <div className="md:col-span-2 flex gap-3 pt-4 border-t">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-[#1A8A6C] text-white px-6 py-2.5 rounded-md font-medium hover:bg-[#147A5E] disabled:opacity-60">
              <Save className="w-4 h-4" />{loading ? "جارٍ الحفظ..." : "حفظ"}
            </button>
            <button type="button" onClick={() => navigate("/units")}
              className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-md hover:bg-gray-50">
              إلغاء
            </button>
          </div>
        </form>
      </div>

      {/* Installments section — only shown when editing an existing unit */}
      {isEdit && id && <InstallmentsSection unitId={id} unitPrice={Number(form.price)} />}
    </div>
  );
}
