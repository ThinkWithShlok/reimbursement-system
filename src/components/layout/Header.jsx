import { useAuth } from '../../context/AuthContext';
import { Menu, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/expenses': 'My Expenses',
  '/expenses/new': 'New Expense',
  '/approvals': 'Approvals',
  '/all-expenses': 'All Expenses',
  '/users': 'Team',
  '/workflows': 'Workflows',
};

export default function Header({ onMenuClick }) {
  const { signOut, company } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const title = pageTitles[location.pathname] || 'ExpenseFlow';
  
  // Handle expense detail pages
  const isExpenseDetail = location.pathname.match(/^\/expenses\/[a-f0-9-]+$/);
  const displayTitle = isExpenseDetail ? 'Expense Detail' : title;

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden btn-ghost p-2"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-heading text-xl">{displayTitle}</h1>
            {company && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {company.name} · {company.base_currency}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="btn-ghost text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
