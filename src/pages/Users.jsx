import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { Users as UsersIcon, Plus, Edit2, X, Loader2, Shield, UserCheck, User } from 'lucide-react';
import toast from 'react-hot-toast';

const roleIcons = { admin: Shield, manager: UserCheck, employee: User };

export default function UsersPage() {
  const { profile } = useAuth();
  const { users, loading, createUser, updateUser } = useUsers();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'employee', managerId: '' });

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  function openCreate() {
    setForm({ email: '', fullName: '', role: 'employee', managerId: '' });
    setEditingId(null); setShowForm(true);
  }

  function openEdit(user) {
    setForm({ email: user.email, fullName: user.full_name, role: user.role, managerId: user.manager_id || '' });
    setEditingId(user.id); setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (editingId) {
        await updateUser(editingId, { full_name: form.fullName, role: form.role, manager_id: form.managerId || null });
        toast.success('User updated');
      } else {
        await createUser(form);
        toast.success('User created');
      }
      setShowForm(false);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-heading text-2xl">Team</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{users.length} members</p>
        </div>
        <button onClick={openCreate} className="btn-primary" id="btn-add-user"><Plus size={18} /> Add Member</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="space-y-3">
          {users.map((u, i) => {
            const RoleIcon = roleIcons[u.role] || User;
            const mgr = users.find(m => m.id === u.manager_id);
            return (
              <div key={u.id} className="card flex items-center justify-between animate-fade-in-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-tertiary)] flex items-center justify-center text-sm font-bold text-[var(--color-text-secondary)]">
                    {u.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{u.full_name}</p>
                      <span className={`status-chip ${u.role === 'admin' ? 'bg-[#0a0a0a] text-white' : u.role === 'manager' ? 'bg-[var(--color-info-light)] text-[var(--color-info)]' : 'status-draft'}`}>
                        <RoleIcon size={10} /> {u.role}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{u.email}{mgr ? ` · Reports to ${mgr.full_name}` : ''}</p>
                  </div>
                </div>
                {u.id !== profile?.id && (
                  <button onClick={() => openEdit(u)} className="btn-ghost"><Edit2 size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-heading text-lg">{editingId ? 'Edit Member' : 'Add Member'}</h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {!editingId && (
                <div><label className="text-label block mb-2">Email</label>
                  <input type="email" className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required id="user-email" /></div>
              )}
              <div><label className="text-label block mb-2">Full Name</label>
                <input type="text" className="input-field" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required id="user-name" /></div>
              <div><label className="text-label block mb-2">Role</label>
                <select className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} id="user-role">
                  <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                </select></div>
              <div><label className="text-label block mb-2">Reports To</label>
                <select className="input-field" value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })} id="user-manager">
                  <option value="">None</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>)}
                </select></div>
              <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3 mt-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : (editingId ? 'Save Changes' : 'Add Member')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
