/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkflows, useUsers } from '../hooks/useUsers';
import { Settings, Plus, Trash2, Star, X, Loader2, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Workflows() {
  const { workflows, loading, createWorkflow, addStage, setDefault, deleteWorkflow, deleteStage } = useWorkflows();
  const { users } = useUsers();
  const [showCreate, setShowCreate] = useState(false);
  const [showStageForm, setShowStageForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [stageForm, setStageForm] = useState({ name: '', approvalType: 'percentage', requiredPercentage: 100, approverIds: [], isManagerApprover: false });

  const approverOptions = users.filter(u => u.role === 'admin' || u.role === 'manager');

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true);
    try { await createWorkflow(newName); setShowCreate(false); setNewName(''); toast.success('Workflow created'); }
    catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function handleAddStage(workflowId) {
    setSaving(true);
    try {
      const wf = workflows.find(w => w.id === workflowId);
      const nextOrder = (wf?.workflow_stages?.length || 0) + 1;
      const finalName = stageForm.isManagerApprover ? 'Direct Manager [MANAGER_APPROVER]' : stageForm.name;
      await addStage(workflowId, { ...stageForm, name: finalName, stageOrder: nextOrder, approverIds: stageForm.isManagerApprover ? [] : stageForm.approverIds });
      setShowStageForm(null); setStageForm({ name: '', approvalType: 'percentage', requiredPercentage: 100, approverIds: [], isManagerApprover: false });
      toast.success('Stage added');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  function toggleApprover(userId) {
    setStageForm(prev => ({
      ...prev,
      approverIds: prev.approverIds.includes(userId)
        ? prev.approverIds.filter(id => id !== userId)
        : [...prev.approverIds, userId]
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-heading text-2xl">Workflows</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Configure approval workflows</p></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> New Workflow</button>
      </div>

      {loading ? <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>
      : workflows.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Settings size={28} /></div>
          <h3 className="text-heading text-lg mt-2">No workflows</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Create a workflow to define approval stages</p></div>
      ) : (
        <div className="space-y-4">
          {workflows.map(wf => (
            <div key={wf.id} className="card-elevated">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-heading text-base">{wf.name}</h3>
                  {wf.is_default && <span className="status-chip bg-[#0a0a0a] text-white"><Star size={10} /> Default</span>}
                </div>
                <div className="flex gap-2">
                  {!wf.is_default && <button onClick={() => setDefault(wf.id)} className="btn-ghost text-xs"><Star size={14} /> Set Default</button>}
                  <button onClick={() => deleteWorkflow(wf.id)} className="btn-ghost text-xs text-[var(--color-danger)]"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Stages */}
              <div className="space-y-2 mb-4">
                {wf.workflow_stages?.map((stage, i) => (
                  <div key={stage.id} className="flex items-center gap-3 p-3 bg-[var(--color-surface-secondary)] rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-text-primary)] text-white text-xs flex items-center justify-center font-bold">
                      {stage.stage_order}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{stage.name.replace(' [MANAGER_APPROVER]', '')}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {stage.approval_type} · {stage.required_percentage}% required ·{' '}
                        {stage.name.includes('[MANAGER_APPROVER]') ? 'Direct Manager' : `${stage.stage_approvers?.length || 0} approver(s)`}
                      </p>
                      {stage.stage_approvers?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {stage.stage_approvers.map(sa => (
                            <span key={sa.id} className="text-xs px-2 py-0.5 rounded bg-white border border-[var(--color-border)]">
                              {sa.users?.full_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {i < (wf.workflow_stages.length - 1) && <ChevronRight size={16} className="text-[var(--color-text-muted)]" />}
                    <button onClick={() => deleteStage(stage.id)} className="btn-ghost p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              {showStageForm === wf.id ? (
                <div className="p-4 border border-[var(--color-border)] rounded-lg space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" id="is-manager-approver" checked={stageForm.isManagerApprover} onChange={e => setStageForm({ ...stageForm, isManagerApprover: e.target.checked, name: e.target.checked ? 'Direct Manager' : '' })} />
                    <label htmlFor="is-manager-approver" className="text-sm font-semibold">Requires Direct Manager Approval First</label>
                  </div>
                  {!stageForm.isManagerApprover && (
                    <input type="text" className="input-field" placeholder="Stage name" value={stageForm.name} onChange={e => setStageForm({ ...stageForm, name: e.target.value })} />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <select className="input-field" value={stageForm.approvalType} onChange={e => setStageForm({ ...stageForm, approvalType: e.target.value })}>
                      <option value="percentage">Percentage</option><option value="specific">All Required</option><option value="hybrid">Hybrid</option>
                    </select>
                    <input type="number" className="input-field" placeholder="Required %" min={1} max={100} value={stageForm.requiredPercentage} onChange={e => setStageForm({ ...stageForm, requiredPercentage: parseInt(e.target.value) })} />
                  </div>
                  {!stageForm.isManagerApprover && (
                    <div>
                      <p className="text-label mb-2 flex items-center gap-1"><Users size={12} /> Approvers</p>
                      <div className="flex flex-wrap gap-2">
                        {approverOptions.map(u => (
                        <button key={u.id} type="button" onClick={() => toggleApprover(u.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${stageForm.approverIds.includes(u.id) ? 'bg-[var(--color-text-primary)] text-white border-[var(--color-text-primary)]' : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}`}>
                          {u.full_name}
                        </button>
                      ))}
                    </div>
                  </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleAddStage(wf.id)} disabled={saving || (!stageForm.isManagerApprover && (!stageForm.name || stageForm.approverIds.length === 0))} className="btn-primary text-sm">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : 'Add Stage'}
                    </button>
                    <button onClick={() => setShowStageForm(null)} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowStageForm(wf.id)} className="btn-secondary text-sm w-full justify-center">
                  <Plus size={14} /> Add Stage
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-heading text-lg">New Workflow</h3>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <input type="text" className="input-field mb-4" placeholder="Workflow name" value={newName} onChange={e => setNewName(e.target.value)} required />
              <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3">
                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Create Workflow'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
