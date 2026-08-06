export const ROLES = ['super_admin', 'company_admin', 'manager', 'team_leader', 'hr', 'employee'] as const;
export type Role = typeof ROLES[number];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const STATUSES = ['open', 'assigned', 'in_progress', 'pending', 'escalated', 'resolved', 'closed'] as const;
export const CATEGORIES = ['it', 'hr', 'payroll', 'marketing', 'sales', 'software', 'hardware', 'leave', 'security', 'other'] as const;
export const DEPARTMENTS = ['sales', 'finance', 'hr', 'it', 'marketing', 'general'] as const;
export const MANAGER_ROLES: Role[] = ['super_admin', 'company_admin', 'manager', 'team_leader', 'hr'];
