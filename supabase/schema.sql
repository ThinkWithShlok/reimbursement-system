-- ============================================================
-- ExpenseFlow — Database Schema
-- Multi-tenant Expense Reimbursement Management System
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. COMPANIES
-- ============================================================
CREATE TABLE public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  country     text NOT NULL,
  base_currency text NOT NULL,  -- ISO 4217
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. USERS
-- ============================================================
CREATE TABLE public.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text NOT NULL,
  role        text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  manager_id  uuid REFERENCES public.users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount           numeric(12,2) NOT NULL,
  currency         text NOT NULL,
  converted_amount numeric(12,2),
  base_currency    text,
  exchange_rate    numeric(12,6),
  category         text NOT NULL CHECK (category IN ('travel','food','accommodation','office_supplies','other')),
  description      text,
  expense_date     date NOT NULL,
  receipt_url      text,
  vendor           text,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','in_approval','approved','rejected')),
  submitted_at     timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. WORKFLOWS
-- ============================================================
CREATE TABLE public.workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_default  boolean DEFAULT false,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. WORKFLOW_STAGES
-- ============================================================
CREATE TABLE public.workflow_stages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id         uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  stage_order         integer NOT NULL,
  name                text NOT NULL,
  approval_type       text NOT NULL DEFAULT 'percentage' CHECK (approval_type IN ('percentage','specific','hybrid')),
  required_percentage integer DEFAULT 100,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(workflow_id, stage_order)
);

ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. STAGE_APPROVERS
-- ============================================================
CREATE TABLE public.stage_approvers (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id  uuid NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  UNIQUE(stage_id, user_id)
);

ALTER TABLE public.stage_approvers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. APPROVALS
-- ============================================================
CREATE TABLE public.approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  stage_id    uuid NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  comment     text,
  acted_at    timestamptz,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(expense_id, stage_id, approver_id)
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. AUDIT_LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  expense_id  uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  details     jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_expenses_company_status ON public.expenses(company_id, status);
CREATE INDEX idx_expenses_user ON public.expenses(user_id);
CREATE INDEX idx_approvals_expense ON public.approvals(expense_id);
CREATE INDEX idx_approvals_approver_status ON public.approvals(approver_id, status);
CREATE INDEX idx_audit_logs_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX idx_users_company ON public.users(company_id);
CREATE INDEX idx_users_auth ON public.users(auth_id);

-- ============================================================
-- TRIGGER: Auto-create user on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_country text;
  v_currency text;
  v_full_name text;
  v_workflow_id uuid;
  v_stage_id uuid;
  v_user_id uuid;
BEGIN
  v_full_name := COALESCE(new.raw_user_meta_data ->> 'full_name', 'User');
  v_company_name := new.raw_user_meta_data ->> 'company_name';
  v_country := new.raw_user_meta_data ->> 'country';
  v_currency := new.raw_user_meta_data ->> 'base_currency';

  -- If company_name is provided, create new company + admin
  IF v_company_name IS NOT NULL AND v_company_name != '' THEN
    INSERT INTO public.companies (name, country, base_currency)
    VALUES (v_company_name, COALESCE(v_country, 'US'), COALESCE(v_currency, 'USD'))
    RETURNING id INTO v_company_id;

    INSERT INTO public.users (auth_id, company_id, email, full_name, role)
    VALUES (new.id, v_company_id, new.email, v_full_name, 'admin')
    RETURNING id INTO v_user_id;

    -- Create default workflow
    INSERT INTO public.workflows (company_id, name, is_default)
    VALUES (v_company_id, 'Standard Approval', true)
    RETURNING id INTO v_workflow_id;

    -- Add single admin approval stage
    INSERT INTO public.workflow_stages (workflow_id, stage_order, name, approval_type, required_percentage)
    VALUES (v_workflow_id, 1, 'Admin Review', 'percentage', 100)
    RETURNING id INTO v_stage_id;

    INSERT INTO public.stage_approvers (stage_id, user_id)
    VALUES (v_stage_id, v_user_id);
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: Updated_at auto-update
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper: Get current user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT company_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Helper: Get current user's id
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Helper: Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- COMPANIES: Users can read their own company
CREATE POLICY "Users can view own company" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

CREATE POLICY "Allow insert during signup" ON public.companies
  FOR INSERT WITH CHECK (true);

-- USERS: Company members can read, admin can manage
CREATE POLICY "Users can view company members" ON public.users
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Allow insert for signup trigger" ON public.users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can update users" ON public.users
  FOR UPDATE USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role() = 'admin'
  );

-- EXPENSES: Users see own + admin/manager see company
CREATE POLICY "Users can view own expenses" ON public.expenses
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND (
      user_id = public.get_user_id()
      OR public.get_user_role() IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can create expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND user_id = public.get_user_id()
  );

CREATE POLICY "Users can update own draft expenses" ON public.expenses
  FOR UPDATE USING (
    company_id = public.get_user_company_id()
    AND (
      user_id = public.get_user_id()
      OR public.get_user_role() IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can delete expenses" ON public.expenses
  FOR DELETE USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role() = 'admin'
  );

-- WORKFLOWS
CREATE POLICY "Users can view company workflows" ON public.workflows
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Admin can manage workflows" ON public.workflows
  FOR ALL USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role() = 'admin'
  );

-- WORKFLOW_STAGES
CREATE POLICY "Users can view workflow stages" ON public.workflow_stages
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM public.workflows WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Admin can manage workflow stages" ON public.workflow_stages
  FOR ALL USING (
    workflow_id IN (
      SELECT id FROM public.workflows WHERE company_id = public.get_user_company_id()
    )
  );

-- STAGE_APPROVERS
CREATE POLICY "Users can view stage approvers" ON public.stage_approvers
  FOR SELECT USING (
    stage_id IN (
      SELECT ws.id FROM public.workflow_stages ws
      JOIN public.workflows w ON w.id = ws.workflow_id
      WHERE w.company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Admin can manage stage approvers" ON public.stage_approvers
  FOR ALL USING (
    stage_id IN (
      SELECT ws.id FROM public.workflow_stages ws
      JOIN public.workflows w ON w.id = ws.workflow_id
      WHERE w.company_id = public.get_user_company_id()
    )
  );

-- APPROVALS
CREATE POLICY "Users can view related approvals" ON public.approvals
  FOR SELECT USING (
    expense_id IN (
      SELECT id FROM public.expenses WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Approvers can create approvals" ON public.approvals
  FOR INSERT WITH CHECK (
    expense_id IN (
      SELECT id FROM public.expenses WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Approvers can update own approvals" ON public.approvals
  FOR UPDATE USING (
    approver_id = public.get_user_id()
    OR public.get_user_role() = 'admin'
  );

-- AUDIT_LOGS
CREATE POLICY "Users can view company audit logs" ON public.audit_logs
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Anyone can view receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');
