import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, formatPrice, type Unit, type UnitType } from "@/lib/api";
import { Plus, Search, Eye, Edit, Home, Maximize2, Layers, BedDouble, Bath } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const STATUS_LABELS: Record<string, string> = { AVAILABLE: "متاح", SOLD: "مباع" };
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

export default function Units() {
  const [, navigate] = useLocation();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { data: units = [], isLoading } = useQuery<Unit[]>({
    queryKey: ["units", search, statusFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter) params.set("typeId", typeFilter);
      return api.get(`/units?${params}`);
    },
    staleTime: 0,
  });

  const { data: types = [] } = useQuery<UnitType[]>({
    queryKey: ["unit-types"],
    queryFn: () => api.get("/unit-types"),
  });

  const cfg = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.AVAILABLE;

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
          <input type="text" placeholder="بحث بالكود أو الاسم..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" />
        </div>
        {["ALL", "AVAILABLE", "SOLD"].map(s => (
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

      {/* Summary count */}
      {!isLoading && (
        <div className="text-sm text-gray-500">
          إجمالي: <span className="font-semibold text-[#1b3a57]">{units.length}</span> وحدة
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">جارٍ التحميل...</div>
      ) : units.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border">لا توجد وحدات</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {units.map(unit => {
            const c = cfg(unit.STATUS);
            const isHovered = hoveredId === unit.UNIT_ID;
            return (
              <div key={unit.UNIT_ID}
                onMouseEnter={() => setHoveredId(unit.UNIT_ID)}
                onMouseLeave={() => setHoveredId(null)}
                className={`bg-white rounded-xl shadow-sm border-2 ${c.border} transition-all duration-200 hover:shadow-lg hover:-translate-y-1 flex flex-col overflow-hidden relative`}>

                {/* Colored header */}
                <div className={`${c.header} text-white px-4 py-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm leading-tight truncate">{unit.UNIT_NAME}</div>
                      <div className="text-xs text-white/75 mt-0.5 font-mono">{unit.UNIT_CODE}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${c.badge}`}>
                      {STATUS_LABELS[unit.STATUS] ?? unit.STATUS}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4 flex-1 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Home className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>{unit.TYPE_NAME}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Maximize2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>{unit.AREA} م²</span>
                    {unit.SALEABLE_AREA && unit.SALEABLE_AREA !== unit.AREA && (
                      <span className="text-gray-400">/ بيعي: {unit.SALEABLE_AREA} م²</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{unit.PROJECT_NAME} · {unit.FLOOR_NAME || unit.FLOOR_NUMBER}</div>
                  <div className="text-[#1b6ca8] font-bold text-base pt-1 border-t border-gray-100">
                    {formatPrice(unit.PRICE)}
                  </div>
                </div>

                {/* Hover tooltip — extra details */}
                {isHovered && (
                  <div className="absolute inset-x-0 bottom-[56px] bg-[#1b3a57] text-white text-xs rounded-t-lg px-4 py-3 space-y-1.5 z-10 shadow-xl">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
                      <span className="text-white/70">المبنى:</span>
                      <span className="font-medium">{unit.BUILDING_NAME}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
                      <span className="text-white/70">الدور:</span>
                      <span className="font-medium">{unit.FLOOR_NAME || unit.FLOOR_NUMBER}</span>
                    </div>
                    {(unit.ROOMS > 0 || unit.BATHROOMS > 0) && (
                      <div className="flex gap-4">
                        {unit.ROOMS > 0 && (
                          <div className="flex items-center gap-1.5">
                            <BedDouble className="w-3.5 h-3.5 text-blue-300" />
                            <span>{unit.ROOMS} غرف</span>
                          </div>
                        )}
                        {unit.BATHROOMS > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Bath className="w-3.5 h-3.5 text-blue-300" />
                            <span>{unit.BATHROOMS} حمامات</span>
                          </div>
                        )}
                      </div>
                    )}
                    {unit.DESCRIPTION && (
                      <div className="text-white/60 truncate pt-0.5 border-t border-white/10">{unit.DESCRIPTION}</div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 pb-4 flex gap-2">
                  <button onClick={() => navigate(`/units/${unit.UNIT_ID}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-[#1b6ca8] text-[#1b6ca8] rounded-lg hover:bg-[#1b6ca8] hover:text-white transition-colors font-medium">
                    <Eye className="w-3.5 h-3.5" /> عرض
                  </button>
                  {isAdmin && unit.STATUS !== "SOLD" && (
                    <button onClick={() => navigate(`/units/${unit.UNIT_ID}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                      <Edit className="w-3.5 h-3.5" /> تعديل
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
