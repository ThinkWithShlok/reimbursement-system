/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(authId) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('auth_id', authId)
        .single();

      if (profileError) {
        console.error('Failed to fetch profile:', profileError);
        return;
      }

      setProfile(profileData);
      setCompany(profileData.companies);
    } catch (err) {
      console.error('Profile fetch error:', err);
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          // Small delay to allow trigger to complete
          if (event === 'SIGNED_IN') {
            setTimeout(() => fetchProfile(s.user.id), 500);
          } else {
            fetchProfile(s.user.id);
          }
        } else {
          setProfile(null);
          setCompany(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signUp({ email, password, fullName, companyName, country, baseCurrency, role }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
          country,
          base_currency: baseCurrency,
          role: role || 'employee',
        },
      },
    });

    if (error) throw error;

    // Wait for trigger then fetch profile and update role
    if (data.user) {
      await new Promise(r => setTimeout(r, 1000));
      // Update the role in the users table
      if (role) {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', data.user.id)
          .single();
        if (profile) {
          await supabase.from('users').update({ role }).eq('id', profile.id);
        }
      }
      await fetchProfile(data.user.id);
    }

    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setCompany(null);
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  const value = {
    session,
    user,
    profile,
    company,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
    isEmployee: profile?.role === 'employee',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
