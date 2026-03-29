import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Receipt, PlusCircle, CheckSquare,
  Users, Settings, FileText, X, Zap
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee'] },
  { to: '/expenses', label: 'My Expenses', icon: Receipt, roles: ['admin', 'manager', 'employee'] },
  { to: '/expenses/new', label: 'New Expense', icon: PlusCircle, roles: ['admin', 'manager', 'employee'] },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare, roles: ['admin', 'manager'] },
  { divider: true },
  { to: '/all-expenses', label: 'All Expenses', icon: FileText, roles: ['admin'] },
  { to: '/users', label: 'Team', icon: Users, roles: ['admin'] },
  { to: '/workflows', label: 'Workflows', icon: Settings, roles: ['admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { profile } = useAuth();
  const location = useLocation();

  if (!profile) return null;

  const filteredItems = navItems.filter(
    item => item.divider || item.roles.includes(profile.role)
  );

  // Remove divider if it's first or last or consecutive
  const cleanItems = filteredItems.filter((item, i) => {
    if (!item.divider) return true;
    const prev = filteredItems[i - 1];
    const next = filteredItems[i + 1];
    return prev && !prev.divider && next && !next.divider;
  });

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[var(--color-text-primary)] rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-heading text-base">ExpenseFlow</span>
          </div>
          <button onClick={onClose} className="md:hidden btn-ghost p-1">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {cleanItems.map((item, i) => {
            if (item.divider) {
              return <div key={i} className="h-px bg-[var(--color-border)] my-3 mx-2" />;
            }

            const Icon = item.icon;
            const isActive = location.pathname === item.to ||
              (item.to === '/expenses' && location.pathname === '/expenses' && location.pathname !== '/expenses/new');

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Profile */}
        <div className="px-4 py-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-tertiary)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)]">
              {profile.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{profile.full_name}</p>
              <p className="text-xs text-[var(--color-text-tertiary)] capitalize">{profile.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
