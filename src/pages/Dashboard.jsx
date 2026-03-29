/* eslint-disable no-unused-vars */
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { useApprovals } from '../hooks/useApprovals';
import { Link } from 'react-router-dom';
import {
  Receipt, CheckSquare, Clock, TrendingUp,
  ArrowRight, PlusCircle, AlertCircle
} from 'lucide-react';
import gsap from 'gsap';

function StatCard({ label, value, icon: Icon, color, delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(ref.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, delay, ease: 'power3.out' }
      );
    }
  }, [delay]);

  return (
    <div ref={ref} className={`stat-card ${color === '#ffffff' ? 'card-green' : ''}`} style={{ opacity: 0 }}>
      <div className="flex items-center justify-between">
        <span className="text-label">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: color === '#ffffff' ? 'rgba(255,255,255,0.2)' : color + '15', color: color === '#ffffff' ? '#ffffff' : color }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function RecentExpenseRow({ expense }) {
  const statusColors = {
    draft: 'var(--color-draft)',
    submitted: 'var(--color-submitted)',
    in_approval: 'var(--color-in-approval)',
    approved: 'var(--color-approved)',
    rejected: 'var(--color-rejected)',
  };

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className="flex items-center justify-between py-4 px-6 rounded-xl hover:bg-[var(--color-surface-secondary)] transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-2 h-2 rounded-full" style={{ background: statusColors[expense.status] }} />
        <div>
          <p className="text-sm font-medium">{expense.description || expense.category}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {expense.users && ` · ${expense.users.full_name}`}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-mono">
          {expense.currency} {Number(expense.amount).toLocaleString()}
        </p>
        <p className="text-xs capitalize text-[var(--color-text-tertiary)]">
          {expense.status.replace('_', ' ')}
        </p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { profile, isAdmin, isManager } = useAuth();
  const { expenses, loading: expLoading } = useExpenses(
    isAdmin ? {} : { userId: profile?.id }
  );
  const { approvals, loading: appLoading } = useApprovals();

  const titleRef = useRef(null);

  useEffect(() => {
    if (titleRef.current) {
      gsap.fromTo(titleRef.current,
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' }
      );
    }
  }, []);

  if (!profile) return null;

  const myExpenses = expenses.filter(e => e.user_id === profile.id);
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const totalSpent = myExpenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.converted_amount || e.amount), 0);
  const pendingAmount = myExpenses
    .filter(e => ['submitted', 'in_approval'].includes(e.status))
    .reduce((sum, e) => sum + Number(e.converted_amount || e.amount), 0);

  const recentExpenses = (isAdmin ? expenses : myExpenses).slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div ref={titleRef} style={{ opacity: 0 }}>
        <h2 className="text-display text-4xl md:text-5xl mb-2">
          {getGreeting()},<br />
          <span className="text-[var(--color-text-tertiary)]">{profile.full_name?.split(' ')[0]}</span>
        </h2>
        <p className="text-[var(--color-text-secondary)] mt-3">
          Here's your expense overview for today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Approved"
          value={`${profile.companies?.base_currency || ''} ${totalSpent.toLocaleString()}`}
          icon={TrendingUp}
          color="#ffffff"
          delay={0.1}
        />
        <StatCard
          label="Pending Amount"
          value={`${profile.companies?.base_currency || ''} ${pendingAmount.toLocaleString()}`}
          icon={Clock}
          color="#f59e0b"
          delay={0.15}
        />
        <StatCard
          label="My Expenses"
          value={myExpenses.length}
          icon={Receipt}
          color="#3b82f6"
          delay={0.2}
        />
        {(isAdmin || isManager) && (
          <StatCard
            label="Pending Approvals"
            value={pendingApprovals.length}
            icon={CheckSquare}
            color="#ef4444"
            delay={0.25}
          />
        )}
      </div>

      {/* Quick Actions + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="space-y-4 animate-fade-in-up stagger-3">
          <h3 className="text-heading text-lg">Quick Actions</h3>
          <Link
            to="/expenses/new"
            className="card card-hover flex items-center gap-4 p-4"
            id="quick-new-expense"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--color-text-primary)] flex items-center justify-center">
              <PlusCircle size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">New Expense</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">Submit a new claim</p>
            </div>
            <ArrowRight size={16} className="text-[var(--color-text-muted)]" />
          </Link>

          {(isAdmin || isManager) && pendingApprovals.length > 0 && (
            <Link
              to="/approvals"
              className="card card-hover flex items-center gap-4 p-4 border-[var(--color-warning)]"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-light)] flex items-center justify-center">
                <AlertCircle size={18} className="text-[var(--color-warning)]" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Review Approvals</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {pendingApprovals.length} pending
                </p>
              </div>
              <ArrowRight size={16} className="text-[var(--color-text-muted)]" />
            </Link>
          )}
        </div>

        {/* Recent Expenses */}
        <div className="lg:col-span-2 animate-fade-in-up stagger-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-heading text-lg">Recent Expenses</h3>
            <Link to="/expenses" className="btn-ghost text-xs">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="card">
            {expLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner" />
              </div>
            ) : recentExpenses.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <Receipt size={24} />
                </div>
                <p className="text-sm text-[var(--color-text-tertiary)]">No expenses yet</p>
                <Link to="/expenses/new" className="btn-primary mt-4 text-sm">
                  Create your first expense
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {recentExpenses.map(exp => (
                  <RecentExpenseRow key={exp.id} expense={exp} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
