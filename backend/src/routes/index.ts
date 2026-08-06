import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { DEPARTMENTS, ROLES } from '../constants/index.js';
import { AuditLog, Notification, Ticket, User } from '../models/index.js';
import { authenticate, authorize } from '../middlewares/index.js';
import { authService } from '../services/auth.service.js';
import { ticketService } from '../services/ticket.service.js';
import { AppError, asyncHandler, ok, randomToken, sha256 } from '../utils/index.js';

const validate = (req: any) => { const errors = validationResult(req); if (!errors.isEmpty()) throw new AppError(422, errors.array().map(e => e.msg).join(', '), 'VALIDATION_ERROR'); };
export const router = Router();

router.post('/auth/register', body('name').trim().isLength({ min: 2 }), body('email').isEmail(), body('password').isLength({ min: 8 }), asyncHandler(async (req, res) => { validate(req); ok(res, await authService.register(req.body), 'Account created', undefined, 201); }));
router.post('/auth/login', body('email').isEmail(), body('password').notEmpty(), asyncHandler(async (req, res) => { validate(req); ok(res, await authService.login(req.body.email, req.body.password, req.ip)); }));
router.post('/auth/refresh', body('refreshToken').notEmpty(), asyncHandler(async (req, res) => { validate(req); ok(res, await authService.refresh(req.body.refreshToken)); }));
router.post('/auth/logout', body('refreshToken').notEmpty(), asyncHandler(async (req, res) => { await authService.logout(req.body.refreshToken); ok(res, null, 'Logged out'); }));
router.post('/auth/forgot-password', body('email').isEmail(), asyncHandler(async (req, res) => { const raw = randomToken(); await User.updateOne({ email: req.body.email.toLowerCase() }, { resetPasswordHash: sha256(raw), resetPasswordExpiresAt: new Date(Date.now() + 3600000) }); ok(res, process.env.NODE_ENV === 'development' ? { resetToken: raw } : null, 'If the account exists, reset instructions were created'); }));
router.post('/auth/reset-password', body('token').notEmpty(), body('password').isLength({ min: 8 }), asyncHandler(async (req, res) => { const bcrypt = await import('bcryptjs'); const user = await User.findOne({ resetPasswordHash: sha256(req.body.token), resetPasswordExpiresAt: { $gt: new Date() } }).select('+resetPasswordHash +resetPasswordExpiresAt'); if (!user) throw new AppError(400, 'Invalid or expired reset token'); user.set({ passwordHash: await bcrypt.hash(req.body.password, 12), resetPasswordHash: undefined, resetPasswordExpiresAt: undefined }); await user.save(); ok(res, null, 'Password reset'); }));

router.use(authenticate);
router.get('/auth/me', asyncHandler(async (req, res) => ok(res, await User.findById(req.user!.id))));
router.get('/tickets', asyncHandler(async (req, res) => { const result = await ticketService.list(req.user, req.query); ok(res, result.items, undefined, result.meta); }));
router.post('/tickets', body('title').trim().isLength({ min: 3 }), body('description').isLength({ min: 5 }), body('category').notEmpty(), body('department').optional({ checkFalsy: true }).isIn(DEPARTMENTS), body('assignedTo').optional({ checkFalsy: true }).isMongoId(), asyncHandler(async (req, res) => { validate(req); ok(res, await ticketService.create(req.body, req.user!), 'Ticket created', undefined, 201); }));
router.get('/tickets/:id', asyncHandler(async (req, res) => ok(res, await ticketService.get(String(req.params.id), req.user))));
router.patch('/tickets/:id', asyncHandler(async (req, res) => ok(res, await ticketService.update(String(req.params.id), req.body, req.user!), 'Ticket updated')));
router.post('/tickets/:id/comments', body('body').trim().isLength({ min: 1 }), asyncHandler(async (req, res) => { validate(req); ok(res, await ticketService.comment(String(req.params.id), req.body.body, !!req.body.internal, req.user!), 'Comment added', undefined, 201); }));
router.get('/notifications', asyncHandler(async (req, res) => ok(res, await Notification.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50))));
router.patch('/notifications/:id/read', asyncHandler(async (req, res) => ok(res, await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user!.id }, { readAt: new Date() }, { new: true }))));
router.get('/dashboard', asyncHandler(async (req, res) => { const match: any = req.user!.role === 'employee' ? { $or: [{ createdBy: new (await import('mongoose')).default.Types.ObjectId(req.user!.id) }, { assignedTo: new (await import('mongoose')).default.Types.ObjectId(req.user!.id) }] } : req.user!.role === 'hr' ? { department: 'hr' } : {}; if (req.user!.companyId) match.companyId = new (await import('mongoose')).default.Types.ObjectId(req.user!.companyId); const [status, priority, category, monthly, performance] = await Promise.all([Ticket.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]), Ticket.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]), Ticket.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]), Ticket.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 12 }]), Ticket.aggregate([{ $match: { ...match, resolvedAt: { $exists: true } } }, { $group: { _id: null, averageResolutionMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } }])]); ok(res, { status, priority, category, monthly, averageResolutionHours: Math.round((performance[0]?.averageResolutionMs || 0) / 3600000) }); }));
router.get('/assignees', asyncHandler(async (req, res) => {
  const department = String(req.query.department || '');
  if (!DEPARTMENTS.includes(department as typeof DEPARTMENTS[number]) || department === 'general') throw new AppError(422, 'A valid department is required', 'VALIDATION_ERROR');
  const scope = req.user!.companyId ? { companyId: req.user!.companyId } : {};
  const users = await User.find({ department, isActive: true, _id: { $ne: req.user!.id }, ...scope }).select('name email role department').sort({ role: 1, name: 1 }).limit(100);
  ok(res, users);
}));
router.get('/users', authorize('super_admin','company_admin'), asyncHandler(async (req, res) => {
  const scope = req.user!.companyId ? { companyId: req.user!.companyId } : {};
  ok(res, await User.find(scope).sort({ createdAt: -1 }));
}));
router.patch('/users/:id', authorize('super_admin','company_admin'), asyncHandler(async (req, res) => {
  const targetId = String(req.params.id);
  const scope = req.user!.companyId ? { _id: targetId, companyId: req.user!.companyId } : { _id: targetId };
  const target = await User.findOne(scope);
  if (!target) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  if (targetId === req.user!.id && (req.body.role !== undefined || req.body.isActive !== undefined)) throw new AppError(400, 'You cannot change your own role or account status', 'SELF_UPDATE_BLOCKED');
  if (req.user!.role === 'company_admin' && (target.role === 'super_admin' || req.body.role === 'super_admin')) throw new AppError(403, 'Only a super admin can manage the Super Admin role', 'FORBIDDEN');
  const allowed: Record<string, unknown> = {};
  for (const key of ['name','role','department','employeeCategory','isActive']) if (req.body[key] !== undefined) allowed[key] = req.body[key];
  if (allowed.role && !ROLES.includes(allowed.role as typeof ROLES[number])) throw new AppError(422, 'Invalid role', 'VALIDATION_ERROR');
  if (allowed.department && !DEPARTMENTS.includes(allowed.department as typeof DEPARTMENTS[number])) throw new AppError(422, 'Invalid department', 'VALIDATION_ERROR');
  Object.assign(target, allowed); await target.save();
  await AuditLog.create({ companyId: req.user!.companyId, actor: req.user!.id, action: 'user.updated', resource: 'user', resourceId: target.id, metadata: allowed });
  ok(res, target, 'User updated');
}));
router.get('/audit-logs', authorize('super_admin','company_admin'), asyncHandler(async (req, res) => ok(res, await AuditLog.find(req.user!.companyId ? { companyId: req.user!.companyId } : {}).populate('actor', 'name email').sort({ createdAt: -1 }).limit(100))));
