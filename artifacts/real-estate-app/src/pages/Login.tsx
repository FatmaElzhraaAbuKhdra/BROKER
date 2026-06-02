import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Building2, User, Lock } from "lucide-react";
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
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#1b3a57] to-[#2c3e50] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#1b3a57] text-white p-6 text-center border-b-4 border-[#0d7a8a]">
          <div className="flex justify-center mb-3">
            <div className="bg-white/10 p-3 rounded-full">
              <Building2 className="w-10 h-10 text-[#f0a500]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1">شركة العقارات المتحدة</h1>
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
                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]"
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
                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]"
              />
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1b6ca8] hover:bg-[#15598d] text-white py-2.5 rounded-md font-medium transition-colors disabled:opacity-60"
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
