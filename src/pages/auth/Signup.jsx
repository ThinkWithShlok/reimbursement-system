import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCountriesWithCurrencies } from '../../lib/currency';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
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

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in-up">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-[var(--color-text-primary)] rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-display text-2xl">ExpenseFlow</span>
        </div>

        {/* Heading */}
        <h1 className="text-display text-3xl mb-2">Create your account</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          Set up your company and start tracking expenses
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-label block mb-2">Full Name</label>
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

          <div>
            <label className="text-label block mb-2">Company Name</label>
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

          <div>
            <label className="text-label block mb-2">Country</label>
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
            <div className="px-3 py-2 bg-[var(--color-surface-secondary)] rounded-lg text-sm animate-fade-in">
              <span className="text-[var(--color-text-tertiary)]">Base currency: </span>
              <span className="font-semibold">{form.baseCurrency}</span>
            </div>
          )}

          <div>
            <label className="text-label block mb-2">Email</label>
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

          <div>
            <label className="text-label block mb-2">Password</label>
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3 text-base mt-6"
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

        <p className="text-center text-sm text-[var(--color-text-tertiary)] mt-8">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-text-primary)] font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
