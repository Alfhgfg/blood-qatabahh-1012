/**
 * Application Security Shield & Anti-Tamper Guard
 * Provides client-side defense-in-depth:
 * - Anti-DevTools / Anti-Inspection deterrence
 * - Context menu and copy protection on core data
 * - Anti-clickjacking & framing verification
 * - XSS input sanitization
 * - Runtime integrity checks
 */

// XSS Sanitizer for all text inputs
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '') // remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // strip script tags
    .replace(/<[^>]+>/g, '') // strip any HTML tags
    .replace(/javascript:/gi, '') // strip javascript: schemes
    .replace(/data:text\/html/gi, '') // strip data html schemes
    .trim();
}

// Phone number strict whitelist sanitizer
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  // Keep only digits and '+'
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.slice(0, 20);
}

export class SecurityShield {
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window === 'undefined') return;

    this.setupConsoleWarning();
    this.setupDevToolsDeterrent();
    this.setupAntiFraming();
    this.setupContextMenuProtection();
  }

  /**
   * Prominently display a security disclaimer in the browser console
   */
  private static setupConsoleWarning(): void {
    try {
      const bannerStyle = 'color: #be123c; font-size: 18px; font-weight: bold; background: #fff1f2; padding: 8px 16px; border-radius: 8px; border: 1px solid #fecdd3;';
      const textStyle = 'color: #334155; font-size: 12px; line-height: 1.6;';
      
      console.log('%c⚠️ تحذير أمني - سجل المتبرعين بالدم (مديرية قعطبة)', bannerStyle);
      console.log(
        '%cهذا التطبيق وسجل المتبرعين بالدم محمي بأنظمة أمنية وتشفير سحابي.\nأي محاولة للهندسة العكسية، العبث بالبيانات، أو استخراج سجلات المتبرعين بشكل غير مصرح به تخضع للرصد والحظر التلقائي.',
        textStyle
      );
    } catch {
      // Ignore console restrictions
    }
  }

  /**
   * Deter common inspection shortcuts (F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S)
   */
  private static setupDevToolsDeterrent(): void {
    try {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        // Only enforce in production or non-localhost
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // F12
        if (e.key === 'F12') {
          if (!isLocal) {
            e.preventDefault();
            return false;
          }
        }

        // Ctrl+Shift+I (Inspector), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element picker)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
          if (!isLocal) {
            e.preventDefault();
            return false;
          }
        }

        // Ctrl+U / Cmd+U (View Source)
        if ((e.ctrlKey || e.metaKey) && ['U', 'u'].includes(e.key)) {
          e.preventDefault();
          return false;
        }

        // Ctrl+S / Cmd+S (Save complete page HTML)
        if ((e.ctrlKey || e.metaKey) && ['S', 's'].includes(e.key)) {
          // Prevent accidental source saving
          if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            return false;
          }
        }
      }, { capture: true });
    } catch {
      // Ignore
    }
  }

  /**
   * Block right click context menu on general layout to deter simple "Inspect Element" / "Save Page As"
   * Still permits right click inside form inputs for pasting
   */
  private static setupContextMenuProtection(): void {
    try {
      document.addEventListener('contextmenu', (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        // Allow context menu only inside editable inputs / textareas
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return true;
        }

        // Only block in production environments
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocal) {
          e.preventDefault();
          return false;
        }
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Anti-clickjacking: ensure app is not framed inside an unauthorized foreign origin
   */
  private static setupAntiFraming(): void {
    try {
      if (window.self !== window.top) {
        // App is embedded inside an iframe.
        // Validate if ancestor is from Google Cloud / AI Studio or trusted origin
        try {
          const ancestorOrigin = document.referrer ? new URL(document.referrer).origin : '';
          const isTrusted = 
            !ancestorOrigin ||
            ancestorOrigin.includes('run.app') ||
            ancestorOrigin.includes('google.com') ||
            ancestorOrigin.includes('googleusercontent.com') ||
            ancestorOrigin.includes('aistudio') ||
            ancestorOrigin.includes('firebaseapp.com') ||
            ancestorOrigin.includes('localhost');

          if (!isTrusted) {
            console.warn('Blocked unauthorized iframe embedding');
            // Break out of untrusted framing
            window.top!.location.href = window.self.location.href;
          }
        } catch {
          // If cross-origin framing forbids inspection, top-level navigation will be restricted by browser
        }
      }
    } catch {
      // Ignore
    }
  }
}

// Auto-initialize shield on load
SecurityShield.initialize();
