import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { api, formatPrice, formatDate, type Unit, type Customer, type Installment } from "@/lib/api";
import { ArrowRight, Edit, Trash2, ShoppingCart, Upload, Star, X, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const emptyRow = { dueDate: "", amount: "", paidDate: "", status: "PENDING", notes: "" };

const statusLabel = (s: string) =>
  s === "PAID" ? "مدفوع" : s === "OVERDUE" ? "متأخر" : s === "PARTIALLY_PAID" ? "مدفوع جزئياً" : "معلق";

const statusClass = (s: string) =>
  s === "PAID"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : s === "OVERDUE"
    ? "bg-rose-100 text-rose-700 border-rose-200"
    : s === "PARTIALLY_PAID"
    ? "bg-orange-100 text-orange-700 border-orange-200"
    : "bg-amber-100 text-amber-700 border-amber-200";

export default function UnitDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [saleForm, setSaleForm] = useState({ customerId: "", saleDate: new Date().toISOString().slice(0, 10), saleAmount: "", notes: "" });
  const [saleLoading, setSaleLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Interactive grid state
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editData, setEditData] = useState(emptyRow);
  const [installmentLoading, setInstallmentLoading] = useState(false);

  const { data: unit, isLoading } = useQuery<Unit>({
    queryKey: ["unit", id],
    queryFn: () => api.get(`/units/${id}`),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
    enabled: showSaleDialog,
  });

  const { data: installments = [], isLoading: installmentsLoading } = useQuery<Installment[]>({
    queryKey: ["installments", id],
    queryFn: () => api.get(`/installments?unitId=${id}`),
    enabled: Boolean(id),
    staleTime: 0,
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

  const startEdit = (inst: Installment) => {
    setEditingId(inst.INSTALLMENT_ID);
    setEditData({
      dueDate: inst.DUE_DATE ? inst.DUE_DATE.slice(0, 10) : "",
      amount: String(inst.AMOUNT),
      paidDate: inst.PAID_DATE ? inst.PAID_DATE.slice(0, 10) : "",
      status: inst.STATUS,
      notes: inst.NOTES || "",
    });
  };

  const startAddNew = () => {
    setEditingId("new");
    setEditData(emptyRow);
  };

  const saveRow = async () => {
    if (!editData.dueDate || !editData.amount) { toast.error("تاريخ الاستحقاق والمبلغ مطلوبان"); return; }
    if (Number(editData.amount) <= 0) { toast.error("المبلغ يجب أن يكون أكبر من 0"); return; }
    setInstallmentLoading(true);
    try {
      const body = {
        unitId: unit.UNIT_ID,
        dueDate: editData.dueDate,
        amount: Number(editData.amount),
        paidDate: editData.paidDate || null,
        status: editData.status,
        notes: editData.notes || null,
      };
      if (editingId === "new") {
        await api.post("/installments", body);
        toast.success("تمت إضافة القسط");
      } else {
        await api.put(`/installments/${editingId}`, body);
        toast.success("تم تحديث القسط");
      }
      qc.invalidateQueries({ queryKey: ["installments", id] });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setInstallmentLoading(false);
    }
  };

  const handleDeleteInstallment = async (installmentId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا القسط؟")) return;
    try {
      await api.delete(`/installments/${installmentId}`);
      toast.success("تم حذف القسط");
      qc.invalidateQueries({ queryKey: ["installments", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    }
  };

  const ic = "w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A8A6C]";

  const totalInstallments = installments.reduce((sum, i) => sum + i.AMOUNT, 0);
  const paidInstallments = installments.filter(i => i.STATUS === "PAID").reduce((sum, i) => sum + i.AMOUNT, 0);

  return (
    <div dir="rtl" className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/units")} className="text-[#1A8A6C] hover:underline flex items-center gap-1 text-sm">
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
              className="flex items-center gap-2 bg-[#25B897] text-white px-4 py-2 rounded-md text-sm hover:bg-[#147A5E]">
              <ShoppingCart className="w-4 h-4" /> تسجيل بيع
            </button>
          )}
          {isAdmin && !isSold && (
            <>
              <button onClick={() => navigate(`/units/${unit.UNIT_ID}/edit`)}
                className="flex items-center gap-2 bg-[#1A8A6C] text-white px-4 py-2 rounded-md text-sm hover:bg-[#147A5E]">
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
                <h1 className="text-xl font-bold text-[#0D4D3A]">{unit.UNIT_NAME}</h1>
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
                ["الطابق - نوع الدور", unit.FLOOR_TYPE ? `${unit.FLOOR_NAME || unit.FLOOR_NUMBER} (${unit.FLOOR_TYPE})` : (unit.FLOOR_NAME || unit.FLOOR_NUMBER)],
                ["المساحة الإنشائية", `${unit.AREA} م²`],
                ...(unit.SALEABLE_AREA != null ? [["المساحة البيعية", `${unit.SALEABLE_AREA} م²`] as [string, string]] : []),
                ["عدد الغرف", String(unit.ROOMS)],
                ["عدد الحمامات", String(unit.BATHROOMS)],
                ["السعر", formatPrice(unit.PRICE)],
                ["تاريخ الإضافة", formatDate(unit.CREATED_DATE)],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-gray-100 pb-2">
                  <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                  <div className="font-medium text-[#0D4D3A]">{value}</div>
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
              <h2 className="font-semibold text-[#0D4D3A] text-sm">
                الصور ({unit.IMAGES?.length ?? 0})
              </h2>
              <label className="cursor-pointer flex items-center gap-1 text-xs bg-[#1A8A6C] text-white px-2.5 py-1.5 rounded hover:bg-[#147A5E]">
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
                      <div className="absolute top-1 right-1 bg-[#25B897] text-white text-xs px-1.5 py-0.5 rounded">رئيسية</div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      {img.IS_PRIMARY !== 1 && (
                        <button onClick={() => handleSetPrimary(img.IMAGE_ID)}
                          className="p-1 bg-[#25B897] text-white rounded text-xs" title="تعيين كرئيسية">
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

      {/* Installments section */}
      <div className="bg-white rounded-lg shadow-sm border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-[#0D4D3A]">الأقساط ({installments.length})</h2>
            {installments.length > 0 && (
              <div className="flex gap-3 text-xs text-gray-500">
                <span>الإجمالي: <span className="font-semibold text-[#0D4D3A]">{formatPrice(totalInstallments)}</span></span>
                <span>المدفوع: <span className="font-semibold text-emerald-600">{formatPrice(paidInstallments)}</span></span>
                <span>المتبقي: <span className="font-semibold text-amber-600">{formatPrice(totalInstallments - paidInstallments)}</span></span>
              </div>
            )}
          </div>
          {isAdmin && editingId === null && (
            <button onClick={startAddNew}
              className="flex items-center gap-2 bg-[#1A8A6C] text-white px-3 py-1.5 rounded-md text-sm hover:bg-[#147A5E] transition-colors">
              <Plus className="w-3.5 h-3.5" /> إضافة قسط
            </button>
          )}
        </div>

        {installmentsLoading ? (
          <div className="text-center py-6 text-gray-400 text-sm">جارٍ التحميل...</div>
        ) : installments.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            لا توجد أقساط مضافة
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="apex-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>تاريخ الاستحقاق</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>تاريخ الدفع</th>
                  <th>ملاحظات</th>
                  {isAdmin && <th className="w-28">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {/* New row being added */}
                {editingId === "new" && (
                  <tr className="bg-emerald-50 border-r-4 border-emerald-400">
                    <td className="text-gray-400 text-xs">جديد</td>
                    <td><input type="date" value={editData.dueDate} onChange={e => setEditData(d => ({ ...d, dueDate: e.target.value }))} className={ic} /></td>
                    <td><input type="number" value={editData.amount} onChange={e => setEditData(d => ({ ...d, amount: e.target.value }))} min={1} placeholder="0" className={ic} /></td>
                    <td>
                      <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} className={ic}>
                        <option value="PENDING">معلق</option>
                        <option value="PAID">مدفوع</option>
                        <option value="PARTIALLY_PAID">مدفوع جزئياً</option>
                        <option value="OVERDUE">متأخر</option>
                      </select>
                    </td>
                    <td><input type="date" value={editData.paidDate} onChange={e => setEditData(d => ({ ...d, paidDate: e.target.value }))} className={ic} /></td>
                    <td><input type="text" value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} placeholder="ملاحظات..." className={ic} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={saveRow} disabled={installmentLoading}
                          className="text-xs bg-[#1A8A6C] text-white px-2 py-1 rounded hover:bg-[#147A5E] disabled:opacity-60">
                          {installmentLoading ? "..." : "حفظ"}
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs border border-gray-300 text-gray-600 px-2 py-1 rounded hover:bg-gray-50">
                          إلغاء
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {installments.map((inst, i) => (
                  <tr key={inst.INSTALLMENT_ID}
                    className={editingId === inst.INSTALLMENT_ID ? "bg-blue-50 border-r-4 border-blue-400" : "hover:bg-gray-50"}>
                    <td className="text-gray-400">{i + 1}</td>

                    {editingId === inst.INSTALLMENT_ID ? (
                      <>
                        <td><input type="date" value={editData.dueDate} onChange={e => setEditData(d => ({ ...d, dueDate: e.target.value }))} className={ic} /></td>
                        <td><input type="number" value={editData.amount} onChange={e => setEditData(d => ({ ...d, amount: e.target.value }))} min={1} className={ic} /></td>
                        <td>
                          <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} className={ic}>
                            <option value="PENDING">معلق</option>
                            <option value="PAID">مدفوع</option>
                            <option value="PARTIALLY_PAID">مدفوع جزئياً</option>
                            <option value="OVERDUE">متأخر</option>
                          </select>
                        </td>
                        <td><input type="date" value={editData.paidDate} onChange={e => setEditData(d => ({ ...d, paidDate: e.target.value }))} className={ic} /></td>
                        <td><input type="text" value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} className={ic} /></td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={saveRow} disabled={installmentLoading}
                              className="text-xs bg-[#1A8A6C] text-white px-2 py-1 rounded hover:bg-[#147A5E] disabled:opacity-60">
                              {installmentLoading ? "..." : "حفظ"}
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-xs border border-gray-300 text-gray-600 px-2 py-1 rounded hover:bg-gray-50">
                              إلغاء
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-mono text-sm">{formatDate(inst.DUE_DATE)}</td>
                        <td className="font-semibold text-[#0D4D3A]">{formatPrice(inst.AMOUNT)}</td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusClass(inst.STATUS)}`}>
                            {statusLabel(inst.STATUS)}
                          </span>
                        </td>
                        <td className="text-sm text-gray-500">
                          {inst.PAID_DATE ? formatDate(inst.PAID_DATE) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="text-sm text-gray-500 max-w-[200px] truncate">
                          {inst.NOTES || <span className="text-gray-300">-</span>}
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="flex gap-1">
                              <button onClick={() => startEdit(inst)} disabled={editingId !== null}
                                className="text-xs border border-[#1A8A6C] text-[#1A8A6C] px-2 py-1 rounded hover:bg-[#1A8A6C] hover:text-white transition-colors disabled:opacity-40">
                                <Edit className="w-3 h-3 inline ml-1" />تعديل
                              </button>
                              <button onClick={() => handleDeleteInstallment(inst.INSTALLMENT_ID)} disabled={editingId !== null}
                                className="text-xs border border-red-400 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40">
                                <Trash2 className="w-3 h-3 inline ml-1" />حذف
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Dialog */}
      {showSaleDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-[#0D4D3A] text-white px-5 py-3 rounded-t-lg flex items-center justify-between">
              <span className="font-semibold">تسجيل عملية بيع - {unit.UNIT_NAME}</span>
              <button onClick={() => setShowSaleDialog(false)} className="hover:text-white/70"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSale} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">العميل *</label>
                <select value={saleForm.customerId} onChange={e => setSaleForm(s => ({ ...s, customerId: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]">
                  <option value="">-- اختر العميل --</option>
                  {customers.map(c => <option key={c.CUSTOMER_ID} value={c.CUSTOMER_ID}>{c.FULL_NAME} - {c.MOBILE}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">تاريخ البيع *</label>
                <input type="date" value={saleForm.saleDate} onChange={e => setSaleForm(s => ({ ...s, saleDate: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">مبلغ البيع *</label>
                <input type="number" value={saleForm.saleAmount} onChange={e => setSaleForm(s => ({ ...s, saleAmount: e.target.value }))}
                  placeholder={String(unit.PRICE)} required min={1}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">ملاحظات</label>
                <textarea value={saleForm.notes} onChange={e => setSaleForm(s => ({ ...s, notes: e.target.value }))} rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A8A6C]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saleLoading}
                  className="flex-1 bg-[#25B897] text-white py-2 rounded-md font-medium hover:bg-[#147A5E] disabled:opacity-60">
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
