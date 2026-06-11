import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatPrice, type Villa, type Project } from "@/lib/api";
import { Plus, Search, Edit, Trash2, X, Save, Home, Maximize2, BedDouble, Bath } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const STATUS_LABELS: Record<string, string> = { AVAILABLE: "متاح", SOLD: "مباع", RESERVED: "محجوز" };
const STATUS_CONFIG: Record<string, { border: string; header: string; badge: string }> = {
  AVAILABLE: {
    border: "border-emerald-400",
    header: "bg-gradient-to-l from-emerald-600 to-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  SOLD: {
    border: "border-rose-400",
    header: "bg-gradient-to-l from-rose-600 to-rose-500",
    badge: "bg-rose-100 text-rose-700 border border-rose-200",
  },
  RESERVED: {
    border: "border-amber-400",
    header: "bg-gradient-to-l from-amber-500 to-amber-400",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
  },
};

const emptyForm = {
  projectId: "", villaCode: "", villaName: "", area: "", landArea: "",
  rooms: "0", bathrooms: "0", price: "", status: "AVAILABLE", description: "",
};

export default function Villas() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Villa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const { data: villas = [], isLoading } = useQuery<Villa[]>({
    queryKey: ["villas", search, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (projectFilter) params.set("projectId", projectFilter);
      return api.get(`/villas?${params}`);
    },
    staleTime: 0,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects"),
  });

  const cfg = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.AVAILABLE;
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]";

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (v: Villa) => {
    setEditing(v);
    setForm({
      projectId: String(v.PROJECT_ID),
      villaCode: v.VILLA_CODE,
      villaName: v.VILLA_NAME,
      area: String(v.AREA),
      landArea: v.LAND_AREA != null ? String(v.LAND_AREA) : "",
      rooms: String(v.ROOMS),
      bathrooms: String(v.BATHROOMS),
      price: String(v.PRICE),
      status: v.STATUS,
      description: v.DESCRIPTION || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId || !form.villaCode || !form.villaName || !form.area || !form.price) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة"); return;
    }
    if (Number(form.area) <= 0) { toast.error("المساحة يجب أن تكون أكبر من 0"); return; }
    setLoading(true);
    try {
      const body = {
        projectId: Number(form.projectId),
        villaCode: form.villaCode,
        villaName: form.villaName,
        area: Number(form.area),
        landArea: form.landArea ? Number(form.landArea) : null,
        rooms: Number(form.rooms),
        bathrooms: Number(form.bathrooms),
        price: Number(form.price),
        status: form.status,
        description: form.description || null,
      };
      if (editing) {
        await api.put(`/villas/${editing.VILLA_ID}`, body);
        toast.success("تم تحديث الفيلا");
      } else {
        await api.post("/villas", body);
        toast.success("تمت إضافة الفيلا");
      }
      qc.invalidateQueries({ queryKey: ["villas"] });
      setShowModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (v: Villa) => {
    if (v.STATUS === "SOLD") { toast.error("لا يمكن حذف فيلا مباعة"); return; }
    if (!confirm(`هل أنت متأكد من حذف "${v.VILLA_NAME}"؟`)) return;
    try {
      await api.delete(`/villas/${v.VILLA_ID}`);
      toast.success("تم حذف الفيلا");
      qc.invalidateQueries({ queryKey: ["villas"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0D4D3A]">الفلل</h1>
        {isAdmin && (
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-[#1A8A6C] text-white px-4 py-2 rounded-md text-sm hover:bg-[#147A5E] transition-colors">
            <Plus className="w-4 h-4" /> إضافة فيلا
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="بحث بالكود أو الاسم..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]" />
        </div>
        {["ALL", "AVAILABLE", "SOLD", "RESERVED"].map(st => (
          <button key={st} onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${statusFilter === st ? "bg-[#1A8A6C] text-white border-[#1A8A6C]" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            {st === "ALL" ? "الكل" : STATUS_LABELS[st]}
          </button>
        ))}
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]">
          <option value="">جميع المشاريع</option>
          {projects.map(p => <option key={p.PROJECT_ID} value={p.PROJECT_ID}>{p.PROJECT_NAME}</option>)}
        </select>
      </div>

      {/* Summary count */}
      {!isLoading && (
        <div className="text-sm text-gray-500">
          إجمالي: <span className="font-semibold text-[#0D4D3A]">{villas.length}</span> فيلا
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">جارٍ التحميل...</div>
      ) : villas.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border">لا توجد فلل</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {villas.map(villa => {
            const c = cfg(villa.STATUS);
            return (
              <div key={villa.VILLA_ID}
                className={`bg-white rounded-xl shadow-sm border-2 ${c.border} transition-all duration-200 hover:shadow-lg hover:-translate-y-1 flex flex-col overflow-hidden`}>

                {/* Colored header */}
                <div className={`${c.header} text-white px-4 py-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm leading-tight truncate">{villa.VILLA_NAME}</div>
                      <div className="text-xs text-white/75 mt-0.5 font-mono">{villa.VILLA_CODE}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${c.badge}`}>
                      {STATUS_LABELS[villa.STATUS] ?? villa.STATUS}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4 flex-1 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Home className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{villa.PROJECT_NAME}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Maximize2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>{villa.AREA} م²</span>
                    {villa.LAND_AREA != null && villa.LAND_AREA !== villa.AREA && (
                      <span className="text-gray-400">/ قطعة: {villa.LAND_AREA} م²</span>
                    )}
                  </div>
                  {(villa.ROOMS > 0 || villa.BATHROOMS > 0) && (
                    <div className="flex gap-3 text-xs text-gray-600">
                      {villa.ROOMS > 0 && (
                        <div className="flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-gray-400" />
                          <span>{villa.ROOMS} غرف</span>
                        </div>
                      )}
                      {villa.BATHROOMS > 0 && (
                        <div className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5 text-gray-400" />
                          <span>{villa.BATHROOMS} حمامات</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-[#1A8A6C] font-bold text-base pt-1 border-t border-gray-100">
                    {formatPrice(villa.PRICE)}
                  </div>
                </div>

                {/* Actions */}
                {isAdmin && (
                  <div className="px-4 pb-4 flex gap-2">
                    {villa.STATUS !== "SOLD" && (
                      <button onClick={() => openEdit(villa)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-[#1A8A6C] text-[#1A8A6C] rounded-lg hover:bg-[#1A8A6C] hover:text-white transition-colors font-medium">
                        <Edit className="w-3.5 h-3.5" /> تعديل
                      </button>
                    )}
                    <button onClick={() => handleDelete(villa)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-red-400 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium">
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="bg-[#0D4D3A] text-white px-5 py-3 rounded-t-lg flex items-center justify-between flex-shrink-0">
              <span className="font-semibold">{editing ? "تعديل الفيلا" : "إضافة فيلا جديدة"}</span>
              <button onClick={() => setShowModal(false)} className="hover:text-white/70"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-sm font-medium block mb-1">المشروع *</label>
                <select className={ic} value={form.projectId} onChange={s("projectId")} required>
                  <option value="">-- اختر المشروع --</option>
                  {projects.map(p => <option key={p.PROJECT_ID} value={p.PROJECT_ID}>{p.PROJECT_NAME}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">كود الفيلا *</label>
                  <input className={ic} value={form.villaCode} onChange={s("villaCode")} required placeholder="VL-001" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">اسم الفيلا *</label>
                  <input className={ic} value={form.villaName} onChange={s("villaName")} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">المساحة الإنشائية (م²) *</label>
                  <input type="number" step="0.01" className={ic} value={form.area} onChange={s("area")} min={0.01} required />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">مساحة القطعة (م²)</label>
                  <input type="number" step="0.01" className={ic} value={form.landArea} onChange={s("landArea")} min={0} placeholder="اختياري" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">عدد الغرف</label>
                  <input type="number" className={ic} value={form.rooms} onChange={s("rooms")} min={0} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">عدد الحمامات</label>
                  <input type="number" className={ic} value={form.bathrooms} onChange={s("bathrooms")} min={0} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">السعر (ريال) *</label>
                <input type="number" className={ic} value={form.price} onChange={s("price")} min={0} required />
              </div>
              {editing && (
                <div>
                  <label className="text-sm font-medium block mb-1">الحالة</label>
                  <select className={ic} value={form.status} onChange={s("status")}>
                    <option value="AVAILABLE">متاح</option>
                    <option value="RESERVED">محجوز</option>
                    <option value="SOLD">مباع</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1">الوصف</label>
                <textarea className={ic} value={form.description} onChange={s("description")} rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1A8A6C] text-white py-2 rounded-md font-medium hover:bg-[#147A5E] disabled:opacity-60">
                  <Save className="w-4 h-4" />{loading ? "جارٍ الحفظ..." : "حفظ"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
