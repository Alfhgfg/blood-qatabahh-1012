import { relations } from 'drizzle-orm';
import { boolean, integer, json, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// Users table (keyed by Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: varchar('uid', { length: 128 }).notNull().unique(), // Firebase Auth UID
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).default(''),
  phone: varchar('phone', { length: 50 }).default(''),
  role: varchar('role', { length: 20 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Donors table
export const donors = pgTable('donors', {
  id: varchar('id', { length: 128 }).primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  bloodType: varchar('blood_type', { length: 10 }).notNull(),
  district: varchar('district', { length: 150 }).notNull(),
  area: varchar('area', { length: 150 }).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  lastDonationDate: varchar('last_donation_date', { length: 50 }),
  notes: text('notes'),
  createdAt: varchar('created_at', { length: 50 }).notNull(),
});

// Blood requests table
export const requests = pgTable('requests', {
  id: varchar('id', { length: 128 }).primaryKey(),
  patientName: varchar('patient_name', { length: 255 }).notNull(),
  bloodType: varchar('blood_type', { length: 10 }).notNull(),
  unitsNeeded: integer('units_needed').default(1).notNull(),
  hospital: varchar('hospital', { length: 255 }).notNull(),
  district: varchar('district', { length: 150 }).notNull(),
  area: varchar('area', { length: 150 }).notNull(),
  urgency: varchar('urgency', { length: 50 }).default('urgent').notNull(),
  status: varchar('status', { length: 50 }).default('open').notNull(),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }).notNull(),
  caseDetails: text('case_details'),
  requestDate: varchar('request_date', { length: 50 }).notNull(),
  createdAt: varchar('created_at', { length: 50 }).notNull(),
});

// Districts table
export const districts = pgTable('districts', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  areas: json('areas').$type<string[]>().default([]),
});

// Notifications table
export const notifications = pgTable('notifications', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  time: varchar('time', { length: 50 }).notNull(),
  type: varchar('type', { length: 50 }).default('system').notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({}) => ({}));
