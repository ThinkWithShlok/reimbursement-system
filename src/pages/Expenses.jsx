import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { Receipt, Plus, Filter, Search } from 'lucide-react';

const categories = ['all', 'travel', 'food', 'accommodation', 'office_supplies', 'other'];
const statuses = ['all', 'draft', 'submitted', 'in_approval', 'approved', 'rejected'];

export default function Expenses() {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { expenses, loading } = useExpenses({ userId: profile?.id });

  const filtered = expenses.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.description?.toLowerCase().includes(q) ||
        e.vendor?.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-heading text-2xl">My Expenses</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            {expenses.length} total · {expenses.filter(e => e.status === 'draft').length} drafts
          </p>
        </div>
        <Link to="/expenses/new" className="btn-primary" id="btn-new-expense">
          <Plus size={20} />
          New Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-center gap-6 mt-12 mb-10">
        <div className="relative w-full sm:flex-1 min-w-[300px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            className="input-field pl-12 py-4 shadow-sm"
            placeholder="Search expenses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="expense-search"
          />
        </div>

        <select
          className="input-field w-full sm:w-auto py-4 shadow-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          id="filter-status"
        >
          {statuses.map(s => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Status' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>

        <select
          className="input-field w-auto"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          id="filter-category"
        >
          {categories.map(c => (
            <option key={c} value={c}>
              {c === 'all' ? 'All Categories' : c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Expense List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner spinner-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Receipt size={28} />
          </div>
          <h3 className="text-heading text-lg mt-2">No expenses found</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            {expenses.length === 0 ? "You haven't created any expenses yet" : 'Try adjusting your filters'}
          </p>
          {expenses.length === 0 && (
            <Link to="/expenses/new" className="btn-primary mt-4">
              <Plus size={16} /> Create Expense
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((expense, i) => (
            <ExpenseRow key={expense.id} expense={expense} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseRow({ expense, index }) {
  const categoryIcons = {
    travel: '✈️',
    food: '🍽️',
    accommodation: '🏨',
    office_supplies: '📎',
    other: '📦',
  };

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className="card card-hover flex items-center gap-5 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.04}s` }}
      id={`expense-row-${expense.id}`}
    >
      <div className="text-2xl">{categoryIcons[expense.category] || '📦'}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">
            {expense.description || expense.category.replace('_', ' ')}
          </p>
          <span className={`status-chip status-${expense.status}`}>
            {expense.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
          {new Date(expense.expense_date).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
          })}
          {expense.vendor && ` · ${expense.vendor}`}
        </p>
      </div>

      <div className="text-right">
        <p className="font-bold text-mono text-base">
          {expense.currency} {Number(expense.amount).toLocaleString()}
        </p>
        {expense.converted_amount && expense.currency !== expense.base_currency && (
          <p className="text-xs text-[var(--color-text-tertiary)]">
            ≈ {expense.base_currency} {Number(expense.converted_amount).toLocaleString()}
          </p>
        )}
      </div>
    </Link>
  );
}
