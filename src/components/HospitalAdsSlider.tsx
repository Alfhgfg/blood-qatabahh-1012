import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Hospital, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { HospitalAd } from '../types';

interface HospitalAdsSliderProps {
  ads: HospitalAd[];
  onSelectAd: (ad: HospitalAd) => void;
}

export const HospitalAdsSlider: React.FC<HospitalAdsSliderProps> = ({ ads, onSelectAd }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef(false);
  const didSwipeRef = useRef(false);

  const total = ads.length;
  const safeIndex = total > 0 ? Math.min(currentIndex, total - 1) : 0;

  useEffect(() => {
    if (currentIndex >= total && total > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, total]);

  const goToSlide = useCallback(
    (index: number) => {
      if (total <= 0) return;
      const next = ((index % total) + total) % total;
      setCurrentIndex(next);
    },
    [total]
  );

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Smooth auto-advance when multiple ads exist and user is not interacting
  useEffect(() => {
    if (total <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [total, isPaused]);

  if (total === 0) {
    return null;
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = false;
    didSwipeRef.current = false;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null || e.touches.length !== 1) {
      return;
    }
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    if (!isHorizontalSwipeRef.current && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      isHorizontalSwipeRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsPaused(false);
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const dx = endX - touchStartXRef.current;

    if (Math.abs(dx) > 36 && total > 1) {
      didSwipeRef.current = true;
      if (dx < 0) {
        handleNext();
      } else {
        handlePrev();
      }
      window.setTimeout(() => {
        didSwipeRef.current = false;
      }, 250);
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = false;
  };

  return (
    <section
      aria-label="إعلانات المستشفيات والمراكز الطبية"
      className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2.5"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0">
            <Hospital className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
            إعلانات المستشفيات والمراكز الطبية
          </h3>
        </div>

        {/* Current Slide / Total Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-[11px] font-bold font-sans text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-lg tabular-nums"
            aria-live="polite"
          >
            {safeIndex + 1} / {total}
          </span>
        </div>
      </div>

      {/* Responsive Banner Slider Viewport (Height strictly 94px - 108px) */}
      <div
        className="relative w-full h-[96px] sm:h-[108px] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 group select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Horizontal LTR Track for consistent smooth sliding */}
        <div
          dir="ltr"
          className="flex w-full h-full transition-transform duration-500 ease-out will-change-transform"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {ads.map((ad, index) => (
            <button
              key={ad.id}
              type="button"
              dir="rtl"
              onClick={() => {
                if (didSwipeRef.current) return;
                onSelectAd(ad);
              }}
              aria-label={`عرض تفاصيل ${ad.hospitalName}`}
              className="relative w-full h-full shrink-0 block text-right cursor-pointer focus:outline-hidden"
            >
              <img
                src={ad.imageUrl}
                alt={ad.hospitalName}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                className="w-full h-full object-cover object-center block"
              />
              {/* Subtle bottom gradient for hospital name & tap hint */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent px-3 py-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-bold text-white truncate drop-shadow-xs">
                  {ad.hospitalName}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/95 bg-rose-700/85 backdrop-blur-xs px-2 py-0.5 rounded-md shrink-0">
                  <span>التفاصيل</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Desktop/Quick Prev & Next Buttons (only when > 1 ad) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="الإعلان السابق"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/55 hover:bg-rose-700/90 text-white items-center justify-center backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="الإعلان التالي"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/55 hover:bg-rose-700/90 text-white items-center justify-center backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Dot Indicators */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-0.5" role="tablist" aria-label="مؤشرات الإعلانات">
          {ads.map((ad, idx) => {
            const active = idx === safeIndex;
            return (
              <button
                key={ad.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`الانتقال إلى ${ad.hospitalName}`}
                onClick={() => goToSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  active ? 'w-5 bg-rose-700' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
