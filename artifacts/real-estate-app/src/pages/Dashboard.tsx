import { useQuery } from "@tanstack/react-query";
import { api, formatPrice, formatDate, type DashboardKpis, type VillaKpis, type VillaProgress } from "@/lib/api";
import { Building2, Home, TrendingUp, DollarSign, CheckCircle, Clock, AlertCircle } from "lucide-react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["#1A8A6C", "#25B897", "#2e7d32", "#1A9B7A", "#dc3545", "#6c757d", "#8e44ad", "#e67e22"];

const STATUS_AR: Record<string, string> = {
  AVAILABLE: "متاحة",
  SOLD: "مباعة",
  RESERVED: "محجوزة",
};
const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#2e7d32",
  SOLD: "#dc3545",
  RESERVED: "#25B897",
};

export default function Dashboard() {
  const { data: kpis, isLoading: kpiLoading } = useQuery<DashboardKpis>({
    queryKey: ["dashboard-kpis"],
    queryFn: () => api.get("/dashboard/kpis"),
    refetchInterval: 30_000,
  });

  const { data: byType } = useQuery<{ TYPE_NAME: string; COUNT: number }[]>({
    queryKey: ["dashboard-by-type"],
    queryFn: () => api.get("/dashboard/units-by-type"),
    refetchInterval: 30_000,
  });

  const { data: byStatus } = useQuery<{ STATUS: string; COUNT: number }[]>({
    queryKey: ["dashboard-units-status"],
    queryFn: () => api.get("/dashboard/units-status"),
    refetchInterval: 30_000,
  });

  const { data: villaKpis } = useQuery<VillaKpis>({
    queryKey: ["dashboard-villa-kpis"],
    queryFn: () => api.get("/dashboard/villa-kpis"),
    refetchInterval: 30_000,
  });

  const { data: villasProgress = [] } = useQuery<VillaProgress[]>({
    queryKey: ["dashboard-villas-progress"],
    queryFn: () => api.get("/dashboard/villas-progress"),
    refetchInterval: 30_000,
  });

  const kpiCards = [
    { label: "إجمالي الوحدات", value: kpis?.totalUnits ?? 0, icon: Building2, color: "#1A8A6C", bg: "#e8f0f8" },
    { label: "وحدات مباعة", value: kpis?.soldUnits ?? 0, icon: Home, color: "#dc3545", bg: "#fce8ea" },
    { label: "وحدات متاحة", value: kpis?.availableUnits ?? 0, icon: TrendingUp, color: "#2e7d32", bg: "#e8f5e9" },
    { label: "قيمة المبيعات", value: formatPrice(kpis?.totalSalesValue ?? 0), icon: DollarSign, color: "#25B897", bg: "#fff8e1" },
  ];

  const villaKpiCards = [
    { label: "إجمالي الفلل", value: villaKpis?.totalVillas ?? 0, icon: Building2, color: "#1A8A6C", bg: "#e8f5f0" },
    { label: "فلل متاحة", value: villaKpis?.availableVillas ?? 0, icon: CheckCircle, color: "#2e7d32", bg: "#e8f5e9" },
    { label: "مباعة جزئياً", value: villaKpis?.partiallySoldVillas ?? 0, icon: Clock, color: "#f59e0b", bg: "#fffbeb" },
    { label: "مباعة كلياً", value: villaKpis?.fullySoldVillas ?? 0, icon: AlertCircle, color: "#dc3545", bg: "#fce8ea" },
  ];

  const typeData = (byType ?? []).filter(d => d.COUNT > 0);
  const statusData = (byStatus ?? []).map(d => ({ ...d, name: STATUS_AR[d.STATUS] ?? d.STATUS }));
  const progressData = villasProgress.filter(v => v.TOTAL_UNITS > 0);

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0D4D3A]">لوحة التحكم</h1>
        <span className="text-xs text-gray-500">يتجدد كل 30 ثانية</span>
      </div>

      {/* Unit KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="rounded-full p-3 flex-shrink-0" style={{ background: bg }}>
              <Icon className="w-6 h-6" style={{ color }} />
            </div>
            <div>
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-lg font-bold" style={{ color }}>
                {kpiLoading ? "..." : value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Villa KPI Cards */}
      {villaKpis && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0D4D3A] border-r-4 border-[#1A8A6C] pr-2">إحصائيات الفلل</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {villaKpiCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-4">
                <div className="rounded-full p-3 flex-shrink-0" style={{ background: bg }}>
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-lg font-bold" style={{ color }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Units by type */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-[#0D4D3A] mb-3 text-sm">الوحدات حسب النوع</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeData} dataKey="COUNT" nameKey="TYPE_NAME" cx="50%" cy="50%" outerRadius={75} innerRadius={30}>
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(val, _name, props) => [`${val} وحدة`, props.payload?.TYPE_NAME]} />
              <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Units status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-[#0D4D3A] mb-3 text-sm">حالة الوحدات</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData} dataKey="COUNT" nameKey="name"
                cx="50%" cy="50%" outerRadius={75} innerRadius={30}
                label={({ name, COUNT, percent }) => percent > 0.05 ? `${name}: ${COUNT}` : ""}
                labelLine={false}
              >
                {statusData.map((item, i) => (
                  <Cell key={i} fill={STATUS_COLOR[item.STATUS] ?? COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val, _name, props) => [`${val} وحدة`, props.payload?.name]} />
              <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Villa Progress Bar Chart */}
      {progressData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-[#0D4D3A] mb-3 text-sm">تقدم مبيعات الفلل (الوحدات)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={progressData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="VILLA_NAME" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
              <Bar dataKey="SOLD_UNITS" name="مباعة" fill="#dc3545" radius={[3, 3, 0, 0]} />
              <Bar dataKey="AVAILABLE_UNITS" name="متاحة" fill="#1A8A6C" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="bg-[#0D4D3A] text-white px-4 py-2 rounded-t-lg text-sm font-medium">
          آخر المبيعات
        </div>
        <div className="overflow-x-auto">
          <table className="apex-table">
            <thead>
              <tr>
                <th>كود الوحدة</th><th>اسم الوحدة</th><th>العميل</th><th>قيمة البيع</th><th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(kpis?.recentSales ?? []).map((s) => (
                <tr key={s.SALE_ID}>
                  <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{s.UNIT_CODE}</span></td>
                  <td>{s.UNIT_NAME}</td>
                  <td>{s.CUSTOMER_NAME}</td>
                  <td className="text-[#2e7d32] font-semibold">{formatPrice(s.SALE_AMOUNT)}</td>
                  <td>{formatDate(s.SALE_DATE)}</td>
                </tr>
              ))}
              {(kpis?.recentSales?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">لا توجد مبيعات حتى الآن</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
