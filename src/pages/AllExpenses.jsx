import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { FileText, Search, Download } from 'lucide-react';

const statuses = ['all', 'draft', 'submitted', 'in_approval', 'approved', 'rejected'];
const categories = ['all', 'travel', 'food', 'accommodation', 'office_supplies', 'other'];

export default function AllExpenses() {
  const { profile } = useAuth();
  const { expenses, loading } = useExpenses({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = expenses.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.description?.toLowerCase().includes(q) || e.vendor?.toLowerCase().includes(q) ||
        e.users?.full_name?.toLowerCase().includes(q) || e.users?.email?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalAmount = filtered.reduce((s, e) => s + Number(e.converted_amount || e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-heading text-2xl">All Expenses</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            {filtered.length} expenses · {profile?.companies?.base_currency} {totalAmount.toLocaleString()} total
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input type="text" className="input-field pl-9" placeholder="Search by name, description..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Status' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
        </select>
        <select className="input-field w-auto" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><FileText size={28} /></div>
          <h3 className="text-heading text-lg mt-2">No expenses found</h3></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/expenses/${e.id}`} className="font-medium hover:underline">{e.users?.full_name}</Link>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{e.users?.email}</p>
                  </td>
                  <td>{e.description || '—'}</td>
                  <td><span className="capitalize text-xs">{e.category.replace('_', ' ')}</span></td>
                  <td className="text-mono font-semibold">{e.currency} {Number(e.amount).toLocaleString()}</td>
                  <td className="text-xs">{new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td><span className={`status-chip status-${e.status}`}>{e.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
