import { useQuery } from "@tanstack/react-query";
import { api, formatPrice, formatDate, type DashboardKpis } from "@/lib/api";
import { Building2, Home, TrendingUp, DollarSign } from "lucide-react";
import {
  PieChart, Pie, Cell,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#1b6ca8", "#f0a500", "#2e7d32", "#0d7a8a", "#dc3545", "#6c757d", "#8e44ad", "#e67e22"];

const STATUS_AR: Record<string, string> = {
  AVAILABLE: "متاحة",
  SOLD: "مباعة",
  RESERVED: "محجوزة",
};
const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#2e7d32",
  SOLD: "#dc3545",
  RESERVED: "#f0a500",
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

  const kpiCards = [
    { label: "إجمالي الوحدات", value: kpis?.totalUnits ?? 0, icon: Building2, color: "#1b6ca8", bg: "#e8f0f8" },
    { label: "وحدات مباعة", value: kpis?.soldUnits ?? 0, icon: Home, color: "#dc3545", bg: "#fce8ea" },
    { label: "وحدات متاحة", value: kpis?.availableUnits ?? 0, icon: TrendingUp, color: "#2e7d32", bg: "#e8f5e9" },
    { label: "قيمة المبيعات", value: formatPrice(kpis?.totalSalesValue ?? 0), icon: DollarSign, color: "#f0a500", bg: "#fff8e1" },
  ];

  const typeData = (byType ?? []).filter(d => d.COUNT > 0);
  const statusData = (byStatus ?? []).map(d => ({ ...d, name: STATUS_AR[d.STATUS] ?? d.STATUS }));

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1b3a57]">لوحة التحكم</h1>
        <span className="text-xs text-gray-500">يتجدد كل 30 ثانية</span>
      </div>

      {/* KPI Cards */}
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Units by type — pie with legend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-[#1b3a57] mb-3 text-sm">الوحدات حسب النوع</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={typeData}
                dataKey="COUNT"
                nameKey="TYPE_NAME"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={30}
              >
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(val, _name, props) => [`${val} وحدة`, props.payload?.TYPE_NAME]} />
              <Legend
                formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Units status — pie with legend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-[#1b3a57] mb-3 text-sm">حالة الوحدات</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="COUNT"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={30}
                label={({ name, COUNT, percent }) =>
                  percent > 0.05 ? `${name}: ${COUNT}` : ""
                }
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

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="bg-[#1b3a57] text-white px-4 py-2 rounded-t-lg text-sm font-medium">
          آخر المبيعات
        </div>
        <div className="overflow-x-auto">
          <table className="apex-table">
            <thead>
              <tr>
                <th>كود الوحدة</th>
                <th>اسم الوحدة</th>
                <th>العميل</th>
                <th>قيمة البيع</th>
                <th>التاريخ</th>
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
