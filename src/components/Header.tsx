import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  HeartHandshake, 
  ShieldCheck, 
  LogOut, 
  User, 
  Sun, 
  Moon, 
  Sunrise, 
  Sunset,
  Menu
} from 'lucide-react';
import { AppNotification, UserAccount, UserRole } from '../types';

interface HeaderProps {
  role: UserRole;
  onOpenRoleModal: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  onNavigateHome: () => void;
  onOpenInstallModal?: () => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
  onOpenSidebar?: () => void;
  isSidebarOpen?: boolean;
}

interface GreetingData {
  greeting: 'صباح الخير' | 'مساء الخير';
  fullGreeting: string;
  subMessage: string;
  timePeriod: 'morning' | 'afternoon' | 'evening' | 'night';
  timeFormatted: string;
}

function calculateGreeting(userName?: string): GreetingData {
  const now = new Date();
  const hour = now.getHours();

  let greeting: 'صباح الخير' | 'مساء الخير' = 'صباح الخير';
  let timePeriod: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
  let subMessage = 'يوم مبارك مكلل بالصحة والعافية، دمتم عوناً للمرضى';

  if (hour >= 4 && hour < 12) {
    greeting = 'صباح الخير';
    timePeriod = 'morning';
    subMessage = 'صباح العطاء والبركة، دمتم سنداً وعوناً لإنقاذ أرواح أهلنا في قعطبة';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'مساء الخير';
    timePeriod = 'afternoon';
    subMessage = 'طاب مساؤكم بكل خير، جهودكم وتكاتفكم تصنع فارقاً في حياة كل محتاج';
  } else if (hour >= 17 && hour < 22) {
    greeting = 'مساء الخير';
    timePeriod = 'evening';
    subMessage = 'مساء النور والتكافل، دمتم رمزاً للشهامة والإنسانية في مديرية قعطبة';
  } else {
    greeting = 'مساء الخير';
    timePeriod = 'night';
    subMessage = 'طابت ليلتكم بالسكينة والسلام، فريق المتبرعين متأهب لنداءات الطوارئ';
  }

  const nameGreeting = userName ? `${greeting}، أهلاً بك يا ${userName}` : `${greeting}، مرحباً بكم`;

  const timeFormatted = now.toLocaleTimeString('ar-YE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return {
    greeting,
    fullGreeting: nameGreeting,
    subMessage,
    timePeriod,
    timeFormatted
  };
}

export const Header: React.FC<HeaderProps> = ({
  role,
  onOpenRoleModal,
  notifications,
  onOpenNotifications,
  onNavigateHome,
  currentUser,
  onLogout,
  onOpenSidebar,
  isSidebarOpen = false
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [logoTapCount, setLogoTapCount] = useState(0);

  // Dynamic greeting state based on current device time, updated periodically
  const [greetingData, setGreetingData] = useState<GreetingData>(() =>
    calculateGreeting(currentUser?.fullName)
  );

  useEffect(() => {
    // Recompute immediately when user changes
    setGreetingData(calculateGreeting(currentUser?.fullName));

    // Update greeting and time every 30 seconds
    const interval = setInterval(() => {
      setGreetingData(calculateGreeting(currentUser?.fullName));
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser?.fullName]);

  const handleBrandClick = () => {
    onNavigateHome();
    const newCount = logoTapCount + 1;
    if (newCount >= 5) {
      setLogoTapCount(0);
      if (onOpenRoleModal) {
        onOpenRoleModal();
      }
    } else {
      setLogoTapCount(newCount);
      setTimeout(() => setLogoTapCount(0), 3000);
    }
  };

  const isMorning = greetingData.greeting === 'صباح الخير';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] font-['Cairo',sans-serif]">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2.5 sm:gap-3">
        {/* Right side in RTL: Hamburger Menu Trigger + Brand Mark */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              aria-label="فتح القائمة الجانبية"
              aria-expanded={isSidebarOpen}
              aria-controls="main-sidebar-drawer"
              title="القائمة الجانبية"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95 focus-visible:outline-2 focus-visible:outline-rose-600"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* App Title & Brand (Stealth 5-tap for admin access) */}
          <div 
            onClick={handleBrandClick}
            className="flex items-center gap-2.5 cursor-pointer group transition-transform active:scale-98 select-none min-w-0"
            title="سجل المتبرعين بالدم - قعطبة"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-700 to-red-800 flex items-center justify-center text-white shadow-sm shadow-rose-900/10 group-hover:scale-105 transition-transform shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xs sm:text-base font-bold text-slate-900 leading-tight group-hover:text-rose-700 transition-colors truncate">
                سجل المتبرعين بالدم - مديرية قعطبة
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-500 truncate">برعاية اللجنة المجتمعية – مديرية قعطبة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls: Notifications, User, Role & Logout */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-slate-600 hover:text-rose-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 hover:border-slate-300"
            title="الإشعارات الفورية"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? '+9' : unreadCount}
              </span>
            )}
          </button>

          {/* Current User Greeting & Info Badge on Desktop */}
          {currentUser && (
            <div 
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 max-w-[240px]"
              title={`الحساب الحالي: ${currentUser.fullName} (@${currentUser.username})`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                isMorning ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {isMorning ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-[10px] text-slate-400 font-bold">{greetingData.greeting}</span>
                <span className="truncate font-semibold text-[11px] text-slate-800">{currentUser.fullName}</span>
              </div>
            </div>
          )}

          {/* Role Indicator: Protected and hidden unless logged in as admin */}
          {role === 'admin' && (
            <button
              onClick={onOpenRoleModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs cursor-pointer"
              title="لوحة وصلاحيات المسؤول المعتمد"
            >
              <ShieldCheck className="w-4 h-4 text-amber-100" />
              <span>مسؤول</span>
            </button>
          )}

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 transition-colors cursor-pointer"
              title="تسجيل الخروج من الحساب"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          )}
        </div>
      </div>

      {/* Prominent Alert & Dynamic Greeting Strip (صباح الخير / مساء الخير) - Compact */}
      <div className={`border-t px-3 py-1 sm:px-6 transition-all duration-300 ${
        isMorning
          ? 'bg-gradient-to-r from-amber-50/80 via-rose-50/60 to-amber-50/80 border-amber-200/50 text-amber-950'
          : 'bg-gradient-to-r from-indigo-50/70 via-slate-50/80 to-indigo-50/70 border-indigo-200/50 text-slate-900'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-[11px] sm:text-xs">
          {/* Main Greeting with Animated Day/Night Icon */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`p-1 rounded-md flex items-center justify-center shrink-0 shadow-2xs ${
              isMorning
                ? 'bg-amber-100/90 text-amber-700 ring-1 ring-amber-300/40'
                : 'bg-indigo-100/90 text-indigo-700 ring-1 ring-indigo-300/40'
            }`}>
              {greetingData.timePeriod === 'morning' && <Sun className="w-3.5 h-3.5 animate-pulse" />}
              {greetingData.timePeriod === 'afternoon' && <Sunrise className="w-3.5 h-3.5" />}
              {greetingData.timePeriod === 'evening' && <Sunset className="w-3.5 h-3.5" />}
              {greetingData.timePeriod === 'night' && <Moon className="w-3.5 h-3.5 animate-pulse" />}
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold tracking-tight truncate flex items-center gap-1">
                <span className={isMorning ? 'text-amber-900' : 'text-indigo-950'}>
                  {greetingData.fullGreeting}
                </span>
                <span className="text-rose-600 font-bold text-[10px]">🩸</span>
              </span>

              <span className="hidden md:inline-block text-[10px] sm:text-[11px] text-slate-500 font-normal truncate">
                — {greetingData.subMessage}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};


