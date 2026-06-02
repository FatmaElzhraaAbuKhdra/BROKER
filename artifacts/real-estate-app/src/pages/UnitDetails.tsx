import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { api, formatPrice, formatDate, type Unit, type Customer } from "@/lib/api";
import { ArrowRight, Edit, Trash2, ShoppingCart, Upload, Star, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function UnitDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [saleForm, setSaleForm] = useState({ customerId: "", saleDate: new Date().toISOString().slice(0, 10), saleAmount: "", notes: "" });
  const [saleLoading, setSaleLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const { data: unit, isLoading } = useQuery<Unit>({
    queryKey: ["unit", id],
    queryFn: () => api.get(`/units/${id}`),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
    enabled: showSaleDialog,
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">جارٍ التحميل...</div>;
  if (!unit) return <div className="text-center py-12 text-red-500">الوحدة غير موجودة</div>;

  const isSold = unit.STATUS === "SOLD";

  const handleDelete = async () => {
    if (isSold) { toast.error("لا يمكن حذف وحدة مباعة"); return; }
    if (!confirm(`هل أنت متأكد من حذف ${unit.UNIT_NAME}؟`)) return;
    try {
      await api.delete(`/units/${unit.UNIT_ID}`);
      toast.success("تم حذف الوحدة");
      qc.invalidateQueries({ queryKey: ["units"] });
      navigate("/units");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    }
  };

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.customerId || !saleForm.saleDate || !saleForm.saleAmount) { toast.error("جميع الحقول مطلوبة"); return; }
    setSaleLoading(true);
    try {
      await api.post("/sales", { unitId: unit.UNIT_ID, customerId: Number(saleForm.customerId), saleDate: saleForm.saleDate, saleAmount: Number(saleForm.saleAmount), notes: saleForm.notes });
      toast.success("تمت عملية البيع بنجاح");
      setShowSaleDialog(false);
      qc.invalidateQueries({ queryKey: ["unit", id] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إتمام عملية البيع");
    } finally {
      setSaleLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append("images", f));
    setUploadLoading(true);
    try {
      await api.upload(`/units/${unit.UNIT_ID}/images`, formData);
      toast.success("تم رفع الصور");
      qc.invalidateQueries({ queryKey: ["unit", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل رفع الصور");
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm("حذف هذه الصورة؟")) return;
    try {
      await api.delete(`/units/${unit.UNIT_ID}/images/${imageId}`);
      toast.success("تم حذف الصورة");
      qc.invalidateQueries({ queryKey: ["unit", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل حذف الصورة");
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    try {
      await api.put(`/units/${unit.UNIT_ID}/images/${imageId}/primary`, {});
      toast.success("تم تعيين الصورة الرئيسية");
      qc.invalidateQueries({ queryKey: ["unit", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل");
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/units")} className="text-[#1b6ca8] hover:underline flex items-center gap-1 text-sm">
            <ArrowRight className="w-4 h-4" /> الوحدات
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-medium">{unit.UNIT_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          {isSold && (
            <div className="flex items-center gap-1 text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-1.5 rounded-md">
              <Lock className="w-4 h-4" /> وحدة مباعة - للقراءة فقط
            </div>
          )}
          {!isSold && (user?.role === "ACCOUNTING" || isAdmin) && (
            <button onClick={() => setShowSaleDialog(true)}
              className="flex items-center gap-2 bg-[#f0a500] text-white px-4 py-2 rounded-md text-sm hover:bg-[#d8940a]">
              <ShoppingCart className="w-4 h-4" /> تسجيل بيع
            </button>
          )}
          {isAdmin && !isSold && (
            <>
              <button onClick={() => navigate(`/units/${unit.UNIT_ID}/edit`)}
                className="flex items-center gap-2 bg-[#1b6ca8] text-white px-4 py-2 rounded-md text-sm hover:bg-[#15598d]">
                <Edit className="w-4 h-4" /> تعديل
              </button>
              <button onClick={handleDelete}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700">
                <Trash2 className="w-4 h-4" /> حذف
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Unit info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-[#1b3a57]">{unit.UNIT_NAME}</h1>
                <div className="font-mono text-sm text-gray-500 mt-1">{unit.UNIT_CODE}</div>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full border font-medium
                ${unit.STATUS === "SOLD" ? "badge-sold" : unit.STATUS === "RESERVED" ? "badge-reserved" : "badge-available"}`}>
                {unit.STATUS === "AVAILABLE" ? "متاح" : unit.STATUS === "SOLD" ? "مباع" : "محجوز"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["نوع الوحدة", unit.TYPE_NAME],
                ["المشروع", unit.PROJECT_NAME],
                ["المبنى", unit.BUILDING_NAME],
                ["الطابق", unit.FLOOR_NAME || unit.FLOOR_NUMBER],
                ["المساحة", `${unit.AREA} م²`],
                ["عدد الغرف", String(unit.ROOMS)],
                ["عدد الحمامات", String(unit.BATHROOMS)],
                ["السعر", formatPrice(unit.PRICE)],
                ["تاريخ الإضافة", formatDate(unit.CREATED_DATE)],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-gray-100 pb-2">
                  <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                  <div className="font-medium text-[#1b3a57]">{value}</div>
                </div>
              ))}
            </div>

            {unit.DESCRIPTION && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-gray-500 mb-1">الوصف</div>
                <p className="text-sm text-gray-700 leading-relaxed">{unit.DESCRIPTION}</p>
              </div>
            )}
          </div>
        </div>

        {/* Images panel */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#1b3a57] text-sm">
                الصور ({unit.IMAGES?.length ?? 0})
              </h2>
              <label className="cursor-pointer flex items-center gap-1 text-xs bg-[#1b6ca8] text-white px-2.5 py-1.5 rounded hover:bg-[#15598d]">
                <Upload className="w-3 h-3" />
                {uploadLoading ? "جارٍ الرفع..." : "رفع صور"}
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadLoading} />
              </label>
            </div>

            {(!unit.IMAGES || unit.IMAGES.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                لا توجد صور
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {unit.IMAGES.map(img => (
                  <div key={img.IMAGE_ID} className="relative group rounded overflow-hidden border border-gray-200">
                    <img
                      src={`/api/uploads/${img.FILE_PATH}`}
                      alt={img.FILE_NAME}
                      className="w-full h-24 object-cover"
                    />
                    {img.IS_PRIMARY === 1 && (
                      <div className="absolute top-1 right-1 bg-[#f0a500] text-white text-xs px-1.5 py-0.5 rounded">رئيسية</div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      {img.IS_PRIMARY !== 1 && (
                        <button onClick={() => handleSetPrimary(img.IMAGE_ID)}
                          className="p-1 bg-[#f0a500] text-white rounded text-xs" title="تعيين كرئيسية">
                          <Star className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteImage(img.IMAGE_ID)}
                        className="p-1 bg-red-600 text-white rounded text-xs" title="حذف">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sale Dialog */}
      {showSaleDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-[#1b3a57] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">تسجيل عملية بيع - {unit.UNIT_NAME}</span>
              <button onClick={() => setShowSaleDialog(false)} className="hover:text-white/70"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSale} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">العميل *</label>
                <select value={saleForm.customerId} onChange={e => setSaleForm(s => ({ ...s, customerId: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]">
                  <option value="">-- اختر العميل --</option>
                  {customers.map(c => <option key={c.CUSTOMER_ID} value={c.CUSTOMER_ID}>{c.FULL_NAME} - {c.MOBILE}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">تاريخ البيع *</label>
                <input type="date" value={saleForm.saleDate} onChange={e => setSaleForm(s => ({ ...s, saleDate: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">مبلغ البيع *</label>
                <input type="number" value={saleForm.saleAmount} onChange={e => setSaleForm(s => ({ ...s, saleAmount: e.target.value }))}
                  placeholder={String(unit.PRICE)} required min={1}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">ملاحظات</label>
                <textarea value={saleForm.notes} onChange={e => setSaleForm(s => ({ ...s, notes: e.target.value }))} rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b6ca8]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saleLoading}
                  className="flex-1 bg-[#f0a500] text-white py-2 rounded-md font-medium hover:bg-[#d8940a] disabled:opacity-60">
                  {saleLoading ? "جارٍ الحفظ..." : "تأكيد البيع"}
                </button>
                <button type="button" onClick={() => setShowSaleDialog(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-md hover:bg-gray-50">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
