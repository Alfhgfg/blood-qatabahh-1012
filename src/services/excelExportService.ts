import * as XLSX from 'xlsx';
import { Donor } from '../types';
import { firestoreService } from '../firebase/firestoreService';
import { storageService } from './storageService';
import { saveAndShareFile } from './nativeFileSaver';

export interface ExcelExportResult {
  success: boolean;
  donorsCount?: number;
  filename?: string;
  error?: string;
}

/**
 * Service to export all donor data directly from Firebase Firestore into a professional .xlsx Excel file.
 * Restricted to administrators only. Compatible with web browsers and Android APK.
 */
export async function exportDonorsToExcel(): Promise<ExcelExportResult> {
  try {
    // 0. Enforce strict Admin role check: regular users are not allowed to save or export Excel files
    const currentUser = storageService.getCurrentUser();
    const currentRole = storageService.getRole();
    const isAdmin = currentRole === 'admin' || currentUser?.role === 'admin';
    if (!isAdmin) {
      return {
        success: false,
        error: 'عذراً، لا يُسمح للمستخدمين العاديين بحفظ أو تصدير ملف Excel. هذه الصلاحية مخصصة لمسؤول السجل المركزي فقط.'
      };
    }

    // 1. Fetch ALL donors directly from Firebase Firestore
    let donorsList: Donor[] = [];
    try {
      donorsList = await firestoreService.fetchDonors();
    } catch (fsErr: any) {
      console.warn('Direct Firestore fetch encountered error, attempting fallback cache:', fsErr);
      // If Firestore network failed, check local storage
      const localDonors = storageService.getDonors();
      if (localDonors && localDonors.length > 0) {
        donorsList = localDonors;
      } else {
        throw new Error(
          fsErr?.message?.includes('permission') || fsErr?.message?.includes('PERMISSION_DENIED')
            ? 'خطأ في الصلاحيات: ليس لديك إذن لقراءة سجل المتبرعين من قاعدة البيانات السحابية.'
            : 'تعذر الاتصال بقاعدة بيانات Firebase Firestore لجلب سجل المتبرعين. يرجى التأكد من اتصال الإنترنت والمحاولة ثانية.'
        );
      }
    }

    if (!Array.isArray(donorsList) || donorsList.length === 0) {
      return {
        success: false,
        error: 'لا توجد بيانات متبرعين مسجلة حالياً في قاعدة البيانات للتصدير.'
      };
    }

    // Sort donors newest first
    const sortedDonors = [...donorsList].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // 2. Prepare Rows matching the exact required columns in order:
    const donorsRows = sortedDonors.map((d, index) => ({
      'الرقم التسلسلي': index + 1,
      'اسم المتبرع': (d.fullName || '').trim(),
      'فصيلة الدم': (d.bloodType || '').trim(),
      'رقم الهاتف': (d.phone || '').trim(),
      'المديرية': (d.district || 'مديرية قعطبة').trim(),
      'المنطقة': (d.area || '—').trim(),
      'الملاحظات': (d.notes && d.notes.trim()) ? d.notes.trim() : 'سليم وجاهز للتبرع',
      'حالة التوفر': d.isAvailable ? 'متاح للتبرع 🟢' : 'غير متاح مؤقتاً ⚪',
      'تاريخ التسجيل': d.createdAt ? new Date(d.createdAt).toLocaleDateString('ar-YE') : '—'
    }));

    // 3. Build Main Donors Worksheet
    const donorsSheet = XLSX.utils.json_to_sheet(donorsRows);
    donorsSheet['!views'] = [{ rightToLeft: true }];
    donorsSheet['!cols'] = [
      { wch: 14 }, // الرقم التسلسلي
      { wch: 32 }, // اسم المتبرع
      { wch: 14 }, // فصيلة الدم
      { wch: 18 }, // رقم الهاتف
      { wch: 24 }, // المديرية
      { wch: 22 }, // المنطقة
      { wch: 35 }, // الملاحظات
      { wch: 18 }, // حالة التوفر
      { wch: 16 }  // تاريخ التسجيل
    ];

    // 4. Secondary Worksheet: Blood Type Statistics & District Distribution
    const bloodTypeCounts: Record<string, { total: number; available: number }> = {
      'O+': { total: 0, available: 0 },
      'O-': { total: 0, available: 0 },
      'A+': { total: 0, available: 0 },
      'A-': { total: 0, available: 0 },
      'B+': { total: 0, available: 0 },
      'B-': { total: 0, available: 0 },
      'AB+': { total: 0, available: 0 },
      'AB-': { total: 0, available: 0 }
    };

    sortedDonors.forEach((d) => {
      if (bloodTypeCounts[d.bloodType]) {
        bloodTypeCounts[d.bloodType].total++;
        if (d.isAvailable) bloodTypeCounts[d.bloodType].available++;
      }
    });

    const statsRows = Object.entries(bloodTypeCounts).map(([type, stats]) => ({
      'فصيلة الدم': type,
      'إجمالي المسجلين': stats.total,
      'المتاحين للتبرع': stats.available,
      'النسبة المئوية': sortedDonors.length > 0 ? `${Math.round((stats.total / sortedDonors.length) * 100)}%` : '0%',
      'نسبة الجاهزية': stats.total > 0 ? `${Math.round((stats.available / stats.total) * 100)}%` : '0%'
    }));

    const statsSheet = XLSX.utils.json_to_sheet(statsRows);
    statsSheet['!views'] = [{ rightToLeft: true }];
    statsSheet['!cols'] = [
      { wch: 14 }, // فصيلة الدم
      { wch: 18 }, // إجمالي المسجلين
      { wch: 18 }, // المتاحين للتبرع
      { wch: 16 }, // النسبة المئوية
      { wch: 16 }  // نسبة الجاهزية
    ];

    // 5. Create Workbook and append sheets
    const workbook = XLSX.utils.book_new();
    (workbook as any).Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(workbook, donorsSheet, 'سجل المتبرعين');
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'إحصائيات الفصائل');

    // 6. Generate binary array buffer in .xlsx format
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    // 7. Generate descriptive Arabic filename with today's date
    const today = new Date().toISOString().split('T')[0];
    const filename = `سجل_متبرعي_الدم_قعطبة_${today}.xlsx`;

    // 8. Robust Cross-Platform Download & Share Strategy (Capacitor Native Android APK + Web Browser fallback)
    const saveResult = await saveAndShareFile({
      filename,
      data: new Uint8Array(excelBuffer),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'سجل متبرعي الدم - مديرية قعطبة',
      text: `تقرير سجل المتبرعين الكامل (${sortedDonors.length} متبرع) - مديرية قعطبة ومستشفى النصر`,
      dialogTitle: 'تصدير ومشاركة ملف إكسل المتبرعين'
    });

    if (!saveResult.success) {
      throw new Error(saveResult.error || 'تعذر حفظ وتصدير ملف Excel على الجهاز');
    }

    // 9. Record an audit log for accountability
    try {
      firestoreService.addAuditLog({
        action: 'export_excel',
        actionLabel: 'تصدير سجل المتبرعين إلى Excel',
        details: `تم تصدير وتنزيل ملف Excel بنجاح يحتوي على (${sortedDonors.length}) متبرع من Firebase Firestore بواسطة المسؤول.`,
        adminEmail: currentUser?.username || 'admin',
        adminName: currentUser?.fullName || 'مسؤول السجل'
      }).catch(() => {});
    } catch {}

    return {
      success: true,
      donorsCount: sortedDonors.length,
      filename
    };
  } catch (error: any) {
    console.error('Failed to export donors to Excel:', error);
    return {
      success: false,
      error: error?.message || 'حدث خطأ غير متوقع أثناء توليد وتنزيل ملف Excel'
    };
  }
}
