import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatDate, type Project } from "@/lib/api";
import { Plus, Edit, Trash2, X, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const STATUS_MAP: Record<string, string> = { ACTIVE: "نشط", COMPLETED: "مكتمل", ON_HOLD: "معلق" };
const STATUS_COLORS: Record<string, string> = { ACTIVE: "badge-available", COMPLETED: "bg-blue-100 text-blue-800 border border-blue-300", ON_HOLD: "badge-reserved" };

export default function Projects() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const emptyForm = { projectName: "", location: "", description: "", startDate: "", endDate: "", status: "ACTIVE" };
  const [form, setForm] = useState(emptyForm);

  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ["projects"], queryFn: () => api.get("/projects") });
  const filtered = projects.filter(p => !search || p.PROJECT_NAME.includes(search) || (p.LOCATION || "").includes(search));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({ projectName: p.PROJECT_NAME, location: p.LOCATION || "", description: p.DESCRIPTION || "", startDate: p.START_DATE ? String(p.START_DATE).slice(0, 10) : "", endDate: p.END_DATE ? String(p.END_DATE).slice(0, 10) : "", status: p.STATUS });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectName) { toast.error("اسم المشروع مطلوب"); return; }
    setLoading(true);
    try {
      if (editing) { await api.put(`/projects/${editing.PROJECT_ID}`, form); toast.success("تم تحديث المشروع"); }
      else { await api.post("/projects", form); toast.success("تمت إضافة المشروع"); }
      qc.invalidateQueries({ queryKey: ["projects"] });
      setShowModal(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل الحفظ"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (p: Project) => {
    if (!confirm(`حذف "${p.PROJECT_NAME}"؟`)) return;
    try { await api.delete(`/projects/${p.PROJECT_ID}`); toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["projects"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "فشل الحذف"); }
  };

  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]";

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#0D4D3A]">المشاريع</h1>
        <div className="flex items-center gap-3">
          <div className="relative"><Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]" /></div>
          {isAdmin && <button onClick={openAdd} className="flex items-center gap-2 bg-[#1A8A6C] text-white px-4 py-2 rounded-md text-sm hover:bg-[#147A5E]"><Plus className="w-4 h-4" /> إضافة</button>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="apex-table">
          <thead><tr><th>#</th><th>اسم المشروع</th><th>الموقع</th><th>الحالة</th><th>تاريخ البدء</th>{isAdmin && <th>إجراءات</th>}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
            : filtered.map((p, i) => (
              <tr key={p.PROJECT_ID}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-medium text-[#0D4D3A]">{p.PROJECT_NAME}</td>
                <td className="text-gray-600">{p.LOCATION || "-"}</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.STATUS]}`}>{STATUS_MAP[p.STATUS]}</span></td>
                <td className="text-gray-500">{formatDate(p.START_DATE)}</td>
                {isAdmin && <td><div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="text-xs border border-[#1A8A6C] text-[#1A8A6C] px-2 py-1 rounded hover:bg-[#1A8A6C] hover:text-white transition-colors"><Edit className="w-3 h-3 inline ml-1" />تعديل</button>
                  <button onClick={() => handleDelete(p)} className="text-xs border border-red-400 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3 inline ml-1" />حذف</button>
                </div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="bg-[#0D4D3A] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">{editing ? "تعديل المشروع" : "إضافة مشروع"}</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-sm font-medium block mb-1">اسم المشروع *</label><input className={ic} value={form.projectName} onChange={s("projectName")} required /></div>
              <div className="col-span-2"><label className="text-sm font-medium block mb-1">الموقع</label><input className={ic} value={form.location} onChange={s("location")} /></div>
              <div><label className="text-sm font-medium block mb-1">تاريخ البدء</label><input type="date" className={ic} value={form.startDate} onChange={s("startDate")} /></div>
              <div><label className="text-sm font-medium block mb-1">تاريخ الانتهاء</label><input type="date" className={ic} value={form.endDate} onChange={s("endDate")} /></div>
              <div><label className="text-sm font-medium block mb-1">الحالة</label><select className={ic} value={form.status} onChange={s("status")}><option value="ACTIVE">نشط</option><option value="COMPLETED">مكتمل</option><option value="ON_HOLD">معلق</option></select></div>
              <div className="col-span-2"><label className="text-sm font-medium block mb-1">الوصف</label><textarea className={ic} value={form.description} onChange={s("description")} rows={2} /></div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[#1A8A6C] text-white py-2 rounded-md font-medium hover:bg-[#147A5E] disabled:opacity-60"><Save className="w-4 h-4" />{loading ? "..." : "حفظ"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
