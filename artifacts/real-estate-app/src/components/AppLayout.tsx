import { type ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Building2, Home, Layers, Users, ShoppingCart,
  Tags, LogOut, Menu, X, ChevronLeft
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/units", label: "الوحدات", icon: Home },
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
    <div className="flex h-screen bg-[#f5f5f5] overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-60" : "w-14"} flex-shrink-0 bg-[#2c3e50] text-white flex flex-col transition-all duration-200 overflow-hidden`}
      >
        {/* Logo */}
        <div className="bg-[#1b3a57] px-4 py-3 flex items-center gap-3 border-b border-white/10 min-h-[56px]">
          <Building2 className="w-6 h-6 text-[#f0a500] flex-shrink-0" />
          {sidebarOpen && (
            <div>
              <div className="font-bold text-sm leading-tight">نظام إدارة العقارات</div>
              <div className="text-xs text-white/60">Real Estate System</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {allNav.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href !== "/dashboard" && location.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => navigate(href)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-right
                  ${active ? "bg-[#1b6ca8] text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        {sidebarOpen && user && (
          <div className="border-t border-white/10 px-4 py-3">
            <div className="text-xs text-white/60 mb-1">مرحباً</div>
            <div className="font-medium text-sm truncate">{user.fullName}</div>
            <div className="text-xs text-[#f0a500] mt-0.5">
              {user.role === "ADMIN" ? "مدير النظام" : "مسؤول حسابات"}
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-[#1b3a57] text-white flex items-center gap-3 px-4 py-0 min-h-[56px] flex-shrink-0 shadow">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-white/80">
            <span className="text-[#f0a500]">الرئيسية</span>
            <ChevronLeft className="w-3 h-3" />
            <span>{allNav.find(n => location === n.href || location.startsWith(n.href))?.label ?? "لوحة التحكم"}</span>
          </div>

          <div className="flex-1" />

          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-white/75 hover:text-white transition-colors px-3 py-1.5 rounded hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
