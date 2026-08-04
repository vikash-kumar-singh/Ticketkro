import { MANAGER_ROLES } from '../constants/index.js';
import { AuditLog, Notification, Ticket, TicketComment, TicketHistory, User } from '../models/index.js';
import { AppError, ticketNumber } from '../utils/index.js';

const scoped = (user: Express.Request['user']) => {
  if (!user) throw new AppError(401, 'Authentication required');
  const query: Record<string, unknown> = user.companyId ? { companyId: user.companyId } : {};
  if (user.role === 'employee') query.createdBy = user.id;
  if (user.role === 'hr') query.department = 'hr';
  return query;
};
export const ticketService = {
  async list(user: Express.Request['user'], query: Record<string, any>) {
    const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = scoped(user);
    for (const key of ['status', 'priority', 'category', 'department', 'assignedTo', 'createdBy']) if (query[key]) filter[key] = query[key];
    if (query.search) filter.$text = { $search: query.search };
    if (query.from || query.to) filter.createdAt = { ...(query.from && { $gte: new Date(query.from) }), ...(query.to && { $lte: new Date(query.to) }) };
    const [items, total] = await Promise.all([Ticket.find(filter).populate('createdBy assignedTo', 'name email role department').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Ticket.countDocuments(filter)]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  },
  async get(id: string, user: Express.Request['user']) {
    const ticket = await Ticket.findOne({ _id: id, ...scoped(user) }).populate('createdBy assignedTo', 'name email role department');
    if (!ticket) throw new AppError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
    const [comments, history] = await Promise.all([TicketComment.find({ ticketId: id, ...(user?.role === 'employee' && { internal: false }) }).populate('author', 'name role').sort({ createdAt: 1 }), TicketHistory.find({ ticketId: id }).populate('actor', 'name').sort({ createdAt: 1 })]);
    return { ticket, comments, history };
  },
  async create(input: any, user: NonNullable<Express.Request['user']>) {
    const department = input.department || ({ hr: 'hr', payroll: 'finance', software: 'it', hardware: 'it', security: 'it' } as Record<string, string>)[input.category] || input.category;
    const adminScope: Record<string, unknown> = { role: 'super_admin', isActive: true };
    if (user.companyId) adminScope.companyId = user.companyId;
    const superAdmin = await User.findOne(adminScope).sort({ createdAt: 1 });
    const status = superAdmin ? 'assigned' : 'open';
    const ticket = await Ticket.create({ ...input, department, status, assignedTo: superAdmin?._id, ticketNumber: ticketNumber(), createdBy: user.id, companyId: user.companyId });
    const work: Promise<unknown>[] = [
      TicketHistory.create({ ticketId: ticket._id, actor: user.id, action: 'ticket.created', to: { status } }),
      AuditLog.create({ companyId: user.companyId, actor: user.id, action: 'ticket.created', resource: 'ticket', resourceId: ticket.id }),
    ];
    if (superAdmin) {
      work.push(
        TicketHistory.create({ ticketId: ticket._id, actor: user.id, action: 'ticket.auto_assigned', to: { assignedTo: superAdmin._id, role: 'super_admin' } }),
        Notification.create({ userId: superAdmin._id, title: 'New ticket assigned', message: `${ticket.ticketNumber}: ${ticket.title}`, link: `/tickets/${ticket.id}` }),
        AuditLog.create({ companyId: user.companyId, actor: user.id, action: 'ticket.assigned_to_super_admin', resource: 'ticket', resourceId: ticket.id, metadata: { assignedTo: superAdmin.id } }),
      );
    }
    await Promise.all(work);
    return Ticket.findById(ticket._id).populate('createdBy assignedTo', 'name email role department');
  },
  async update(id: string, input: any, user: NonNullable<Express.Request['user']>) {
    const ticket = await Ticket.findOne({ _id: id, ...scoped(user) }); if (!ticket) throw new AppError(404, 'Ticket not found');
    const managerial = MANAGER_ROLES.includes(user.role); const isCreator = ticket.createdBy.toString() === user.id;
    if (!managerial && (!isCreator || !['open', 'resolved'].includes(ticket.status))) throw new AppError(403, 'Ticket cannot be changed');
    const allowed = managerial ? ['title','description','category','department','priority','status','assignedTo','dueDate'] : ['title','description','feedback','status'];
    const before = ticket.toObject(); for (const key of allowed) if (input[key] !== undefined) ticket.set(key, input[key]);
    if (input.status === 'resolved') ticket.resolvedAt = new Date(); if (input.status === 'closed') ticket.closedAt = new Date(); await ticket.save();
    await TicketHistory.create({ ticketId: id, actor: user.id, action: 'ticket.updated', from: before, to: ticket.toObject() });
    if (ticket.assignedTo) await Notification.create({ userId: ticket.assignedTo, title: 'Ticket updated', message: `${ticket.ticketNumber}: ${ticket.title}`, link: `/tickets/${id}` });
    return ticket;
  },
  async comment(id: string, body: string, internal: boolean, user: NonNullable<Express.Request['user']>) {
    const ticket = await Ticket.findOne({ _id: id, ...scoped(user) }); if (!ticket) throw new AppError(404, 'Ticket not found');
    if (internal && user.role === 'employee') throw new AppError(403, 'Internal comments require staff access');
    const comment = await TicketComment.create({ ticketId: id, author: user.id, body, internal });
    await TicketHistory.create({ ticketId: id, actor: user.id, action: internal ? 'comment.internal' : 'comment.public' });
    return TicketComment.findById(comment._id).populate('author', 'name role');
  },
};
