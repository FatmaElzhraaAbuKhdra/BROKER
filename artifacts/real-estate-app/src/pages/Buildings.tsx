import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Building, type Project } from "@/lib/api";
import { Plus, Edit, Trash2, X, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function Buildings() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [loading, setLoading] = useState(false);
  const empty = { projectId: "", buildingName: "", buildingCode: "", floorsCount: "0", landArea: "", totalSaleableArea: "", description: "" };
  const [form, setForm] = useState(empty);

  const { data: buildings = [], isLoading } = useQuery<Building[]>({ queryKey: ["buildings"], queryFn: () => api.get("/buildings") });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["projects"], queryFn: () => api.get("/projects") });
  const filtered = buildings.filter(b => !search || b.BUILDING_NAME.includes(search) || b.PROJECT_NAME.includes(search));

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (b: Building) => {
    setEditing(b);
    setForm({
      projectId: String(b.PROJECT_ID),
      buildingName: b.BUILDING_NAME,
      buildingCode: b.BUILDING_CODE || "",
      floorsCount: String(b.FLOORS_COUNT),
      landArea: b.LAND_AREA != null ? String(b.LAND_AREA) : "",
      totalSaleableArea: b.TOTAL_SALEABLE_AREA != null ? String(b.TOTAL_SALEABLE_AREA) : "",
      description: b.DESCRIPTION || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId || !form.buildingName) { toast.error("المشروع واسم المبنى مطلوبان"); return; }
    setLoading(true);
    try {
      const body = {
        ...form,
        projectId: Number(form.projectId),
        floorsCount: Number(form.floorsCount),
        landArea: form.landArea ? Number(form.landArea) : null,
        totalSaleableArea: form.totalSaleableArea ? Number(form.totalSaleableArea) : null,
      };
      if (editing) { await api.put(`/buildings/${editing.BUILDING_ID}`, body); toast.success("تم تحديث المبنى"); }
      else { await api.post("/buildings", body); toast.success("تمت إضافة المبنى"); }
      qc.invalidateQueries({ queryKey: ["buildings"] });
      setShowModal(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (b: Building) => {
    if (!confirm(`حذف "${b.BUILDING_NAME}"؟`)) return;
    try { await api.delete(`/buildings/${b.BUILDING_ID}`); toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["buildings"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
  };

  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]";

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#1b3a57]">المباني</h1>
        <div className="flex items-center gap-3">
          <div className="relative"><Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" /></div>
          {isAdmin && <button onClick={openAdd} className="flex items-center gap-2 bg-[#1b6ca8] text-white px-4 py-2 rounded-md text-sm hover:bg-[#15598d]"><Plus className="w-4 h-4" /> إضافة</button>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="apex-table">
          <thead><tr><th>#</th><th>المبنى</th><th>الكود</th><th>المشروع</th><th>عدد الأدوار</th><th>مساحة القطعة (م²)</th><th>إجمالي المساحات البيعية (م²)</th>{isAdmin && <th>إجراءات</th>}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
            : filtered.map((b, i) => (
              <tr key={b.BUILDING_ID}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-medium text-[#1b3a57]">{b.BUILDING_NAME}</td>
                <td className="font-mono text-xs text-gray-500">{b.BUILDING_CODE || "-"}</td>
                <td className="text-gray-600">{b.PROJECT_NAME}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-2 bg-[#1b6ca8] rounded-full" style={{ width: `${Math.min(100, (b.FLOORS_COUNT / 30) * 100)}%` }} />
                    </div>
                    <span className="text-sm">{b.FLOORS_COUNT}</span>
                  </div>
                </td>
                <td className="text-gray-700 font-mono">{b.LAND_AREA != null ? Number(b.LAND_AREA).toLocaleString("ar-SA") : <span className="text-gray-300">-</span>}</td>
                <td className="text-gray-700 font-mono">{b.TOTAL_SALEABLE_AREA != null ? Number(b.TOTAL_SALEABLE_AREA).toLocaleString("ar-SA") : <span className="text-gray-300">-</span>}</td>
                {isAdmin && <td><div className="flex gap-2">
                  <button onClick={() => openEdit(b)} className="text-xs border border-[#1b6ca8] text-[#1b6ca8] px-2 py-1 rounded hover:bg-[#1b6ca8] hover:text-white transition-colors"><Edit className="w-3 h-3 inline ml-1" />تعديل</button>
                  <button onClick={() => handleDelete(b)} className="text-xs border border-red-400 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3 inline ml-1" />حذف</button>
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
              <span className="font-semibold">{editing ? "تعديل المبنى" : "إضافة مبنى"}</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div><label className="text-sm font-medium block mb-1">المشروع *</label><select className={ic} value={form.projectId} onChange={s("projectId")} required><option value="">-- اختر المشروع --</option>{projects.map(p => <option key={p.PROJECT_ID} value={p.PROJECT_ID}>{p.PROJECT_NAME}</option>)}</select></div>
              <div><label className="text-sm font-medium block mb-1">اسم المبنى *</label><input className={ic} value={form.buildingName} onChange={s("buildingName")} required /></div>
              <div><label className="text-sm font-medium block mb-1">كود المبنى</label><input className={ic} value={form.buildingCode} onChange={s("buildingCode")} /></div>
              <div><label className="text-sm font-medium block mb-1">عدد الأدوار</label><input type="number" className={ic} value={form.floorsCount} onChange={s("floorsCount")} min={0} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium block mb-1">مساحة القطعة (م²)</label><input type="number" step="0.01" className={ic} value={form.landArea} onChange={s("landArea")} min={0} placeholder="260.00" /></div>
                <div><label className="text-sm font-medium block mb-1">إجمالي المساحات البيعية (م²)</label><input type="number" step="0.01" className={ic} value={form.totalSaleableArea} onChange={s("totalSaleableArea")} min={0} placeholder="417.50" /></div>
              </div>
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
