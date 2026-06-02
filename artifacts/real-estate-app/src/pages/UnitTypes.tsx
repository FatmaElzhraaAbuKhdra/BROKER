import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatDate, type UnitType } from "@/lib/api";
import { Plus, Edit, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function UnitTypes() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UnitType | null>(null);
  const [form, setForm] = useState({ typeName: "", description: "" });
  const [loading, setLoading] = useState(false);

  const { data: types = [], isLoading } = useQuery<UnitType[]>({
    queryKey: ["unit-types"], queryFn: () => api.get("/unit-types"),
  });

  const openAdd = () => { setEditing(null); setForm({ typeName: "", description: "" }); setShowModal(true); };
  const openEdit = (t: UnitType) => { setEditing(t); setForm({ typeName: t.TYPE_NAME, description: t.DESCRIPTION || "" }); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.typeName) { toast.error("اسم النوع مطلوب"); return; }
    setLoading(true);
    try {
      if (editing) {
        await api.put(`/unit-types/${editing.TYPE_ID}`, form);
        toast.success("تم تحديث نوع الوحدة");
      } else {
        await api.post("/unit-types", form);
        toast.success("تمت إضافة نوع الوحدة");
      }
      qc.invalidateQueries({ queryKey: ["unit-types"] });
      setShowModal(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل الحفظ"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (t: UnitType) => {
    if (!confirm(`حذف "${t.TYPE_NAME}"؟`)) return;
    try {
      await api.delete(`/unit-types/${t.TYPE_ID}`);
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["unit-types"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل الحذف"); }
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1b3a57]">أنواع الوحدات</h1>
        {isAdmin && <button onClick={openAdd} className="flex items-center gap-2 bg-[#1b6ca8] text-white px-4 py-2 rounded-md text-sm hover:bg-[#15598d]"><Plus className="w-4 h-4" /> إضافة</button>}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="apex-table">
          <thead><tr><th>#</th><th>اسم النوع</th><th>الوصف</th><th>تاريخ الإضافة</th>{isAdmin && <th>إجراءات</th>}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
            : types.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">لا توجد بيانات</td></tr>
            : types.map((t, i) => (
              <tr key={t.TYPE_ID}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-medium text-[#1b3a57]">{t.TYPE_NAME}</td>
                <td className="text-gray-600">{t.DESCRIPTION || "-"}</td>
                <td className="text-gray-500">{formatDate(t.CREATED_DATE)}</td>
                {isAdmin && (
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(t)} className="text-xs border border-[#1b6ca8] text-[#1b6ca8] px-2 py-1 rounded hover:bg-[#1b6ca8] hover:text-white transition-colors">
                        <Edit className="w-3 h-3 inline ml-1" />تعديل
                      </button>
                      <button onClick={() => handleDelete(t)} className="text-xs border border-red-400 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3 h-3 inline ml-1" />حذف
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-[#1b3a57] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">{editing ? "تعديل نوع الوحدة" : "إضافة نوع وحدة"}</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">اسم النوع *</label>
                <input value={form.typeName} onChange={e => setForm(f => ({ ...f, typeName: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">الوصف</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[#1b6ca8] text-white py-2 rounded-md font-medium hover:bg-[#15598d] disabled:opacity-60">
                  <Save className="w-4 h-4" />{loading ? "جارٍ الحفظ..." : "حفظ"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
