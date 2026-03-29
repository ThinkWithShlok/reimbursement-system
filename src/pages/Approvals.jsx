import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApprovals, useApprovalActions } from '../hooks/useApprovals';
import { CheckSquare, Clock, CheckCircle2, XCircle, Loader2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Approvals() {
  const { profile } = useAuth();
  const { approvals, loading, refetch } = useApprovals();
  const { actOnApproval } = useApprovalActions();
  const [acting, setActing] = useState(null);
  const [comments, setComments] = useState({});

  const pending = approvals.filter(a => a.status === 'pending');
  const completed = approvals.filter(a => a.status !== 'pending');

  async function handleAction(approvalId, action) {
    setActing(approvalId);
    try {
      await actOnApproval(approvalId, action, comments[approvalId] || '');
      refetch();
      toast.success(action === 'approved' ? 'Approved!' : 'Rejected');
    } catch (e) { toast.error(e.message); }
    finally { setActing(null); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-heading text-2xl">Approvals</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{pending.length} pending · {completed.length} completed</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>
      ) : pending.length === 0 && completed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CheckSquare size={28} /></div>
          <h3 className="text-heading text-lg mt-2">No approvals</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">You don't have any approval requests</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h3 className="text-label mb-4 flex items-center gap-2">
                <Clock size={14} /> Pending ({pending.length})
              </h3>
              <div className="space-y-3">
                {pending.map((a, i) => (
                  <div key={a.id} className="card animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Link to={`/expenses/${a.expense_id}`} className="font-semibold text-sm hover:underline">
                          {a.expenses?.description || a.expenses?.category?.replace('_', ' ') || 'Expense'}
                        </Link>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          By {a.expenses?.users?.full_name} · {a.workflow_stages?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-mono">{a.expenses?.currency} {Number(a.expenses?.amount || 0).toLocaleString()}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {a.expenses?.expense_date && new Date(a.expenses.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <input
                      type="text"
                      className="input-field text-sm mb-3"
                      placeholder="Add comment (optional)"
                      value={comments[a.id] || ''}
                      onChange={e => setComments(p => ({ ...p, [a.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(a.id, 'approved')} disabled={acting === a.id}
                        className="btn-primary flex-1 justify-center text-sm py-2" style={{ background: 'var(--color-success)' }}>
                        {acting === a.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                      </button>
                      <button onClick={() => handleAction(a.id, 'rejected')} disabled={acting === a.id}
                        className="btn-danger flex-1 justify-center text-sm py-2">
                        {acting === a.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h3 className="text-label mb-4">Completed ({completed.length})</h3>
              <div className="space-y-2">
                {completed.slice(0, 20).map(a => (
                  <Link key={a.id} to={`/expenses/${a.expense_id}`}
                    className="card card-hover flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${a.status === 'approved' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                      <div>
                        <p className="text-sm font-medium">{a.expenses?.description || a.expenses?.category?.replace('_', ' ')}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">by {a.expenses?.users?.full_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`status-chip status-${a.status}`}>{a.status}</span>
                      {a.acted_at && <p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(a.acted_at).toLocaleDateString()}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
