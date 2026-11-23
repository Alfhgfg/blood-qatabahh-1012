import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Users, 
  AlertTriangle,
  HelpCircle,
  FileText,
  Ban
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BloodType, District, Donor } from '../types';
import { firestoreService } from '../firebase/firestoreService';
import { normalizePhoneNumber, normalizeArabicText } from '../services/storageService';

interface ImportDonorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingDonors: Donor[];
  districts: District[];
  onImport: (newDonors: Omit<Donor, 'id' | 'createdAt'>[]) => Promise<{ addedCount: number; skippedDuplicatesCount: number }>;
}

interface ParsedDonorPreview {
  fullName: string;
  phone: string;
  bloodType: BloodType;
  district: string;
  area: string;
  isAvailable: boolean;
  lastDonationDate?: string;
  notes?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  isInvalid: boolean;
  invalidReason?: string;
}

export const ImportDonorsModal: React.FC<ImportDonorsModalProps> = ({
  isOpen,
  onClose,
  existingDonors,
  districts,
  onImport
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedDonorPreview[]>([]);
  const [defaultDistrict, setDefaultDistrict] = useState<string>(districts[0]?.name || 'مديرية قعطبة - المركز');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [successResult, setSuccessResult] = useState<{ added: number; skipped: number; invalid: number } | null>(null);

  const normalizeBloodType = (raw: any): BloodType => {
    if (!raw) return 'O+';
    const str = String(raw).trim().toUpperCase();

    // Standard types
    if (['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].includes(str)) {
      return str as BloodType;
    }

    // Common Arabic representations
    if (str.includes('AB') || str.includes('اي بي')) {
      return str.includes('-') || str.includes('سالب') ? 'AB-' : 'AB+';
    }
    if (str.startsWith('A') || str.includes('أ') || str.includes('ا')) {
      return str.includes('-') || str.includes('سالب') ? 'A-' : 'A+';
    }
    if (str.startsWith('B') || str.includes('ب')) {
      return str.includes('-') || str.includes('سالب') ? 'B-' : 'B+';
    }
    if (str.startsWith('O') || str.includes('او') || str.includes('أو')) {
      return str.includes('-') || str.includes('سالب') ? 'O-' : 'O+';
    }

    return 'O+';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccessResult(null);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    setIsLoading(true);

    try {
      // 1. Fetch the latest live donors directly from Firestore to check against
      const remoteDonors = await firestoreService.fetchDonors().catch(() => existingDonors);
      const allReferenceDonors = remoteDonors && remoteDonors.length > 0 ? remoteDonors : existingDonors;

      const existingPhoneSet = new Set(
        allReferenceDonors.map((d) => normalizePhoneNumber(d.phone))
      );
      const existingNameSet = new Set(
        allReferenceDonors.map((d) => normalizeArabicText(d.fullName))
      );

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('الملف فارغ أو لا يحتوي على صفحات بيانات صالحة');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rows.length === 0) {
        throw new Error('لم يتم العثور على أي صفوف أو بيانات داخل الملف المحدد');
      }

      // Analyze columns dynamically
      const keys = Object.keys(rows[0] || {});

      const findKey = (patterns: string[]): string | undefined => {
        return keys.find((k) => {
          const lower = k.toLowerCase().trim();
          return patterns.some((p) => lower.includes(p));
        });
      };

      const nameKey = findKey(['اسم المتبرع', 'الاسم', 'اسم', 'fullname', 'name', 'donor']);
      const phoneKey = findKey(['رقم الهاتف', 'الهاتف', 'جوال', 'تلفون', 'phone', 'mobile', 'tel']);
      const bloodKey = findKey(['فصيلة الدم', 'فصيلة', 'الزمرة', 'blood', 'type']);
      const districtKey = findKey(['مديرية', 'المديرية', 'district', 'city']);
      const areaKey = findKey(['منطقة', 'المنطقة', 'قرية', 'القرية', 'حي', 'عزلة', 'area', 'village']);
      const availableKey = findKey(['جاهزية', 'توفر', 'متاح', 'available', 'status']);
      const lastDonationKey = findKey(['تبرع', 'تاريخ', 'donation', 'date']);
      const notesKey = findKey(['ملاحظات', 'ملاحظة', 'notes', 'note']);

      if (!nameKey && !phoneKey) {
        throw new Error('تعذر العثور على أعمدة الاسم ورقم الهاتف في الملف. يرجى التأكد من احتواء الملف على عمود «الاسم» وعمود «الهاتف».');
      }

      // In-batch duplicate tracking (within the imported file itself)
      const batchPhones = new Set<string>();
      const batchNames = new Set<string>();

      const processed: ParsedDonorPreview[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rawName = nameKey ? String(row[nameKey] || '').trim() : '';
        const rawPhone = phoneKey ? String(row[phoneKey] || '').trim() : '';

        // Skip completely empty rows
        if (!rawName && !rawPhone) continue;

        const normPhone = normalizePhoneNumber(rawPhone);
        const normName = normalizeArabicText(rawName);

        // Validation for completeness & phone structure
        let isInvalid = false;
        let invalidReason = '';

        if (!rawName || rawName.length < 3 || rawName.split(/\s+/).filter((w) => w.length > 1).length < 2) {
          isInvalid = true;
          invalidReason = 'اسم المتبرع غير مكتمل (يجب كتابة الاسم الثنائي على الأقل)';
        } else if (!normPhone || normPhone.length !== 9 || !/^(70|71|73|77|78)\d{7}$/.test(normPhone)) {
          isInvalid = true;
          invalidReason = 'رقم الهاتف غير صحيح (يجب 9 أرقام يمنية تبدأ بـ 77, 78, 73, 71, 70)';
        }

        // Deduplication against Firestore and inside file
        let isDuplicate = false;
        let duplicateReason = '';

        if (!isInvalid) {
          // 1. Check against Firestore database
          if (existingPhoneSet.has(normPhone)) {
            isDuplicate = true;
            duplicateReason = 'رقم الهاتف مسجل مسبقاً في قاعدة بيانات السجل';
          } else if (existingNameSet.has(normName)) {
            isDuplicate = true;
            duplicateReason = 'اسم المتبرع مسجل مسبقاً في قاعدة بيانات السجل';
          } else if (batchPhones.has(normPhone)) {
            // 2. Check for duplicate within the file itself
            isDuplicate = true;
            duplicateReason = 'رقم هاتف مكرر داخل نفس الملف المستورد';
          } else if (batchNames.has(normName)) {
            isDuplicate = true;
            duplicateReason = 'اسم متبرع مكرر داخل نفس الملف المستورد';
          } else {
            batchPhones.add(normPhone);
            batchNames.add(normName);
          }
        }

        const fullName = rawName || `متبرع رقم ${i + 1}`;
        const phone = normPhone || rawPhone || '000000000';
        const bloodType = normalizeBloodType(bloodKey ? row[bloodKey] : 'O+');
        const district = (districtKey ? String(row[districtKey] || '').trim() : '') || defaultDistrict;
        const area = (areaKey ? String(row[areaKey] || '').trim() : '') || 'المركز';

        let isAvailable = true;
        if (availableKey && row[availableKey]) {
          const val = String(row[availableKey]).toLowerCase();
          if (val.includes('غير') || val.includes('لا') || val.includes('no') || val.includes('false')) {
            isAvailable = false;
          }
        }

        const lastDonationDate = lastDonationKey && row[lastDonationKey] ? String(row[lastDonationKey]).trim() : undefined;
        const notes = notesKey && row[notesKey] ? String(row[notesKey]).trim() : undefined;

        processed.push({
          fullName,
          phone,
          bloodType,
          district,
          area,
          isAvailable,
          lastDonationDate,
          notes,
          isDuplicate,
          duplicateReason,
          isInvalid,
          invalidReason
        });
      }

      setParsedRows(processed);
      if (processed.length === 0) {
        setError('لم يتم العثور على أي سجلات صالحة في هذا الملف');
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err.message || 'حدث خطأ أثناء قراءة الملف. تأكد من سلامة صيغة Excel أو CSV');
      setParsedRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const validNewDonors = parsedRows.filter((r) => !r.isDuplicate && !r.isInvalid);
  const duplicateDonors = parsedRows.filter((r) => r.isDuplicate);
  const invalidDonors = parsedRows.filter((r) => r.isInvalid);

  const handleConfirmImport = async () => {
    if (validNewDonors.length === 0) {
      setError('لا توجد سجلات جديدة صالحة لاستيرادها (جميع السجلات في الملف إما مكررة أو غير صالحة)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const donorsToSave: Omit<Donor, 'id' | 'createdAt'>[] = validNewDonors.map((r) => ({
        fullName: r.fullName,
        phone: r.phone,
        bloodType: r.bloodType,
        district: r.district || defaultDistrict,
        area: r.area,
        isAvailable: r.isAvailable,
        lastDonationDate: r.lastDonationDate,
        notes: r.notes
      }));

      const res = await onImport(donorsToSave);
      setSuccessResult({
        added: res.addedCount,
        skipped: duplicateDonors.length + res.skippedDuplicatesCount,
        invalid: invalidDonors.length
      });
      setIsSubmitting(false);

      // Auto close after brief pause
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'حدث خطأ أثناء حفظ المتبرعين في قاعدة البيانات');
    }
  };

  const resetSelection = () => {
    setFileName('');
    setFileSize('');
    setParsedRows([]);
    setError('');
    setSuccessResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 font-['Cairo',sans-serif]">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">استيراد المتبرعين من ملف</h3>
              <p className="text-xs text-slate-500">دعم ملفات Excel (.xlsx, .xls) وCSV مع منع التكرار</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* File Picker Area */}
          {!parsedRows.length && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                onChange={handleFileChange}
                className="hidden"
                id="donor-file-import"
              />

              <label
                htmlFor="donor-file-import"
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/60 hover:bg-emerald-50/30 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/10 mb-3 group-hover:scale-105 transition-transform border border-slate-200">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  اضغط لاختيار ملف المتبرعين من هاتفك
                </h4>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-3">
                  يدعم صيغ ملفات Excel الحديثة (.xlsx)، والقديمة (.xls)، وملفات القيم المفصولة بفواصل (.csv).
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                  <span>تحديد ملف من الجهاز</span>
                </span>
              </label>

              {/* Supported Columns Guide */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <span>معلومات ترتيب الأعمدة المدعومة:</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  يتعرف النظام تلقائياً على الأعمدة باللغة العربية والإنجليزية، مثل: <strong>الاسم</strong>، <strong>رقم الهاتف</strong>، <strong>فصيلة الدم</strong>، <strong>المديرية</strong>، <strong>المنطقة</strong>، و<strong>الملاحظات</strong>.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono">الاسم الكامل</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono">رقم الهاتف</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono">فصيلة الدم (O+, A+...)</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono">المديرية</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono">المنطقة</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-8 text-center space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-bold text-slate-700">جاري قراءة وتحليل بيانات الملف وفحص التكرارات...</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>تم اكتمال عملية الاستيراد بنجاح!</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                تمت إضافة <strong className="font-bold text-emerald-950">{successResult.added} متبرع جديد</strong> إلى قاعدة بيانات Firestore السحابية والسجل المركزي، وتم تخطي <strong className="font-bold text-amber-900">{successResult.skipped} سجل مكرر</strong> لمنع الازدواج، واستبعاد <strong className="font-bold text-rose-900">{successResult.invalid} سجل متعذر استيراده</strong> لنقص بياناته.
              </p>
            </div>
          )}

          {/* Parsed Preview Table & Summary */}
          {parsedRows.length > 0 && !successResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* File details banner */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs">{fileName}</h4>
                    <span className="text-[10px] text-slate-400">{fileSize} • {parsedRows.length} صف تم فحصها</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetSelection}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                >
                  تغيير الملف
                </button>
              </div>

              {/* Stats badges: 3 categories (جديدة، مكررة، متعذرة) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 block truncate">سجلات جديدة للإضافة:</span>
                    <strong className="text-xs font-bold text-emerald-800">{validNewDonors.length} متبرع</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 block truncate">سجلات مكررة (استبعاد):</span>
                    <strong className="text-xs font-bold text-amber-800">{duplicateDonors.length} مكرر</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-rose-50/90 border border-rose-200 rounded-2xl flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Ban className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 block truncate">متعذّر استيرادها:</span>
                    <strong className="text-xs font-bold text-rose-800">{invalidDonors.length} غير صالح</strong>
                  </div>
                </div>
              </div>

              {/* Default District Fallback */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المديرية الافتراضية (للسجلات التي لم يُحدد لها مديرية بالملف):
                </label>
                <select
                  value={defaultDistrict}
                  onChange={(e) => setDefaultDistrict(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-emerald-500"
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview Rows List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>معاينة البيانات المستخرجة ({Math.min(parsedRows.length, 10)} من {parsedRows.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">تم الفحص المباشر مع قاعدة بيانات Firestore</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
                  {parsedRows.slice(0, 10).map((row, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 font-sans font-bold text-xs flex items-center justify-center shrink-0 border border-rose-100">
                          {row.bloodType}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{row.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate" dir="ltr">
                            {row.phone} • {row.district}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {row.isInvalid ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1" title={row.invalidReason}>
                            <Ban className="w-3 h-3" />
                            <span>غير صالح</span>
                          </span>
                        ) : row.isDuplicate ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1" title={row.duplicateReason}>
                            <AlertTriangle className="w-3 h-3" />
                            <span>مكرر</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>جديد</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            {parsedRows.length > 0 && !successResult && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSubmitting || validNewDonors.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-sm transition-all active:scale-98 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'جاري حفظ المتبرعين...'
                    : `تأكيد واستيراد (${validNewDonors.length} متبرع جديد)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
