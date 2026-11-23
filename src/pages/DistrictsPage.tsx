import React, { useState } from 'react';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Building2, 
  Users, 
  Check, 
  X
} from 'lucide-react';
import { District, Donor, UserRole, ActivePage } from '../types';
import { useRegisterBackHandler } from '../services/backHandlerRegistry';

interface DistrictsPageProps {
  role: UserRole;
  districts: District[];
  donors: Donor[];
  onNavigate: (page: ActivePage) => void;
  onBack?: () => void;
  onOpenRoleModal: () => void;
  onAddDistrict: (name: string, areas: string[]) => void;
  onUpdateDistrict: (district: District) => void;
  onDeleteDistrict: (id: string) => void;
  isActive?: boolean;
}

export const DistrictsPage: React.FC<DistrictsPageProps> = ({
  role,
  districts,
  donors,
  onNavigate,
  onBack,
  onOpenRoleModal,
  onAddDistrict,
  onUpdateDistrict,
  onDeleteDistrict,
  isActive = true
}) => {
  const [newDistrictName, setNewDistrictName] = useState('');
  const [newAreaInputs, setNewAreaInputs] = useState<Record<string, string>>({});
  const [showAddDistrictModal, setShowAddDistrictModal] = useState(false);
  const [initialAreasStr, setInitialAreasStr] = useState('');

  useRegisterBackHandler(
    'districts-add-modal',
    isActive && showAddDistrictModal,
    () => setShowAddDistrictModal(false),
    30
  );

  // If role is not admin, protect the page
  if (role !== 'admin') {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-100 shadow-xs max-w-lg mx-auto my-8 space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">
          صفحة «المديريات والمناطق» محمية ومخصصة لدور «مسؤول»
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          يرجى التبديل لدور المسؤول لإدارة بيانات المديريات والقرى في قعطبة ومحيطها.
        </p>
        <button
          onClick={onOpenRoleModal}
          className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer inline-flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>تفعيل دور المسؤول</span>
        </button>
      </div>
    );
  }

  const handleCreateDistrict = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDistrictName.trim()) return;

    const areas = initialAreasStr
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    onAddDistrict(newDistrictName.trim(), areas.length > 0 ? areas : ['المركز']);
    setNewDistrictName('');
    setInitialAreasStr('');
    setShowAddDistrictModal(false);
  };

  const handleAddAreaToDistrict = (district: District) => {
    const inputVal = newAreaInputs[district.id]?.trim();
    if (!inputVal) return;

    if (!district.areas.includes(inputVal)) {
      const updated: District = {
        ...district,
        areas: [...district.areas, inputVal]
      };
      onUpdateDistrict(updated);
    }

    setNewAreaInputs({ ...newAreaInputs, [district.id]: '' });
  };

  const handleRemoveArea = (district: District, areaToRemove: string) => {
    const updated: District = {
      ...district,
      areas: district.areas.filter((a) => a !== areaToRemove)
    };
    onUpdateDistrict(updated);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (onBack ? onBack() : onNavigate('admin'))}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
            title="العودة للوحة الإدارة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-600" />
              <span>إدارة المديريات والمناطق</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تهيئة وإدارة التقسيم الجغرافي والقرى التابعة لقعطبة ومحافظة الضالع
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddDistrictModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مديرية جديدة</span>
        </button>
      </div>

      {/* Add District Modal */}
      {showAddDistrictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">إضافة مديرية جديدة</h3>
              <button
                onClick={() => setShowAddDistrictModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDistrict} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المديرية / المنطقة الرئيسية:
                </label>
                <input
                  type="text"
                  placeholder="مثال: مديرية دمت / نقيل الشيم"
                  value={newDistrictName}
                  onChange={(e) => setNewDistrictName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  القرى والمناطق التابعة (مفصولة بفاصلة ,):
                </label>
                <textarea
                  rows={3}
                  placeholder="مثال: القرية 1, القرية 2, حي السلام..."
                  value={initialAreasStr}
                  onChange={(e) => setInitialAreasStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDistrictModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  حفظ المديرية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Districts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {districts.map((dist) => {
          const donorCount = donors.filter((d) => d.district === dist.name).length;

          return (
            <div
              key={dist.id}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                {/* District Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{dist.name}</h3>
                      <span className="text-[11px] text-slate-400">
                        {dist.areas.length} قرى ومناطق مسجلة
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl font-sans">
                      <Users className="w-3.5 h-3.5" />
                      {donorCount} متبرع
                    </span>

                    {districts.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف مديرية "${dist.name}"؟`)) {
                            onDeleteDistrict(dist.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="حذف المديرية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Areas Pills */}
                <div className="mt-3">
                  <label className="block text-[11px] font-bold text-slate-500 mb-2">
                    القرى والأحياء التابعة:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {dist.areas.map((area) => (
                      <span
                        key={area}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
                      >
                        <span>{area}</span>
                        {dist.areas.length > 1 && (
                          <button
                            onClick={() => handleRemoveArea(dist, area)}
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                            title="حذف القرية"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Village Input */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="أضف قرية أو منطقة جديدة..."
                  value={newAreaInputs[dist.id] || ''}
                  onChange={(e) =>
                    setNewAreaInputs({ ...newAreaInputs, [dist.id]: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAreaToDistrict(dist);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddAreaToDistrict(dist)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
