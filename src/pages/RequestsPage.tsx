import React, { useState, useMemo } from 'react';
import { 
  Droplet, 
  Search, 
  Phone, 
  Hospital, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ChevronLeft,
  X,
  ArrowRight
} from 'lucide-react';
import { BloodRequest, BloodType, RequestStatus } from '../types';

interface RequestsPageProps {
  requests: BloodRequest[];
  onOpenAddRequest: () => void;
  onSelectRequest: (req: BloodRequest) => void;
  onBack?: () => void;
}

export const RequestsPage: React.FC<RequestsPageProps> = ({
  requests,
  onOpenAddRequest,
  onSelectRequest,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  // Sort newest to oldest as requested: "مرتبة من الأحدث إلى الأقدم"
  const sortedAndFiltered = useMemo(() => {
    return requests
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((req) => {
        const matchesSearch =
          searchTerm.trim() === '' ||
          req.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.bloodType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.contactPhone.includes(searchTerm);

        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
        const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;

        return matchesSearch && matchesStatus && matchesUrgency;
      });
  }, [requests, searchTerm, statusFilter, urgencyFilter]);

  return (
    <div className="space-y-5 pb-24">
      {/* Header Banner & Submit Request Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/80 transition-all cursor-pointer shrink-0"
              title="الرجوع"
            >
              <ArrowRight className="w-4 h-4 text-slate-600" />
              <span>الرجوع</span>
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-700 animate-pulse"></span>
              طلبات الدم ونداءات الاستغاثة
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              قائمة حالات المرضى المحتاجين لنقل دم في مستشفيات قعطبة ومحيطها
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAddRequest}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-800 to-red-800 hover:from-rose-900 hover:to-red-900 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>تقديم طلب دم</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم المريض، المستشفى، الفصيلة (مثال: O-، مستشفى السلام، أيمن...)"
            className="w-full px-4 py-2.5 pr-11 pl-10 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-700 focus:ring-2 focus:ring-rose-700/10 bg-slate-50/70"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              الكل ({requests.length})
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer ${
                statusFilter === 'open'
                  ? 'bg-rose-800 text-white border-rose-800 shadow-xs'
                  : 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100'
              }`}
            >
              قيد الانتظار ({requests.filter((r) => r.status === 'open').length})
            </button>
            <button
              onClick={() => setStatusFilter('fulfilled')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer ${
                statusFilter === 'fulfilled'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100'
              }`}
            >
              تم التوفير ({requests.filter((r) => r.status === 'fulfilled').length})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">الفرز:</span>
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              الأحدث أولاً ⏱️
            </span>
          </div>
        </div>
      </div>

      {/* Requests List */}
      {sortedAndFiltered.length > 0 ? (
        <div className="space-y-3">
          {sortedAndFiltered.map((req) => {
            const isFulfilled = req.status === 'fulfilled';
            const isCritical = req.urgency === 'critical';

            return (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md group ${
                  isFulfilled
                    ? 'border-emerald-200/80 bg-emerald-50/15'
                    : isCritical
                      ? 'border-slate-200/80 hover:border-rose-400 ring-1 ring-rose-100'
                      : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Side Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-rose-800 to-red-900 text-white font-sans font-black text-base flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      {req.bloodType}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-rose-700 transition-colors">
                          {req.patientName}
                        </h3>

                        {isFulfilled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            تم توفير الدم
                          </span>
                        ) : isCritical ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            عاجل جداً
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/70 px-2.5 py-0.5 rounded-full">
                            عاجل
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 font-sans">
                          {req.requestDate}
                        </span>
                      </div>

                      {/* Hospital & Location */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1 text-slate-700 font-medium">
                          <Hospital className="w-3.5 h-3.5 text-slate-400" />
                          {req.hospital}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {req.district} - {req.area}
                        </span>
                      </div>

                      {/* Details Snippet */}
                      <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                        {req.caseDetails}
                      </p>
                    </div>
                  </div>

                  {/* Right Side Units & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right sm:text-left">
                      <span className="text-[11px] text-slate-400 block">المطلوب</span>
                      <span className="text-sm font-black text-rose-700 font-sans">
                        {req.unitsNeeded} وحدة
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${req.contactPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>اتصال</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => onSelectRequest(req)}
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>التفاصيل</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 space-y-3">
          <Droplet className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">لا توجد طلبات تطابق معايير البحث</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك إفراغ خانة البحث أو تقديم طلب دم جديد في حال وجود حالة بحاجة للتبرع.
          </p>
        </div>
      )}
    </div>
  );
};
