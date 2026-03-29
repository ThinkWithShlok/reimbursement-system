import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    let userRes;
    try {
      // Step 1: Attempt to sign in
      userRes = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (userRes.error && userRes.error.message.includes('Invalid login credentials')) {
        // Step 2: Auto Sign-Up for seamless Hackathon demo flow
        toast.loading('Provisioning new account...', { id: 'auth' });
        try {
          const signRes = await signUp({
            email: form.email,
            password: form.password,
            fullName: form.name || 'Demo User',
            companyName: `${form.name || form.email} Demo Corp`,
            country: 'US',
            baseCurrency: 'USD'
          });
          userRes = { data: signRes, error: null };
          toast.success('Account auto-provisioned!', { id: 'auth' });
        } catch (signupErr) {
          throw signupErr;
        }
      } else if (userRes.error) {
        throw userRes.error;
      } else {
        toast.success('Welcome back!');
      }

      // Hackathon requirement: Try to gracefully update the target role selected in the UI
      if (userRes.data?.user) {
        const { data: profile } = await supabase.from('users').select('id, role').eq('auth_id', userRes.data.user.id).single();
        if (profile) {
          // Attempt an override update - this seamlessly updates the role if DB policies allow
          // For admins, this will freely swap their roles for easy demo testing.
          await supabase.from('users').update({ 
            full_name: form.name || profile.full_name,
            role: form.role 
          }).eq('id', profile.id);
        }
      }

      // Hard refresh to sync all global context caches with the possibly new roles
      window.location.href = '/dashboard';
      
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
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
          <span className="text-display text-2xl">ExpenseFlow Login</span>
        </div>

        {/* Heading */}
        <h1 className="text-display text-3xl mb-2">Hackathon Demo Login</h1>
        <p className="text-[var(--color-text-secondary)] mb-6">
          Seamlessly login or auto-provision your test account
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" id="login-form-wrap">
          <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border)]">
             <button type="button" onClick={() => setForm({ name: 'Adam Admin', email: 'admin.dev@expense.com', password: 'password123', role: 'admin' })} className="btn-secondary text-[11px] justify-center py-1.5 border-none shadow-sm">Demo Admin</button>
             <button type="button" onClick={() => setForm({ name: 'Maria Manager', email: 'manager.dev@expense.com', password: 'password123', role: 'manager' })} className="btn-secondary text-[11px] justify-center py-1.5 border-none shadow-sm">Demo Manager</button>
             <button type="button" onClick={() => setForm({ name: 'Ethan Employee', email: 'employee.dev@expense.com', password: 'password123', role: 'employee' })} className="btn-secondary text-[11px] justify-center py-1.5 border-none shadow-sm">Demo Employee</button>
          </div>
          <div>
            <label className="text-label block mb-2">Full Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Your Name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              id="login-name"
            />
          </div>

          <div>
            <label className="text-label block mb-2">Email</label>
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

          <div>
            <label className="text-label block mb-2">Password</label>
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

          <div>
            <label className="text-label block mb-2">Login Role</label>
            <select
              className="input-field"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              required
              id="login-role"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3 text-base mt-6"
            id="login-submit"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Login
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-tertiary)] mt-8">
          If account doesn't exist, it will instantly auto-provision.
        </p>
      </div>
    </div>
  );
}
