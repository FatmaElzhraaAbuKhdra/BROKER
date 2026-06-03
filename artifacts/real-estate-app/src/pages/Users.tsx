import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatDate, type User } from "@/lib/api";
import { Plus, Edit, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function Users() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const emptyEdit = { fullName: "", email: "", role: "ACCOUNTING" as const, isActive: true, password: "" };
  const emptyReg = { username: "", password: "", fullName: "", email: "", role: "ACCOUNTING" as const };
  const [form, setForm] = useState(emptyEdit);
  const [regForm, setRegForm] = useState(emptyReg);

  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["users"], queryFn: () => api.get("/users") });

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ fullName: u.FULL_NAME, email: u.EMAIL || "", role: u.ROLE, isActive: u.IS_ACTIVE === 1, password: "" });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.role) { toast.error("الاسم والدور مطلوبان"); return; }
    setLoading(true);
    try {
      await api.put(`/users/${editing!.USER_ID}`, form);
      toast.success("تم تحديث المستخدم");
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowModal(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.username || !regForm.password || !regForm.fullName) { toast.error("جميع الحقول مطلوبة"); return; }
    setLoading(true);
    try {
      await api.post("/auth/register", regForm);
      toast.success("تم إنشاء المستخدم");
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowRegisterModal(false);
      setRegForm(emptyReg);
    } catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (u: User) => {
    if (u.USER_ID === me?.userId) { toast.error("لا يمكن حذف حسابك الخاص"); return; }
    if (!confirm(`حذف "${u.FULL_NAME}"؟`)) return;
    try { await api.delete(`/users/${u.USER_ID}`); toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["users"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
  };

  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const r = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setRegForm(f => ({ ...f, [k]: e.target.value }));
  const ic = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]";

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0D4D3A]">إدارة المستخدمين</h1>
        <button onClick={() => setShowRegisterModal(true)} className="flex items-center gap-2 bg-[#1A8A6C] text-white px-4 py-2 rounded-md text-sm hover:bg-[#147A5E]"><Plus className="w-4 h-4" /> مستخدم جديد</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="apex-table">
          <thead><tr><th>#</th><th>اسم المستخدم</th><th>الاسم الكامل</th><th>الدور</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
            : users.map((u, i) => (
              <tr key={u.USER_ID} className={u.USER_ID === me?.userId ? "bg-[#E1F5EE]" : ""}>
                <td className="text-gray-400">{i + 1}</td>
                <td><span className="font-mono text-sm font-semibold text-[#1A8A6C]">{u.USERNAME}</span>{u.USER_ID === me?.userId && <span className="mr-2 text-xs text-gray-400">(أنت)</span>}</td>
                <td className="font-medium">{u.FULL_NAME}</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-full ${u.ROLE === "ADMIN" ? "bg-purple-100 text-purple-800 border border-purple-300" : "bg-blue-100 text-blue-800 border border-blue-300"}`}>{u.ROLE === "ADMIN" ? "مدير" : "محاسب"}</span></td>
                <td><span className={`text-xs px-2 py-0.5 rounded-full ${u.IS_ACTIVE ? "badge-available" : "badge-sold"}`}>{u.IS_ACTIVE ? "مفعّل" : "معطّل"}</span></td>
                <td className="text-gray-500">{formatDate(u.CREATED_DATE)}</td>
                <td><div className="flex gap-2">
                  <button onClick={() => openEdit(u)} className="text-xs border border-[#1A8A6C] text-[#1A8A6C] px-2 py-1 rounded hover:bg-[#1A8A6C] hover:text-white transition-colors"><Edit className="w-3 h-3 inline ml-1" />تعديل</button>
                  {u.USER_ID !== me?.userId && <button onClick={() => handleDelete(u)} className="text-xs border border-red-400 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3 inline ml-1" />حذف</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-[#0D4D3A] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">تعديل: {editing.USERNAME}</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div><label className="text-sm font-medium block mb-1">الاسم الكامل *</label><input className={ic} value={form.fullName} onChange={s("fullName")} required /></div>
              <div><label className="text-sm font-medium block mb-1">البريد الإلكتروني</label><input type="email" className={ic} value={form.email} onChange={s("email")} /></div>
              <div><label className="text-sm font-medium block mb-1">الدور *</label><select className={ic} value={form.role} onChange={s("role")}><option value="ADMIN">مدير النظام</option><option value="ACCOUNTING">مسؤول حسابات</option></select></div>
              <div><label className="text-sm font-medium block mb-1">كلمة مرور جديدة (اتركها فارغة للإبقاء)</label><input type="password" className={ic} value={form.password} onChange={s("password")} /></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="isActive" checked={form.isActive} onChange={s("isActive")} /><label htmlFor="isActive" className="text-sm font-medium">الحساب مفعّل</label></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[#1A8A6C] text-white py-2 rounded-md font-medium hover:bg-[#147A5E] disabled:opacity-60"><Save className="w-4 h-4" />{loading ? "..." : "حفظ"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-[#0D4D3A] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">إضافة مستخدم جديد</span>
              <button onClick={() => setShowRegisterModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRegister} className="p-5 space-y-4">
              <div><label className="text-sm font-medium block mb-1">اسم المستخدم *</label><input className={ic} value={regForm.username} onChange={r("username")} required /></div>
              <div><label className="text-sm font-medium block mb-1">كلمة المرور *</label><input type="password" className={ic} value={regForm.password} onChange={r("password")} required /></div>
              <div><label className="text-sm font-medium block mb-1">الاسم الكامل *</label><input className={ic} value={regForm.fullName} onChange={r("fullName")} required /></div>
              <div><label className="text-sm font-medium block mb-1">البريد الإلكتروني</label><input type="email" className={ic} value={regForm.email} onChange={r("email")} /></div>
              <div><label className="text-sm font-medium block mb-1">الدور *</label><select className={ic} value={regForm.role} onChange={r("role")}><option value="ADMIN">مدير النظام</option><option value="ACCOUNTING">مسؤول حسابات</option></select></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[#1A8A6C] text-white py-2 rounded-md font-medium hover:bg-[#147A5E] disabled:opacity-60"><Save className="w-4 h-4" />{loading ? "..." : "إنشاء"}</button>
                <button type="button" onClick={() => setShowRegisterModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
