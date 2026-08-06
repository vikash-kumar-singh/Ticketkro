export type Role='super_admin'|'company_admin'|'manager'|'team_leader'|'hr'|'employee';
export type User={id:string;_id?:string;name:string;email:string;role:Role;department:string;employeeCategory?:string;isActive:boolean;createdAt?:string};
export type Ticket={id:string;ticketNumber:string;title:string;description:string;category:string;department:string;priority:'low'|'medium'|'high'|'critical';status:'open'|'assigned'|'in_progress'|'pending'|'escalated'|'resolved'|'closed';createdBy:User;assignedTo?:User;createdAt:string;dueDate?:string};
export type ApiResponse<T>={success:boolean;data:T;message?:string;meta?:{page:number;pages:number;total:number;limit:number}};
