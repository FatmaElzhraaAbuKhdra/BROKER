import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { User, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) { navigate("/dashboard"); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { toast.error("الرجاء إدخال اسم المستخدم وكلمة المرور"); return; }
    setLoading(true);
    try {
      await login(username, password);
      toast.success("تم تسجيل الدخول بنجاح");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5FAF8] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#0D4D3A] text-white p-6 text-center border-b-4 border-[#25B897]">
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <img src="/app/logo.png" alt="لبينات للتطوير العقاري" className="w-20 h-20 object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-bold mb-1">شركة لبينات العقارية</h1>
          <span className="text-xs bg-white/20 px-3 py-1 rounded-full">نظام إدارة العقارات</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]"
              />
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1A8A6C] hover:bg-[#147A5E] text-white py-2.5 rounded-md font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <div className="bg-gray-50 px-8 py-3 border-t text-center text-xs text-gray-500">
          admin / admin123 &nbsp;|&nbsp; accounts / accounts123
        </div>
      </div>
    </div>
  );
}
