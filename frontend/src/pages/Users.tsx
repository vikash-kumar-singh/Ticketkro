import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { DEPARTMENTS } from '../constants';
import { useAuth } from '../store/auth';
import type { ApiResponse, Role, User } from '../types';

const roles: { value: Role; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' }, { value: 'company_admin', label: 'Company Admin' },
  { value: 'manager', label: 'Manager' }, { value: 'team_leader', label: 'Team Leader' },
  { value: 'hr', label: 'HR' }, { value: 'employee', label: 'Employee' },
];

function UserRow({ user }: { user: User }) {
  const currentUser = useAuth(s => s.user); const queryClient = useQueryClient();
  const [role, setRole] = useState(user.role); const [department, setDepartment] = useState(user.department || 'general');
  const update = useMutation({ mutationFn: (changes: Partial<User>) => api.patch<ApiResponse<User>>(`/users/${user.id}`, changes), onSuccess: response => { const saved = response.data.data; setRole(saved.role); setDepartment(saved.department); queryClient.invalidateQueries({ queryKey: ['users'] }); } });
  const changed = role !== user.role || department !== user.department; const isSelf = currentUser?.id === user.id;
  return <tr className="border-b border-slate-100 align-middle hover:bg-slate-50/70">
    <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-brand">{user.name.split(' ').map(v => v[0]).slice(0, 2).join('')}</div><div><p className="font-semibold">{user.name}{isSelf && <span className="ml-2 text-xs font-normal text-brand">You</span>}</p><p className="text-xs text-slate-500">{user.email}</p></div></div></td>
    <td className="px-4 py-4"><select className="field min-w-40" value={role} onChange={e => setRole(e.target.value as Role)} disabled={isSelf || update.isPending}>{roles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td>
    <td className="px-4 py-4"><select className="field min-w-40" value={department} onChange={e => setDepartment(e.target.value)} disabled={update.isPending}><option value="general">General</option>{DEPARTMENTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td>
    <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{user.isActive ? <UserCheck size={13} /> : <UserX size={13} />}{user.isActive ? 'Active' : 'Disabled'}</span></td>
    <td className="px-4 py-4"><div className="flex justify-end gap-2"><button className="btn-secondary px-3" disabled={isSelf || update.isPending} onClick={() => update.mutate({ isActive: !user.isActive })}>{user.isActive ? 'Disable' : 'Activate'}</button><button className="btn-primary px-3" disabled={!changed || update.isPending} onClick={() => update.mutate({ role, department })}><Check size={15} />{update.isPending ? 'Saving…' : 'Save'}</button></div>{update.isError && <p className="mt-1 text-right text-xs text-rose-600">{(update.error as any).response?.data?.error?.message || 'Update failed'}</p>}</td>
  </tr>;
}

export function Users() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: () => api.get<ApiResponse<User[]>>('/users').then(r => r.data.data) });
  const filtered = useMemo(() => data?.filter(user => `${user.name} ${user.email} ${user.role} ${user.department}`.toLowerCase().includes(search.toLowerCase())) || [], [data, search]);
  return <><div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-50 p-3 text-brand"><ShieldCheck /></div><div><h2 className="text-2xl font-bold">User management</h2><p className="text-slate-500">Assign roles, departments, and account access.</p></div></div><div className="card mt-6 p-0"><div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center"><label className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input className="field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" /></label><p className="text-sm text-slate-500">{filtered.length} user{filtered.length === 1 ? '' : 's'}</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{['User', 'Role', 'Department', 'Status', 'Actions'].map(item => <th key={item} className="px-4 py-3 font-semibold last:text-right">{item}</th>)}</tr></thead><tbody>{isLoading && [1, 2, 3].map(i => <tr key={i}><td colSpan={5} className="p-4"><div className="h-12 animate-pulse rounded bg-slate-100" /></td></tr>)}{filtered.map(user => <UserRow key={user.id} user={user} />)}</tbody></table>{isError && <p className="p-10 text-center text-rose-600">You do not have permission to manage users.</p>}{!isLoading && !isError && !filtered.length && <p className="p-10 text-center text-slate-500">No users match your search.</p>}</div></div></>;
}