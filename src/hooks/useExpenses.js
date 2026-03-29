/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useExpenses(filters = {}) {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    let query = supabase
      .from('expenses')
      .select('*, users!expenses_user_id_fkey(full_name, email)')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch expenses:', error);
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  }, [profile, filters.userId, filters.status, filters.category]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return { expenses, loading, refetch: fetchExpenses };
}

export function useExpenseActions() {
  const { profile } = useAuth();

  async function createExpense(expenseData) {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        company_id: profile.company_id,
        user_id: profile.id,
        ...expenseData,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: profile.company_id,
      expense_id: data.id,
      user_id: profile.id,
      action: 'expense_created',
      details: { category: expenseData.category, amount: expenseData.amount },
    });

    return data;
  }

  async function updateExpense(id, updates) {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function submitExpense(expenseId) {
    // Get default workflow
    const { data: workflow } = await supabase
      .from('workflows')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (!workflow) throw new Error('No active workflow found');

    // Get first stage + approvers (include name for [MANAGER_APPROVER] detection)
    const { data: stages } = await supabase
      .from('workflow_stages')
      .select('id, name, stage_order, stage_approvers(user_id)')
      .eq('workflow_id', workflow.id)
      .order('stage_order', { ascending: true });

    if (!stages || stages.length === 0) throw new Error('Workflow has no stages');

    const firstStage = stages[0];

    let approvalInserts = [];
    if (profile.manager_id) {
      // Route specifically to the direct manager
      approvalInserts.push({
        expense_id: expenseId,
        stage_id: firstStage.id,
        approver_id: profile.manager_id,
        status: 'pending',
      });
    } else {
      // Fallback to Admin or explicitly configured stage approvers
      approvalInserts = firstStage.stage_approvers.map(sa => ({
        expense_id: expenseId,
        stage_id: firstStage.id,
        approver_id: sa.user_id,
        status: 'pending',
      }));
    }

    if (approvalInserts.length === 0) throw new Error('No approvers configured for first stage');

    const { error: approvalError } = await supabase
      .from('approvals')
      .insert(approvalInserts);

    if (approvalError) throw approvalError;

    // Update expense status
    const { error: updateError } = await supabase
      .from('expenses')
      .update({
        status: 'in_approval',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', expenseId);

    if (updateError) throw updateError;

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: profile.company_id,
      expense_id: expenseId,
      user_id: profile.id,
      action: 'expense_submitted',
    });
  }

  async function deleteExpense(id) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async function uploadReceipt(file, expenseId) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.company_id}/${expenseId || 'temp'}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath);

    return publicUrl;
  }

  return { createExpense, updateExpense, submitExpense, deleteExpense, uploadReceipt };
}
