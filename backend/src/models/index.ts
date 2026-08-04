import mongoose, { Schema, model } from 'mongoose';
import { CATEGORIES, PRIORITIES, ROLES, STATUSES } from '../constants/index.js';

const options = { timestamps: true, toJSON: { virtuals: true, transform: (_: unknown, ret: Record<string, unknown>) => { ret.id = ret._id; delete ret._id; delete ret.__v; delete ret.passwordHash; return ret; } } };

const userSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, index: true }, name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'employee', index: true }, department: { type: String, trim: true, default: 'general' },
  employeeCategory: { type: String, default: 'custom' }, isActive: { type: Boolean, default: true }, lastLoginAt: Date,
  resetPasswordHash: { type: String, select: false }, resetPasswordExpiresAt: { type: Date, select: false },
}, options);

const ticketSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, index: true }, ticketNumber: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true }, description: { type: String, required: true }, category: { type: String, enum: CATEGORIES, required: true, index: true },
  department: { type: String, required: true, index: true }, priority: { type: String, enum: PRIORITIES, default: 'medium', index: true },
  status: { type: String, enum: STATUSES, default: 'open', index: true }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true }, dueDate: Date, resolvedAt: Date, closedAt: Date,
  attachments: [{ name: String, url: String, mimeType: String, size: Number }], feedback: { rating: { type: Number, min: 1, max: 5 }, comment: String },
}, options);
ticketSchema.index({ companyId: 1, status: 1, department: 1, createdAt: -1 });
ticketSchema.index({ title: 'text', description: 'text', ticketNumber: 'text' });

const commentSchema = new Schema({ ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true }, author: { type: Schema.Types.ObjectId, ref: 'User', required: true }, body: { type: String, required: true }, internal: { type: Boolean, default: false }, attachments: [{ name: String, url: String }] }, options);
const historySchema = new Schema({ ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true }, actor: { type: Schema.Types.ObjectId, ref: 'User', required: true }, action: { type: String, required: true }, from: Schema.Types.Mixed, to: Schema.Types.Mixed }, options);
const notificationSchema = new Schema({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, title: String, message: String, type: { type: String, default: 'in_app' }, readAt: Date, link: String }, options);
const auditSchema = new Schema({ companyId: Schema.Types.ObjectId, actor: { type: Schema.Types.ObjectId, ref: 'User' }, action: { type: String, required: true, index: true }, resource: String, resourceId: String, ip: String, metadata: Schema.Types.Mixed }, options);
const refreshTokenSchema = new Schema({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true, expires: 0 }, revokedAt: Date }, options);

export const User = model('User', userSchema);
export const Ticket = model('Ticket', ticketSchema);
export const TicketComment = model('TicketComment', commentSchema);
export const TicketHistory = model('TicketHistory', historySchema);
export const Notification = model('Notification', notificationSchema);
export const AuditLog = model('AuditLog', auditSchema);
export const RefreshToken = model('RefreshToken', refreshTokenSchema);
export { mongoose };
