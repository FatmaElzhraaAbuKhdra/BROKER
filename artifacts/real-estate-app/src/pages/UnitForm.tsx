import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { api, type Unit, type UnitType, type Project, type Building, type Floor } from "@/lib/api";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";

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

export default function UnitForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    unitCode: "", unitName: "", typeId: "", projectId: "",
    buildingId: "", floorId: "", area: "", saleableArea: "", rooms: "0",
    bathrooms: "0", price: "", description: "",
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
      });
    }
  }, [existing]);

  const { data: types = [] } = useQuery<UnitType[]>({ queryKey: ["unit-types"], queryFn: () => api.get("/unit-types") });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["projects"], queryFn: () => api.get("/projects") });
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
      const body = { ...form, typeId: Number(form.typeId), projectId: Number(form.projectId), buildingId: Number(form.buildingId), floorId: Number(form.floorId), area: Number(form.area), saleableArea: form.saleableArea ? Number(form.saleableArea) : null, rooms: Number(form.rooms), bathrooms: Number(form.bathrooms), price: Number(form.price) };
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
    </div>
  );
}
