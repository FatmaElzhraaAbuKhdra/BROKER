import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Floor, type Building } from "@/lib/api";
import { Plus, Edit, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function Floors() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(false);
  const empty = { buildingId: "", floorNumber: "", floorName: "", description: "" };
  const [form, setForm] = useState(empty);

  const { data: floors = [], isLoading } = useQuery<Floor[]>({ queryKey: ["floors"], queryFn: () => api.get("/floors") });
  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ["buildings"], queryFn: () => api.get("/buildings") });

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (f: Floor) => { setEditing(f); setForm({ buildingId: String(f.BUILDING_ID), floorNumber: f.FLOOR_NUMBER, floorName: f.FLOOR_NAME || "", description: f.DESCRIPTION || "" }); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.buildingId || !form.floorNumber) { toast.error("المبنى ورقم الطابق مطلوبان"); return; }
    setLoading(true);
    try {
      const body = { ...form, buildingId: Number(form.buildingId) };
      if (editing) { await api.put(`/floors/${editing.FLOOR_ID}`, body); toast.success("تم تحديث الطابق"); }
      else { await api.post("/floors", body); toast.success("تمت إضافة الطابق"); }
      qc.invalidateQueries({ queryKey: ["floors"] });
      setShowModal(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (f: Floor) => {
    if (!confirm(`حذف الطابق "${f.FLOOR_NAME || f.FLOOR_NUMBER}"؟`)) return;
    try { await api.delete(`/floors/${f.FLOOR_ID}`); toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["floors"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
  };

  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]";

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1b3a57]">الأدوار</h1>
        {isAdmin && <button onClick={openAdd} className="flex items-center gap-2 bg-[#1b6ca8] text-white px-4 py-2 rounded-md text-sm hover:bg-[#15598d]"><Plus className="w-4 h-4" /> إضافة</button>}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="apex-table">
          <thead><tr><th>#</th><th>رقم الطابق</th><th>اسم الطابق</th><th>المبنى</th><th>المشروع</th>{isAdmin && <th>إجراءات</th>}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
            : floors.map((f, i) => (
              <tr key={f.FLOOR_ID}>
                <td className="text-gray-400">{i + 1}</td>
                <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{f.FLOOR_NUMBER}</span></td>
                <td className="font-medium text-[#1b3a57]">{f.FLOOR_NAME || "-"}</td>
                <td className="text-gray-600">{f.BUILDING_NAME}</td>
                <td className="text-gray-500">{f.PROJECT_NAME}</td>
                {isAdmin && <td><div className="flex gap-2">
                  <button onClick={() => openEdit(f)} className="text-xs border border-[#1b6ca8] text-[#1b6ca8] px-2 py-1 rounded hover:bg-[#1b6ca8] hover:text-white transition-colors"><Edit className="w-3 h-3 inline ml-1" />تعديل</button>
                  <button onClick={() => handleDelete(f)} className="text-xs border border-red-400 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3 inline ml-1" />حذف</button>
                </div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-[#1b3a57] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">{editing ? "تعديل الطابق" : "إضافة طابق"}</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div><label className="text-sm font-medium block mb-1">المبنى *</label><select className={ic} value={form.buildingId} onChange={s("buildingId")} required><option value="">-- اختر المبنى --</option>{buildings.map(b => <option key={b.BUILDING_ID} value={b.BUILDING_ID}>{b.BUILDING_NAME} - {b.PROJECT_NAME}</option>)}</select></div>
              <div><label className="text-sm font-medium block mb-1">رقم الطابق *</label><input className={ic} value={form.floorNumber} onChange={s("floorNumber")} required placeholder="1, 2, 3..." /></div>
              <div><label className="text-sm font-medium block mb-1">اسم الطابق</label><input className={ic} value={form.floorName} onChange={s("floorName")} placeholder="الطابق الأول" /></div>
              <div><label className="text-sm font-medium block mb-1">الوصف</label><textarea className={ic} value={form.description} onChange={s("description")} rows={2} /></div>
              <div className="flex gap-3 pt-2">
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
