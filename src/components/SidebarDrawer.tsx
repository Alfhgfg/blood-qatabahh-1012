import React, { useEffect, useRef, useState } from 'react';
import {
  Home,
  User,
  Droplet,
  Heart,
  UserPlus,
  Bell,
  ClipboardList,
  BookOpen,
  Info,
  PhoneCall,
  Settings,
  LogOut,
  X,
  ShieldCheck,
  ChevronLeft,
  Hospital
} from 'lucide-react';
import { ActivePage, Donor, UserAccount, UserRole } from '../types';
import { auth } from '../firebase/config';
import { normalizePhoneNumber } from '../services/storageService';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  badge?: string | number | null;
  badgeTone?: 'rose' | 'slate' | 'amber';
  iconColor?: string;
  onClick: () => void;
}

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onOpenAddDonor: () => void;
  onOpenNotifications: () => void;
  onLogout: () => void;
  currentUser: UserAccount | null;
  role: UserRole;
  donors: Donor[];
  openRequestsCount: number;
  unreadNotificationsCount: number;
  hospitalsCount?: number;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  activePage,
  onNavigate,
  onOpenAddDonor,
  onOpenNotifications,
  onLogout,
  currentUser,
  role,
  donors,
  openRequestsCount,
  unreadNotificationsCount,
  hospitalsCount = 0
}) => {
  const [imgError, setImgError] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const firebasePhoto = auth?.currentUser?.photoURL || undefined;
  const userPhoto = !imgError ? (currentUser?.photoUrl || firebasePhoto) : undefined;

  useEffect(() => {
    setImgError(false);
  }, [currentUser?.photoUrl, firebasePhoto]);

  // Reset drag state when drawer opens/closes
  useEffect(() => {
    if (!isOpen) {
      setDragOffsetX(0);
      setIsDragging(false);
      isHorizontalSwipe.current = null;
    }
  }, [isOpen]);

  // Lock body scroll and listen for Escape when open
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Find linked donor profile from Firestore donors list
  const linkedDonor = React.useMemo(() => {
    if (!currentUser || donors.length === 0) return null;
    if (currentUser.linkedDonorId) {
      const byId = donors.find((d) => d.id === currentUser.linkedDonorId);
      if (byId) return byId;
    }
    const cleanPhone = normalizePhoneNumber(currentUser.phone || '');
    if (cleanPhone) {
      return donors.find((d) => normalizePhoneNumber(d.phone) === cleanPhone) || null;
    }
    return null;
  }, [currentUser, donors]);

  // Live swipe-right-to-close gesture (for native Android RTL feel)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isHorizontalSwipe.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 && deltaX > 0;
      }
    }

    if (isHorizontalSwipe.current && deltaX > 0) {
      setIsDragging(true);
      setDragOffsetX(Math.min(deltaX, 340));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = deltaX / elapsed;

    if (isHorizontalSwipe.current && (deltaX > 75 || (deltaX > 35 && velocity > 0.45))) {
      onClose();
    }

    setDragOffsetX(0);
    setIsDragging(false);
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = null;
  };

  const handleTouchCancel = () => {
    setDragOffsetX(0);
    setIsDragging(false);
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = null;
  };

  const handleNavClick = (page: ActivePage) => {
    onNavigate(page);
    onClose();
  };

  const handleActionClick = (action: () => void) => {
    onClose();
    setTimeout(() => {
      action();
    }, 140);
  };

  const initials = (currentUser?.fullName || 'م')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  const primaryItems: NavItem[] = [
    {
      id: 'home',
      label: 'الصفحة الرئيسية',
      icon: Home,
      isActive: activePage === 'home' || activePage === 'hospital-ad',
      iconColor: 'text-rose-700',
      onClick: () => handleNavClick('home')
    },
    {
      id: 'profile',
      label: 'الملف الشخصي',
      icon: User,
      isActive: activePage === 'profile',
      iconColor: 'text-sky-700',
      onClick: () => handleNavClick('profile')
    },
    {
      id: 'requests',
      label: 'طلبات التبرع بالدم',
      icon: Droplet,
      isActive: activePage === 'requests',
      badge: openRequestsCount > 0 ? openRequestsCount : null,
      badgeTone: 'rose',
      iconColor: 'text-red-700',
      onClick: () => handleNavClick('requests')
    },
    {
      id: 'donors',
      label: 'المتبرعون بالدم',
      icon: Heart,
      isActive: activePage === 'donors',
      badge: donors.length > 0 ? donors.length : null,
      badgeTone: 'slate',
      iconColor: 'text-rose-600',
      onClick: () => handleNavClick('donors')
    },
    {
      id: 'hospitals',
      label: 'المستشفيات والأطباء',
      icon: Hospital,
      isActive: activePage === 'hospitals' || activePage === 'hospital-doctors',
      badge: hospitalsCount > 0 ? hospitalsCount : null,
      badgeTone: 'slate',
      iconColor: 'text-teal-700',
      onClick: () => handleNavClick('hospitals')
    },
    {
      id: 'add-donor',
      label: 'تسجيل متبرع جديد',
      icon: UserPlus,
      isActive: false,
      iconColor: 'text-emerald-700',
      onClick: () => handleActionClick(onOpenAddDonor)
    }
  ];

  const trackingItems: NavItem[] = [
    {
      id: 'notifications',
      label: 'الإشعارات',
      icon: Bell,
      isActive: false,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : null,
      badgeTone: 'rose',
      iconColor: 'text-amber-600',
      onClick: () => handleActionClick(onOpenNotifications)
    },
    {
      id: 'history',
      label: 'سجل التبرعات',
      icon: ClipboardList,
      isActive: activePage === 'history',
      iconColor: 'text-indigo-700',
      onClick: () => handleNavClick('history')
    }
  ];

  const supportItems: NavItem[] = [
    {
      id: 'info',
      label: 'معلومات التبرع بالدم',
      icon: BookOpen,
      isActive: activePage === 'info',
      iconColor: 'text-rose-700',
      onClick: () => handleNavClick('info')
    },
    {
      id: 'about',
      label: 'من نحن',
      icon: Info,
      isActive: activePage === 'about',
      iconColor: 'text-teal-700',
      onClick: () => handleNavClick('about')
    },
    {
      id: 'contact',
      label: 'اتصل بنا',
      icon: PhoneCall,
      isActive: activePage === 'contact',
      iconColor: 'text-emerald-700',
      onClick: () => handleNavClick('contact')
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: Settings,
      isActive: activePage === 'settings',
      iconColor: 'text-slate-700',
      onClick: () => handleNavClick('settings')
    }
  ];

  const renderNavGroup = (items: NavItem[], groupTitle?: string) => (
    <div className="space-y-1">
      {groupTitle && (
        <div className="px-3 pt-1 pb-1 text-[11px] font-bold text-slate-400">
          {groupTitle}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            aria-current={item.isActive ? 'page' : undefined}
            className={`w-full min-h-[46px] flex items-center justify-between gap-3 px-3 py-2 rounded-2xl text-right transition-all duration-150 motion-reduce:transition-none cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-rose-600 border ${
              item.isActive
                ? 'bg-rose-50/95 text-rose-800 border-rose-200/90 font-bold shadow-2xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-100/80 border-transparent font-semibold'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  item.isActive
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-slate-100/90 text-slate-600'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${item.isActive ? 'text-white' : item.iconColor || 'text-slate-600'}`} />
              </div>
              <span className="text-[13px] sm:text-sm truncate whitespace-nowrap">
                {item.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`text-[11px] font-bold font-sans tabular-nums px-2 py-0.5 rounded-lg ${
                    item.badgeTone === 'rose'
                      ? 'bg-rose-600 text-white'
                      : item.badgeTone === 'amber'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              <ChevronLeft
                className={`w-4 h-4 transition-transform ${
                  item.isActive ? 'text-rose-600' : 'text-slate-300'
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );

  const backdropOpacity = isOpen
    ? Math.max(0.15, 1 - dragOffsetX / 340)
    : 0;

  return (
    <div
      inert={!isOpen}
      className={`fixed inset-0 z-50 font-['Cairo',sans-serif] ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Dimmed Backdrop */}
      <div
        onClick={onClose}
        style={{ opacity: backdropOpacity }}
        className={`fixed inset-0 bg-slate-950/55 backdrop-blur-[2px] ${
          isDragging
            ? 'transition-none'
            : 'transition-opacity duration-300 motion-reduce:transition-none'
        }`}
      />

      {/* Right-Side Slide-in RTL Drawer */}
      <aside
        id="main-sidebar-drawer"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الجانبية للتنقل"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={
          isOpen && dragOffsetX > 0
            ? { transform: `translateX(${dragOffsetX}px)` }
            : undefined
        }
        className={`fixed top-0 bottom-0 right-0 w-[85vw] max-w-[330px] h-[100dvh] bg-white shadow-2xl border-l border-slate-200/90 flex flex-col will-change-transform ${
          isDragging
            ? 'transition-none'
            : 'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Top User Profile Header */}
        <div className="bg-gradient-to-bl from-rose-900 via-red-900 to-slate-900 text-white p-4 pt-safe shrink-0 relative overflow-hidden">
          {/* Subtle decorative radial accent */}
          <div className="absolute -left-10 -top-10 w-32 h-32 rounded-full bg-rose-500/20 blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between gap-2 relative z-10 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Droplet className="w-3.5 h-3.5 text-rose-200 fill-rose-200" />
              </div>
              <span className="text-[11px] font-bold text-rose-100/95 tracking-wide truncate">
                بوابة تبرع الدم · قعطبة
              </span>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="إغلاق القائمة الجانبية"
              className="min-w-[44px] min-h-[44px] -m-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clickable User Card -> Profile */}
          <button
            type="button"
            onClick={() => handleNavClick('profile')}
            className="w-full flex items-center gap-3 text-right p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-xs transition-all cursor-pointer relative z-10 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-white"
          >
            <div className="relative shrink-0">
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={currentUser?.fullName || 'صورة المستخدم'}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-13 h-13 rounded-2xl object-cover border-2 border-white/40 shadow-md bg-slate-800"
                />
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-rose-600 to-red-700 border-2 border-white/30 flex items-center justify-center text-white font-black text-base shadow-md">
                  {initials}
                </div>
              )}

              {linkedDonor && (
                <span
                  title={`فصيلة الدم: ${linkedDonor.bloodType}`}
                  className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-lg bg-white text-rose-800 font-sans font-black text-[10px] shadow-sm border border-rose-200"
                >
                  {linkedDonor.bloodType}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white truncate">
                  {currentUser?.fullName || 'مستخدم النظام'}
                </h3>
                {role === 'admin' && (
                  <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-rose-100/85 truncate mt-0.5 font-sans" dir="ltr">
                {currentUser?.phone ||
                  (currentUser?.username ? `@${currentUser.username}` : currentUser?.email || '')}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-rose-200/90 mt-1">
                <span>
                  {role === 'admin'
                    ? 'مسؤول النظام'
                    : linkedDonor
                      ? (linkedDonor.isAvailable ? 'متبرع متاح' : 'متبرع · في استراحة')
                      : 'حساب مستخدم'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="underline decoration-white/40">عرض الملف</span>
              </div>
            </div>
          </button>
        </div>

        {/* Scrollable Navigation Links */}
        <nav
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3"
          aria-label="روابط التطبيق"
        >
          {renderNavGroup(primaryItems, 'التنقل والخدمات')}

          <div className="border-t border-slate-100 mx-2" />

          {renderNavGroup(trackingItems, 'التنبيهات والسجل')}

          <div className="border-t border-slate-100 mx-2" />

          {renderNavGroup(supportItems, 'معلومات والدعم')}

          {role === 'admin' && (
            <>
              <div className="border-t border-slate-100 mx-2" />
              {renderNavGroup(
                [
                  {
                    id: 'admin',
                    label: 'لوحة تحكم المسؤول',
                    icon: ShieldCheck,
                    isActive: activePage === 'admin' || activePage === 'districts',
                    iconColor: 'text-amber-600',
                    onClick: () => handleNavClick('admin')
                  }
                ],
                'الإدارة'
              )}
            </>
          )}
        </nav>

        {/* Footer: Logout Button & Official Sponsorship */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 pb-safe shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => handleActionClick(onLogout)}
            className="w-full min-h-[46px] flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm border border-red-200/80 transition-colors cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-red-600"
          >
            <LogOut className="w-4.5 h-4.5 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
          <p className="text-[10px] font-semibold text-slate-400 text-center">
            برعاية اللجنة المجتمعية – مديرية قعطبة
          </p>
        </div>
      </aside>
    </div>
  );
};
