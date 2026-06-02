import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, formatPrice, type Unit, type UnitType } from "@/lib/api";
import { Plus, Search, Eye, Edit, Trash2, Home } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const STATUS_LABELS: Record<string, string> = { AVAILABLE: "متاح", SOLD: "مباع", RESERVED: "محجوز" };
const STATUS_CLASSES: Record<string, string> = { AVAILABLE: "badge-available", SOLD: "badge-sold", RESERVED: "badge-reserved" };

export default function Units() {
  const [, navigate] = useLocation();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("");
  const [hoveredUnit, setHoveredUnit] = useState<number | null>(null);

  const { data: units = [], isLoading } = useQuery<Unit[]>({
    queryKey: ["units", search, statusFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter) params.set("typeId", typeFilter);
      return api.get(`/units?${params}`);
    },
  });

  const { data: types = [] } = useQuery<UnitType[]>({
    queryKey: ["unit-types"],
    queryFn: () => api.get("/unit-types"),
  });

  const handleDelete = async (unit: Unit) => {
    if (unit.STATUS === "SOLD") { toast.error("لا يمكن حذف وحدة مباعة"); return; }
    if (!confirm(`هل أنت متأكد من حذف ${unit.UNIT_NAME}؟`)) return;
    try {
      await api.delete(`/units/${unit.UNIT_ID}`);
      toast.success("تم حذف الوحدة");
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1b3a57]">الوحدات العقارية</h1>
        {isAdmin && (
          <button onClick={() => navigate("/units/new")}
            className="flex items-center gap-2 bg-[#1b6ca8] text-white px-4 py-2 rounded-md text-sm hover:bg-[#15598d] transition-colors">
            <Plus className="w-4 h-4" /> إضافة وحدة
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="بحث بالكود أو الاسم..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" />
        </div>
        {["ALL", "AVAILABLE", "SOLD", "RESERVED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${statusFilter === s ? "bg-[#1b6ca8] text-white border-[#1b6ca8]" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            {s === "ALL" ? "الكل" : STATUS_LABELS[s]}
          </button>
        ))}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]">
          <option value="">جميع الأنواع</option>
          {types.map(t => <option key={t.TYPE_ID} value={t.TYPE_ID}>{t.TYPE_NAME}</option>)}
        </select>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">جارٍ التحميل...</div>
      ) : units.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border">لا توجد وحدات</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {units.map(unit => (
            <div key={unit.UNIT_ID}
              className="bg-white rounded-lg shadow-sm border-2 transition-all duration-200 cursor-pointer relative group"
              style={{ borderColor: unit.STATUS === "SOLD" ? "#dc3545" : unit.STATUS === "RESERVED" ? "#f0a500" : "#2e7d32" }}
              onMouseEnter={() => setHoveredUnit(unit.UNIT_ID)}
              onMouseLeave={() => setHoveredUnit(null)}
              onClick={() => navigate(`/units/${unit.UNIT_ID}`)}>

              {/* Card header */}
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-[#1b3a57] leading-tight">{unit.UNIT_NAME}</div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{unit.UNIT_CODE}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_CLASSES[unit.STATUS]}`}>
                    {STATUS_LABELS[unit.STATUS]}
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-3 space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-1"><Home className="w-3 h-3" /><span>{unit.TYPE_NAME}</span></div>
                <div className="text-[#1b6ca8] font-bold text-base">{formatPrice(unit.PRICE)}</div>
                <div className="text-gray-400 text-xs">{unit.PROJECT_NAME}</div>
              </div>

              {/* Hover tooltip */}
              {hoveredUnit === unit.UNIT_ID && (
                <div className="absolute z-50 bottom-full right-0 mb-2 w-52 bg-[#1b3a57] text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
                  <div className="font-semibold mb-2 border-b border-white/20 pb-1">{unit.UNIT_CODE}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span>المساحة:</span><span>{unit.AREA} م²</span></div>
                    <div className="flex justify-between"><span>الطابق:</span><span>{unit.FLOOR_NAME || unit.FLOOR_NUMBER}</span></div>
                    <div className="flex justify-between"><span>الغرف:</span><span>{unit.ROOMS}</span></div>
                    <div className="flex justify-between"><span>الحمامات:</span><span>{unit.BATHROOMS}</span></div>
                    <div className="flex justify-between"><span>السعر:</span><span>{formatPrice(unit.PRICE)}</span></div>
                    <div className="flex justify-between"><span>المشروع:</span><span className="text-right">{unit.PROJECT_NAME}</span></div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-[#1b3a57] rotate-45" />
                </div>
              )}

              {/* Actions */}
              <div className="px-3 pb-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => navigate(`/units/${unit.UNIT_ID}`)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 border border-[#1b6ca8] text-[#1b6ca8] rounded hover:bg-[#1b6ca8] hover:text-white transition-colors">
                  <Eye className="w-3 h-3" /> عرض
                </button>
                {isAdmin && unit.STATUS !== "SOLD" && (
                  <>
                    <button onClick={() => navigate(`/units/${unit.UNIT_ID}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors">
                      <Edit className="w-3 h-3" /> تعديل
                    </button>
                    <button onClick={() => handleDelete(unit)}
                      className="flex items-center justify-center gap-1 text-xs py-1.5 px-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
