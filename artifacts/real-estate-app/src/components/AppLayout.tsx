import { type ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Building2,
  Home,
  Layers,
  Users,
  ShoppingCart,
  Tags,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  TreePine,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/units", label: "الوحدات", icon: Home },
  { href: "/villas", label: "الفلل", icon: TreePine },
  { href: "/unit-types", label: "أنواع الوحدات", icon: Tags },
  { href: "/buildings", label: "المباني", icon: Building2 },
  { href: "/floors", label: "الأدوار", icon: Layers },
  { href: "/customers", label: "العملاء", icon: Users },
  { href: "/sales", label: "المبيعات", icon: ShoppingCart },
];

const adminNav: typeof nav = [];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const allNav = isAdmin ? [...nav, ...adminNav] : nav;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F5FAF8" }}
      dir="rtl"
    >
      {/* Sidebar */}
      <aside
        style={{ background: "#115d46", transition: "width 0.2s" }}
        className={`${sidebarOpen ? "w-64" : "w-14"} flex-shrink-0 text-white flex flex-col overflow-hidden`}
      >
        {/* Logo area */}
        <div
          style={{
            background: "#0a3d2d",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
          className="px-3 py-2 flex items-center gap-3 min-h-[60px]"
        >
          <div className="flex-shrink-0 bg-white rounded-lg p-1">
            <img
              src="/logo.png"
              alt="لبينات"
              className="w-8 h-8 object-contain"
            />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight truncate">
                شركة لبينات العقارية
              </div>
              <div className="text-xs truncate" style={{ color: "#25B897" }}>
                نظام إدارة العقارات
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {allNav.map(({ href, label, icon: Icon }) => {
            const active =
              location === href ||
              (href !== "/dashboard" && location.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => navigate(href)}
                style={
                  active
                    ? {
                        background: "rgba(0,168,149,1.12)",
                        borderRight: "3px solid #25B897",
                        color: "#fff",
                      }
                    : {
                        borderRight: "3px solid transparent",
                        color: "rgba(255,255,255,0.8)",
                      }
                }
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-right transition-colors ${!active ? "hover:bg-white/10 hover:text-white" : ""}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        {sidebarOpen && user && (
          <div
            style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
            className="px-4 py-3"
          >
            <div
              className="text-xs mb-1"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              مرحباً
            </div>
            <div className="font-semibold text-sm truncate">
              {user.fullName}
            </div>
            <div
              className="text-xs mt-0.5 font-medium"
              style={{ color: "#25B897" }}
            >
              {user.role === "ADMIN" ? "مدير النظام" : "مسؤول حسابات"}
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header
          style={{ background: "#0D4D3A" }}
          className="text-white flex items-center gap-3 px-4 min-h-[60px] flex-shrink-0 shadow-md"
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded transition-colors hover:bg-white/10"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt=""
              className="w-7 h-7 object-contain bg-white rounded p-0.5"
            />
            <span className="font-bold text-sm hidden sm:inline opacity-80">
              نظام إدارة العقارات
            </span>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-white/70 mr-2">
            <span style={{ color: "#25B897" }}>الرئيسية</span>
            <ChevronLeft className="w-3 h-3" />
            <span>
              {allNav.find(
                (n) => location === n.href || location.startsWith(n.href),
              )?.label ?? "لوحة التحكم"}
            </span>
          </div>

          <div className="flex-1" />

          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm transition-colors px-3 py-1.5 rounded hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
