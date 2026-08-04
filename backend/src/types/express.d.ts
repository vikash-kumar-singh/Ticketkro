import type { Role } from '../constants/index.js';
declare global { namespace Express { interface Request { user?: { id: string; role: Role; companyId?: string }; } } }
export {};
