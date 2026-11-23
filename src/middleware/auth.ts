import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const MASTER_ADMIN_EMAIL = 'abdulrahmanalshaiby2028@gmail.com';
export const MASTER_ADMIN_EMAILS = [
  'abdulrahmanalshaiby2028@gmail.com',
  'abdulrahmanalshaiby2070@gmail.com'
];

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const verifyAdminToken = async (
  authHeader?: string
): Promise<{ isAdmin: boolean; user?: DecodedIdToken; error?: string }> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'غير مصرح: رمز التفويض مفقود' };
  }
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return { isAdmin: false, error: 'رمز التفويض فارغ' };
  }

  // 1. Primary verification via Firebase Admin SDK
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = (decodedToken.email || '').toLowerCase().trim();
    if (MASTER_ADMIN_EMAILS.includes(email) || decodedToken.admin === true) {
      return { isAdmin: true, user: decodedToken };
    }
    return { isAdmin: false, user: decodedToken, error: 'تم رفض الوصول: هذا الحساب ليس مسؤولاً معتمداً' };
  } catch (err: any) {
    // 2. Secondary verification via official Firebase Identity Toolkit REST API with apiKey
    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token })
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const fbUser = data?.users?.[0];
        if (fbUser && fbUser.email) {
          const email = (fbUser.email || '').toLowerCase().trim();
          if (MASTER_ADMIN_EMAILS.includes(email)) {
            const userObj: any = {
              uid: fbUser.localId,
              email: fbUser.email,
              email_verified: fbUser.emailVerified === true,
              auth_time: Math.floor(Date.now() / 1000),
              user_id: fbUser.localId,
              sub: fbUser.localId,
              admin: true
            };
            return { isAdmin: true, user: userObj };
          }
          return { isAdmin: false, error: 'تم رفض الوصول: هذا الحساب ليس مسؤولاً معتمداً' };
        }
      }
    } catch (restErr) {
      console.warn('Identity Toolkit verification fallback notice:', restErr);
    }

    return { isAdmin: false, error: 'جلسة التحقق غير صالحة أو منتهية، يرجى إعادة تسجيل الدخول' };
  }
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const verification = await verifyAdminToken(req.headers.authorization);
  if (!verification.isAdmin) {
    return res.status(verification.user ? 403 : 401).json({
      success: false,
      error: verification.error || 'عفواً، يتطلب هذا الإجراء صلاحيات مسؤول النظام المعتمد'
    });
  }
  req.user = verification.user;
  next();
};


