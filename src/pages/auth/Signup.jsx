import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCountriesWithCurrencies } from '../../lib/currency';
import { Zap, ArrowRight, Loader2, Shield, Users, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
    country: '',
    baseCurrency: '',
    role: 'employee',
  });

  useEffect(() => {
    getCountriesWithCurrencies().then(setCountries);
  }, []);

  function handleCountryChange(e) {
    const country = e.target.value;
    const selected = countries.find(c => c.name === country);
    setForm({
      ...form,
      country,
      baseCurrency: selected?.currencyCode || '',
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.baseCurrency) {
      toast.error('Please select a country');
      return;
    }
    setLoading(true);
    try {
      await signUp(form);
      toast.success('Account created! Welcome to ExpenseFlow.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  const roles = [
    { value: 'admin', label: 'Admin', icon: Shield },
    { value: 'manager', label: 'Manager', icon: Users },
    { value: 'employee', label: 'Employee', icon: Briefcase },
  ];

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in-up">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{
            width: 42, height: 42,
            background: 'var(--color-text-primary)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={20} color="#fff" />
          </div>
          <span className="text-display" style={{ fontSize: '1.5rem' }}>ExpenseFlow</span>
        </div>

        {/* Heading */}
        <h1 className="text-display" style={{ fontSize: '1.75rem', marginBottom: '0.375rem' }}>Create your account</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', marginBottom: '1.75rem' }}>
          Set up your company and start tracking expenses
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Full Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Your name"
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              required
              id="signup-name"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Company Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Acme Inc."
              value={form.companyName}
              onChange={e => setForm({ ...form, companyName: e.target.value })}
              required
              id="signup-company"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Country</label>
            <select
              className="input-field"
              value={form.country}
              onChange={handleCountryChange}
              required
              id="signup-country"
            >
              <option value="">Select country...</option>
              {countries.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.currencyCode})
                </option>
              ))}
            </select>
          </div>

          {form.baseCurrency && (
            <div style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--color-surface-secondary)',
              borderRadius: 8,
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>Base currency: </span>
              <span style={{ fontWeight: 600 }}>{form.baseCurrency}</span>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="you@company.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              id="signup-email"
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              id="signup-password"
            />
          </div>

          {/* Role Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Sign up as</label>
            <div style={{ display: 'flex', gap: '0.5rem' }} id="signup-role-selector">
              {roles.map(r => {
                const Icon = r.icon;
                const isActive = form.role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className="role-card"
                    data-active={isActive}
                    id={`signup-role-${r.value}`}
                  >
                    <Icon size={18} style={{ marginBottom: 2 }} />
                    <span className="role-card-label">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem' }}
            id="signup-submit"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Create Account
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p style={{
          textAlign: 'center', fontSize: '0.875rem',
          color: 'var(--color-text-tertiary)', marginTop: '1.75rem'
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{
            color: 'var(--color-text-primary)', fontWeight: 600, textDecoration: 'none'
          }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
