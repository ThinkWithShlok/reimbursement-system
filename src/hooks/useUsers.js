/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch users:', error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function createUser({ email, fullName, role, managerId }) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        company_id: profile.company_id,
        email,
        full_name: fullName,
        role,
        manager_id: managerId || null,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      company_id: profile.company_id,
      user_id: profile.id,
      action: 'user_created',
      details: { email, role, full_name: fullName },
    });

    await fetchUsers();
    return data;
  }

  async function updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      company_id: profile.company_id,
      user_id: profile.id,
      action: 'user_updated',
      details: { target_user: userId, updates },
    });

    await fetchUsers();
    return data;
  }

  return { users, loading, createUser, updateUser, refetch: fetchUsers };
}

export function useWorkflows() {
  const { profile } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('workflows')
      .select(`
        *,
        workflow_stages(
          *,
          stage_approvers(*, users!stage_approvers_user_id_fkey(full_name, email))
        )
      `)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch workflows:', error);
    } else {
      // Sort stages by order
      const sorted = (data || []).map(w => ({
        ...w,
        workflow_stages: (w.workflow_stages || []).sort((a, b) => a.stage_order - b.stage_order),
      }));
      setWorkflows(sorted);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  async function createWorkflow(name) {
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        company_id: profile.company_id,
        name,
      })
      .select()
      .single();

    if (error) throw error;
    await fetchWorkflows();
    return data;
  }

  async function addStage(workflowId, { name, stageOrder, approvalType, requiredPercentage, approverIds }) {
    const { data: stage, error } = await supabase
      .from('workflow_stages')
      .insert({
        workflow_id: workflowId,
        stage_order: stageOrder,
        name,
        approval_type: approvalType || 'percentage',
        required_percentage: requiredPercentage || 100,
      })
      .select()
      .single();

    if (error) throw error;

    if (approverIds && approverIds.length > 0) {
      const approverInserts = approverIds.map(uid => ({
        stage_id: stage.id,
        user_id: uid,
      }));
      await supabase.from('stage_approvers').insert(approverInserts);
    }

    await fetchWorkflows();
    return stage;
  }

  async function setDefault(workflowId) {
    // Unset all defaults first
    await supabase
      .from('workflows')
      .update({ is_default: false })
      .eq('company_id', profile.company_id);

    // Set new default
    await supabase
      .from('workflows')
      .update({ is_default: true })
      .eq('id', workflowId);

    await fetchWorkflows();
  }

  async function deleteWorkflow(workflowId) {
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', workflowId);
    if (error) throw error;
    await fetchWorkflows();
  }

  async function deleteStage(stageId) {
    const { error } = await supabase
      .from('workflow_stages')
      .delete()
      .eq('id', stageId);
    if (error) throw error;
    await fetchWorkflows();
  }

  return {
    workflows,
    loading,
    createWorkflow,
    addStage,
    setDefault,
    deleteWorkflow,
    deleteStage,
    refetch: fetchWorkflows,
  };
}

export function useAuditLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      if (!profile) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, users!audit_logs_user_id_fkey(full_name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Failed to fetch audit logs:', error);
      } else {
        setLogs(data || []);
      }
      setLoading(false);
    }
    fetch();
  }, [profile]);

  return { logs, loading };
}
