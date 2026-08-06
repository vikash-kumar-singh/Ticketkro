import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api/client';
import { DEPARTMENTS } from '../constants';
import type { ApiResponse, Ticket, User } from '../types';

const schema = z.object({
  title: z.string().min(3), description: z.string().min(5), category: z.string().min(1),
  department: z.string().optional(), assignedTo: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']), dueDate: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function NewTicket() {
  const navigate = useNavigate(); const [submitError, setSubmitError] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { priority: 'medium', department: '', assignedTo: '' } });
  const department = watch('department');
  const { data: assignees = [], isFetching } = useQuery({
    queryKey: ['assignees', department],
    queryFn: () => api.get<ApiResponse<User[]>>('/assignees', { params: { department } }).then(r => r.data.data),
    enabled: !!department,
  });
  useEffect(() => { setValue('assignedTo', ''); }, [department, setValue]);
  const submit = async (data: Form) => {
    setSubmitError('');
    try { const response = await api.post<ApiResponse<Ticket>>('/tickets', data); navigate(`/tickets/${response.data.data.id}`); }
    catch (error: any) { setSubmitError(error.response?.data?.error?.message || 'Unable to create ticket'); }
  };
  return <div className="mx-auto max-w-3xl"><div className="mb-7"><h2 className="text-2xl font-bold">Raise a ticket</h2><p className="text-slate-500">Select the right department and optionally assign a specific person.</p></div><form className="card space-y-5" onSubmit={handleSubmit(submit)}>
    {submitError && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>}
    <label><span className="label">Title</span><input className="field" {...register('title')} placeholder="Briefly describe the request" /><Error text={errors.title?.message} /></label>
    <label><span className="label">Description</span><textarea className="field min-h-36 resize-y" {...register('description')} placeholder="What happened, what did you expect, and who is affected?" /><Error text={errors.description?.message} /></label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label><span className="label">Category</span><select className="field capitalize" {...register('category')}><option value="">Select category</option>{['it','hr','payroll','marketing','sales','software','hardware','leave','security','other'].map(value => <option key={value} value={value}>{value}</option>)}</select><Error text={errors.category?.message} /></label>
      <label><span className="label">Priority</span><select className="field capitalize" {...register('priority')}>{['low','medium','high','critical'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span className="label">Department</span><select className="field" {...register('department')}><option value="">Auto-route from category</option>{DEPARTMENTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="mt-1 text-xs text-slate-400">Choose a department to select a specific assignee.</p></label>
      <label><span className="label">Assign to (optional)</span><select className="field" {...register('assignedTo')} disabled={!department || isFetching}><option value="">{!department ? 'Select a department first' : isFetching ? 'Loading people…' : assignees.length ? 'Super Admin fallback' : 'No active people found'}</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name} — {person.role.replace('_', ' ')}</option>)}</select><p className="mt-1 text-xs text-slate-400">If left empty, the ticket goes to the Super Admin.</p></label>
      <label><span className="label">Due date (optional)</span><input className="field" type="date" {...register('dueDate')} /></label>
    </div>
    <div className="flex justify-end gap-3 border-t pt-5"><button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button><button disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Creating…' : 'Create ticket'}</button></div>
  </form></div>;
}
function Error({ text }: { text?: string }) { return text ? <small className="mt-1 block text-rose-600">{text}</small> : null; }