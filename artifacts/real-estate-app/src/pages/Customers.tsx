import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatDate, type Customer } from "@/lib/api";
import { Plus, Edit, Trash2, X, Save, Search, Users, Phone, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function Customers() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const empty = { fullName: "", mobile: "", email: "", nationalId: "", address: "", notes: "" };
  const [form, setForm] = useState(empty);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", search],
    queryFn: () => api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ fullName: c.FULL_NAME, mobile: c.MOBILE, email: c.EMAIL || "", nationalId: c.NATIONAL_ID || "", address: c.ADDRESS || "", notes: c.NOTES || "" }); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.mobile) { toast.error("الاسم والجوال مطلوبان"); return; }
    setLoading(true);
    try {
      if (editing) { await api.put(`/customers/${editing.CUSTOMER_ID}`, form); toast.success("تم تحديث العميل"); }
      else { await api.post("/customers", form); toast.success("تمت إضافة العميل"); }
      qc.invalidateQueries({ queryKey: ["customers"] });
      setShowModal(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`حذف "${c.FULL_NAME}"؟`)) return;
    try { await api.delete(`/customers/${c.CUSTOMER_ID}`); toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["customers"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
  };

  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]";

  return (
    <div dir="rtl" className="space-y-4">
      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي العملاء", value: customers.length, icon: Users, color: "#1b6ca8", bg: "#e8f0f8" },
          { label: "عملاء لديهم هاتف", value: customers.filter(c => c.MOBILE).length, icon: Phone, color: "#2e7d32", bg: "#e8f5e9" },
          { label: "عملاء مسجلون", value: customers.filter(c => c.NATIONAL_ID).length, icon: UserCheck, color: "#f0a500", bg: "#fff8e1" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-lg border shadow-sm p-4 flex items-center gap-3">
            <div className="rounded-full p-2.5" style={{ background: bg }}><Icon className="w-5 h-5" style={{ color }} /></div>
            <div><div className="text-xs text-gray-500">{label}</div><div className="text-lg font-bold" style={{ color }}>{value}</div></div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#1b3a57]">العملاء</h1>
        <div className="flex items-center gap-3">
          <div className="relative"><Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الجوال..." className="pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" /></div>
          <button onClick={openAdd} className="flex items-center gap-2 bg-[#1b6ca8] text-white px-4 py-2 rounded-md text-sm hover:bg-[#15598d]"><Plus className="w-4 h-4" /> إضافة</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="apex-table">
          <thead><tr><th>#</th><th>الاسم</th><th>الجوال</th><th>البريد الإلكتروني</th><th>رقم الهوية</th><th>تاريخ التسجيل</th><th>إجراءات</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
            : customers.map((c, i) => (
              <tr key={c.CUSTOMER_ID}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-medium text-[#1b3a57]">{c.FULL_NAME}</td>
                <td className="font-mono text-sm">{c.MOBILE}</td>
                <td className="text-gray-600">{c.EMAIL || "-"}</td>
                <td className="font-mono text-xs text-gray-500">{c.NATIONAL_ID || "-"}</td>
                <td className="text-gray-500">{formatDate(c.CREATED_DATE)}</td>
                <td><div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="text-xs border border-[#1b6ca8] text-[#1b6ca8] px-2 py-1 rounded hover:bg-[#1b6ca8] hover:text-white transition-colors"><Edit className="w-3 h-3 inline ml-1" />تعديل</button>
                  {isAdmin && <button onClick={() => handleDelete(c)} className="text-xs border border-red-400 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3 inline ml-1" />حذف</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="bg-[#1b3a57] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">{editing ? "تعديل العميل" : "إضافة عميل"}</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-sm font-medium block mb-1">الاسم الكامل *</label><input className={ic} value={form.fullName} onChange={s("fullName")} required /></div>
              <div><label className="text-sm font-medium block mb-1">الجوال *</label><input className={ic} value={form.mobile} onChange={s("mobile")} required /></div>
              <div><label className="text-sm font-medium block mb-1">البريد الإلكتروني</label><input type="email" className={ic} value={form.email} onChange={s("email")} /></div>
              <div><label className="text-sm font-medium block mb-1">رقم الهوية</label><input className={ic} value={form.nationalId} onChange={s("nationalId")} /></div>
              <div><label className="text-sm font-medium block mb-1">العنوان</label><input className={ic} value={form.address} onChange={s("address")} /></div>
              <div className="col-span-2"><label className="text-sm font-medium block mb-1">ملاحظات</label><textarea className={ic} value={form.notes} onChange={s("notes")} rows={2} /></div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[#1b6ca8] text-white py-2 rounded-md font-medium hover:bg-[#15598d] disabled:opacity-60"><Save className="w-4 h-4" />{loading ? "..." : "حفظ"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
