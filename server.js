var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import nodemailer from "nodemailer";
import cron from "node-cron";
import {
  createDefaultAppUpdateConfig,
  sanitizeLoadedAppUpdateConfig,
  validateAndNormalizeAppUpdateConfig
} from "./src/lib/appUpdateValidator.js";
import {
  normalizeUserRecord,
  summarizeUsersDirectory
} from "./src/lib/userDirectoryUtils.js";

// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection as clientCollection, getDocs as getClientDocs } from "firebase/firestore";

// firebase-applet-config.json
var firebase_applet_config_default = (() => {
  try {
    const cfgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "firebase-applet-config.json");
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    }
  } catch (e) {
    console.warn("Notice reading firebase-applet-config.json:", e.message);
  }
  return {
    projectId: "avian-gate-pbcxw",
    appId: "1:589909705354:web:3d9e372d5712e34ed0e373",
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: "avian-gate-pbcxw.firebaseapp.com",
    firestoreDatabaseId: "ai-studio-cloneof-b241c9ea-b029-471a-bf1f-1ab8e967fe5e",
    storageBucket: "avian-gate-pbcxw.firebasestorage.app",
    messagingSenderId: "589909705354",
    measurementId: "",
    oAuthClientId: "",
    recaptchaSiteKey: ""
  };
})();

// src/lib/firebase-admin.ts
if (!getApps().length) {
  let credential = void 0;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(sa);
    } catch (e) {
      console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
    }
  }
  initializeApp({
    projectId: firebase_applet_config_default.projectId,
    ...(credential ? { credential } : {})
  });
}
var adminAuth = getAuth();
var adminMessaging = null;
try {
  adminMessaging = getMessaging();
} catch (e) {
  console.warn("Firebase Admin Messaging init note:", e.message);
}
var adminDb = null;
try {
  adminDb = getAdminFirestore();
} catch (e) {
  console.warn("Firebase Admin Firestore init note:", e.message);
}

var clientFirebaseApp = null;
var clientFirestoreDb = null;
try {
  clientFirebaseApp = initClientApp(firebase_applet_config_default);
  clientFirestoreDb = getClientFirestore(clientFirebaseApp, firebase_applet_config_default.firestoreDatabaseId);
} catch (e) {
  console.warn("Client Firestore init notice in server:", e.message);
}

async function fetchAllFirestoreFCMTokens() {
  if (!clientFirestoreDb) return [];
  try {
    const snap = await getClientDocs(clientCollection(clientFirestoreDb, "fcm_tokens"));
    const tokens = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data && data.token && data.enabled !== false) {
        tokens.push(data);
      }
    });
    return tokens;
  } catch (err) {
    console.warn("Notice querying fcm_tokens from Firestore:", err.message);
    return [];
  }
}

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

var TRUSTED_ADMIN_EMAILS = [
  "abdulrahmanalshaiby2028@gmail.com",
  "abdulrahmanalshaiby2070@gmail.com",
  "an736160403an@gmail.com"
];
var ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
function issueAdminSessionToken(username = "admin") {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      username,
      exp: Date.now() + 24 * 60 * 60 * 1e3
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("base64url");
  return `adm_${payload}.${sig}`;
}
function verifyAdminSessionToken(token) {
  if (!token || typeof token !== "string" || !token.startsWith("adm_")) return null;
  const raw = token.slice(4);
  const dotIdx = raw.indexOf(".");
  if (dotIdx <= 0) return null;
  const payload = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || parsed.role !== "admin" || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
var requireAdminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "غير مصرح: مطلوب تسجيل دخول المسؤول المعتمد" });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: "غير مصرح: رمز المصادقة مفقود" });
  }
  const sessionAdmin = verifyAdminSessionToken(token);
  if (sessionAdmin) {
    req.user = { uid: "user-admin", role: "admin", username: sessionAdmin.username };
    return next();
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = String(decodedToken.email || "").toLowerCase();
    let isAdminUser = TRUSTED_ADMIN_EMAILS.includes(email);
    if (!isAdminUser && adminDb && decodedToken.uid) {
      try {
        const adminDoc = await adminDb.collection("admins").doc(decodedToken.uid).get();
        if (adminDoc.exists) isAdminUser = true;
      } catch {
      }
    }
    if (!isAdminUser) {
      return res.status(403).json({ error: "تم رفض الوصول: هذه العملية مخصصة للمسؤول المعتمد فقط" });
    }
    req.user = { ...decodedToken, role: "admin" };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "غير مصرح: جلسة المسؤول منتهية أو غير صالحة" });
  }
};

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  districts: () => districts,
  donors: () => donors,
  notifications: () => notifications,
  requests: () => requests,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import { boolean, integer, json, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: varchar("uid", { length: 128 }).notNull().unique(),
  // Firebase Auth UID
  email: varchar("email", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  role: varchar("role", { length: 20 }).default("user"),
  createdAt: timestamp("created_at").defaultNow()
});
var donors = pgTable("donors", {
  id: varchar("id", { length: 128 }).primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  bloodType: varchar("blood_type", { length: 10 }).notNull(),
  district: varchar("district", { length: 150 }).notNull(),
  area: varchar("area", { length: 150 }).notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  lastDonationDate: varchar("last_donation_date", { length: 50 }),
  notes: text("notes"),
  createdAt: varchar("created_at", { length: 50 }).notNull()
});
var requests = pgTable("requests", {
  id: varchar("id", { length: 128 }).primaryKey(),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  bloodType: varchar("blood_type", { length: 10 }).notNull(),
  unitsNeeded: integer("units_needed").default(1).notNull(),
  hospital: varchar("hospital", { length: 255 }).notNull(),
  district: varchar("district", { length: 150 }).notNull(),
  area: varchar("area", { length: 150 }).notNull(),
  urgency: varchar("urgency", { length: 50 }).default("urgent").notNull(),
  status: varchar("status", { length: 50 }).default("open").notNull(),
  contactName: varchar("contact_name", { length: 255 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
  caseDetails: text("case_details"),
  requestDate: varchar("request_date", { length: 50 }).notNull(),
  createdAt: varchar("created_at", { length: 50 }).notNull()
});
var districts = pgTable("districts", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  areas: json("areas").$type().default([])
});
var notifications = pgTable("notifications", {
  id: varchar("id", { length: 128 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  time: varchar("time", { length: 50 }).notNull(),
  type: varchar("type", { length: 50 }).default("system").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var usersRelations = relations(users, ({}) => ({}));

// src/db/index.ts
var dbInstance;
try {
  if (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME) {
    if (!global._postgresPool) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD || "",
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 5e3
      });
      global._postgresPool.on("error", (err) => {
        console.warn("Notice: SQL pool client connection warning:", err.message);
      });
    }
    dbInstance = drizzle(global._postgresPool, { schema: schema_exports });
  } else {
    throw new Error("Database credentials not set");
  }
} catch (e) {
  console.warn("[AI Studio] Cloud SQL not connected — using mock fallback");
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d) => d?.data ?? {},
    update: async (d) => d?.data ?? {},
    delete: async () => ({})
  };
  const queryProxy = new Proxy({}, { get: () => noOp });
  const chainable = () => chainable;
  chainable.values = () => chainable;
  chainable.onConflictDoUpdate = () => chainable;
  chainable.returning = async () => [];
  chainable.from = () => chainable;
  chainable.where = () => chainable;
  dbInstance = new Proxy({ query: queryProxy }, {
    get: (_, prop) => {
      if (prop === "query") return queryProxy;
      if (prop === "insert" || prop === "select" || prop === "update" || prop === "delete") {
        return () => chainable;
      }
      return async () => [];
    }
  });
}
var db = dbInstance;

// src/db/users.ts
async function getOrCreateUser(uid, email, fullName, phone, role = "user") {
  try {
    const result = await db.insert(users).values({
      uid,
      email,
      fullName: fullName || email.split("@")[0],
      phone: phone || "",
      role
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        ...fullName ? { fullName } : {},
        ...phone ? { phone } : {}
      }
    }).returning();
    return result?.[0] || { uid, email, fullName: fullName || email.split("@")[0], phone: phone || "", role };
  } catch (err) {
    console.warn("[AI Studio] Notice: Cloud SQL user sync fallback active:", err);
    return { uid, email, fullName: fullName || email.split("@")[0], phone: phone || "", role };
  }
}
async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.warn("[AI Studio] Notice: Cloud SQL getUsers fallback active:", error);
    return [];
  }
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.disable("x-powered-by");
var loginAttempts = /* @__PURE__ */ new Map();
function checkRateLimit(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  const now = Date.now();
  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1e3);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true };
}
function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count++;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1e3;
  }
  loginAttempts.set(ip, record);
}
function resetFailedAttempt(ip) {
  loginAttempts.delete(ip);
}
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-XSS-Protection", "1; mode=block");
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
var dataDir = path.join(__dirname, "data");
var backupsDir = path.join(dataDir, "backups");
var exportsDir = path.join(dataDir, "exports");
var dbFilePath = path.join(dataDir, "blood_registry_db.json");
var distPath = path.join(__dirname, "dist");
[dataDir, backupsDir, exportsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
function normalizeArabicText(text2) {
  if (!text2) return "";
  return text2.trim().replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "\u0627").replace(/ة/g, "\u0647").replace(/ى/g, "\u064A").replace(/[\s\t\n]+/g, " ").toLowerCase();
}
function normalizePhoneNumber(phone) {
  if (!phone) return "";
  let clean = String(phone).replace(/[\s\-\(\)\.]+/g, "");
  if (clean.startsWith("+967")) clean = clean.substring(4);
  if (clean.startsWith("00967")) clean = clean.substring(5);
  if (clean.startsWith("967")) clean = clean.substring(3);
  if (clean.startsWith("0")) clean = clean.substring(1);
  return clean;
}
function checkDonorDuplication(newDonor, existingDonors, excludeId) {
  const normPhone = normalizePhoneNumber(newDonor.phone);
  const normName = normalizeArabicText(newDonor.fullName);
  const rawName = String(newDonor.fullName || "").trim();
  if (!normPhone || normPhone.length !== 9 || !/^(70|71|73|77|78)\d{7}$/.test(normPhone)) {
    return {
      isDuplicate: true,
      reason: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D. \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0645\u0646 9 \u0623\u0631\u0642\u0627\u0645 \u0648\u064A\u0628\u062F\u0623 \u0628\u0640 (77 \u0623\u0648 78 \u0623\u0648 73 \u0623\u0648 71 \u0623\u0648 70)."
    };
  }
  if (/^(\d)\1{7,}$/.test(normPhone)) {
    return {
      isDuplicate: true,
      reason: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u060C \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u062A\u0635\u0627\u0644 \u062D\u0642\u064A\u0642\u064A \u0644\u0644\u062A\u0648\u0627\u0635\u0644 \u0639\u0646\u062F \u0627\u0644\u062D\u0627\u062C\u0629 \u0644\u0644\u062F\u0645."
    };
  }
  const words = rawName.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 3) {
    return {
      isDuplicate: true,
      reason: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062B\u0644\u0627\u062B\u064A \u0623\u0648 \u0627\u0644\u0631\u0628\u0627\u0639\u064A \u0643\u0627\u0645\u0644\u0627\u064B (\u0645\u062B\u0627\u0644: \u0635\u0627\u0644\u062D \u0645\u062D\u0645\u062F \u0639\u0644\u064A \u0627\u0644\u0634\u0639\u064A\u0628\u064A) \u0644\u0636\u0645\u0627\u0646 \u062A\u0641\u0627\u062F\u064A \u062A\u0634\u0627\u0628\u0647 \u0627\u0644\u0623\u0633\u0645\u0627\u0621 \u0648\u0636\u0645\u0627\u0646 \u062F\u0642\u0629 \u0627\u0644\u0633\u062C\u0644."
    };
  }
  for (const existing of existingDonors) {
    if (excludeId && existing.id === excludeId) continue;
    const existingNormPhone = normalizePhoneNumber(existing.phone);
    const existingNormName = normalizeArabicText(existing.fullName);
    if (existingNormPhone === normPhone) {
      return {
        isDuplicate: true,
        reason: `\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 (${newDonor.phone}) \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0641\u064A \u0627\u0644\u0633\u062C\u0644 \u0628\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u0628\u0631\u0639 (${existing.fullName}). \u064A\u0645\u0646\u0639 \u062A\u0633\u062C\u064A\u0644 \u0646\u0641\u0633 \u0627\u0644\u0631\u0642\u0645 \u0644\u0645\u062A\u0628\u0631\u0639 \u0622\u062E\u0631.`
      };
    }
    if (existingNormName === normName) {
      return {
        isDuplicate: true,
        reason: `\u0627\u0644\u0645\u062A\u0628\u0631\u0639 (${newDonor.fullName}) \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0641\u064A \u0627\u0644\u0633\u062C\u0644 \u0628\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 (${existing.phone}). \u064A\u0645\u0646\u0639 \u062A\u0643\u0631\u0627\u0631 \u062A\u0633\u062C\u064A\u0644 \u0646\u0641\u0633 \u0627\u0644\u0645\u062A\u0628\u0631\u0639.`
      };
    }
    const existingWords = existingNormName.split(" ").filter((w) => w.length > 1);
    const newWords = normName.split(" ").filter((w) => w.length > 1);
    const commonWords = newWords.filter((w) => existingWords.includes(w));
    if (commonWords.length >= 3 && (commonWords.length >= newWords.length - 1 || commonWords.length >= existingWords.length - 1)) {
      return {
        isDuplicate: true,
        reason: `\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645 \u064A\u062A\u0634\u0627\u0628\u0647 \u0623\u0648 \u064A\u062A\u0637\u0627\u0628\u0642 \u0628\u0634\u0643\u0644 \u0643\u0628\u064A\u0631 \u0645\u0639 \u0627\u0644\u0645\u062A\u0628\u0631\u0639 \u0627\u0644\u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B (${existing.fullName} - ${existing.phone}). \u064A\u0645\u0646\u0639 \u0627\u0644\u062A\u062D\u0627\u064A\u0644 \u0628\u062A\u0633\u062C\u064A\u0644 \u0633\u062C\u0644\u0627\u062A \u0645\u062A\u0639\u062F\u062F\u0629 \u0644\u0646\u0641\u0633 \u0627\u0644\u0634\u062E\u0635.`
      };
    }
  }
  return { isDuplicate: false };
}
var SEED_DISTRICTS = [
  {
    id: "dist-1",
    name: "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
    areas: ["\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u062F\u064A\u0646\u0629", "\u0633\u0648\u0642 \u0642\u0639\u0637\u0628\u0629", "\u062D\u064A \u0627\u0644\u0646\u0635\u0631", "\u062D\u064A \u0627\u0644\u0633\u0644\u0627\u0645", "\u0627\u0644\u0645\u062D\u0637\u0629", "\u0627\u0644\u0633\u0647\u062F\u0647", "\u062F\u0627\u0631 \u0627\u0644\u0633\u0644\u0627\u0645"]
  },
  {
    id: "dist-2",
    name: "\u0642\u0639\u0637\u0628\u0629 \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629",
    areas: ["\u0627\u0644\u062C\u0628\u0627\u0631\u0629", "\u0627\u0644\u0642\u0631\u064A\u0646", "\u0635\u0648\u0644\u0627\u0646", "\u0627\u0644\u062C\u0639\u062F\u064A\u0627\u062A", "\u064A\u0639\u064A\u0633", "\u0627\u0644\u0642\u0647\u0631\u0629", "\u0627\u0644\u0639\u0631\u0641\u0627\u0641", "\u062D\u0628\u064A\u0644 \u0627\u0644\u0633\u0648\u0642"]
  },
  {
    id: "dist-3",
    name: "\u0627\u0644\u0641\u0627\u062E\u0631",
    areas: ["\u0633\u0648\u0642 \u0627\u0644\u0641\u0627\u062E\u0631", "\u062D\u0628\u064A\u0644 \u0627\u0644\u0639\u0628\u062F\u064A", "\u0645\u0631\u062E\u0632\u0629", "\u0633\u0644\u064A\u0645", "\u0627\u0644\u0642\u0641\u0644\u0629", "\u0628\u0627\u0628 \u063A\u0644\u0642"]
  },
  {
    id: "dist-4",
    name: "\u0633\u0646\u0627\u062D",
    areas: ["\u0633\u0648\u0642 \u0633\u0646\u0627\u062D", "\u0627\u0644\u0648\u0628\u062D", "\u0627\u0644\u0642\u0628\u0629", "\u062E\u0648\u0628\u0631", "\u0644\u0643\u0645\u0629 \u0627\u0644\u062F\u0648\u0643\u064A"]
  },
  {
    id: "dist-5",
    name: "\u062D\u0645\u0631 \u0648\u0634\u062E\u0628",
    areas: ["\u0634\u062E\u0628", "\u062D\u0645\u0631 \u0627\u0644\u0633\u0627\u062F\u0629", "\u062D\u0645\u0631 \u0627\u0644\u0642\u0648\u0632", "\u062F\u0627\u0631 \u0627\u0644\u0633\u064A\u062F", "\u0628\u064A\u062A \u0627\u0644\u0634\u0648\u0643\u064A"]
  },
  {
    id: "dist-6",
    name: "\u0646\u0642\u064A\u0644 \u0627\u0644\u0634\u064A\u0645 \u0648\u0631\u064A\u0634\u0627\u0646",
    areas: ["\u0646\u0642\u064A\u0644 \u0627\u0644\u0634\u064A\u0645", "\u0631\u064A\u0634\u0627\u0646", "\u0643\u0646\u0647", "\u0627\u0644\u062D\u0642\u0641", "\u062D\u0645\u0627\u0645 \u0627\u0644\u0641\u0631\u062F\u0648\u0633"]
  }
];
var SEED_DONORS = [
  {
    id: "donor-1",
    fullName: "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0645\u062D\u0645\u062F \u0635\u0627\u0644\u062D \u0627\u0644\u0642\u062D\u0637\u0628\u064A",
    phone: "771234567",
    bloodType: "O+",
    district: "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
    area: "\u062D\u064A \u0627\u0644\u0633\u0644\u0627\u0645",
    isAvailable: true,
    lastDonationDate: "2026-06-15",
    notes: "\u0645\u062A\u0628\u0631\u0639 \u0645\u0646\u062A\u0638\u0645\u060C \u062C\u0627\u0647\u0632 \u0641\u064A \u0623\u064A \u0648\u0642\u062A \u0637\u0627\u0631\u0626",
    createdAt: "2026-08-01T10:00:00Z"
  },
  {
    id: "donor-2",
    fullName: "\u0635\u062E\u0631 \u0639\u0628\u062F\u0627\u0644\u0643\u0631\u064A\u0645 \u0627\u0644\u0642\u0639\u0637\u0628\u064A",
    phone: "734567890",
    bloodType: "O-",
    district: "\u0642\u0639\u0637\u0628\u0629 \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629",
    area: "\u0627\u0644\u062C\u0628\u0627\u0631\u0629",
    isAvailable: true,
    lastDonationDate: "2026-05-10",
    notes: "\u0641\u0635\u064A\u0644\u0629 \u0646\u0627\u062F\u0631\u0629 \u0645\u0639\u0637\u0627\u0621 \u0639\u0627\u0645",
    createdAt: "2026-08-05T12:30:00Z"
  },
  {
    id: "donor-3",
    fullName: "\u0623\u062D\u0645\u062F \u0641\u0636\u0644 \u0627\u0644\u0645\u0646\u0635\u0648\u0628",
    phone: "773456789",
    bloodType: "A+",
    district: "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
    area: "\u0633\u0648\u0642 \u0642\u0639\u0637\u0628\u0629",
    isAvailable: true,
    lastDonationDate: "2026-07-20",
    notes: "\u0645\u062A\u0648\u0627\u062C\u062F \u0628\u0627\u0644\u0642\u0631\u0628 \u0645\u0646 \u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0633\u0644\u0627\u0645",
    createdAt: "2026-08-10T09:15:00Z"
  },
  {
    id: "donor-4",
    fullName: "\u062C\u0645\u0627\u0644 \u064A\u062D\u064A\u0649 \u0627\u0644\u0634\u0639\u064A\u0628\u064A",
    phone: "712398745",
    bloodType: "B+",
    district: "\u0633\u0646\u0627\u062D",
    area: "\u0633\u0648\u0642 \u0633\u0646\u0627\u062D",
    isAvailable: true,
    lastDonationDate: "2026-08-25",
    notes: "\u0644\u062F\u064A\u0647 \u0648\u0633\u064A\u0644\u0629 \u0645\u0648\u0627\u0635\u0644\u0627\u062A \u0633\u0631\u064A\u0639\u0629",
    createdAt: "2026-08-12T14:00:00Z"
  },
  {
    id: "donor-5",
    fullName: "\u0648\u0636\u0627\u062D \u0646\u0627\u0635\u0631 \u0627\u0644\u0641\u0627\u062E\u0631\u064A",
    phone: "770987654",
    bloodType: "AB+",
    district: "\u0627\u0644\u0641\u0627\u062E\u0631",
    area: "\u062D\u0628\u064A\u0644 \u0627\u0644\u0639\u0628\u062F\u064A",
    isAvailable: true,
    lastDonationDate: "2026-04-12",
    notes: "\u0645\u0633\u062A\u0642\u0628\u0644 \u0639\u0627\u0645\u060C \u0645\u0633\u062A\u0639\u062F \u0644\u0644\u062A\u0628\u0631\u0639 \u0644\u062C\u0645\u064A\u0639 \u0641\u0635\u0627\u0626\u0644 AB",
    createdAt: "2026-08-15T16:20:00Z"
  },
  {
    id: "donor-6",
    fullName: "\u0645\u0627\u062C\u062F \u0639\u0644\u064A \u0627\u0644\u0634\u0648\u0643\u064A",
    phone: "737890123",
    bloodType: "A-",
    district: "\u062D\u0645\u0631 \u0648\u0634\u062E\u0628",
    area: "\u0628\u064A\u062A \u0627\u0644\u0634\u0648\u0643\u064A",
    isAvailable: false,
    lastDonationDate: "2026-09-28",
    notes: "\u062A\u0628\u0631\u0639 \u0645\u0624\u062E\u0631\u0627\u064B - \u064A\u062D\u062A\u0627\u062C \u0641\u062A\u0631\u0629 \u0631\u0627\u062D\u0629 \u0623\u0633\u0628\u0648\u0639\u064A\u0646 \u0644\u0644\u062C\u0627\u0647\u0632\u064A\u0629 \u0627\u0644\u062A\u0627\u0645\u0629",
    createdAt: "2026-08-18T11:45:00Z"
  },
  {
    id: "donor-7",
    fullName: "\u0633\u064A\u0641 \u0627\u0644\u062F\u064A\u0646 \u0642\u0627\u0633\u0645 \u0627\u0644\u0631\u064A\u0627\u0634\u064A",
    phone: "775678123",
    bloodType: "B-",
    district: "\u0646\u0642\u064A\u0644 \u0627\u0644\u0634\u064A\u0645 \u0648\u0631\u064A\u0634\u0627\u0646",
    area: "\u0631\u064A\u0634\u0627\u0646",
    isAvailable: true,
    lastDonationDate: "2026-06-01",
    notes: "\u0641\u0635\u064A\u0644\u0629 \u0646\u0627\u062F\u0631\u0629 \u062C\u062F\u0627\u064B",
    createdAt: "2026-08-20T08:00:00Z"
  },
  {
    id: "donor-8",
    fullName: "\u0631\u062F\u0641\u0627\u0646 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0645\u0633\u0639\u062F",
    phone: "716543210",
    bloodType: "O+",
    district: "\u0642\u0639\u0637\u0628\u0629 \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629",
    area: "\u0627\u0644\u0642\u0631\u064A\u0646",
    isAvailable: true,
    lastDonationDate: "2026-07-04",
    notes: "\u0645\u062A\u0637\u0648\u0639 \u0646\u0627\u0634\u0637 \u0641\u064A \u0642\u0648\u0627\u0641\u0644 \u0627\u0644\u0625\u063A\u0627\u062B\u0629 \u0627\u0644\u0637\u0628\u064A\u0629",
    createdAt: "2026-08-22T13:10:00Z"
  },
  {
    id: "donor-9",
    fullName: "\u0647\u0634\u0627\u0645 \u0635\u0627\u0644\u062D \u0627\u0644\u0646\u062C\u0627\u0631",
    phone: "778901234",
    bloodType: "AB-",
    district: "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
    area: "\u062D\u064A \u0627\u0644\u0646\u0635\u0631",
    isAvailable: true,
    lastDonationDate: "2026-03-15",
    notes: "\u0641\u0635\u064A\u0644\u0629 \u0633\u0627\u0644\u0628\u0629 \u0646\u0627\u062F\u0631\u0629",
    createdAt: "2026-08-25T17:00:00Z"
  },
  {
    id: "donor-10",
    fullName: "\u0628\u0634\u064A\u0631 \u0639\u0644\u0648\u064A \u0633\u0644\u064A\u0645",
    phone: "739012345",
    bloodType: "O-",
    district: "\u0627\u0644\u0641\u0627\u062E\u0631",
    area: "\u0633\u0644\u064A\u0645",
    isAvailable: true,
    lastDonationDate: "2026-07-15",
    notes: "\u062C\u0627\u0647\u0632 \u0644\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u062D\u0631\u062C\u0629",
    createdAt: "2026-09-01T10:00:00Z"
  }
];
var SEED_REQUESTS = [
  {
    id: "req-1",
    patientName: "\u0627\u0644\u0637\u0641\u0644 \u0623\u064A\u0645\u0646 \u062E\u0627\u0644\u062F \u0627\u0644\u0642\u0639\u0637\u0628\u064A",
    bloodType: "O-",
    unitsNeeded: 2,
    hospital: "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0633\u0644\u0627\u0645 \u0627\u0644\u062A\u062E\u0635\u0635\u064A - \u0642\u0639\u0637\u0628\u0629",
    district: "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
    area: "\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u062F\u064A\u0646\u0629",
    urgency: "critical",
    status: "open",
    contactName: "\u0648\u0627\u0644\u062F \u0627\u0644\u0637\u0641\u0644 (\u062E\u0627\u0644\u062F \u0627\u0644\u0642\u0639\u0637\u0628\u064A)",
    contactPhone: "777443322",
    caseDetails: "\u062D\u0627\u0644\u0629 \u0646\u0632\u064A\u0641 \u062D\u0627\u062F \u0623\u062B\u0631 \u0639\u0645\u0644\u064A\u0629 \u062C\u0631\u0627\u062D\u064A\u0629 \u0637\u0627\u0631\u0626\u0629\u060C \u064A\u062D\u062A\u0627\u062C \u0648\u062D\u062F\u062A\u064A\u0646 \u0641\u0635\u064A\u0644\u0629 O \u0633\u0627\u0644\u0628\u0629 \u0641\u0648\u0631\u0627\u064B.",
    requestDate: "2026-10-22",
    createdAt: "2026-10-22T08:30:00Z"
  },
  {
    id: "req-2",
    patientName: "\u0623\u0645 \u0639\u0628\u062F\u0627\u0644\u0645\u0644\u0643 \u0627\u0644\u0642\u062D\u0637\u0628\u064A",
    bloodType: "A+",
    unitsNeeded: 3,
    hospital: "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0646\u0635\u0631 \u0627\u0644\u0639\u0627\u0645 - \u0627\u0644\u0636\u0627\u0644\u0639",
    district: "\u0633\u0646\u0627\u062D",
    area: "\u0633\u0648\u0642 \u0633\u0646\u0627\u062D",
    urgency: "critical",
    status: "open",
    contactName: "\u0623\u062E \u0627\u0644\u0645\u0631\u064A\u0636\u0629 (\u0645\u0635\u0644\u062D \u0627\u0644\u0642\u062D\u0637\u0628\u064A)",
    contactPhone: "733221144",
    caseDetails: "\u0639\u0645\u0644\u064A\u0629 \u0648\u0644\u0627\u062F\u0629 \u0642\u064A\u0635\u0631\u064A\u0629 \u0645\u0639 \u0627\u0646\u062E\u0641\u0627\u0636 \u062D\u0627\u062F \u0641\u064A \u062E\u0636\u0627\u0628 \u0627\u0644\u062F\u0645 (\u0627\u0644\u0647\u064A\u0645\u0648\u062C\u0644\u0648\u0628\u064A\u0646 6.5).",
    requestDate: "2026-10-22",
    createdAt: "2026-10-22T10:15:00Z"
  },
  {
    id: "req-3",
    patientName: "\u0637\u0627\u0631\u0642 \u0639\u0628\u062F\u0627\u0644\u0633\u0644\u0627\u0645 \u0627\u0644\u062D\u0627\u0644\u0645\u064A",
    bloodType: "B+",
    unitsNeeded: 1,
    hospital: "\u0645\u0633\u062A\u0648\u0635\u0641 \u0642\u0639\u0637\u0628\u0629 \u0627\u0644\u062E\u064A\u0631\u064A",
    district: "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
    area: "\u062D\u064A \u0627\u0644\u0633\u0644\u0627\u0645",
    urgency: "urgent",
    status: "open",
    contactName: "\u0627\u0628\u0646 \u0639\u0645\u0647 (\u0639\u0627\u062F\u0644 \u0627\u0644\u062D\u0627\u0644\u0645\u064A)",
    contactPhone: "711998877",
    caseDetails: "\u0645\u0631\u064A\u0636 \u062B\u0644\u0627\u0633\u064A\u0645\u064A\u0627 \u0628\u062D\u0627\u062C\u0629 \u0644\u062A\u062C\u062F\u064A\u062F \u0643\u064A\u0633 \u062F\u0645 \u0628\u0635\u0648\u0631\u0629 \u0645\u0646\u062A\u0638\u0645\u0629 \u0627\u0644\u064A\u0648\u0645.",
    requestDate: "2026-10-21",
    createdAt: "2026-10-21T16:00:00Z"
  },
  {
    id: "req-4",
    patientName: "\u0641\u064A\u0635\u0644 \u0639\u0628\u062F\u0647 \u0646\u0627\u062C\u064A \u0627\u0644\u0634\u0648\u0643\u064A",
    bloodType: "AB+",
    unitsNeeded: 2,
    hospital: "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u062A\u0636\u0627\u0645\u0646 \u0627\u0644\u062A\u062E\u0635\u0635\u064A",
    district: "\u062D\u0645\u0631 \u0648\u0634\u062E\u0628",
    area: "\u0628\u064A\u062A \u0627\u0644\u0634\u0648\u0643\u064A",
    urgency: "moderate",
    status: "fulfilled",
    contactName: "\u0634\u0642\u064A\u0642\u0647 (\u062C\u0645\u064A\u0644 \u0627\u0644\u0634\u0648\u0643\u064A)",
    contactPhone: "772334455",
    caseDetails: "\u062A\u0645 \u062A\u0648\u0641\u064A\u0631 \u0627\u0644\u062F\u0645 \u0628\u0646\u062C\u0627\u062D \u0628\u0641\u0636\u0644 \u0645\u062A\u0628\u0631\u0639\u064A \u0645\u0646\u0637\u0642\u0629 \u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629.",
    requestDate: "2026-10-19",
    createdAt: "2026-10-19T11:20:00Z"
  }
];
var SEED_NOTIFICATIONS = [
  {
    id: "notif-1",
    title: "\u0637\u0644\u0628 \u062F\u0645 \u0639\u0627\u062C\u0644 \u062C\u062F\u0627\u064B \u0641\u064A \u0642\u0639\u0637\u0628\u0629 \u{1F6A8}",
    message: "\u0627\u062D\u062A\u064A\u0627\u062C \u0637\u0627\u0631\u0626 \u0644\u0640 \u0648\u062D\u062F\u062A\u064A\u0646 \u0645\u0646 \u0641\u0635\u064A\u0644\u0629 O- \u0628\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0633\u0644\u0627\u0645 \u0627\u0644\u062A\u062E\u0635\u0635\u064A \u0644\u0644\u0637\u0641\u0644 \u0623\u064A\u0645\u0646 \u062E\u0627\u0644\u062F.",
    time: "\u0645\u0646\u0630 \u0633\u0627\u0639\u0629",
    type: "urgent",
    read: false,
    linkPage: "requests",
    itemId: "req-1"
  },
  {
    id: "notif-2",
    title: "\u0637\u0644\u0628 \u062F\u0645 \u0639\u0627\u062C\u0644 A+ \u{1FA78}",
    message: "\u062D\u0627\u0644\u0629 \u0648\u0644\u0627\u062F\u0629 \u0637\u0627\u0631\u0626\u0629 \u0628\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0646\u0635\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u062D\u0627\u062C\u0629 \u0644\u0640 3 \u0648\u062D\u062F\u0627\u062A \u0641\u0635\u064A\u0644\u0629 A+.",
    time: "\u0645\u0646\u0630 \u0633\u0627\u0639\u062A\u064A\u0646",
    type: "urgent",
    read: false,
    linkPage: "requests",
    itemId: "req-2"
  },
  {
    id: "notif-3",
    title: "\u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u064A\u0648\u0645\u064A \u0625\u0644\u0649 Excel \u0645\u0641\u0639\u0644 \u{1F4CA}",
    message: "\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0627\u0644\u064A\u0648\u0645\u064A \u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0625\u0644\u0649 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F.",
    time: "\u0627\u0644\u064A\u0648\u0645",
    type: "system",
    read: true,
    linkPage: "admin"
  }
];
var db2;
var masterBackupPath = path.join(backupsDir, "blood_registry_master_backup.json");
function parseDbContent(content) {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      donors: Array.isArray(parsed.donors) && parsed.donors.length > 0 ? parsed.donors : SEED_DONORS,
      requests: Array.isArray(parsed.requests) && parsed.requests.length > 0 ? parsed.requests : SEED_REQUESTS,
      districts: Array.isArray(parsed.districts) && parsed.districts.length > 0 ? parsed.districts : SEED_DISTRICTS,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : SEED_NOTIFICATIONS,
      adminSettings: {
        pin: parsed.adminSettings?.pin || "",
        pinUpdatedAt: parsed.adminSettings?.pinUpdatedAt || 0,
        recoveryCode: parsed.adminSettings?.recoveryCode || process.env.ADMIN_RECOVERY_CODE || "alsh486iby-2026",
        recipientEmail: parsed.adminSettings?.recipientEmail || "abdulrahmanalshaiby2028@gmail.com",
        dailyExportHour: typeof parsed.adminSettings?.dailyExportHour === "number" ? parsed.adminSettings.dailyExportHour : 8,
        dailyExportMinute: typeof parsed.adminSettings?.dailyExportMinute === "number" ? parsed.adminSettings.dailyExportMinute : 0,
        autoExportEnabled: parsed.adminSettings?.autoExportEnabled !== false,
        smtpHost: parsed.adminSettings?.smtpHost || process.env.SMTP_HOST || "",
        smtpPort: parsed.adminSettings?.smtpPort || Number(process.env.SMTP_PORT) || 587,
        smtpUser: parsed.adminSettings?.smtpUser || process.env.SMTP_USER || "",
        smtpPass: parsed.adminSettings?.smtpPass || process.env.SMTP_PASS || "",
        smtpSecure: parsed.adminSettings?.smtpSecure || process.env.SMTP_SECURE === "true",
        smtpFrom: parsed.adminSettings?.smtpFrom || process.env.SMTP_FROM || "qaatabah-blood-registry@yemen.org",
        lastExportAt: parsed.adminSettings?.lastExportAt || void 0,
        lastExportStatus: parsed.adminSettings?.lastExportStatus || void 0,
        lastExportMessage: parsed.adminSettings?.lastExportMessage || void 0,
        whatsappEnabled: parsed.adminSettings?.whatsappEnabled !== false,
        whatsappPhoneNumberId: parsed.adminSettings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        whatsappAccessToken: parsed.adminSettings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "",
        whatsappSimulateMode: parsed.adminSettings?.whatsappSimulateMode !== false,
        whatsappMaxRecipients: typeof parsed.adminSettings?.whatsappMaxRecipients === "number" ? parsed.adminSettings.whatsappMaxRecipients : 10
      },
      exportLogs: Array.isArray(parsed.exportLogs) ? parsed.exportLogs : [],
      pushSubscriptions: Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [],
      donorResponses: Array.isArray(parsed.donorResponses) ? parsed.donorResponses : [],
      whatsappDispatches: Array.isArray(parsed.whatsappDispatches) ? parsed.whatsappDispatches : [],
      hospitalAds: Array.isArray(parsed.hospitalAds) ? parsed.hospitalAds : [],
      hospitals: Array.isArray(parsed.hospitals) ? parsed.hospitals : [],
      doctors: Array.isArray(parsed.doctors) ? parsed.doctors : [],
      appUpdate: sanitizeLoadedAppUpdateConfig(parsed.appUpdate),
      users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [
        {
          id: "user-admin",
          username: "admin",
          fullName: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u0643\u0632\u064A - \u0642\u0639\u0637\u0628\u0629",
          phone: "771234567",
          role: "admin",
          createdAt: "2026-08-01T00:00:00Z"
        },
        {
          id: "user-default",
          username: "user",
          password: "user123",
          fullName: "\u0645\u062A\u0628\u0631\u0639 \u0645\u0633\u062C\u0644 - \u0642\u0639\u0637\u0628\u0629",
          phone: "770112233",
          role: "user",
          createdAt: "2026-08-01T00:00:00Z"
        }
      ]
    };
  } catch {
    return null;
  }
}
function loadDatabase() {
  if (fs.existsSync(dbFilePath)) {
    try {
      const content = fs.readFileSync(dbFilePath, "utf-8");
      const parsed = parseDbContent(content);
      if (parsed) {
        console.log(`Database loaded successfully from ${dbFilePath} (${parsed.donors.length} donors)`);
        return parsed;
      }
    } catch (e) {
      console.error("Error reading primary database file:", e);
    }
  }
  if (fs.existsSync(masterBackupPath)) {
    try {
      const content = fs.readFileSync(masterBackupPath, "utf-8");
      const parsed = parseDbContent(content);
      if (parsed) {
        console.log(`Restoring database from master backup ${masterBackupPath}`);
        saveDatabase(parsed);
        return parsed;
      }
    } catch (e) {
      console.error("Error reading master backup file:", e);
    }
  }
  try {
    if (fs.existsSync(backupsDir)) {
      const backupFiles = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".json")).sort().reverse();
      for (const bf of backupFiles) {
        const fullP = path.join(backupsDir, bf);
        const content = fs.readFileSync(fullP, "utf-8");
        const parsed = parseDbContent(content);
        if (parsed) {
          console.log(`Restoring database from backup file ${fullP}`);
          saveDatabase(parsed);
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error("Error scanning backup directory:", e);
  }
  const initialDb = {
    donors: SEED_DONORS,
    requests: SEED_REQUESTS,
    districts: SEED_DISTRICTS,
    notifications: SEED_NOTIFICATIONS,
    adminSettings: {
      pin: "",
      pinUpdatedAt: 0,
      recoveryCode: process.env.ADMIN_RECOVERY_CODE || "",
      recipientEmail: "abdulrahmanalshaiby2028@gmail.com",
      dailyExportHour: 8,
      dailyExportMinute: 0,
      autoExportEnabled: true,
      smtpHost: process.env.SMTP_HOST || "",
      smtpPort: Number(process.env.SMTP_PORT) || 587,
      smtpUser: process.env.SMTP_USER || "",
      smtpPass: process.env.SMTP_PASS || "",
      smtpSecure: process.env.SMTP_SECURE === "true",
      smtpFrom: process.env.SMTP_FROM || "qaatabah-blood-registry@yemen.org",
      whatsappEnabled: true,
      whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
      whatsappSimulateMode: true,
      whatsappMaxRecipients: 10
    },
    exportLogs: [],
    pushSubscriptions: [],
    donorResponses: [],
    whatsappDispatches: [],
    hospitalAds: [],
    hospitals: [],
    doctors: [],
    appUpdate: createDefaultAppUpdateConfig(),
    users: [
      {
        id: "user-admin",
        username: "admin",
        fullName: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u0643\u0632\u064A - \u0642\u0639\u0637\u0628\u0629",
        phone: "771234567",
        role: "admin",
        createdAt: "2026-08-01T00:00:00Z"
      },
      {
        id: "user-default",
        username: "user",
        password: "user123",
        fullName: "\u0645\u062A\u0628\u0631\u0639 \u0645\u0633\u062C\u0644 - \u0642\u0639\u0637\u0628\u0629",
        phone: "770112233",
        role: "user",
        createdAt: "2026-08-01T00:00:00Z"
      }
    ]
  };
  saveDatabase(initialDb);
  return initialDb;
}
function saveDatabase(dataToSave = db2) {
  try {
    const tmpPath = `${dbFilePath}.tmp`;
    const jsonString = JSON.stringify(dataToSave, null, 2);
    fs.writeFileSync(tmpPath, jsonString, "utf-8");
    fs.renameSync(tmpPath, dbFilePath);
    try {
      fs.writeFileSync(masterBackupPath, jsonString, "utf-8");
    } catch (e) {
      console.warn("Could not mirror to master backup:", e);
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const dailyBackupPath = path.join(backupsDir, `backup_${today}.json`);
    if (!fs.existsSync(dailyBackupPath)) {
      try {
        fs.writeFileSync(dailyBackupPath, jsonString, "utf-8");
      } catch (e) {
        console.warn("Could not write daily backup snapshot:", e);
      }
    }
  } catch (err) {
    console.error("Failed to save database to disk:", err);
  }
}
db2 = loadDatabase();
function generateDonorsExcelBuffer(donors2) {
  const donorsRows = donors2.map((d, idx) => ({
    "\u0645": idx + 1,
    "\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u0628\u0631\u0639 \u0627\u0644\u0643\u0627\u0645\u0644": d.fullName,
    "\u0641\u0635\u064A\u0644\u0629 \u0627\u0644\u062F\u0645": d.bloodType,
    "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641": d.phone,
    "\u0627\u0644\u0645\u062F\u064A\u0631\u064A\u0629": d.district,
    "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 / \u0627\u0644\u0642\u0631\u064A\u0629": d.area,
    "\u062D\u0627\u0644\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629": d.isAvailable ? "\u0645\u062A\u0627\u062D \u0644\u0644\u062A\u0628\u0631\u0639 \u0641\u0648\u0631\u0627\u064B \u{1F7E2}" : "\u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B \u26AA",
    "\u062A\u0627\u0631\u064A\u062E \u0622\u062E\u0631 \u062A\u0628\u0631\u0639": d.lastDonationDate || "\u0644\u0645 \u064A\u0633\u062C\u0644 \u062A\u0628\u0631\u0639 \u0633\u0627\u0628\u0642",
    "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0635\u062D\u064A\u0629": d.notes || "\u0633\u0644\u064A\u0645 \u0648\u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u0628\u0631\u0639",
    "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0633\u062C\u064A\u0644": d.createdAt ? new Date(d.createdAt).toLocaleDateString("ar-YE") : "\u0645\u0633\u0628\u0642"
  }));
  const donorSheet = XLSX.utils.json_to_sheet(donorsRows);
  donorSheet["!cols"] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 14 },
    { wch: 18 },
    { wch: 25 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 35 },
    { wch: 18 }
  ];
  donorSheet["!views"] = [{ rightToLeft: true }];
  const bloodTypeCounts = {
    "O+": { total: 0, available: 0 },
    "O-": { total: 0, available: 0 },
    "A+": { total: 0, available: 0 },
    "A-": { total: 0, available: 0 },
    "B+": { total: 0, available: 0 },
    "B-": { total: 0, available: 0 },
    "AB+": { total: 0, available: 0 },
    "AB-": { total: 0, available: 0 }
  };
  donors2.forEach((d) => {
    if (bloodTypeCounts[d.bloodType]) {
      bloodTypeCounts[d.bloodType].total++;
      if (d.isAvailable) bloodTypeCounts[d.bloodType].available++;
    }
  });
  const statsRows = Object.entries(bloodTypeCounts).map(([type, s]) => ({
    "\u0641\u0635\u064A\u0644\u0629 \u0627\u0644\u062F\u0645": type,
    "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646": s.total,
    "\u0627\u0644\u0645\u062A\u0627\u062D\u064A\u0646 \u0644\u0644\u062A\u0628\u0631\u0639 \u062D\u0627\u0644\u064A\u0627\u064B": s.available,
    "\u0646\u0633\u0628\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629": s.total > 0 ? `${Math.round(s.available / s.total * 100)}%` : "0%"
  }));
  const statsSheet = XLSX.utils.json_to_sheet(statsRows);
  statsSheet["!cols"] = [{ wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 18 }];
  statsSheet["!views"] = [{ rightToLeft: true }];
  const districtCounts = {};
  donors2.forEach((d) => {
    districtCounts[d.district] = (districtCounts[d.district] || 0) + 1;
  });
  const districtRows = Object.entries(districtCounts).map(([distName, count]) => ({
    "\u0627\u0644\u0645\u062F\u064A\u0631\u064A\u0629 / \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629": distName,
    "\u0639\u062F\u062F \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0627\u0644\u0645\u0633\u062C\u0644\u064A\u0646": count
  }));
  const distSheet = XLSX.utils.json_to_sheet(districtRows);
  distSheet["!cols"] = [{ wch: 30 }, { wch: 24 }];
  distSheet["!views"] = [{ rightToLeft: true }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, donorSheet, "\u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646");
  XLSX.utils.book_append_sheet(workbook, statsSheet, "\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0641\u0635\u0627\u0626\u0644");
  XLSX.utils.book_append_sheet(workbook, distSheet, "\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
async function executeExcelExportAndDispatch(manualTrigger = false) {
  const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const filename = `qaatabah_blood_donors_${dateStr}.xlsx`;
  const filePath = path.join(exportsDir, filename);
  const recipient = db2.adminSettings.recipientEmail || "abdulrahmanalshaiby2028@gmail.com";
  const donorsCount = db2.donors.length;
  try {
    const excelBuffer = generateDonorsExcelBuffer(db2.donors);
    fs.writeFileSync(filePath, excelBuffer);
    const rareCounts = db2.donors.filter((d) => ["O-", "A-", "B-", "AB-"].includes(d.bloodType)).length;
    const availableCount = db2.donors.filter((d) => d.isAvailable).length;
    const smtpHost = db2.adminSettings.smtpHost || process.env.SMTP_HOST;
    const smtpUser = db2.adminSettings.smtpUser || process.env.SMTP_USER;
    const smtpPass = db2.adminSettings.smtpPass || process.env.SMTP_PASS;
    const smtpPort = db2.adminSettings.smtpPort || Number(process.env.SMTP_PORT) || 587;
    const smtpSecure = db2.adminSettings.smtpSecure ?? process.env.SMTP_SECURE === "true";
    const smtpFrom = db2.adminSettings.smtpFrom || process.env.SMTP_FROM || "qaatabah-blood-registry@yemen.org";
    let emailSent = false;
    let emailError;
    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        const mailOptions = {
          from: `"\u0633\u062C\u0644 \u0645\u062A\u0628\u0631\u0639\u064A \u0642\u0639\u0637\u0628\u0629" <${smtpFrom}>`,
          to: recipient,
          subject: `\u{1FA78} \u062A\u0642\u0631\u064A\u0631 \u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0628\u0627\u0644\u062F\u0645 \u0627\u0644\u064A\u0648\u0645\u064A - \u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 (${dateStr})`,
          html: `
            <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 16px;">
              <div style="background: linear-gradient(135deg, #be123c, #9f1239); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                <h1 style="margin: 0; font-size: 22px;">\u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0628\u0627\u0644\u062F\u0645 - \u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629</h1>
                <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">\u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u064A\u0648\u0645\u064A \u0627\u0644\u0645\u062D\u062F\u062B \u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0628\u0627\u0644\u062F\u0645</p>
              </div>

              <div style="margin-top: 20px; background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <h3 style="margin-top: 0; color: #0f172a;">\u0645\u0644\u062E\u0635 \u0627\u0644\u0633\u062C\u0644 \u0644\u062A\u0627\u0631\u064A\u062E: ${dateStr}</h3>
                <ul style="line-height: 1.8; font-size: 14px; color: #334155; padding-right: 20px;">
                  <li><strong>\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0627\u0644\u0645\u0633\u062C\u0644\u064A\u0646:</strong> ${donorsCount} \u0645\u062A\u0628\u0631\u0639</li>
                  <li><strong>\u0627\u0644\u0645\u062A\u0627\u062D\u064A\u0646 \u0644\u0644\u062A\u0628\u0631\u0639 \u0641\u0648\u0631\u0627\u064B:</strong> ${availableCount} \u0645\u062A\u0628\u0631\u0639</li>
                  <li><strong>\u0623\u0635\u062D\u0627\u0628 \u0627\u0644\u0641\u0635\u0627\u0626\u0644 \u0627\u0644\u0646\u0627\u062F\u0631\u0629 (\u0627\u0644\u0633\u0627\u0644\u0628\u0629):</strong> ${rareCounts} \u0645\u062A\u0628\u0631\u0639</li>
                </ul>

                <p style="font-size: 13px; color: #64748b; margin-top: 15px;">
                  \u0645\u0631\u0641\u0642 \u0645\u0639 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0644\u0641 Excel \u0628\u0635\u064A\u063A\u0629 <strong>${filename}</strong> \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0643\u0627\u0641\u0629 \u062A\u0641\u0627\u0635\u064A\u0644 \u0648\u0623\u0633\u0645\u0627\u0621 \u0648\u0623\u0631\u0642\u0627\u0645 \u0647\u0648\u0627\u062A\u0641 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646\u060C \u0645\u0639 \u062F\u0639\u0645 \u0643\u0627\u0645\u0644 \u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A.
                </p>
              </div>

              <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
                \u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0647\u0630\u0627 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0622\u0644\u064A\u0627\u064B \u0639\u0628\u0631 \u062E\u0627\u062F\u0645 \xAB\u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0628\u0627\u0644\u062F\u0645 - \u0642\u0639\u0637\u0628\u0629\xBB
              </div>
            </div>
          `,
          attachments: [
            {
              filename,
              content: excelBuffer,
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
          ]
        };
        await transporter.sendMail(mailOptions);
        emailSent = true;
      } catch (err) {
        console.error("SMTP send error:", err);
        emailError = err.message || String(err);
      }
    }
    const logStatus = emailSent ? "success" : "saved_locally";
    const message = emailSent ? `\u062A\u0645 \u062A\u0635\u062F\u064A\u0631 \u0648\u0625\u0631\u0633\u0627\u0644 \u0645\u0644\u0641 Excel \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A (${recipient})` : `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u0641\u0638 \u0645\u0644\u0641 Excel \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 (${donorsCount} \u0645\u062A\u0628\u0631\u0639). \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u062D\u0645\u064A\u0644\u060C \u0648\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0641\u0639\u064A\u0644 SMTP \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631.`;
    const exportLog = {
      id: `export-${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      filename,
      recipient,
      donorsCount,
      status: logStatus,
      message,
      errorDetails: emailError
    };
    db2.exportLogs = [exportLog, ...(db2.exportLogs || []).slice(0, 99)];
    db2.adminSettings.lastExportAt = exportLog.timestamp;
    db2.adminSettings.lastExportStatus = logStatus;
    db2.adminSettings.lastExportMessage = message;
    db2.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: emailSent ? "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0645\u0644\u0641 Excel \u0627\u0644\u064A\u0648\u0645\u064A \u2709\uFE0F" : "\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0645\u0644\u0641 Excel \u0648\u062D\u0641\u0638\u0647 \u0628\u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u{1F4CA}",
      message: emailSent ? `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0646\u0633\u062E\u0629 Excel \u0645\u062D\u062F\u062B\u0629 \u062A\u0636\u0645 (${donorsCount}) \u0645\u062A\u0628\u0631\u0639 \u0625\u0644\u0649 ${recipient}.` : `\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0645\u0644\u0641 ${filename} \u0628\u0646\u062C\u0627\u062D. \u064A\u0645\u0643\u0646\u0643 \u062A\u062D\u0645\u064A\u0644\u0647 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0646 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.`,
      time: "\u0627\u0644\u0622\u0646",
      type: "system",
      read: false,
      linkPage: "admin"
    });
    saveDatabase();
    return {
      success: true,
      status: logStatus,
      filename,
      message,
      details: emailError
    };
  } catch (err) {
    console.error("Excel generation/export failed:", err);
    const failureLog = {
      id: `export-${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      filename,
      recipient,
      donorsCount,
      status: "failed",
      message: "\u0641\u0634\u0644\u062A \u0639\u0645\u0644\u064A\u0629 \u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0641 Excel",
      errorDetails: err.message || String(err)
    };
    db2.exportLogs = [failureLog, ...(db2.exportLogs || []).slice(0, 99)];
    db2.adminSettings.lastExportAt = failureLog.timestamp;
    db2.adminSettings.lastExportStatus = "failed";
    db2.adminSettings.lastExportMessage = failureLog.message;
    saveDatabase();
    return {
      success: false,
      status: "failed",
      filename,
      message: "\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0641 Excel",
      details: err.message
    };
  }
}
var scheduledCronTask = null;
function setupDailyExportCron() {
  if (scheduledCronTask) {
    scheduledCronTask.stop();
  }
  const hour = db2.adminSettings.dailyExportHour ?? 8;
  const minute = db2.adminSettings.dailyExportMinute ?? 0;
  const cronExpr = `${minute} ${hour} * * *`;
  if (db2.adminSettings.autoExportEnabled) {
    console.log(`Setting up daily Excel export cron at ${cronExpr} (Target: ${db2.adminSettings.recipientEmail})`);
    scheduledCronTask = cron.schedule(cronExpr, async () => {
      console.log("Running automated daily Excel export for Qaatabah blood donors...");
      await executeExcelExportAndDispatch(false);
    });
  }
}
setupDailyExportCron();
app.all(["/healthz", "/_health", "/health", "/ready", "/live"], (_req, res) => {
  res.status(200).send("OK");
});
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    donorsCount: db2.donors.length,
    requestsCount: db2.requests.length,
    districtsCount: db2.districts.length,
    lastExport: db2.adminSettings.lastExportAt || null
  });
});
app.post("/api/sync", (req, res) => {
  try {
    const {
      donors: clientDonors,
      requests: clientRequests,
      districts: clientDistricts,
      users: clientUsers,
      adminPin: clientPin,
      pinUpdatedAt: clientPinUpdatedAt,
      deletedDonorIds,
      deletedRequestIds
    } = req.body;
    let hasChanges = false;
    if (Array.isArray(deletedDonorIds) && deletedDonorIds.length > 0) {
      const deleteSet = new Set(deletedDonorIds);
      const beforeLen = db2.donors.length;
      db2.donors = db2.donors.filter((d) => !deleteSet.has(d.id));
      if (db2.donors.length !== beforeLen) hasChanges = true;
    }
    if (Array.isArray(clientDonors)) {
      for (const cd of clientDonors) {
        if (!cd || !cd.fullName || !cd.phone) continue;
        const normalizedPhone = String(cd.phone).replace(/\s+/g, "");
        const existingIdx = db2.donors.findIndex(
          (d) => d.id === cd.id || String(d.phone).replace(/\s+/g, "") === normalizedPhone
        );
        if (existingIdx !== -1) {
          const serverD = db2.donors[existingIdx];
          const serverTime = serverD.createdAt ? new Date(serverD.createdAt).getTime() : 0;
          const clientTime = cd.createdAt ? new Date(cd.createdAt).getTime() : 0;
          if (clientTime >= serverTime) {
            db2.donors[existingIdx] = {
              ...serverD,
              ...cd,
              id: serverD.id
              // maintain stable id
            };
            hasChanges = true;
          }
        } else {
          db2.donors.unshift({
            ...cd,
            id: cd.id || `donor-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
            createdAt: cd.createdAt || (/* @__PURE__ */ new Date()).toISOString()
          });
          hasChanges = true;
        }
      }
    }
    if (Array.isArray(deletedRequestIds) && deletedRequestIds.length > 0) {
      const deleteSet = new Set(deletedRequestIds);
      const beforeLen = db2.requests.length;
      db2.requests = db2.requests.filter((r) => !deleteSet.has(r.id));
      if (db2.requests.length !== beforeLen) hasChanges = true;
    }
    if (Array.isArray(clientRequests)) {
      for (const cr of clientRequests) {
        if (!cr || !cr.patientName || !cr.hospital) continue;
        const existingIdx = db2.requests.findIndex((r) => r.id === cr.id);
        if (existingIdx !== -1) {
          db2.requests[existingIdx] = {
            ...db2.requests[existingIdx],
            ...cr
          };
          hasChanges = true;
        } else {
          db2.requests.unshift({
            ...cr,
            id: cr.id || `req-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
            createdAt: cr.createdAt || (/* @__PURE__ */ new Date()).toISOString()
          });
          hasChanges = true;
        }
      }
    }
    if (Array.isArray(clientDistricts)) {
      for (const cdist of clientDistricts) {
        if (!cdist || !cdist.name) continue;
        const exists = db2.districts.some((d) => d.id === cdist.id || d.name === cdist.name);
        if (!exists) {
          db2.districts.push(cdist);
          hasChanges = true;
        }
      }
    }
    if (Array.isArray(clientUsers) && clientUsers.length > 0) {
      if (!Array.isArray(db2.users)) db2.users = [];
      for (const cu of clientUsers) {
        if (!cu || !cu.username || !cu.fullName) continue;
        const cleanU = String(cu.username).trim().toLowerCase();
        const existingIdx = db2.users.findIndex(
          (u) => u.id === cu.id || u.username.toLowerCase() === cleanU
        );
        if (existingIdx !== -1) {
          db2.users[existingIdx] = {
            ...db2.users[existingIdx],
            ...cu,
            password: db2.users[existingIdx].password || cu.password
          };
          hasChanges = true;
        } else {
          db2.users.push(cu);
          hasChanges = true;
        }
      }
    }
    const serverPin = db2.adminSettings.pin || "1234";
    const serverPinTime = db2.adminSettings.pinUpdatedAt || 0;
    if (clientPin && typeof clientPin === "string" && clientPin.trim().length >= 4) {
      const cPin = clientPin.trim();
      const cPinTime = typeof clientPinUpdatedAt === "number" ? clientPinUpdatedAt : 0;
      if (serverPin === "1234" && cPin !== "1234") {
        db2.adminSettings.pin = cPin;
        db2.adminSettings.pinUpdatedAt = cPinTime || Date.now();
        hasChanges = true;
      } else if (cPinTime > serverPinTime && cPin !== serverPin) {
        db2.adminSettings.pin = cPin;
        db2.adminSettings.pinUpdatedAt = cPinTime;
        hasChanges = true;
      }
    }
    if (hasChanges) {
      saveDatabase();
    }
    res.json({
      success: true,
      donors: db2.donors,
      requests: db2.requests,
      districts: db2.districts,
      notifications: db2.notifications,
      hospitalAds: Array.isArray(db2.hospitalAds) ? db2.hospitalAds : [],
      hospitals: sortServerHospitals(db2.hospitals),
      doctors: sortServerDoctors(db2.doctors),
      users: (db2.users || []).map(({ password, ...s }) => s),
      adminPin: db2.adminSettings.pin || "1234",
      pinUpdatedAt: db2.adminSettings.pinUpdatedAt || 0,
      online: true
    });
  } catch (err) {
    console.error("Error during database sync:", err);
    res.status(500).json({ error: "Sync failed", details: err.message });
  }
});
app.get("/api/donors", (req, res) => {
  const { search, bloodType, district } = req.query;
  let results = db2.donors;
  if (bloodType && typeof bloodType === "string") {
    results = results.filter((d) => d.bloodType === bloodType);
  }
  if (district && typeof district === "string") {
    results = results.filter((d) => d.district === district);
  }
  if (search && typeof search === "string") {
    const q = search.toLowerCase().trim();
    results = results.filter(
      (d) => d.fullName.toLowerCase().includes(q) || d.phone.includes(q) || d.area.toLowerCase().includes(q) || d.district.toLowerCase().includes(q)
    );
  }
  res.json(results);
});
app.post("/api/donors", (req, res) => {
  const { fullName, phone, bloodType, district, area, isAvailable, lastDonationDate, notes, userId, userRole } = req.body;
  if (!fullName || !phone || !bloodType || !district || !area) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0625\u0644\u0632\u0627\u0645\u064A\u0629" });
  }
  if (userRole === "user" && userId && Array.isArray(db2.users)) {
    const user = db2.users.find((u) => u.id === userId);
    if (user && user.linkedDonorId) {
      const existingDonor = db2.donors.find((d) => d.id === user.linkedDonorId);
      return res.status(409).json({
        error: `\u0644\u062F\u064A\u0643 \u0633\u062C\u0644 \u0645\u062A\u0628\u0631\u0639 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0627\u0633\u0645 (${existingDonor?.fullName || user.fullName}). \u064A\u064F\u0633\u0645\u062D \u0628\u0633\u062C\u0644 \u0648\u0627\u062D\u062F \u0641\u0642\u0637 \u0644\u0643\u0644 \u0634\u062E\u0635 \u0644\u0645\u0646\u0639 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0647\u0648\u064A\u0627\u062A.`
      });
    }
  }
  const dupCheck = checkDonorDuplication({ fullName, phone }, db2.donors);
  if (dupCheck.isDuplicate) {
    return res.status(409).json({ error: dupCheck.reason });
  }
  const cleanPhone = normalizePhoneNumber(phone);
  const cleanName = fullName.trim();
  const newDonor = {
    id: `donor-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    fullName: cleanName,
    phone: cleanPhone,
    bloodType,
    district,
    area,
    isAvailable: isAvailable ?? true,
    lastDonationDate: lastDonationDate || void 0,
    notes: notes || void 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db2.donors.unshift(newDonor);
  if (userId && Array.isArray(db2.users)) {
    const userIdx = db2.users.findIndex((u) => u.id === userId);
    if (userIdx !== -1) {
      db2.users[userIdx].linkedDonorId = newDonor.id;
    }
  }
  db2.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: "\u0645\u062A\u0628\u0631\u0639 \u062C\u062F\u064A\u062F \u0645\u0633\u062C\u0644 \u{1FA78}",
    message: `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639 ${newDonor.fullName} \u0641\u0635\u064A\u0644\u0629 (${newDonor.bloodType}) \u0641\u064A ${newDonor.district} - ${newDonor.area}.`,
    time: "\u0627\u0644\u0622\u0646",
    type: "donor",
    read: false,
    linkPage: "donors",
    itemId: newDonor.id
  });
  saveDatabase();
  res.status(201).json(newDonor);
});
app.post("/api/donors/import", (req, res) => {
  const { donors: importedDonors } = req.body;
  if (!Array.isArray(importedDonors)) {
    return res.status(400).json({ error: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629\u060C \u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0645\u0635\u0641\u0648\u0641\u0629 \u0645\u0646 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646" });
  }
  let addedCount = 0;
  let skippedDuplicatesCount = 0;
  const addedDonors = [];
  for (const item of importedDonors) {
    if (!item || !item.fullName || !item.phone) continue;
    const dupCheck = checkDonorDuplication({ fullName: item.fullName, phone: item.phone }, db2.donors);
    if (dupCheck.isDuplicate) {
      skippedDuplicatesCount++;
      continue;
    }
    const cleanName = String(item.fullName).trim();
    const cleanPhone = normalizePhoneNumber(item.phone);
    const newDonor = {
      id: `donor-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
      fullName: cleanName,
      phone: cleanPhone,
      bloodType: item.bloodType || "O+",
      district: item.district || "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
      area: item.area || "\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u062F\u064A\u0646\u0629",
      isAvailable: item.isAvailable !== false,
      lastDonationDate: item.lastDonationDate || void 0,
      notes: item.notes || void 0,
      createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    db2.donors.unshift(newDonor);
    addedDonors.push(newDonor);
    addedCount++;
  }
  if (addedCount > 0) {
    db2.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0628\u0646\u062C\u0627\u062D \u{1F4C1}",
      message: `\u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F ${addedCount} \u0645\u062A\u0628\u0631\u0639 \u062C\u062F\u064A\u062F \u0625\u0644\u0649 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0648\u062A\u062E\u0637\u064A ${skippedDuplicatesCount} \u0645\u0643\u0631\u0631.`,
      time: "\u0627\u0644\u0622\u0646",
      type: "donor",
      read: false,
      linkPage: "donors"
    });
    saveDatabase();
  }
  res.json({
    success: true,
    addedCount,
    skippedDuplicatesCount,
    totalDonors: db2.donors.length,
    addedDonors
  });
});
app.put("/api/donors/:id", (req, res) => {
  const { id } = req.params;
  const index = db2.donors.findIndex((d) => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u0628\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  db2.donors[index] = {
    ...db2.donors[index],
    ...req.body,
    id
    // keep original ID
  };
  saveDatabase();
  res.json(db2.donors[index]);
});
app.delete("/api/donors/:id", (req, res) => {
  const { id } = req.params;
  const initialLen = db2.donors.length;
  db2.donors = db2.donors.filter((d) => d.id !== id);
  if (db2.donors.length === initialLen) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u0628\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  saveDatabase();
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u062A\u0628\u0631\u0639 \u0628\u0646\u062C\u0627\u062D" });
});
app.get("/api/requests", (_req, res) => {
  res.json(db2.requests);
});
var BLOOD_COMPATIBILITY_MAP = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"]
};

function isDonorCompatibleWithRequest(donorBloodType, reqBloodType) {
  if (!donorBloodType || donorBloodType === "all") return true;
  const list = BLOOD_COMPATIBILITY_MAP[donorBloodType] || [];
  return list.includes(reqBloodType);
}

// ============================================================================
// WhatsApp Business Cloud API Engine: Geographic Proximity, Medical Matching & Deduplication
// ============================================================================

// Geographic coordinates lookup matrix for Qaatabah Directorate & surrounding areas
const QAATABAH_GEO_COORDINATES = {
  // 1. مركز مديرية قعطبة
  "مديرية قعطبة - المركز": {
    default: { lat: 13.9855, lng: 44.6865 },
    "مركز المدينة": { lat: 13.9855, lng: 44.6865 },
    "سوق قعطبة": { lat: 13.9870, lng: 44.6880 },
    "حي النصر": { lat: 13.9820, lng: 44.6820 },
    "حي السلام": { lat: 13.9890, lng: 44.6910 },
    "المحطة": { lat: 13.9920, lng: 44.6890 },
    "السهده": { lat: 13.9780, lng: 44.6750 },
    "دار السلام": { lat: 13.9950, lng: 44.6930 }
  },
  // 2. سناح
  "سناح": {
    default: { lat: 13.8820, lng: 44.6940 },
    "سوق سناح": { lat: 13.8820, lng: 44.6940 },
    "الوبح": { lat: 13.8750, lng: 44.6880 },
    "القبة": { lat: 13.8900, lng: 44.7000 },
    "خوبر": { lat: 13.8950, lng: 44.7080 },
    "لكمة الدوكي": { lat: 13.8700, lng: 44.6800 }
  },
  // 3. الفاخر
  "الفاخر": {
    default: { lat: 14.0250, lng: 44.6020 },
    "سوق الفاخر": { lat: 14.0250, lng: 44.6020 },
    "حبيل العبدي": { lat: 14.0300, lng: 44.6100 },
    "مرخزة": { lat: 14.0180, lng: 44.5950 },
    "سليم": { lat: 14.0350, lng: 44.6150 },
    "القفلة": { lat: 14.0400, lng: 44.6200 },
    "باب غلق": { lat: 14.0500, lng: 44.6300 }
  },
  // 4. حمر وشخب
  "حمر وشخب": {
    default: { lat: 14.0600, lng: 44.6400 },
    "شخب": { lat: 14.0550, lng: 44.6350 },
    "حمر السادة": { lat: 14.0650, lng: 44.6450 },
    "حمر القوز": { lat: 14.0700, lng: 44.6500 },
    "دار السيد": { lat: 14.0580, lng: 44.6380 },
    "بيت الشوكي": { lat: 14.0800, lng: 44.6600 }
  },
  // 5. قعطبة الشمالية (مريس)
  "قعطبة الشمالية": {
    default: { lat: 14.1200, lng: 44.7200 },
    "الجبّارة": { lat: 14.1150, lng: 44.7150 },
    "القرين": { lat: 14.1250, lng: 44.7250 },
    "صولان": { lat: 14.1300, lng: 44.7300 },
    "الجعديات": { lat: 14.1100, lng: 44.7100 },
    "يعيس": { lat: 14.1400, lng: 44.7400 },
    "القهرة": { lat: 14.1450, lng: 44.7450 },
    "العرفاف": { lat: 14.1550, lng: 44.7550 },
    "حبيل السوق": { lat: 14.1050, lng: 44.7050 }
  },
  // 6. نقيل الشيم وريشان
  "نقيل الشيم وريشان": {
    default: { lat: 14.1500, lng: 44.7500 },
    "نقيل الشيم": { lat: 14.1500, lng: 44.7500 },
    "ريشان": { lat: 14.1600, lng: 44.7600 },
    "كنه": { lat: 14.1650, lng: 44.7650 },
    "الحقف": { lat: 14.1700, lng: 44.7700 },
    "حمام الفردوس": { lat: 14.1750, lng: 44.7750 }
  }
};

/**
 * Retrieves geographical coordinates (lat, lng) for a given district and area in Qaatabah.
 */
function getCoordinatesForLocation(districtName, areaName) {
  if (!districtName) return { lat: 13.9855, lng: 44.6865 };
  
  // Find matching district entry (fuzzy or exact)
  const normDist = normalizeArabicText(districtName);
  let matchedDistrictEntry = null;
  for (const [key, val] of Object.entries(QAATABAH_GEO_COORDINATES)) {
    if (normalizeArabicText(key).includes(normDist) || normDist.includes(normalizeArabicText(key))) {
      matchedDistrictEntry = val;
      break;
    }
  }

  if (!matchedDistrictEntry) {
    return { lat: 13.9855, lng: 44.6865 }; // Default to Qaatabah city center
  }

  if (areaName && typeof areaName === "string") {
    const normArea = normalizeArabicText(areaName);
    for (const [aKey, coords] of Object.entries(matchedDistrictEntry)) {
      if (aKey !== "default" && (normalizeArabicText(aKey).includes(normArea) || normArea.includes(normalizeArabicText(aKey)))) {
        return coords;
      }
    }
  }

  return matchedDistrictEntry.default || { lat: 13.9855, lng: 44.6865 };
}

/**
 * Calculates Great-Circle distance between two points on Earth using Haversine formula (km).
 */
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (typeof lat1 !== "number" || typeof lon1 !== "number" || typeof lat2 !== "number" || typeof lon2 !== "number") {
    return 0;
  }
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Formats a Yemeni or international phone number for WhatsApp Business Cloud API.
 * Output: numbers only, e.g. "967771234567"
 */
function formatPhoneForWhatsApp(phone) {
  if (!phone) return "";
  let clean = String(phone).replace(/[^\d]/g, "");
  if (clean.startsWith("00967")) clean = clean.substring(2);
  if (clean.startsWith("967")) return clean;
  if (clean.startsWith("0")) clean = clean.substring(1);
  if (clean.length === 9) {
    return `967${clean}`;
  }
  return clean;
}

// Active in-memory locks to prevent concurrent duplicate dispatches
const activeWhatsAppLocks = new Set();

/**
 * Filters and prioritizes compatible donors for an emergency blood request
 * based on medical compatibility, explicit opt-in, and true geographic proximity.
 */
function findMatchingNearbyDonors(req, donorsList = db2.donors, maxRecipients = 10) {
  if (!Array.isArray(donorsList) || donorsList.length === 0) return [];
  
  const reqCoords = getCoordinatesForLocation(req.district, req.area);

  const matched = [];

  for (const donor of donorsList) {
    // 1. Availability check
    if (donor.isAvailable === false) continue;

    // 2. Consent / Opt-in check (respects explicit false)
    if (donor.whatsappOptIn === false) continue;

    // 3. Strict Medical RBC Compatibility
    if (!isDonorCompatibleWithRequest(donor.bloodType, req.bloodType)) continue;

    // 4. Calculate coordinates and true Haversine distance
    const donorCoords = getCoordinatesForLocation(donor.district, donor.area);
    const distKm = calculateHaversineDistanceKm(
      reqCoords.lat,
      reqCoords.lng,
      donorCoords.lat,
      donorCoords.lng
    );

    // 5. Determine proximity level
    let proximityLevel = "governorate";
    const sameDist = normalizeArabicText(donor.district) === normalizeArabicText(req.district);
    const sameArea = sameDist && normalizeArabicText(donor.area) === normalizeArabicText(req.area);

    if (sameArea || distKm <= 2.5) {
      proximityLevel = "same_area";
    } else if (sameDist || distKm <= 9.0) {
      proximityLevel = "same_district";
    } else if (distKm <= 25.0) {
      proximityLevel = "nearby_district";
    }

    matched.push({
      donor,
      distanceKm: distKm,
      proximityLevel,
      coords: donorCoords
    });
  }

  // Sort by distance (closest first), then by last donation date (longest wait first)
  matched.sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    const dateA = a.donor.lastDonationDate || "1970-01-01";
    const dateB = b.donor.lastDonationDate || "1970-01-01";
    return dateA.localeCompare(dateB);
  });

  return matched.slice(0, maxRecipients);
}

/**
 * Dispatches a WhatsApp notification to a donor, either via live Meta Graph API or Simulation Mode.
 */
async function sendWhatsAppNotification(donor, req, distanceKm, proximityLevel, settings = db2.adminSettings) {
  const normPhone = normalizePhoneNumber(donor.phone);
  const waPhone = formatPhoneForWhatsApp(donor.phone);
  const lockKey = `${req.id}::${normPhone}`;

  // Concurrency Guard: prevent simultaneous identical dispatches
  if (activeWhatsAppLocks.has(lockKey)) {
    return {
      status: "skipped_duplicate",
      message: "طلب إرسال متزامن قيد المعالجة مسبقاً",
      donorPhone: normPhone
    };
  }

  activeWhatsAppLocks.add(lockKey);

  try {
    // Persistent De-duplication Check: verify if already dispatched for this request
    const existingLog = (db2.whatsappDispatches || []).find(
      (d) => d.requestId === req.id && (d.donorPhone === normPhone || d.donorPhone === waPhone) &&
        (d.status === "sent" || d.status === "simulated" || d.status === "delivered")
    );

    if (existingLog) {
      return {
        status: "skipped_duplicate",
        message: "تم إرسال إشعار لهذا المتبرع لنفس الطلب مسبقاً",
        donorPhone: normPhone,
        dispatchId: existingLog.id
      };
    }

    const isSimulate = settings.whatsappSimulateMode !== false ||
      !settings.whatsappPhoneNumberId ||
      !(settings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN);

    const distanceLabel = distanceKm > 0 ? `${distanceKm} كم` : "نفس المنطقة";
    const messageBody = `🚨 نداء دم عاجل - مديرية قعطبة 🩸

أخي المتبرع الكريم/ ${donor.fullName}،
تحية طيبة، تم تسجيل حالة طارئة بمستشفى ${req.hospital} بحاجة ماسة لمتبرعين من فصيلتك (${req.bloodType}):

• الفصيلة المطلوبة: ${req.bloodType}
• المريض: ${req.patientName} (${req.unitsNeeded} وحدة)
• الموقع: ${req.district} - ${req.area}
• المسافة التقريبية: ${distanceLabel}
• مسؤول الحالة: ${req.contactName}
• هاتف التواصل المباشر: ${req.contactPhone}

ملاحظة الحالة: ${req.caseDetails || "حالة طارئة تتطلب سرعة الاستجابة."}

تبرعك ينقذ حياة! للاستجابة أو الاستفسار يرجى الاتصال فوراً برقم مسؤول الحالة أعلاه.`;

    let resultStatus = "simulated";
    let messageId = `wamid.HBgL${Date.now()}${Math.random().toString(36).substring(2, 7)}.simulated`;
    let errorMessage = null;

    if (!isSimulate) {
      // Live WhatsApp Business Cloud API (Meta Graph API)
      const token = settings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = settings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: waPhone,
        type: "text",
        text: {
          preview_url: false,
          body: messageBody
        }
      };

      const metaRes = await fetch(metaUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const metaJson = await metaRes.json().catch(() => ({}));
      if (metaRes.ok && metaJson.messages?.[0]?.id) {
        resultStatus = "sent";
        messageId = metaJson.messages[0].id;
      } else {
        resultStatus = "failed";
        errorMessage = metaJson.error?.message || `HTTP ${metaRes.status}`;
      }
    }

    const logEntry = {
      id: `wa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      requestId: req.id,
      patientName: req.patientName,
      bloodType: req.bloodType,
      donorId: donor.id,
      donorName: donor.fullName,
      donorPhone: normPhone,
      donorDistrict: donor.district,
      donorArea: donor.area,
      distanceKm,
      proximityLevel,
      status: resultStatus,
      messageId,
      errorMessage,
      timestamp: new Date().toISOString()
    };

    if (!Array.isArray(db2.whatsappDispatches)) {
      db2.whatsappDispatches = [];
    }
    db2.whatsappDispatches.unshift(logEntry);
    if (db2.whatsappDispatches.length > 500) {
      db2.whatsappDispatches = db2.whatsappDispatches.slice(0, 500);
    }
    saveDatabase();

    // Mirror to Firestore if available
    if (clientFirestoreDb) {
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(clientFirestoreDb, "whatsapp_dispatches", logEntry.id), logEntry);
      } catch (fsErr) {
        console.warn("Notice syncing whatsapp dispatch to Firestore:", fsErr.message);
      }
    }

    return {
      status: resultStatus,
      messageId,
      errorMessage,
      logEntry,
      simulated: isSimulate
    };
  } finally {
    activeWhatsAppLocks.delete(lockKey);
  }
}

/**
 * Orchestrates WhatsApp emergency alerts for a blood request:
 * finds matching nearby donors, deduplicates, and dispatches.
 */
async function dispatchWhatsAppAlertsForRequest(req, options = {}) {
  try {
    if (db2.adminSettings.whatsappEnabled === false) {
      console.log("[WhatsApp Engine] WhatsApp notifications are globally disabled in admin settings.");
      return { success: false, reason: "disabled", dispatched: [] };
    }

    const maxRecipients = options.maxRecipients || db2.adminSettings.whatsappMaxRecipients || 10;
    const matchedDonors = findMatchingNearbyDonors(req, db2.donors, maxRecipients);

    console.log(`[WhatsApp Engine] Found ${matchedDonors.length} matching nearby donors for request ${req.id} (${req.bloodType} at ${req.district})`);

    const results = [];
    for (const item of matchedDonors) {
      const res = await sendWhatsAppNotification(
        item.donor,
        req,
        item.distanceKm,
        item.proximityLevel,
        db2.adminSettings
      );
      results.push({
        donorId: item.donor.id,
        donorName: item.donor.fullName,
        phone: item.donor.phone,
        distanceKm: item.distanceKm,
        proximityLevel: item.proximityLevel,
        ...res
      });
    }

    return {
      success: true,
      mode: db2.adminSettings.whatsappSimulateMode !== false ? "simulation" : "live",
      requestId: req.id,
      matchedCount: matchedDonors.length,
      dispatchedCount: results.filter(r => r.status === "sent" || r.status === "simulated").length,
      skippedCount: results.filter(r => r.status === "skipped_duplicate").length,
      skippedDuplicateCount: results.filter(r => r.status === "skipped_duplicate").length,
      results
    };
  } catch (err) {
    console.error("[WhatsApp Engine] Error dispatching alerts:", err);
    return { success: false, error: err.message, results: [] };
  }
}

// Modern Firebase Cloud Messaging (FCM) Push Engine
async function sendFCMNotificationToDevices({
  tokens,
  title,
  body,
  data = {},
  priority = "high",
  channelId = "blood_emergency_channel"
}) {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, total: 0 };
  }

  // Filter valid string tokens, remove duplicates and dummy keys
  const cleanTokens = Array.from(
    new Set(
      tokens.filter(
        (t) => typeof t === "string" && t.trim().length > 15 && !t.startsWith("dummy-") && !t.startsWith("test-")
      )
    )
  );

  if (cleanTokens.length === 0) {
    console.log("[FCM Engine] No valid real device tokens found to send to.");
    return { successCount: 0, failureCount: 0, total: 0 };
  }

  const payloadData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) {
      payloadData[k] = String(v);
    }
  }

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  if (adminMessaging) {
    const batchSize = 500;
    for (let i = 0; i < cleanTokens.length; i += batchSize) {
      const batchTokens = cleanTokens.slice(i, i + batchSize);
      try {
        const message = {
          tokens: batchTokens,
          notification: {
            title,
            body
          },
          data: payloadData,
          android: {
            priority: "high",
            notification: {
              channelId: channelId,
              title,
              body,
              sound: "default",
              color: "#be123c",
              icon: "ic_stat_blood_drop",
              priority: "high",
              visibility: "public",
              defaultSound: true,
              defaultVibrateTimings: true,
              clickAction: "OPEN_REQUEST_NOTIFICATION"
            }
          },
          webpush: {
            headers: {
              Urgency: "high"
            },
            notification: {
              title,
              body,
              icon: "/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg",
              badge: "/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg",
              vibrate: [350, 100, 350, 100, 350],
              requireInteraction: true,
              dir: "rtl",
              lang: "ar"
            },
            data: payloadData
          }
        };

        const response = await adminMessaging.sendEachForMulticast(message);
        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error ? resp.error.code : "";
            if (
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(batchTokens[idx]);
            }
          }
        });
      } catch (batchErr) {
        console.warn("[FCM] Batch multicast note:", batchErr.message);
        // Fallback: send individually
        for (const token of batchTokens) {
          try {
            await adminMessaging.send({
              token,
              notification: { title, body },
              data: payloadData,
              android: {
                priority: "high",
                notification: {
                  channelId: channelId,
                  sound: "default",
                  color: "#be123c",
                  icon: "ic_stat_blood_drop",
                  clickAction: "OPEN_REQUEST_NOTIFICATION"
                }
              }
            });
            successCount++;
          } catch (singleErr) {
            failureCount++;
          }
        }
      }
    }
  } else {
    console.warn("[FCM Engine] Notice: adminMessaging not initialized yet; notifications will be stored in database and dispatched via live listeners.");
  }

  // Prune dead/invalid tokens from subscriptions
  if (invalidTokens.length > 0) {
    try {
      db2.pushSubscriptions = (db2.pushSubscriptions || []).filter(
        (s) => !invalidTokens.includes(s.fcmToken) && !invalidTokens.includes(s.endpoint)
      );
      saveDatabase();
    } catch {}
  }

  console.log(`[FCM Engine] Dispatched alert: "${title}" -> ${successCount} sent, ${failureCount} failed out of ${cleanTokens.length} active devices.`);
  return { successCount, failureCount, total: cleanTokens.length };
}

async function dispatchPushNotificationForRequest(req) {
  try {
    const isCritical = req.urgency === "critical" || req.urgency === "urgent";
    const title = req.urgency === "critical" 
      ? `🚨 نداء دم عاجل جداً: فصيلة (${req.bloodType}) في ${req.district}`
      : `🩸 طلب دم جديد: فصيلة (${req.bloodType}) في ${req.district}`;
    const body = `المريض: ${req.patientName} بحاجة إلى (${req.unitsNeeded} كيس دم) بمستشفى ${req.hospital}. اضغط هنا للاستجابة فوراً.`;

    // 1. Gather matching device subscriptions based on filters
    const subscriptions = Array.isArray(db2.pushSubscriptions) ? db2.pushSubscriptions : [];
    const targetTokens = [];

    subscriptions.forEach((sub) => {
      if (sub.enabled === false) return;
      if (sub.criticalOnly && !isCritical) return;
      if (sub.district && sub.district !== "all") {
        const dNorm = String(req.district || "").toLowerCase();
        const subDNorm = String(sub.district || "").toLowerCase();
        if (!dNorm.includes(subDNorm) && !subDNorm.includes(dNorm)) return;
      }
      if (sub.bloodType && sub.bloodType !== "all") {
        if (!isDonorCompatibleWithRequest(sub.bloodType, req.bloodType)) return;
      }
      const tokenVal = sub.fcmToken || sub.endpoint;
      if (tokenVal) targetTokens.push(tokenVal);
    });

    // 2. Also check registered user accounts
    const users2 = db2.users || [];
    users2.forEach((u) => {
      if (!u.fcmToken || u.notificationsEnabled === false) return;
      if (u.bloodType && !isDonorCompatibleWithRequest(u.bloodType, req.bloodType)) return;
      targetTokens.push(u.fcmToken);
    });

    // 3. Gather tokens registered in Firestore 'fcm_tokens' collection
    try {
      const firestoreTokens = await fetchAllFirestoreFCMTokens();
      firestoreTokens.forEach((sub) => {
        if (sub.enabled === false) return;
        if (sub.criticalOnly && !isCritical) return;
        if (sub.district && sub.district !== "all") {
          const dNorm = String(req.district || "").toLowerCase();
          const subDNorm = String(sub.district || "").toLowerCase();
          if (!dNorm.includes(subDNorm) && !subDNorm.includes(dNorm)) return;
        }
        if (sub.bloodType && sub.bloodType !== "all") {
          if (!isDonorCompatibleWithRequest(sub.bloodType, req.bloodType)) return;
        }
        if (sub.token) targetTokens.push(sub.token);
      });
    } catch (fsTokErr) {
      console.warn("Notice querying Firestore fcm_tokens:", fsTokErr.message);
    }

    const uniqueTokens = Array.from(new Set(targetTokens));
    console.log(`[Push Notification] Broadcasting request ${req.id} (${req.bloodType} - ${req.district}) to ${uniqueTokens.length} matching device tokens.`);

    return await sendFCMNotificationToDevices({
      tokens: uniqueTokens,
      title,
      body,
      data: {
        type: "blood_request",
        requestId: req.id,
        bloodType: req.bloodType,
        district: req.district,
        hospital: req.hospital,
        patientName: req.patientName,
        urgency: req.urgency,
        url: `/?openRequest=${req.id}`
      },
      priority: isCritical ? "high" : "normal",
      channelId: "blood_emergency_channel"
    });
  } catch (err) {
    console.error("Error dispatching push notification for request:", err);
    return { successCount: 0, failureCount: 0, total: 0 };
  }
}

async function dispatchPushNotificationForAnnouncement(ann) {
  try {
    const title = `📢 ${ann.title || "تنبيه هام من إدارة السجل"}`;
    const body = (ann.content || "").slice(0, 160);

    const subscriptions = Array.isArray(db2.pushSubscriptions) ? db2.pushSubscriptions : [];
    const targetTokens = subscriptions
      .filter((s) => s.enabled !== false)
      .map((s) => s.fcmToken || s.endpoint)
      .filter(Boolean);

    const users2 = db2.users || [];
    users2.forEach((u) => {
      if (u.fcmToken && u.notificationsEnabled !== false) {
        targetTokens.push(u.fcmToken);
      }
    });

    const uniqueTokens = Array.from(new Set(targetTokens));
    console.log(`[Push Notification] Broadcasting announcement "${title}" to ${uniqueTokens.length} devices.`);

    return await sendFCMNotificationToDevices({
      tokens: uniqueTokens,
      title,
      body,
      data: {
        type: "announcement",
        announcementId: ann.id || "",
        annType: ann.type || "info",
        url: "/?page=home"
      },
      priority: "high",
      channelId: "blood_emergency_channel"
    });
  } catch (err) {
    console.error("Error dispatching push notification for announcement:", err);
    return { successCount: 0, failureCount: 0, total: 0 };
  }
}

// Push Notification Subscription Endpoints
app.post("/api/notifications/push-subscription", (req, res) => {
  try {
    const { endpoint, enabled, bloodType, district, criticalOnly, sound, vibrate, userAgent } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "معرف الاشتراك أو الجهاز مفقود" });
    }

    if (!Array.isArray(db2.pushSubscriptions)) {
      db2.pushSubscriptions = [];
    }

    const existingIdx = db2.pushSubscriptions.findIndex((s) => s.endpoint === endpoint);
    const subRecord = {
      endpoint,
      enabled: enabled !== false,
      bloodType: bloodType || "all",
      district: district || "all",
      criticalOnly: Boolean(criticalOnly),
      sound: sound !== false,
      vibrate: vibrate !== false,
      userAgent: userAgent || "",
      updatedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      db2.pushSubscriptions[existingIdx] = {
        ...db2.pushSubscriptions[existingIdx],
        ...subRecord
      };
    } else {
      db2.pushSubscriptions.push({
        ...subRecord,
        createdAt: new Date().toISOString()
      });
    }

    saveDatabase();
    res.json({ success: true, count: db2.pushSubscriptions.length });
  } catch (err) {
    res.status(500).json({ error: "تعذر حفظ اشتراك الإشعارات", details: err.message });
  }
});

app.get("/api/notifications/push-subscriptions", (_req, res) => {
  const subs = Array.isArray(db2.pushSubscriptions) ? db2.pushSubscriptions : [];
  res.json({
    total: subs.length,
    active: subs.filter((s) => s.enabled).length,
    byDistrict: subs.reduce((acc, s) => {
      const d = s.district || "all";
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {})
  });
});

app.post("/api/notifications/fcm-token", (req, res) => {
  try {
    const { id, token, platform, bloodType, district, criticalOnly, enabled, userId, userAgent } = req.body;
    if (!token) {
      return res.status(400).json({ error: "رمز FCM مطلوب" });
    }

    if (!Array.isArray(db2.pushSubscriptions)) {
      db2.pushSubscriptions = [];
    }

    const endpoint = token;
    const existingIdx = db2.pushSubscriptions.findIndex((s) => s.endpoint === endpoint || s.fcmToken === token);
    const subRecord = {
      endpoint,
      fcmToken: token,
      platform: platform || "android",
      enabled: enabled !== false,
      bloodType: bloodType || "all",
      district: district || "all",
      criticalOnly: Boolean(criticalOnly),
      userId: userId || "",
      userAgent: userAgent || "",
      updatedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      db2.pushSubscriptions[existingIdx] = {
        ...db2.pushSubscriptions[existingIdx],
        ...subRecord
      };
    } else {
      db2.pushSubscriptions.push({
        ...subRecord,
        createdAt: new Date().toISOString()
      });
    }

    saveDatabase();
    res.json({ success: true, count: db2.pushSubscriptions.length });
  } catch (err) {
    res.status(500).json({ error: "تعذر حفظ رمز الجهاز", details: err.message });
  }
});

app.post("/api/notifications/broadcast", async (req, res) => {
  try {
    const { requestId, patientName, bloodType, unitsNeeded, hospital, district, area, urgency, caseDetails, contactName, contactPhone } = req.body;
    const emergencyReq = {
      id: requestId || `req-${Date.now()}`,
      patientName: patientName || "مريض بحاجة للدم",
      bloodType: bloodType || "O-",
      unitsNeeded: Number(unitsNeeded) || 1,
      hospital: hospital || "مستشفى السلام - قعطبة",
      district: district || "مديرية قعطبة - المركز",
      area: area || "مركز المدينة",
      urgency: urgency || "critical",
      caseDetails: caseDetails || "",
      contactName: contactName || "مسؤول الحالة",
      contactPhone: contactPhone || ""
    };

    const pushResult = await dispatchPushNotificationForRequest(emergencyReq).catch((e) => ({ error: e.message }));
    const whatsappResult = await dispatchWhatsAppAlertsForRequest(emergencyReq).catch((e) => ({ error: e.message }));

    res.json({
      success: true,
      message: "تم بث نداء الدم العاجل لجميع الأجهزة والمتبرعين المطابقين بنجاح",
      pushResult,
      whatsappResult
    });
  } catch (err) {
    res.status(500).json({ error: "تعذر بث الإشعار", details: err.message });
  }
});

// WhatsApp Business Cloud API Endpoints
app.post("/api/whatsapp/dispatch-request", async (req, res) => {
  try {
    const { requestId, requestData, maxRecipients } = req.body;
    let targetReq = null;
    if (requestId) {
      targetReq = (db2.requests || []).find((r) => r.id === requestId);
    }
    if (!targetReq) {
      targetReq = requestData || (req.body.bloodType ? req.body : null);
      if (targetReq && !targetReq.id) {
        targetReq.id = requestId || `req-${Date.now()}`;
      }
    }
    if (!targetReq) {
      return res.status(404).json({ error: "طلب الدم غير موجود" });
    }

    const dispatchResult = await dispatchWhatsAppAlertsForRequest(targetReq, {
      maxRecipients: maxRecipients || 10
    });

    res.json(dispatchResult);
  } catch (err) {
    res.status(500).json({ error: "فشل إرسال إشعارات الواتساب", details: err.message });
  }
});

app.get("/api/whatsapp/logs", (_req, res) => {
  const logs = Array.isArray(db2.whatsappDispatches) ? db2.whatsappDispatches : [];
  res.json({
    total: logs.length,
    simulatedCount: logs.filter((l) => l.status === "simulated").length,
    sentCount: logs.filter((l) => l.status === "sent").length,
    skippedDuplicateCount: logs.filter((l) => l.status === "skipped_duplicate").length,
    failedCount: logs.filter((l) => l.status === "failed").length,
    logs: logs.slice(0, 100)
  });
});

app.post("/api/whatsapp/simulate-test", async (req, res) => {
  try {
    const { bloodType, district, area, hospital, patientName, unitsNeeded } = req.body;
    const testReq = {
      id: `sim-req-${Date.now()}`,
      patientName: patientName || "مريض تجريبي",
      bloodType: bloodType || "O-",
      unitsNeeded: unitsNeeded || 2,
      hospital: hospital || "مستشفى السلام التخصصي - قعطبة",
      district: district || "مديرية قعطبة - المركز",
      area: area || "مركز المدينة",
      urgency: "critical",
      contactName: "مسؤول الحالة",
      contactPhone: "777443322",
      caseDetails: "حالة طارئة لاختبار محاكاة واتساب السحابي"
    };

    const matched = findMatchingNearbyDonors(testReq, db2.donors, 5);
    
    const previewMessages = matched.map((item) => {
      const distanceLabel = item.distanceKm > 0 ? `${item.distanceKm} كم` : "نفس المنطقة";
      const sampleText = `🚨 نداء دم عاجل - مديرية قعطبة 🩸

أخي المتبرع الكريم/ ${item.donor.fullName}،
تحية طيبة، تم تسجيل حالة طارئة بمستشفى ${testReq.hospital} بحاجة ماسة لمتبرعين من فصيلتك (${testReq.bloodType}):

• الفصيلة المطلوبة: ${testReq.bloodType}
• المريض: ${testReq.patientName} (${testReq.unitsNeeded} وحدة)
• الموقع: ${testReq.district} - ${testReq.area}
• المسافة التقريبية: ${distanceLabel} (مستوى القرب: ${item.proximityLevel})
• هاتف التواصل: ${testReq.contactPhone}`;

      return {
        donorId: item.donor.id,
        donorName: item.donor.fullName,
        donorBloodType: item.donor.bloodType,
        donorPhone: item.donor.phone,
        donorDistrict: item.donor.district,
        donorArea: item.donor.area,
        distanceKm: item.distanceKm,
        proximityLevel: item.proximityLevel,
        optInConsent: item.donor.whatsappOptIn !== false,
        messagePreview: sampleText
      };
    });

    res.json({
      success: true,
      simulation: true,
      testReq,
      matchedDonorsCount: matched.length,
      previewMessages
    });
  } catch (err) {
    res.status(500).json({ error: "فشل اختبار محاكاة الواتساب", details: err.message });
  }
});

app.post("/api/notifications/test-push", async (req, res) => {
  const { bloodType, district } = req.body;
  const testReq = {
    id: `req-test-${Date.now()}`,
    patientName: "حالة طارئة تجريبية",
    bloodType: bloodType || "O-",
    unitsNeeded: 2,
    hospital: "مستشفى السلام التخصصي - قعطبة",
    district: district || "مديرية قعطبة - المركز",
    area: "مركز المدينة",
    urgency: "critical"
  };

  const dispatchResult = await dispatchPushNotificationForRequest(testReq).catch((e) => ({ error: e.message }));
  res.json({
    success: true,
    message: "تم إرسال إشعار خارجي تجريبي عبر Firebase Cloud Messaging 🔔",
    testReq,
    dispatchResult
  });
});

// Custom Broadcast Endpoint for Admin: إرسال إشعارات مخصصة حسب الفصيلة أو المنطقة
app.post("/api/notifications/custom-broadcast", async (req, res) => {
  try {
    const { title, message, bloodType, district, urgency, linkPage, itemId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "عنوان ونص الإشعار مطلوبان" });
    }

    const isCritical = urgency === "critical" || urgency === "urgent";
    const subscriptions = Array.isArray(db2.pushSubscriptions) ? db2.pushSubscriptions : [];
    const targetTokens = [];

    subscriptions.forEach((sub) => {
      if (sub.enabled === false) return;
      if (sub.criticalOnly && !isCritical) return;
      if (district && district !== "all") {
        const dNorm = String(district).toLowerCase();
        const subDNorm = String(sub.district || "").toLowerCase();
        if (!dNorm.includes(subDNorm) && !subDNorm.includes(dNorm)) return;
      }
      if (bloodType && bloodType !== "all") {
        if (!isDonorCompatibleWithRequest(sub.bloodType, bloodType)) return;
      }
      const tokenVal = sub.fcmToken || sub.endpoint;
      if (tokenVal) targetTokens.push(tokenVal);
    });

    const uniqueTokens = Array.from(new Set(targetTokens));

    // Save in-app notification
    const inAppNotif = {
      id: `notif-${Date.now()}`,
      title,
      message,
      time: "الآن",
      type: isCritical ? "urgent" : "system",
      read: false,
      linkPage: linkPage || "requests",
      itemId: itemId || ""
    };
    if (!Array.isArray(db2.notifications)) db2.notifications = [];
    db2.notifications.unshift(inAppNotif);
    saveDatabase();

    const result = await sendFCMNotificationToDevices({
      tokens: uniqueTokens,
      title,
      body: message,
      data: {
        type: "custom_broadcast",
        url: linkPage ? `/?page=${linkPage}` : "/",
        bloodType: bloodType || "all",
        district: district || "all",
        urgency: urgency || "normal"
      },
      priority: isCritical ? "high" : "normal",
      channelId: "blood_emergency_channel"
    });

    res.json({
      success: true,
      message: `تم إرسال الإشعار المخصص إلى ${result.successCount} جهاز بنجاح 🔔`,
      targetedCount: uniqueTokens.length,
      result
    });
  } catch (err) {
    res.status(500).json({ error: "تعذر إرسال الإشعار المخصص", details: err.message });
  }
});

// FCM Devices & Subscriptions Management Status for Admin
app.get("/api/notifications/fcm-devices", (_req, res) => {
  const subs = Array.isArray(db2.pushSubscriptions) ? db2.pushSubscriptions : [];
  const total = subs.length;
  const active = subs.filter((s) => s.enabled).length;
  const androidCount = subs.filter((s) => s.platform === "android").length;
  const webCount = subs.filter((s) => s.platform === "web" || !s.platform).length;

  const byBloodType = subs.reduce((acc, s) => {
    const bt = s.bloodType || "all";
    acc[bt] = (acc[bt] || 0) + 1;
    return acc;
  }, {});

  const byDistrict = subs.reduce((acc, s) => {
    const d = s.district || "all";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const devicesList = subs.map((s, idx) => ({
    id: `dev-${idx + 1}`,
    platform: s.platform || "web",
    bloodType: s.bloodType || "all",
    district: s.district || "all",
    criticalOnly: Boolean(s.criticalOnly),
    enabled: s.enabled !== false,
    updatedAt: s.updatedAt || s.createdAt || "مسبق",
    tokenPreview: s.fcmToken ? `${s.fcmToken.slice(0, 8)}...${s.fcmToken.slice(-8)}` : "web-endpoint"
  }));

  res.json({
    total,
    active,
    androidCount,
    webCount,
    byBloodType,
    byDistrict,
    devices: devicesList,
    fcmReady: Boolean(adminMessaging),
    projectId: firebase_applet_config_default.projectId
  });
});

// Announcements with FCM Push Broadcast
app.get("/api/announcements", (_req, res) => {
  res.json(Array.isArray(db2.announcements) ? db2.announcements : []);
});

app.post("/api/announcements", async (req, res) => {
  try {
    const { title, content, type, isActive, authorName } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "عنوان ونص الإعلان مطلوبان" });
    }

    const newAnn = {
      id: `ann-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: title.trim(),
      content: content.trim(),
      type: type || "urgent",
      isActive: isActive !== false,
      authorName: authorName || "مسؤول النظام",
      createdAt: new Date().toISOString()
    };

    if (!Array.isArray(db2.announcements)) {
      db2.announcements = [];
    }
    db2.announcements.unshift(newAnn);

    // Save in-app notification
    db2.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: `📢 ${newAnn.title}`,
      message: newAnn.content.slice(0, 160),
      time: "الآن",
      type: newAnn.type === "urgent" ? "urgent" : "system",
      read: false,
      linkPage: "home",
      itemId: newAnn.id
    });

    saveDatabase();

    // Broadcast FCM notification to all devices!
    const dispatchResult = await dispatchPushNotificationForAnnouncement(newAnn).catch(() => ({}));

    res.status(201).json({ success: true, announcement: newAnn, dispatchResult });
  } catch (err) {
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0648\u0646\u0634\u0631 \u0627\u0644\u0625\u0639\u0644\u0627\u0646", details: err.message });
  }
});

// Hospital & Medical Center Banner Ads Endpoints
function sortServerHospitalAds(ads) {
  return [...(Array.isArray(ads) ? ads : [])].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
    const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

app.get("/api/hospital-ads", (_req, res) => {
  res.json(sortServerHospitalAds(db2.hospitalAds));
});

app.post("/api/hospital-ads", (req, res) => {
  try {
    const body = req.body || {};
    const hospitalName = String(body.hospitalName || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();

    if (!hospitalName || !imageUrl || !phone || !address) {
      return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649 \u0648\u0627\u0644\u0635\u0648\u0631\u0629 \u0648\u0631\u0642\u0645 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0648\u0627\u0644\u0639\u0646\u0648\u0627\u0646" });
    }

    if (!Array.isArray(db2.hospitalAds)) {
      db2.hospitalAds = [];
    }

    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const adId = body.id ? String(body.id).trim() : `had-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
    const existingIdx = db2.hospitalAds.findIndex((item) => item.id === adId);

    const record = {
      id: adId,
      hospitalName,
      imageUrl,
      phone,
      address,
      websiteUrl: body.websiteUrl ? String(body.websiteUrl).trim() : void 0,
      description: body.description ? String(body.description).trim() : void 0,
      startDate: String(body.startDate || nowIso.split("T")[0]).trim(),
      endDate: String(body.endDate || nowIso.split("T")[0]).trim(),
      isActive: body.isActive !== false,
      displayOrder: Number.isFinite(Number(body.displayOrder)) ? Number(body.displayOrder) : db2.hospitalAds.length + 1,
      createdAt: existingIdx !== -1 ? db2.hospitalAds[existingIdx].createdAt || nowIso : String(body.createdAt || nowIso),
      updatedAt: nowIso
    };

    if (existingIdx !== -1) {
      db2.hospitalAds[existingIdx] = record;
    } else {
      db2.hospitalAds.push(record);
    }

    db2.hospitalAds = sortServerHospitalAds(db2.hospitalAds);
    saveDatabase();
    res.status(existingIdx !== -1 ? 200 : 201).json({ success: true, ad: record });
  } catch (err) {
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649", details: err.message });
  }
});

app.put("/api/hospital-ads/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(db2.hospitalAds)) {
      db2.hospitalAds = [];
    }
    const idx = db2.hospitalAds.findIndex((item) => item.id === id);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const prev = idx !== -1 ? db2.hospitalAds[idx] : {};
    const body = req.body || {};

    const updated = {
      ...prev,
      ...body,
      id,
      createdAt: prev.createdAt || body.createdAt || nowIso,
      updatedAt: nowIso
    };

    if (idx !== -1) {
      db2.hospitalAds[idx] = updated;
    } else {
      db2.hospitalAds.push(updated);
    }

    db2.hospitalAds = sortServerHospitalAds(db2.hospitalAds);
    saveDatabase();
    res.json({ success: true, ad: updated });
  } catch (err) {
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062B \u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649", details: err.message });
  }
});

app.post("/api/hospital-ads/reorder", (req, res) => {
  try {
    const { ads } = req.body || {};
    if (!Array.isArray(ads)) {
      return res.status(400).json({ error: "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
    }
    if (!Array.isArray(db2.hospitalAds)) {
      db2.hospitalAds = [];
    }
    const orderMap = new Map(ads.map((item, index) => [item.id, Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : index + 1]));
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    db2.hospitalAds = sortServerHospitalAds(
      db2.hospitalAds.map((item) =>
        orderMap.has(item.id)
          ? { ...item, displayOrder: orderMap.get(item.id), updatedAt: nowIso }
          : item
      )
    );
    saveDatabase();
    res.json({ success: true, ads: db2.hospitalAds });
  } catch (err) {
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A", details: err.message });
  }
});

app.delete("/api/hospital-ads/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(db2.hospitalAds)) {
      db2.hospitalAds = [];
    }
    db2.hospitalAds = db2.hospitalAds.filter((item) => item.id !== id);
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649", details: err.message });
  }
});

// Hospitals & Doctors Directory Endpoints (المستشفيات والأطباء)
function sortServerHospitals(hospitals2) {
  return [...(Array.isArray(hospitals2) ? hospitals2 : [])].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
    const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

function sortServerDoctors(doctors2) {
  return [...(Array.isArray(doctors2) ? doctors2 : [])].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
    const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });
}

app.get("/api/hospitals", (_req, res) => {
  res.json(sortServerHospitals(db2.hospitals));
});

app.post("/api/hospitals", (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const address = body.address ? String(body.address).trim() : void 0;
    const phone = body.phone ? String(body.phone).trim() : void 0;
    const description = body.description ? String(body.description).trim() : void 0;

    if (name.length < 2 || name.length > 150) {
      return res.status(400).json({ error: "يرجى إدخال اسم المستشفى بشكل صحيح" });
    }
    if (imageUrl.length < 5 || imageUrl.length > 300000) {
      return res.status(400).json({ error: "يرجى اختيار صورة مستشفى صالحة وبحجم مناسب" });
    }

    if (!Array.isArray(db2.hospitals)) {
      db2.hospitals = [];
    }

    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const hospId = body.id ? String(body.id).trim() : `hosp-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
    const existingIdx = db2.hospitals.findIndex((item) => item.id === hospId);

    const record = {
      id: hospId,
      name,
      imageUrl,
      ...(description ? { description: description.slice(0, 1500) } : {}),
      ...(address ? { address: address.slice(0, 250) } : {}),
      ...(phone ? { phone: phone.slice(0, 25) } : {}),
      displayOrder: Number.isFinite(Number(body.displayOrder)) ? Math.max(0, Number(body.displayOrder)) : db2.hospitals.length + 1,
      createdAt: existingIdx !== -1 ? db2.hospitals[existingIdx].createdAt || nowIso : String(body.createdAt || nowIso),
      updatedAt: nowIso
    };

    if (existingIdx !== -1) {
      db2.hospitals[existingIdx] = record;
    } else {
      db2.hospitals.push(record);
    }

    db2.hospitals = sortServerHospitals(db2.hospitals);
    saveDatabase();
    res.status(existingIdx !== -1 ? 200 : 201).json({ success: true, hospital: record });
  } catch (err) {
    res.status(500).json({ error: "تعذر حفظ بيانات المستشفى", details: err.message });
  }
});

app.put("/api/hospitals/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(db2.hospitals)) {
      db2.hospitals = [];
    }
    const idx = db2.hospitals.findIndex((item) => item.id === id);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const prev = idx !== -1 ? db2.hospitals[idx] : {};
    const body = req.body || {};

    const updated = {
      ...prev,
      ...body,
      id,
      name: String(body.name ?? prev.name ?? "").trim(),
      imageUrl: String(body.imageUrl ?? prev.imageUrl ?? "").trim(),
      createdAt: prev.createdAt || body.createdAt || nowIso,
      updatedAt: nowIso
    };

    if (updated.name.length < 2 || updated.imageUrl.length < 5) {
      return res.status(400).json({ error: "بيانات المستشفى غير مكتملة" });
    }

    if (idx !== -1) {
      db2.hospitals[idx] = updated;
    } else {
      db2.hospitals.push(updated);
    }

    db2.hospitals = sortServerHospitals(db2.hospitals);
    saveDatabase();
    res.json({ success: true, hospital: updated });
  } catch (err) {
    res.status(500).json({ error: "تعذر تحديث بيانات المستشفى", details: err.message });
  }
});

app.post("/api/hospitals/reorder", (req, res) => {
  try {
    const { hospitals: ordered } = req.body || {};
    if (!Array.isArray(ordered)) {
      return res.status(400).json({ error: "قائمة المستشفيات غير صالحة" });
    }
    if (!Array.isArray(db2.hospitals)) {
      db2.hospitals = [];
    }
    const orderMap = new Map(ordered.map((item, index) => [item.id, Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : index + 1]));
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    db2.hospitals = sortServerHospitals(
      db2.hospitals.map((item) =>
        orderMap.has(item.id)
          ? { ...item, displayOrder: orderMap.get(item.id), updatedAt: nowIso }
          : item
      )
    );
    saveDatabase();
    res.json({ success: true, hospitals: db2.hospitals });
  } catch (err) {
    res.status(500).json({ error: "تعذر تحديث ترتيب المستشفيات", details: err.message });
  }
});

app.delete("/api/hospitals/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(db2.hospitals)) db2.hospitals = [];
    if (!Array.isArray(db2.doctors)) db2.doctors = [];
    db2.hospitals = db2.hospitals.filter((item) => item.id !== id);
    db2.doctors = db2.doctors.filter((docItem) => docItem.hospitalId !== id);
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "تعذر حذف المستشفى", details: err.message });
  }
});

app.get("/api/doctors", (req, res) => {
  const { hospitalId } = req.query;
  let list = sortServerDoctors(db2.doctors);
  if (hospitalId && typeof hospitalId === "string") {
    list = list.filter((docItem) => docItem.hospitalId === hospitalId);
  }
  res.json(list);
});

app.post("/api/doctors", (req, res) => {
  try {
    const body = req.body || {};
    const hospitalId = String(body.hospitalId || "").trim();
    const fullName = String(body.fullName || "").trim();
    const specialty = String(body.specialty || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const bio = body.bio ? String(body.bio).trim() : void 0;
    const phone = body.phone ? String(body.phone).trim() : void 0;

    if (!hospitalId || fullName.length < 2 || specialty.length < 2) {
      return res.status(400).json({ error: "يرجى تحديد المستشفى واسم الطبيب والتخصص الطبي" });
    }
    if (imageUrl.length > 300000) {
      return res.status(400).json({ error: "حجم صورة الطبيب يتجاوز الحد المسموح" });
    }

    if (!Array.isArray(db2.doctors)) {
      db2.doctors = [];
    }

    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const docId = body.id ? String(body.id).trim() : `doc-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
    const existingIdx = db2.doctors.findIndex((item) => item.id === docId);

    const record = {
      id: docId,
      hospitalId,
      fullName: fullName.slice(0, 150),
      specialty: specialty.slice(0, 120),
      imageUrl,
      ...(bio ? { bio: bio.slice(0, 1000) } : {}),
      ...(phone ? { phone: phone.slice(0, 25) } : {}),
      displayOrder: Number.isFinite(Number(body.displayOrder)) ? Math.max(0, Number(body.displayOrder)) : db2.doctors.length + 1,
      createdAt: existingIdx !== -1 ? db2.doctors[existingIdx].createdAt || nowIso : String(body.createdAt || nowIso),
      updatedAt: nowIso
    };

    if (existingIdx !== -1) {
      db2.doctors[existingIdx] = record;
    } else {
      db2.doctors.push(record);
    }

    db2.doctors = sortServerDoctors(db2.doctors);
    saveDatabase();
    res.status(existingIdx !== -1 ? 200 : 201).json({ success: true, doctor: record });
  } catch (err) {
    res.status(500).json({ error: "تعذر حفظ بيانات الطبيب", details: err.message });
  }
});

app.put("/api/doctors/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(db2.doctors)) {
      db2.doctors = [];
    }
    const idx = db2.doctors.findIndex((item) => item.id === id);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const prev = idx !== -1 ? db2.doctors[idx] : {};
    const body = req.body || {};

    const updated = {
      ...prev,
      ...body,
      id,
      hospitalId: String(body.hospitalId ?? prev.hospitalId ?? "").trim(),
      fullName: String(body.fullName ?? prev.fullName ?? "").trim(),
      specialty: String(body.specialty ?? prev.specialty ?? "").trim(),
      imageUrl: String(body.imageUrl ?? prev.imageUrl ?? "").trim(),
      createdAt: prev.createdAt || body.createdAt || nowIso,
      updatedAt: nowIso
    };

    if (!updated.hospitalId || updated.fullName.length < 2 || updated.specialty.length < 2) {
      return res.status(400).json({ error: "بيانات الطبيب غير مكتملة" });
    }

    if (idx !== -1) {
      db2.doctors[idx] = updated;
    } else {
      db2.doctors.push(updated);
    }

    db2.doctors = sortServerDoctors(db2.doctors);
    saveDatabase();
    res.json({ success: true, doctor: updated });
  } catch (err) {
    res.status(500).json({ error: "تعذر تحديث بيانات الطبيب", details: err.message });
  }
});

app.delete("/api/doctors/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(db2.doctors)) {
      db2.doctors = [];
    }
    db2.doctors = db2.doctors.filter((item) => item.id !== id);
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "تعذر حذف الطبيب", details: err.message });
  }
});

// Donor Response Endpoints: الاستجابة لطلب التبرع بالدم
app.post("/api/requests/:id/respond", (req, res) => {
  try {
    const { id } = req.params;
    const { donorName, donorPhone, donorBloodType, district, responseType, notes } = req.body;

    if (!donorName || !donorPhone) {
      return res.status(400).json({ error: "يرجى تزويد اسم المتبرع ورقم هاتفه" });
    }

    if (!Array.isArray(db2.donorResponses)) {
      db2.donorResponses = [];
    }

    const responseRecord = {
      id: `resp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      requestId: id,
      donorName: donorName.trim(),
      donorPhone: donorPhone.trim(),
      donorBloodType: donorBloodType || "O+",
      district: district || "مديرية قعطبة",
      responseType: responseType || "ready_to_donate",
      notes: notes || "",
      timestamp: new Date().toISOString()
    };

    db2.donorResponses.unshift(responseRecord);

    // Add in-app notification for the response
    db2.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: "متبرع مستعد للاستجابة! 🩸",
      message: `المتبرع ${responseRecord.donorName} (${responseRecord.donorBloodType}) مستعد للتبرع لطلب الدم رقم (${id}).`,
      time: "الآن",
      type: "donor",
      read: false,
      linkPage: "requests",
      itemId: id
    });

    saveDatabase();
    res.status(201).json({ success: true, response: responseRecord });
  } catch (err) {
    res.status(500).json({ error: "تعذر تسجيل الاستجابة", details: err.message });
  }
});

app.get("/api/requests/:id/responses", (req, res) => {
  const { id } = req.params;
  const responses = Array.isArray(db2.donorResponses) ? db2.donorResponses : [];
  res.json(responses.filter((r) => r.requestId === id));
});
app.post("/api/requests", (req, res) => {
  const {
    patientName,
    bloodType,
    unitsNeeded,
    hospital,
    district,
    area,
    urgency,
    contactName,
    contactPhone,
    caseDetails,
    requestDate
  } = req.body;
  if (!patientName || !bloodType || !hospital || !contactPhone) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0637\u0644\u0628 \u0627\u0644\u062F\u0645" });
  }
  const newRequest = {
    id: `req-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    patientName,
    bloodType,
    unitsNeeded: Number(unitsNeeded) || 1,
    hospital,
    district: district || "\u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629 - \u0627\u0644\u0645\u0631\u0643\u0632",
    area: area || "\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u062F\u064A\u0646\u0629",
    urgency: urgency || "urgent",
    status: "open",
    contactName: contactName || patientName,
    contactPhone,
    caseDetails: caseDetails || "",
    requestDate: requestDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db2.requests.unshift(newRequest);
  db2.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: newRequest.urgency === "critical" ? "\u{1F6A8} \u0637\u0644\u0628 \u062F\u0645 \u0639\u0627\u062C\u0644 \u062C\u062F\u0627\u064B \u0641\u064A \u0642\u0639\u0637\u0628\u0629!" : "\u0637\u0644\u0628 \u062F\u0645 \u062C\u062F\u064A\u062F \u{1FA78}",
    message: `\u0645\u0637\u0644\u0648\u0628 ${newRequest.unitsNeeded} \u0648\u062D\u062F\u0629 \u0641\u0635\u064A\u0644\u0629 (${newRequest.bloodType}) \u0644\u0644\u0645\u0631\u064A\u0636 ${newRequest.patientName} \u0641\u064A ${newRequest.hospital}.`,
    time: "\u0627\u0644\u0622\u0646",
    type: "urgent",
    read: false,
    linkPage: "requests",
    itemId: newRequest.id
  });
  saveDatabase();
  dispatchPushNotificationForRequest(newRequest).catch(() => {
  });
  res.status(201).json(newRequest);
});
app.put("/api/requests/:id", (req, res) => {
  const { id } = req.params;
  const index = db2.requests.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0637\u0644\u0628 \u0627\u0644\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  db2.requests[index] = {
    ...db2.requests[index],
    ...req.body,
    id
  };
  saveDatabase();
  res.json(db2.requests[index]);
});
app.delete("/api/requests/:id", (req, res) => {
  const { id } = req.params;
  db2.requests = db2.requests.filter((r) => r.id !== id);
  saveDatabase();
  res.json({ success: true });
});
app.get("/api/districts", (_req, res) => {
  res.json(db2.districts);
});
app.post("/api/districts", (req, res) => {
  const { name, areas } = req.body;
  if (!name || !Array.isArray(areas)) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062F\u064A\u0631\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
  }
  const newDist = {
    id: `dist-${Date.now()}`,
    name,
    areas
  };
  db2.districts.push(newDist);
  saveDatabase();
  res.status(201).json(newDist);
});
app.put("/api/districts/:id", (req, res) => {
  const { id } = req.params;
  const index = db2.districts.findIndex((d) => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062F\u064A\u0631\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  db2.districts[index] = { ...db2.districts[index], ...req.body, id };
  saveDatabase();
  res.json(db2.districts[index]);
});
app.delete("/api/districts/:id", (req, res) => {
  const { id } = req.params;
  db2.districts = db2.districts.filter((d) => d.id !== id);
  saveDatabase();
  res.json({ success: true });
});
app.get("/api/notifications", (_req, res) => {
  res.json(db2.notifications);
});
app.post("/api/notifications/read/:id", (req, res) => {
  const { id } = req.params;
  db2.notifications = db2.notifications.map((n) => n.id === id ? { ...n, read: true } : n);
  saveDatabase();
  res.json({ success: true });
});
app.post("/api/notifications/read-all", (_req, res) => {
  db2.notifications = db2.notifications.map((n) => ({ ...n, read: true }));
  saveDatabase();
  res.json({ success: true });
});
app.delete("/api/notifications/clear", (_req, res) => {
  db2.notifications = [];
  saveDatabase();
  res.json({ success: true });
});
app.post("/api/admin/login", (req, res) => {
  const { email, password, idToken } = req.body;
  const masterCode = "alsh486iby-2026";
  const cleanPassword = String(password || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (cleanPassword === masterCode || cleanEmail === masterCode || (idToken && req.headers.authorization)) {
    const adminUser = {
      id: "user-admin",
      username: "admin",
      fullName: "مسؤول السجل المركزي - قعطبة",
      phone: "770236765",
      role: "admin",
      createdAt: "2026-08-01T00:00:00Z",
      lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return res.json({ success: true, user: adminUser, adminSessionToken: issueAdminSessionToken("admin") });
  }

  return res.status(401).json({ success: false, error: "رمز أو كلمة مرور المسؤول غير صحيحة" });
});
app.post("/api/admin/verify-pin", (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062E\u0627\u0637\u0626\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${rateLimit.waitSeconds} \u062B\u0627\u0646\u064A\u0629 \u0644\u0623\u0633\u0628\u0627\u0628 \u0623\u0645\u0646\u064A\u0629.`
    });
  }
  const { pin } = req.body;
  if (!pin || typeof pin !== "string") {
    recordFailedAttempt(clientIp);
    return res.status(400).json({ success: false, error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u0648\u0631" });
  }
  const masterCode = "alsh486iby-2026";
  const currentPin = db2.adminSettings.pin;
  if (pin.trim() === masterCode || (currentPin && pin.trim() === currentPin.trim())) {
    resetFailedAttempt(clientIp);
    return res.json({ success: true, role: "admin", adminSessionToken: issueAdminSessionToken("admin") });
  }
  recordFailedAttempt(clientIp);
  res.status(401).json({ success: false, error: "\u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
});
app.post("/api/admin/change-pin", (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!newPin || newPin.trim().length < 4) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0646 4 \u062E\u0627\u0646\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
  }
  const existingPin = db2.adminSettings.pin;
  if (existingPin && currentPin !== existingPin) {
    return res.status(403).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
  }
  db2.adminSettings.pin = newPin.trim();
  db2.adminSettings.pinUpdatedAt = Date.now();
  saveDatabase();
  console.log("Admin PIN changed and persisted to database.");
  res.json({ success: true, message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0628\u0646\u062C\u0627\u062D \u0648\u062D\u0641\u0638\u0647 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629" });
});
app.post("/api/admin/verify-recovery-code", (req, res) => {
  const { recoveryCode } = req.body;
  const input = String(recoveryCode || "").trim().toLowerCase();
  const masterCode = "alsh486iby-2026";
  const dbCode = String(db2.adminSettings?.recoveryCode || "").trim().toLowerCase();
  const envCode = String(process.env.ADMIN_RECOVERY_CODE || "").trim().toLowerCase();
  if (input && (input === masterCode || dbCode && input === dbCode || envCode && input === envCode)) {
    return res.json({ success: true, message: "\u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0635\u062D\u064A\u062D \u0648\u064A\u0645\u0643\u0646 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0622\u0646" });
  }
  return res.status(403).json({ success: false, error: "\u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
});
app.post("/api/admin/reset-pin", (req, res) => {
  const { recoveryCode, newPin } = req.body;
  if (!recoveryCode || !String(recoveryCode).trim()) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A" });
  }
  if (!newPin || String(newPin).trim().length < 4) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0646 4 \u062E\u0627\u0646\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
  }
  const input = String(recoveryCode).trim().toLowerCase();
  const masterCode = "alsh486iby-2026";
  const dbCode = String(db2.adminSettings?.recoveryCode || "").trim().toLowerCase();
  const envCode = String(process.env.ADMIN_RECOVERY_CODE || "").trim().toLowerCase();
  const isValid = input === masterCode || dbCode && input === dbCode || envCode && input === envCode;
  if (!isValid) {
    return res.status(403).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
  }
  db2.adminSettings.pin = String(newPin).trim();
  db2.adminSettings.pinUpdatedAt = Date.now();
  saveDatabase();
  console.log("Admin PIN reset via recovery code and persisted to database.");
  res.json({ success: true, message: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0648\u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0628\u0646\u062C\u0627\u062D \u0648\u062D\u0641\u0638\u0647\u0627" });
});
app.get("/api/admin/settings", (_req, res) => {
  const { smtpPass, pin, whatsappAccessToken, ...safeSettings } = db2.adminSettings;
  res.json({
    ...safeSettings,
    hasSmtpPass: Boolean(smtpPass),
    hasWhatsappToken: Boolean(whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN)
  });
});
app.post("/api/admin/settings", (req, res) => {
  const {
    recipientEmail,
    dailyExportHour,
    dailyExportMinute,
    autoExportEnabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    smtpFrom,
    recoveryCode,
    whatsappEnabled,
    whatsappPhoneNumberId,
    whatsappAccessToken,
    whatsappSimulateMode,
    whatsappMaxRecipients
  } = req.body;
  if (recipientEmail) db2.adminSettings.recipientEmail = recipientEmail.trim();
  if (typeof dailyExportHour === "number") db2.adminSettings.dailyExportHour = dailyExportHour;
  if (typeof dailyExportMinute === "number") db2.adminSettings.dailyExportMinute = dailyExportMinute;
  if (typeof autoExportEnabled === "boolean") db2.adminSettings.autoExportEnabled = autoExportEnabled;
  if (smtpHost !== void 0) db2.adminSettings.smtpHost = smtpHost;
  if (smtpPort !== void 0) db2.adminSettings.smtpPort = Number(smtpPort);
  if (smtpUser !== void 0) db2.adminSettings.smtpUser = smtpUser;
  if (smtpPass) db2.adminSettings.smtpPass = smtpPass;
  if (smtpSecure !== void 0) db2.adminSettings.smtpSecure = Boolean(smtpSecure);
  if (smtpFrom !== void 0) db2.adminSettings.smtpFrom = smtpFrom;
  if (recoveryCode) db2.adminSettings.recoveryCode = recoveryCode.trim();

  // WhatsApp Business Cloud API Settings
  if (typeof whatsappEnabled === "boolean") db2.adminSettings.whatsappEnabled = whatsappEnabled;
  if (whatsappPhoneNumberId !== void 0) db2.adminSettings.whatsappPhoneNumberId = String(whatsappPhoneNumberId).trim();
  if (whatsappAccessToken && String(whatsappAccessToken).trim()) {
    db2.adminSettings.whatsappAccessToken = String(whatsappAccessToken).trim();
  }
  if (typeof whatsappSimulateMode === "boolean") db2.adminSettings.whatsappSimulateMode = whatsappSimulateMode;
  if (typeof whatsappMaxRecipients === "number") db2.adminSettings.whatsappMaxRecipients = Math.max(1, Math.min(50, whatsappMaxRecipients));

  saveDatabase();
  setupDailyExportCron();
  res.json({ success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0628\u0646\u062C\u0627\u062D" });
});
app.get("/api/admin/export-logs", (_req, res) => {
  res.json(db2.exportLogs || []);
});
app.post("/api/admin/trigger-export", async (_req, res) => {
  const result = await executeExcelExportAndDispatch(true);
  res.json(result);
});
app.get("/api/admin/download-excel", (_req, res) => {
  try {
    const buffer = generateDonorsExcelBuffer(db2.donors);
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const filename = `qaatabah_blood_donors_${dateStr}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "\u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u0648\u0644\u064A\u062F \u0645\u0644\u0641 Excel", details: err.message });
  }
});
app.get("/api/admin/backup", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="qaatabah_blood_backup_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json"`
  );
  res.send(JSON.stringify(db2, null, 2));
});
app.post("/api/admin/restore", (req, res) => {
  try {
    const { donors: donors2, requests: requests2, districts: districts2, users: users2, hospitals: hospitals2, doctors: doctors2 } = req.body;
    if (Array.isArray(donors2)) db2.donors = donors2;
    if (Array.isArray(requests2)) db2.requests = requests2;
    if (Array.isArray(districts2)) db2.districts = districts2;
    if (Array.isArray(users2)) db2.users = users2;
    if (Array.isArray(hospitals2)) db2.hospitals = hospitals2;
    if (Array.isArray(doctors2)) db2.doctors = doctors2;
    saveDatabase();
    res.json({
      success: true,
      message: `\u062A\u0645 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D (${db2.donors.length} \u0645\u062A\u0628\u0631\u0639\u060C ${db2.requests.length} \u0637\u0644\u0628 \u062F\u0645)`
    });
  } catch (err) {
    res.status(400).json({ error: "\u0635\u064A\u063A\u0629 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629", details: err.message });
  }
});
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" });
  }
  const cleanUsername = String(username).trim();
  const cleanPhone = normalizePhoneNumber(cleanUsername);
  const masterCode = "alsh486iby-2026";
  const isMasterCodeMatch = password === masterCode || cleanUsername === masterCode;
  const adminPin = db2.adminSettings.pin || "1234";
  const isAdminUser = isMasterCodeMatch || cleanUsername.toLowerCase() === "admin" || cleanUsername.toLowerCase() === "\u0645\u062F\u064A\u0631" || cleanUsername.toLowerCase() === (db2.adminSettings.recipientEmail || "").toLowerCase() || cleanPhone === "771234567";
  if (isAdminUser) {
    const adminUserRecord = (db2.users || []).find((u) => u.id === "user-admin" || u.username === "admin");
    const isPinMatch = isMasterCodeMatch || (adminPin && password === adminPin);
    const isPassMatch = adminUserRecord && (adminUserRecord.password === password || adminUserRecord.passwordHash === password);
    if (isPinMatch || isPassMatch) {
      const adminUser = {
        id: "user-admin",
        username: "admin",
        fullName: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u0643\u0632\u064A - \u0642\u0639\u0637\u0628\u0629",
        phone: "770236765",
        role: "admin",
        createdAt: "2026-08-01T00:00:00Z",
        lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return res.json({ success: true, user: adminUser, adminSessionToken: issueAdminSessionToken("admin") });
    } else {
      return res.status(401).json({ error: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    }
  }
  const users2 = db2.users || [];
  const foundUser = users2.find(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase() || cleanPhone && normalizePhoneNumber(u.phone) === cleanPhone
  );
  if (!foundUser) {
    return res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0646\u0638\u0627\u0645" });
  }
  if (foundUser.password !== password) {
    return res.status(401).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  foundUser.lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
  saveDatabase();
  const { password: _, ...safeUser } = foundUser;
  res.json({ success: true, user: safeUser });
});
app.post("/api/auth/register", (req, res) => {
  const { username, password, fullName, phone } = req.body;
  if (!username || !password || !fullName || !phone) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0644\u062A\u0633\u062C\u064A\u0644" });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanPhone = normalizePhoneNumber(phone);
  const cleanName = String(fullName).trim();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 3 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u062A\u062A\u0643\u0648\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0646 4 \u062E\u0627\u0646\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
  }
  if (!cleanPhone || cleanPhone.length !== 9 || !/^(70|71|73|77|78)\d{7}$/.test(cleanPhone)) {
    return res.status(400).json({ error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u060C \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0645\u0646 9 \u0623\u0631\u0642\u0627\u0645 \u064A\u0628\u062F\u0623 \u0628\u0640 77 \u0623\u0648 78 \u0623\u0648 73 \u0623\u0648 71 \u0623\u0648 70" });
  }
  const words = cleanName.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 2) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0627\u0633\u0645 \u0643\u0627\u0645\u0644\u0627\u064B (\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062B\u0646\u0627\u0626\u064A \u0623\u0648 \u0627\u0644\u062B\u0644\u0627\u062B\u064A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)" });
  }
  if (cleanUsername === "admin" || cleanUsername === "user") {
    return res.status(409).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0647\u0630\u0627 \u0645\u062D\u062C\u0648\u0632 \u0645\u0633\u0628\u0642\u0627\u064B\u060C \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631" });
  }
  const users2 = db2.users || [];
  const existingUsername = users2.find((u) => u.username.toLowerCase() === cleanUsername);
  if (existingUsername) {
    return res.status(409).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B\u060C \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631" });
  }
  const existingPhone = users2.find((u) => normalizePhoneNumber(u.phone) === cleanPhone);
  if (existingPhone) {
    return res.status(409).json({ error: `\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0627\u0633\u0645 (${existingPhone.fullName})` });
  }
  const newUser = {
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    username: cleanUsername,
    password,
    fullName: cleanName,
    phone: cleanPhone,
    role: "user",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db2.users = [...users2, newUser];
  db2.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: "\u0645\u0633\u062A\u062E\u062F\u0645 \u062C\u062F\u064A\u062F \u0627\u0646\u0636\u0645 \u0644\u0644\u062A\u0637\u0628\u064A\u0642 \u{1F464}",
    message: `\u0627\u0646\u0636\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${newUser.fullName} (${newUser.phone}) \u0625\u0644\u0649 \u062A\u0637\u0628\u064A\u0642 \u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646.`,
    time: "\u0627\u0644\u0622\u0646",
    type: "system",
    read: false,
    linkPage: "admin"
  });
  saveDatabase();
  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ success: true, user: safeUser });
});
app.post("/api/auth/recover-admin", (req, res) => {
  const { recoveryCode, newPassword } = req.body;
  if (!recoveryCode || !newPassword) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629" });
  }
  const input = String(recoveryCode).trim().toLowerCase();
  const masterCode = "alsh486iby-2026";
  const dbCode = String(db2.adminSettings?.recoveryCode || "").trim().toLowerCase();
  const envCode = String(process.env.ADMIN_RECOVERY_CODE || "").trim().toLowerCase();
  const isValid = input === masterCode || dbCode && input === dbCode || envCode && input === envCode;
  if (!isValid) {
    return res.status(403).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
  }
  if (String(newPassword).trim().length < 4) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u062A\u062A\u0643\u0648\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0645\u0646 4 \u062E\u0627\u0646\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
  }
  db2.adminSettings.pin = String(newPassword).trim();
  db2.adminSettings.pinUpdatedAt = Date.now();
  saveDatabase();
  res.json({
    success: true,
    message: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0648\u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0628\u0646\u062C\u0627\u062D",
    user: {
      id: "user-admin",
      username: "admin",
      fullName: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u0643\u0632\u064A - \u0642\u0639\u0637\u0628\u0629",
      phone: "771234567",
      role: "admin"
    }
  });
});
app.get("/api/admin/users", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    if (clientFirestoreDb) {
      const snap = await getClientDocs(clientCollection(clientFirestoreDb, "users"));
      const rawUsers = [];
      snap.forEach((d) => {
        const normalized = normalizeUserRecord(d.data(), d.id);
        if (normalized) rawUsers.push(normalized);
      });
      const summary = summarizeUsersDirectory(rawUsers);
      const safeUsers = summary.activeUsers.map(({ password, passwordHash, ...safe }) => safe);
      return res.json(safeUsers);
    }
  } catch (err) {
    console.warn("Notice fetching live Firestore users in /api/admin/users:", err?.message || err);
  }
  const fallbackSummary = summarizeUsersDirectory(db2.users || []);
  const users2 = fallbackSummary.activeUsers.map(({ password, passwordHash, ...safe }) => safe);
  return res.json(users2);
});
app.delete("/api/admin/users/:id", (req, res) => {
  const { id } = req.params;
  if (id === "user-admin") {
    return res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A" });
  }
  db2.users = (db2.users || []).filter((u) => u.id !== id);
  saveDatabase();
  res.json({ success: true });
});
app.get("/api/users", requireAuth, async (_req, res) => {
  try {
    const users2 = await getUsers();
    res.json(users2);
  } catch (error) {
    console.error("Failed to fetch users from Cloud SQL:", error);
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
});
app.post("/api/users/sync", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Missing user token" });
    }
    const { fullName, phone, role } = req.body;
    const user = await getOrCreateUser(req.user.uid, req.user.email || "", fullName, phone, role);
    res.json({ success: true, user });
  } catch (error) {
    console.error("Failed to sync user to Cloud SQL:", error);
    res.status(500).json({ error: error.message || "Failed to sync user" });
  }
});

// In-App Update System Endpoints (التحديث المباشر دون حذف النسخة السابقة)
app.get("/api/app-update/latest", (_req, res) => {
  const config = db2.appUpdate || createDefaultAppUpdateConfig();
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.json({
    success: true,
    config,
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});

app.post("/api/app-update/config", requireAdminAuth, async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.username || "admin";
    const validation = validateAndNormalizeAppUpdateConfig(req.body, actor);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        code: validation.code || "VALIDATION_ERROR",
        error: validation.error
      });
    }

    const currentConfig = db2.appUpdate;
    if (currentConfig && currentConfig.enabled && validation.config.enabled && currentConfig.android) {
      const currentVc = Number(currentConfig.android.versionCode || 0);
      const nextVc = Number(validation.config.android.versionCode || 0);
      if (nextVc < currentVc) {
        return res.status(400).json({
          success: false,
          code: "VERSION_DOWNGRADE_FORBIDDEN",
          error: `لا يمكن تخفيض رقم الإصدار (${nextVc}) عن الإصدار المنشور حالياً (${currentVc}) لضمان التحديث المباشر.`
        });
      }
      if (
        nextVc === currentVc &&
        currentConfig.android.sha256 &&
        validation.config.android.sha256 &&
        currentConfig.android.sha256.toLowerCase() !== validation.config.android.sha256.toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          code: "DUPLICATE_VERSION_CODE",
          error: `رقم الإصدار (${nextVc}) مستخدم مسبقاً لحزمة APK أخرى. يجب زيادة versionCode لكل إصدار جديد.`
        });
      }
    }

    db2.appUpdate = validation.config;
    saveDatabase();

    // Mirror to Firestore settings/app_update if available
    if (clientFirestoreDb) {
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(clientFirestoreDb, "settings", "app_update"), validation.config, { merge: true });
      } catch (fsErr) {
        console.warn("Notice syncing app_update to Firestore:", fsErr.message);
      }
    }

    res.json({
      success: true,
      config: db2.appUpdate,
      message: "تم حفظ ونشر إعدادات التحديث الجديد بنجاح"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "تعذر حفظ إعدادات التحديث",
      details: err.message
    });
  }
});

var isProduction = process.env.NODE_ENV === "production";
async function startServer() {
  if (!isProduction) {
    try {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: { 
          middlewareMode: true,
          hmr: false
        },
        appType: "spa"
      });
      app.use(vite.middlewares);
      console.log("Vite middleware mounted in development mode (HMR disabled)");
    } catch (e) {
      console.warn("Vite middleware failed to mount, falling back to static files:", e);
      mountStaticRoutes();
    }
  } else {
    mountStaticRoutes();
  }
  function mountStaticRoutes() {
    app.use(express.static(distPath, { maxAge: "1h", index: false }));
    app.use("/assets", express.static(path.join(distPath, "assets"), { maxAge: "1y", immutable: true }));
    app.get("*", (_req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>\u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0628\u0631\u0639\u064A\u0646 \u0628\u0627\u0644\u062F\u0645 \u2013 \u0645\u062F\u064A\u0631\u064A\u0629 \u0642\u0639\u0637\u0628\u0629</title></head><body><div id="root">\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...</div></body></html>');
      }
    });
  }

  // Parse command line arguments (--port 3000 --host 0.0.0.0)
  const args = process.argv.slice(2);
  let cliPort = null;
  let cliHost = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      cliPort = Number(args[i + 1]);
    } else if (args[i] === "--host" && args[i + 1]) {
      cliHost = args[i + 1];
    }
  }

  const host = cliHost || process.env.HOST || "0.0.0.0";
  const primaryPort = cliPort || 3000;
  const rawEnvPort = process.env.PORT ? Number(process.env.PORT) : null;
  const envPort = rawEnvPort && !isNaN(rawEnvPort) && rawEnvPort > 0 ? rawEnvPort : null;
  const activeServers = [];

  try {
    const primaryServer = app.listen(primaryPort, host, () => {
      console.log(`Blood Registry server listening on http://${host}:${primaryPort}`);
    });
    primaryServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`Notice: Port ${primaryPort} is currently occupied.`);
      } else {
        console.error(`Server error on http://${host}:${primaryPort}:`, err);
      }
    });
    activeServers.push(primaryServer);
  } catch (err) {
    console.warn(`Failed to bind primary port ${primaryPort}:`, err);
  }

  if (envPort && envPort !== primaryPort) {
    try {
      const envServer = app.listen(envPort, host, () => {
        console.log(`Cloud Run env listener active on http://${host}:${envPort}`);
      });
      envServer.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`Notice: Env port ${envPort} occupied.`);
        } else {
          console.error(`Env port error:`, err);
        }
      });
      activeServers.push(envServer);
    } catch (err) {
      console.warn(`Failed to bind env port ${envPort}:`, err);
    }
  }
  function closeAndExit(signal) {
    console.log(`${signal} received: closing HTTP servers`);
    if (activeServers.length === 0) process.exit(0);
    let closed = 0;
    for (const s of activeServers) {
      s.close(() => {
        closed++;
        if (closed >= activeServers.length) process.exit(0);
      });
    }
    setTimeout(() => process.exit(0), 3e3);
  }
  process.on("SIGTERM", () => closeAndExit("SIGTERM"));
  process.on("SIGINT", () => closeAndExit("SIGINT"));
}
startServer();
export {
  checkDonorDuplication,
  executeExcelExportAndDispatch,
  generateDonorsExcelBuffer,
  normalizeArabicText,
  normalizePhoneNumber
};
