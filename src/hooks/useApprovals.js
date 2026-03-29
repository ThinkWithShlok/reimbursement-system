/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useApprovals() {
  const { profile } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('approvals')
      .select(`
        *,
        expenses(*, users!expenses_user_id_fkey(full_name, email)),
        workflow_stages(name, stage_order, workflow_id, approval_type, required_percentage)
      `)
      .eq('approver_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch approvals:', error);
    } else {
      setApprovals(data || []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  return { approvals, loading, refetch: fetchApprovals };
}

export function useApprovalActions() {
  const { profile } = useAuth();

  async function actOnApproval(approvalId, action, comment = '') {
    // Update approval record
    const { data: approval, error } = await supabase
      .from('approvals')
      .update({
        status: action, // 'approved' or 'rejected'
        comment,
        acted_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .select('*, workflow_stages(*, workflows(id)), expenses(*)')
      .single();

    if (error) throw error;

    const expense = approval.expenses;
    const stage = approval.workflow_stages;

    if (action === 'rejected') {
      // Reject the entire expense
      await supabase
        .from('expenses')
        .update({ status: 'rejected' })
        .eq('id', expense.id);

      // Cancel other pending approvals for this expense
      await supabase
        .from('approvals')
        .update({ status: 'rejected', acted_at: new Date().toISOString() })
        .eq('expense_id', expense.id)
        .eq('status', 'pending');

    } else if (action === 'approved') {
      // Check if stage is complete
      const { data: stageApprovals } = await supabase
        .from('approvals')
        .select('*')
        .eq('expense_id', expense.id)
        .eq('stage_id', stage.id);

      const total = stageApprovals.length;
      const approved = stageApprovals.filter(a => a.status === 'approved').length;
      const percentage = Math.round((approved / total) * 100);

      const stageComplete = (
        stage.approval_type === 'percentage' && percentage >= stage.required_percentage
      ) || (
        stage.approval_type === 'specific' && approved === total
      ) || (
        stage.approval_type === 'hybrid' && (percentage >= stage.required_percentage || approved === total)
      );

      if (stageComplete) {
        // Check for next stage
        const { data: nextStages } = await supabase
          .from('workflow_stages')
          .select('id, name, stage_approvers(user_id)')
          .eq('workflow_id', stage.workflows.id)
          .gt('stage_order', stage.stage_order)
          .order('stage_order', { ascending: true })
          .limit(1);

        if (nextStages && nextStages.length > 0) {
          const nextStage = nextStages[0];
          
          let nextApprovals = [];
          if (nextStage.name?.includes('[MANAGER_APPROVER]')) {
             const { data: submitter } = await supabase.from('users').select('manager_id').eq('id', expense.user_id).single();
             if (submitter?.manager_id) {
               nextApprovals.push({ expense_id: expense.id, stage_id: nextStage.id, approver_id: submitter.manager_id, status: 'pending' });
             } else {
               console.error("No manager assigned to this user, workflow stalled.");
             }
          } else {
             nextApprovals = nextStage.stage_approvers.map(sa => ({
               expense_id: expense.id,
               stage_id: nextStage.id,
               approver_id: sa.user_id,
               status: 'pending',
             }));
          }

          if (nextApprovals.length > 0) {
            await supabase.from('approvals').insert(nextApprovals);
          }
        } else {
          // No more stages — approve the expense
          await supabase
            .from('expenses')
            .update({ status: 'approved' })
            .eq('id', expense.id);
        }
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: profile.company_id,
      expense_id: expense.id,
      user_id: profile.id,
      action: `approval_${action}`,
      details: { comment, stage_name: stage.name },
    });
  }

  async function adminOverrideExpense(expenseId, action, comment = '') {
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    // Update expense directly
    const { error: updateError } = await supabase
      .from('expenses')
      .update({ status: action })
      .eq('id', expenseId)
      .eq('company_id', profile.company_id);

    if (updateError) throw updateError;

    // Cancel any pending approvals
    await supabase
      .from('approvals')
      .update({ status: action === 'approved' ? 'approved' : 'rejected', acted_at: new Date().toISOString(), comment: `[ADMIN OVERRIDE] ${comment}` })
      .eq('expense_id', expenseId)
      .eq('status', 'pending');

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: profile.company_id,
      expense_id: expenseId,
      user_id: profile.id,
      action: `admin_override_${action}`,
      details: { comment },
    });
  }

  return { actOnApproval, adminOverrideExpense };
}

export function useExpenseApprovals(expenseId) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    if (!expenseId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('approvals')
      .select(`
        *,
        users!approvals_approver_id_fkey(full_name, email),
        workflow_stages(name, stage_order)
      `)
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch expense approvals:', error);
    } else {
      setApprovals(data || []);
    }
    setLoading(false);
  }, [expenseId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  return { approvals, loading, refetch: fetchApprovals };
}
