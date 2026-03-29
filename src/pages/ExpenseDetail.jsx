import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useExpenseActions } from '../hooks/useExpenses';
import { useExpenseApprovals, useApprovalActions } from '../hooks/useApprovals';
import { ArrowLeft, Send, Trash2, Clock, CheckCircle2, XCircle, MessageSquare, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const categoryLabels = {
  travel: '✈️ Travel', food: '🍽️ Food & Dining', accommodation: '🏨 Accommodation',
  office_supplies: '📎 Office Supplies', other: '📦 Other',
};

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export default function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { submitExpense, deleteExpense } = useExpenseActions();
  const { approvals, loading: appLoading, refetch: refetchApprovals } = useExpenseApprovals(id);
  const { actOnApproval, adminOverrideExpense } = useApprovalActions();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    supabase.from('expenses').select('*, users!expenses_user_id_fkey(full_name, email)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) { toast.error('Expense not found'); navigate('/expenses'); return; }
        setExpense(data); setLoading(false);
      });
  }, [id, navigate]);

  async function handleSubmit() {
    setActing(true);
    try {
      await submitExpense(id);
      setExpense(p => ({ ...p, status: 'in_approval', submitted_at: new Date().toISOString() }));
      refetchApprovals(); toast.success('Submitted for approval');
    } catch (e) { toast.error(e.message); } finally { setActing(false); }
  }

  async function handleDelete() {
    if (!confirm('Delete this expense?')) return;
    try { await deleteExpense(id); toast.success('Deleted'); navigate('/expenses'); } catch (e) { toast.error(e.message); }
  }

  async function handleApproval(approvalId, action) {
    setActing(true);
    try {
      await actOnApproval(approvalId, action, comment);
      refetchApprovals();
      const { data } = await supabase.from('expenses').select('*, users!expenses_user_id_fkey(full_name, email)').eq('id', id).single();
      if (data) setExpense(data);
      setComment(''); toast.success(action === 'approved' ? 'Approved!' : 'Rejected');
    } catch (e) { toast.error(e.message); } finally { setActing(false); }
  }

  async function handleAdminOverride(action) {
    if (!confirm(`Are you sure you want to FORCE ${action.toUpperCase()} this expense? This bypasses the workflow.`)) return;
    setActing(true);
    try {
      await adminOverrideExpense(id, action, comment);
      refetchApprovals();
      const { data } = await supabase.from('expenses').select('*, users!expenses_user_id_fkey(full_name, email)').eq('id', id).single();
      if (data) setExpense(data);
      setComment(''); toast.success(`Admin Override: ${action.toUpperCase()}`);
    } catch (e) { toast.error(e.message); } finally { setActing(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="spinner spinner-lg" /></div>;
  if (!expense) return null;

  const isOwner = expense.user_id === profile?.id;
  const canSubmit = isOwner && expense.status === 'draft';
  const canDelete = (isOwner && expense.status === 'draft') || isAdmin;
  const myPending = approvals.filter(a => a.approver_id === profile?.id && a.status === 'pending');

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="btn-ghost mb-6 -ml-3"><ArrowLeft size={18} /> Back</button>
      <div className="animate-fade-in-up">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`status-chip status-${expense.status}`}>{expense.status.replace('_', ' ')}</span>
              <span className="text-label">{categoryLabels[expense.category]}</span>
            </div>
            <h2 className="text-display text-3xl">{expense.currency} {Number(expense.amount).toLocaleString()}</h2>
            {expense.converted_amount && expense.currency !== expense.base_currency && (
              <p className="text-[var(--color-text-secondary)] mt-1">≈ {expense.base_currency} {Number(expense.converted_amount).toLocaleString()}
                <span className="text-xs text-[var(--color-text-tertiary)] ml-2">Rate: {expense.exchange_rate}</span></p>
            )}
          </div>
          <div className="flex gap-2">
            {canSubmit && <button onClick={handleSubmit} disabled={acting} className="btn-primary" id="btn-submit-expense">{acting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit</button>}
            {canDelete && <button onClick={handleDelete} className="btn-danger" id="btn-delete-expense"><Trash2 size={16} /></button>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card"><h3 className="text-label mb-4">Details</h3>
            <div className="space-y-3">
              <DetailRow label="Description" value={expense.description || '—'} />
              <DetailRow label="Vendor" value={expense.vendor || '—'} />
              <DetailRow label="Date" value={new Date(expense.expense_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
              <DetailRow label="Submitted by" value={expense.users?.full_name || '—'} />
              {expense.submitted_at && <DetailRow label="Submitted at" value={new Date(expense.submitted_at).toLocaleString()} />}
            </div>
          </div>
          <div className="card"><h3 className="text-label mb-4">Receipt</h3>
            {expense.receipt_url ? (<div><img src={expense.receipt_url} alt="Receipt" className="w-full max-h-48 object-contain rounded-lg bg-[var(--color-surface-secondary)] mb-3" />
              <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs"><ExternalLink size={14} /> View full</a></div>
            ) : <div className="flex items-center justify-center py-10 text-[var(--color-text-muted)]"><p className="text-sm">No receipt</p></div>}
          </div>
        </div>

        <div className="card-elevated">
          <h3 className="text-heading text-base mb-6">Approval Timeline</h3>
          {appLoading ? <div className="flex justify-center py-8"><div className="spinner" /></div>
          : approvals.length === 0 ? <p className="text-sm text-[var(--color-text-tertiary)] py-4">{expense.status === 'draft' ? 'Submit to start approval' : 'No records'}</p>
          : <div className="timeline">{approvals.map(a => (
              <div key={a.id} className="timeline-item">
                <div className={`timeline-dot ${a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'warning'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{a.users?.full_name || 'Unknown'}</span>
                    <span className={`status-chip status-${a.status}`}>{a.status}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{a.workflow_stages?.name} · Stage {a.workflow_stages?.stage_order}</p>
                  {a.comment && <div className="flex items-start gap-2 mt-2 p-2 bg-[var(--color-surface-secondary)] rounded-lg"><MessageSquare size={12} className="text-[var(--color-text-tertiary)] mt-0.5" /><p className="text-xs">{a.comment}</p></div>}
                  {a.acted_at && <p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(a.acted_at).toLocaleString()}</p>}
                </div>
              </div>
            ))}</div>}

          {myPending.length > 0 ? (
            <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
              <h4 className="text-heading text-sm mb-3">Your Action Required</h4>
              <textarea className="input-field mb-3" rows={2} placeholder="Comment (optional)" value={comment} onChange={e => setComment(e.target.value)} id="approval-comment" />
              <div className="flex gap-2">
                <button onClick={() => handleApproval(myPending[0].id, 'approved')} disabled={acting} className="btn-primary flex-1 justify-center" style={{ background: 'var(--color-success)' }} id="btn-approve">{acting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve</button>
                <button onClick={() => handleApproval(myPending[0].id, 'rejected')} disabled={acting} className="btn-danger flex-1 justify-center" id="btn-reject">{acting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject</button>
              </div>
            </div>
          ) : isAdmin && expense.status === 'in_approval' ? (
            <div className="mt-6 pt-6 border-t border-[var(--color-border)] bg-[var(--color-warning-light)] -mx-8 px-8 pb-4 rounded-b-2xl">
              <h4 className="text-heading text-sm mb-3 text-[var(--color-warning)] pt-2">Admin Override</h4>
              <textarea className="input-field mb-3 bg-white" rows={2} placeholder="Override Reason (optional)" value={comment} onChange={e => setComment(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => handleAdminOverride('approved')} disabled={acting} className="btn-primary flex-1 justify-center" style={{ background: 'var(--color-success)' }}>Force Approve</button>
                <button onClick={() => handleAdminOverride('rejected')} disabled={acting} className="btn-danger flex-1 justify-center">Force Reject</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
