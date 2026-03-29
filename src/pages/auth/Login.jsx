import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Zap, ArrowRight, Loader2, Shield, Users, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'employee' });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) throw error;

      // Update the user's role in the profile table
      if (data?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', data.user.id)
          .single();

        if (profile) {
          await supabase
            .from('users')
            .update({ role: form.role })
            .eq('id', profile.id);
        }
      }

      toast.success('Welcome back!');
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.message || 'Invalid email or password');
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
        <h1 className="text-display" style={{ fontSize: '1.75rem', marginBottom: '0.375rem' }}>Welcome back</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', marginBottom: '1.75rem' }}>
          Sign in to your account to continue
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} id="login-form-wrap">
          <div style={{ marginBottom: '1.125rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="you@company.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              id="login-email"
            />
          </div>

          <div style={{ marginBottom: '1.125rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              id="login-password"
            />
          </div>

          {/* Role Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Login as</label>
            <div style={{ display: 'flex', gap: '0.5rem' }} id="login-role-selector">
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
                    id={`login-role-${r.value}`}
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
            id="login-submit"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p style={{
          textAlign: 'center', fontSize: '0.875rem',
          color: 'var(--color-text-tertiary)', marginTop: '1.75rem'
        }}>
          Don&apos;t have an account?{' '}
          <Link to="/signup" style={{
            color: 'var(--color-text-primary)', fontWeight: 600, textDecoration: 'none'
          }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

