import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatPrice, formatDate, type Sale, type Unit, type Customer } from "@/lib/api";
import { Plus, Edit, X, Save, Search } from "lucide-react";
import { toast } from "sonner";

export default function Sales() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const empty = { unitId: "", customerId: "", saleDate: new Date().toISOString().slice(0, 10), saleAmount: "", notes: "" };
  const [form, setForm] = useState(empty);

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["sales", search],
    queryFn: () => api.get(`/sales${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["units-available"],
    queryFn: () => api.get("/units?status=AVAILABLE"),
    enabled: showModal,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
    enabled: showModal,
  });

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (s: Sale) => { setEditing(s); setForm({ unitId: String(s.UNIT_ID), customerId: String(s.CUSTOMER_ID), saleDate: s.SALE_DATE ? String(s.SALE_DATE).slice(0, 10) : "", saleAmount: String(s.SALE_AMOUNT), notes: s.NOTES || "" }); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.saleDate || !form.saleAmount) { toast.error("جميع الحقول المطلوبة يجب ملؤها"); return; }
    if (Number(form.saleAmount) <= 0) { toast.error("مبلغ البيع يجب أن يكون أكبر من 0"); return; }
    setLoading(true);
    try {
      const body = { ...form, customerId: Number(form.customerId), saleAmount: Number(form.saleAmount) };
      if (editing) {
        await api.put(`/sales/${editing.SALE_ID}`, body);
        toast.success("تم تحديث سجل البيع");
      } else {
        await api.post("/sales", { ...body, unitId: Number(form.unitId) });
        toast.success("تمت عملية البيع بنجاح");
      }
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      setShowModal(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
    finally { setLoading(false); }
  };

  const totalSales = sales.reduce((sum, s) => sum + Number(s.SALE_AMOUNT), 0);
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]";

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#0D4D3A]">سجلات المبيعات</h1>
        <div className="flex items-center gap-3">
          <div className="relative"><Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]" /></div>
          <button onClick={openAdd} className="flex items-center gap-2 bg-[#25B897] text-white px-4 py-2 rounded-md text-sm hover:bg-[#d8940a]"><Plus className="w-4 h-4" /> تسجيل بيع</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="apex-table">
          <thead><tr><th>#</th><th>كود الوحدة</th><th>الوحدة</th><th>العميل</th><th>المشروع</th><th>مبلغ البيع</th><th>تاريخ البيع</th><th>إجراءات</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
            : sales.map((s, i) => (
              <tr key={s.SALE_ID}>
                <td className="text-gray-400">{i + 1}</td>
                <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{s.UNIT_CODE}</span></td>
                <td className="font-medium text-[#0D4D3A]">{s.UNIT_NAME}</td>
                <td>{s.CUSTOMER_NAME}</td>
                <td className="text-gray-500">{s.PROJECT_NAME}</td>
                <td className="text-[#2e7d32] font-bold">{formatPrice(s.SALE_AMOUNT)}</td>
                <td className="text-gray-500">{formatDate(s.SALE_DATE)}</td>
                <td><button onClick={() => openEdit(s)} className="text-xs border border-[#1A8A6C] text-[#1A8A6C] px-2 py-1 rounded hover:bg-[#1A8A6C] hover:text-white transition-colors"><Edit className="w-3 h-3 inline ml-1" />تعديل</button></td>
              </tr>
            ))}
            {!isLoading && sales.length > 0 && (
              <tr className="bg-[#f0f8ff] font-bold border-t-2 border-[#1A8A6C]">
                <td colSpan={5} className="text-left text-[#0D4D3A]">الإجمالي ({sales.length} عملية)</td>
                <td className="text-[#1A8A6C] text-base">{formatPrice(totalSales)}</td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-[#0D4D3A] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">{editing ? "تعديل سجل البيع" : "تسجيل عملية بيع جديدة"}</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {!editing && <div><label className="text-sm font-medium block mb-1">الوحدة *</label><select className={ic} value={form.unitId} onChange={s("unitId")} required><option value="">-- اختر الوحدة --</option>{units.map(u => <option key={u.UNIT_ID} value={u.UNIT_ID}>{u.UNIT_CODE} - {u.UNIT_NAME}</option>)}</select></div>}
              <div><label className="text-sm font-medium block mb-1">العميل *</label><select className={ic} value={form.customerId} onChange={s("customerId")} required><option value="">-- اختر العميل --</option>{customers.map(c => <option key={c.CUSTOMER_ID} value={c.CUSTOMER_ID}>{c.FULL_NAME} - {c.MOBILE}</option>)}</select></div>
              <div><label className="text-sm font-medium block mb-1">تاريخ البيع *</label><input type="date" className={ic} value={form.saleDate} onChange={s("saleDate")} required /></div>
              <div><label className="text-sm font-medium block mb-1">مبلغ البيع *</label><input type="number" className={ic} value={form.saleAmount} onChange={s("saleAmount")} required min={1} /></div>
              <div><label className="text-sm font-medium block mb-1">ملاحظات</label><textarea className={ic} value={form.notes} onChange={s("notes")} rows={2} /></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[#25B897] text-white py-2 rounded-md font-medium hover:bg-[#d8940a] disabled:opacity-60"><Save className="w-4 h-4" />{loading ? "..." : "حفظ"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
