import { MANAGER_ROLES } from '../constants/index.js';
import { AuditLog, mongoose, Notification, Ticket, TicketComment, TicketHistory, User } from '../models/index.js';
import { AppError, ticketNumber } from '../utils/index.js';

const scoped = (user: Express.Request['user']) => {
  if (!user) throw new AppError(401, 'Authentication required');
  const query: Record<string, unknown> = user.companyId ? { companyId: user.companyId } : {};
  if (user.role === 'employee') query.$or = [{ createdBy: user.id }, { assignedTo: user.id }];
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
    const assignedHandler = user?.role === 'employee' && ticket.assignedTo && ticket.assignedTo.toString() === user.id;
    const [comments, history] = await Promise.all([TicketComment.find({ ticketId: id, ...(user?.role === 'employee' && !assignedHandler && { internal: false }) }).populate('author', 'name role').sort({ createdAt: 1 }), TicketHistory.find({ ticketId: id }).populate('actor', 'name').sort({ createdAt: 1 })]);
    return { ticket, comments, history };
  },
  async create(input: any, user: NonNullable<Express.Request['user']>) {
    const department = input.department || ({ hr: 'hr', payroll: 'finance', software: 'it', hardware: 'it', security: 'it' } as Record<string, string>)[input.category] || input.category;
    const companyScope = user.companyId ? { companyId: user.companyId } : {};
    let assignee = null;
    let assignmentAction = 'ticket.auto_assigned';
    if (input.assignedTo) {
      assignee = await User.findOne({ _id: input.assignedTo, department, isActive: true, ...companyScope });
      if (!assignee) throw new AppError(422, 'Selected assignee is not active or does not belong to this department', 'INVALID_ASSIGNEE');
      assignmentAction = 'ticket.assigned_by_requester';
    } else {
      assignee = await User.findOne({ role: 'super_admin', isActive: true, ...companyScope }).sort({ createdAt: 1 });
    }
    const status = assignee ? 'assigned' : 'open';
    const ticket = await Ticket.create({ ...input, department, status, assignedTo: assignee?._id, ticketNumber: ticketNumber(), createdBy: user.id, companyId: user.companyId });
    const work: Promise<unknown>[] = [
      TicketHistory.create({ ticketId: ticket._id, actor: user.id, action: 'ticket.created', to: { status } }),
      AuditLog.create({ companyId: user.companyId, actor: user.id, action: 'ticket.created', resource: 'ticket', resourceId: ticket.id }),
    ];
    if (assignee) {
      work.push(
        TicketHistory.create({ ticketId: ticket._id, actor: user.id, action: assignmentAction, to: { assignedTo: assignee._id, role: assignee.role, department: assignee.department } }),
        Notification.create({ userId: assignee._id, title: 'New ticket assigned', message: `${ticket.ticketNumber}: ${ticket.title}`, link: `/tickets/${ticket.id}` }),
        AuditLog.create({ companyId: user.companyId, actor: user.id, action: assignmentAction, resource: 'ticket', resourceId: ticket.id, metadata: { assignedTo: assignee.id, department } }),
      );
    }
    await Promise.all(work);
    return Ticket.findById(ticket._id).populate('createdBy assignedTo', 'name email role department');
  },
  async update(id: string, input: any, user: NonNullable<Express.Request['user']>) {
    const ticket = await Ticket.findOne({ _id: id, ...scoped(user) });
    if (!ticket) throw new AppError(404, 'Ticket not found');
    const managerial = MANAGER_ROLES.includes(user.role);
    const isCreator = ticket.createdBy.toString() === user.id;
    const isAssignee = ticket.assignedTo?.toString() === user.id;
    if (!managerial && !isCreator && !isAssignee) throw new AppError(403, 'Ticket cannot be changed');

    const transferring = Boolean(input.assignedTo && input.assignedTo !== ticket.assignedTo?.toString());
    let transferTarget = null;
    if (transferring) {
      if (!managerial && !isAssignee) throw new AppError(403, 'Only the current assignee or management can transfer this ticket', 'TRANSFER_FORBIDDEN');
      if (!mongoose.isValidObjectId(input.assignedTo)) throw new AppError(422, 'Invalid transfer assignee', 'INVALID_ASSIGNEE');
      if (input.assignedTo === user.id) throw new AppError(422, 'Choose another user for the transfer', 'INVALID_ASSIGNEE');
      const companyScope = user.companyId ? { companyId: user.companyId } : {};
      transferTarget = await User.findOne({ _id: input.assignedTo, isActive: true, ...companyScope });
      if (!transferTarget) throw new AppError(422, 'The selected transfer user is not active or available', 'INVALID_ASSIGNEE');
      input.department = transferTarget.department;
      input.status = 'assigned';
    }

    if (!transferring && !managerial && isAssignee && input.status && !['in_progress', 'pending', 'escalated', 'resolved'].includes(input.status)) throw new AppError(422, 'Assigned users can only start, pause, escalate, or resolve tickets', 'INVALID_STATUS');
    if (!managerial && isCreator && !isAssignee && !['open', 'resolved'].includes(ticket.status)) throw new AppError(403, 'Only the assigned handler can update work in progress');
    const allowed = managerial ? ['title','description','category','department','priority','status','assignedTo','dueDate'] : isAssignee ? ['status','assignedTo','department'] : ['title','description','feedback','status'];
    const before = ticket.toObject();
    for (const key of allowed) if (input[key] !== undefined) ticket.set(key, input[key]);
    if (input.status === 'resolved') ticket.resolvedAt = new Date();
    if (input.status === 'closed') ticket.closedAt = new Date();
    await ticket.save();
    const action = transferring ? 'ticket.reassigned' : 'ticket.updated';
    await TicketHistory.create({ ticketId: id, actor: user.id, action, from: before, to: ticket.toObject() });
    await AuditLog.create({ companyId: user.companyId, actor: user.id, action, resource: 'ticket', resourceId: ticket.id, metadata: transferring ? { from: before.assignedTo, assignedTo: ticket.assignedTo, department: ticket.department } : undefined });
    if (ticket.assignedTo) await Notification.create({ userId: ticket.assignedTo, title: transferring ? 'Ticket transferred to you' : 'Ticket updated', message: `${ticket.ticketNumber}: ${ticket.title}`, link: `/tickets/${id}` });
    return Ticket.findById(ticket._id).populate('createdBy assignedTo', 'name email role department');
  },
  async comment(id: string, body: string, internal: boolean, user: NonNullable<Express.Request['user']>) {
    const ticket = await Ticket.findOne({ _id: id, ...scoped(user) }); if (!ticket) throw new AppError(404, 'Ticket not found');
    const assignedHandler = ticket.assignedTo?.toString() === user.id;
    if (internal && user.role === 'employee' && !assignedHandler) throw new AppError(403, 'Internal comments require handler access');
    const comment = await TicketComment.create({ ticketId: id, author: user.id, body, internal });
    await TicketHistory.create({ ticketId: id, actor: user.id, action: internal ? 'comment.internal' : 'comment.public' });
    return TicketComment.findById(comment._id).populate('author', 'name role');
  },
};
