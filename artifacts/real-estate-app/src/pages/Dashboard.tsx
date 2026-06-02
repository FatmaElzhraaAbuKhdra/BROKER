import { useQuery } from "@tanstack/react-query";
import { api, formatPrice, formatDate, type DashboardKpis } from "@/lib/api";
import { Building2, Home, TrendingUp, DollarSign } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#1b6ca8", "#f0a500", "#2e7d32", "#0d7a8a", "#dc3545", "#6c757d"];

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

  const { data: byProject } = useQuery<{ PROJECT_NAME: string; SALES_COUNT: number; TOTAL_AMOUNT: number }[]>({
    queryKey: ["dashboard-by-project"],
    queryFn: () => api.get("/dashboard/sales-by-project"),
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
    { label: "وحدات متاحة", value: kpis?.availableUnits ?? 0, icon: Home, color: "#2e7d32", bg: "#e8f5e9" },
    { label: "قيمة المبيعات", value: formatPrice(kpis?.totalSalesValue ?? 0), icon: DollarSign, color: "#f0a500", bg: "#fff8e1" },
  ];

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
        {/* Units by type — pie */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-[#1b3a57] mb-4 text-sm">الوحدات حسب النوع</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byType ?? []} dataKey="COUNT" nameKey="TYPE_NAME" cx="50%" cy="50%" outerRadius={80} label={({ TYPE_NAME, COUNT }) => `${TYPE_NAME}: ${COUNT}`}>
                {(byType ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(val) => [`${val} وحدة`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Available vs Sold — pie */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-[#1b3a57] mb-4 text-sm">حالة الوحدات</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus ?? []} dataKey="COUNT" nameKey="STATUS" cx="50%" cy="50%" outerRadius={80}
                label={({ STATUS, COUNT }) => `${STATUS === "AVAILABLE" ? "متاحة" : STATUS === "SOLD" ? "مباعة" : "محجوزة"}: ${COUNT}`}>
                {(byStatus ?? []).map((item, i) => (
                  <Cell key={i} fill={item.STATUS === "AVAILABLE" ? "#2e7d32" : item.STATUS === "SOLD" ? "#dc3545" : "#f0a500"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales by Project bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="font-semibold text-[#1b3a57] mb-4 text-sm">المبيعات حسب المشروع</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byProject ?? []} margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="PROJECT_NAME" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(val) => [formatPrice(Number(val)), "قيمة المبيعات"]} />
            <Legend />
            <Bar dataKey="TOTAL_AMOUNT" name="قيمة المبيعات" fill="#1b6ca8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
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
