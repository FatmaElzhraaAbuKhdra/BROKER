import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { api, formatPrice, type Villa, type Unit } from "@/lib/api";
import { ArrowRight, Home, Maximize2, BedDouble, Bath, Layers, Eye, Building } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const UNIT_STATUS_LABELS: Record<string, string> = { AVAILABLE: "متاح", SOLD: "مباع", RESERVED: "محجوز" };

const VILLA_DISPLAY: Record<string, { badge: string; label: string }> = {
  AVAILABLE:      { badge: "bg-emerald-100 text-emerald-700", label: "متاح" },
  PARTIALLY_SOLD: { badge: "bg-amber-100 text-amber-700",     label: "مباع جزئياً" },
  FULLY_SOLD:     { badge: "bg-rose-100 text-rose-700",       label: "مباع كلياً" },
  RESERVED:       { badge: "bg-blue-100 text-blue-700",       label: "محجوز" },
};

const UNIT_STATUS_CONFIG: Record<string, { border: string; header: string; badge: string }> = {
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

export default function VillaDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAdmin } = useAuth();

  const { data: villa, isLoading: villaLoading } = useQuery<Villa>({
    queryKey: ["villa", id],
    queryFn: () => api.get(`/villas/${id}`),
    enabled: Boolean(id),
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["villa-units", id],
    queryFn: () => api.get(`/villas/${id}/units`),
    enabled: Boolean(id),
    staleTime: 0,
  });

  if (villaLoading) {
    return (
      <div dir="rtl" className="flex items-center justify-center py-20 text-[#1A8A6C]">
        جارٍ التحميل...
      </div>
    );
  }

  if (!villa) {
    return (
      <div dir="rtl" className="text-center py-20 text-gray-400">
        الفيلا غير موجودة
      </div>
    );
  }

  const soldUnits = units.filter(u => u.STATUS === "SOLD").length;
  const availableUnits = units.filter(u => u.STATUS === "AVAILABLE").length;
  const progress = units.length > 0 ? Math.round((soldUnits / units.length) * 100) : 0;
  const progressColor = progress === 100 ? "#dc3545" : progress > 0 ? "#f59e0b" : "#1A8A6C";

  const villaDisplayStatus = unitsLoading || units.length === 0
    ? (villa.STATUS === "RESERVED" ? "RESERVED" : "AVAILABLE")
    : soldUnits >= units.length ? "FULLY_SOLD"
    : soldUnits > 0 ? "PARTIALLY_SOLD"
    : "AVAILABLE";
  const vd = VILLA_DISPLAY[villaDisplayStatus] ?? VILLA_DISPLAY.AVAILABLE;

  return (
    <div dir="rtl" className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/villas")}
          className="text-[#1A8A6C] hover:underline flex items-center gap-1 text-sm">
          <ArrowRight className="w-4 h-4" /> الفلل
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-700">{villa.VILLA_NAME}</span>
      </div>

      {/* Villa Info Card */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-l from-[#0D4D3A] to-[#1A8A6C] text-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">{villa.VILLA_NAME}</h1>
              <div className="text-white/75 text-sm font-mono mt-0.5">{villa.VILLA_CODE}</div>
              <div className="text-white/75 text-sm mt-1">{villa.PROJECT_NAME}</div>
            </div>
            <div className="text-left shrink-0">
              <div className="text-2xl font-bold">{formatPrice(villa.PRICE)}</div>
              <div className="flex items-center gap-2 mt-1 justify-end flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vd.badge}`}>
                  {vd.label}
                </span>
                {!unitsLoading && units.length > 0 && (
                  <span className="text-xs text-white/80 font-mono">
                    {soldUnits} من {units.length} مباع
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">المساحة الإنشائية</div>
            <div className="font-bold text-[#0D4D3A]">{villa.AREA} م²</div>
          </div>
          {villa.LAND_AREA != null && (
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">مساحة القطعة</div>
              <div className="font-bold text-[#0D4D3A]">{villa.LAND_AREA} م²</div>
            </div>
          )}
          {villa.ROOMS > 0 && (
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">الغرف</div>
              <div className="font-bold text-[#0D4D3A]">{villa.ROOMS}</div>
            </div>
          )}
          {villa.BATHROOMS > 0 && (
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">الحمامات</div>
              <div className="font-bold text-[#0D4D3A]">{villa.BATHROOMS}</div>
            </div>
          )}
        </div>

        {villa.DESCRIPTION && (
          <div className="px-5 pb-4 text-sm text-gray-600 border-t pt-3 mx-5">{villa.DESCRIPTION}</div>
        )}
      </div>

      {/* Units Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#0D4D3A]">وحدات الفيلا</h2>
            {!unitsLoading && (
              <div className="flex gap-2 text-xs">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{availableUnits} متاح</span>
                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">{soldUnits} مباع</span>
              </div>
            )}
          </div>
          {!unitsLoading && units.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-24 bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${progress}%`, backgroundColor: progressColor }} />
              </div>
              <span>{progress}%</span>
            </div>
          )}
        </div>

        {unitsLoading ? (
          <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
        ) : units.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-lg border">
            <Building className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <div>لا توجد وحدات مرتبطة بهذه الفيلا</div>
            {isAdmin && (
              <div className="mt-2 text-xs text-gray-400">
                يمكنك ربط الوحدات بالفيلا من خلال نموذج تعديل الوحدة
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {units.map(unit => {
              const c = UNIT_STATUS_CONFIG[unit.STATUS] ?? UNIT_STATUS_CONFIG.AVAILABLE;
              return (
                <div key={unit.UNIT_ID}
                  className={`bg-white rounded-xl shadow-sm border-2 ${c.border} transition-all duration-200 hover:shadow-lg hover:-translate-y-1 flex flex-col overflow-hidden`}>

                  <div className={`${c.header} text-white px-4 py-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm leading-tight truncate">{unit.UNIT_NAME}</div>
                        <div className="text-xs text-white/75 mt-0.5 font-mono">{unit.UNIT_CODE}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${c.badge}`}>
                        {UNIT_STATUS_LABELS[unit.STATUS] ?? unit.STATUS}
                      </span>
                    </div>
                  </div>

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
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Layers className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{unit.BUILDING_NAME} · {unit.FLOOR_NAME || unit.FLOOR_NUMBER}</span>
                    </div>
                    {(unit.ROOMS > 0 || unit.BATHROOMS > 0) && (
                      <div className="flex gap-3 text-xs text-gray-600">
                        {unit.ROOMS > 0 && <div className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-gray-400" /><span>{unit.ROOMS}</span></div>}
                        {unit.BATHROOMS > 0 && <div className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-gray-400" /><span>{unit.BATHROOMS}</span></div>}
                      </div>
                    )}
                    <div className="text-[#1A8A6C] font-bold text-base pt-1 border-t border-gray-100">
                      {formatPrice(unit.PRICE)}
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <button onClick={() => navigate(`/units/${unit.UNIT_ID}`)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs py-2 border border-[#1A8A6C] text-[#1A8A6C] rounded-lg hover:bg-[#1A8A6C] hover:text-white transition-colors font-medium">
                      <Eye className="w-3.5 h-3.5" /> عرض التفاصيل
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
