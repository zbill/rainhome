-- ============================================================
-- CloudBase PostgreSQL 应用状态表 v2 —— 多用户隔离版
-- 执行位置：云开发控制台 → 数据库 → SQL 编辑器
-- 全部一次性执行
-- ============================================================

-- ========== 表 1：user_quiz_data ==========
DROP TABLE IF EXISTS public.user_quiz_data;
CREATE TABLE public.user_quiz_data (
  uid text PRIMARY KEY,
  user_json jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_user_quiz_data_updated_at ON public.user_quiz_data;
CREATE TRIGGER trg_user_quiz_data_updated_at
  BEFORE UPDATE ON public.user_quiz_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ========== 表 2：user_bindings ==========
DROP TABLE IF EXISTS public.user_bindings;
CREATE TABLE public.user_bindings (
  bind_uid text PRIMARY KEY,
  primary_uid text NOT NULL
);


-- ========== 清旧策略 ==========
DROP POLICY IF EXISTS quiz_select_own ON public.user_quiz_data;
DROP POLICY IF EXISTS quiz_insert_own ON public.user_quiz_data;
DROP POLICY IF EXISTS quiz_update_own ON public.user_quiz_data;
DROP POLICY IF EXISTS quiz_delete_own ON public.user_quiz_data;
DROP POLICY IF EXISTS bindings_select_own ON public.user_bindings;
DROP POLICY IF EXISTS bindings_insert_own ON public.user_bindings;


-- ========== 授权：authenticated 角色能读写 ==========
-- （anon 只有表级 GRANT 但没 RLS 策略，启用 RLS 后自动看不到任何行）
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_quiz_data TO authenticated;
GRANT SELECT, INSERT, UPDATE          ON public.user_bindings   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_quiz_data TO anon;
GRANT SELECT, INSERT, UPDATE          ON public.user_bindings   TO anon;


-- ========== 启用 RLS + 创建策略 ==========
-- CloudBase 内置 auth.uid() 实现：
--   coalesce(
--     nullif(current_setting('request.jwt.claim.sub', true), ''),
--     (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
--   )::text
-- 直接用 auth.uid() 就能拿到当前请求的用户 uid（text 类型）

ALTER TABLE public.user_quiz_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bindings   ENABLE ROW LEVEL SECURITY;

-- user_quiz_data：只能读/写自己 uid 的行
CREATE POLICY quiz_select_own ON public.user_quiz_data
  FOR SELECT USING (uid = auth.uid());

CREATE POLICY quiz_insert_own ON public.user_quiz_data
  FOR INSERT WITH CHECK (uid = auth.uid());

CREATE POLICY quiz_update_own ON public.user_quiz_data
  FOR UPDATE
  USING (uid = auth.uid())
  WITH CHECK (uid = auth.uid());

CREATE POLICY quiz_delete_own ON public.user_quiz_data
  FOR DELETE USING (uid = auth.uid());

-- user_bindings：能查/插自己为 bind_uid 或 primary_uid 的行
CREATE POLICY bindings_select_own ON public.user_bindings
  FOR SELECT USING (
    bind_uid = auth.uid() OR primary_uid = auth.uid()
  );

CREATE POLICY bindings_insert_own ON public.user_bindings
  FOR INSERT WITH CHECK (bind_uid = auth.uid());


-- ========== 验证（控制台直接执行这些 SQL 确认 RLS 是否生效） ==========
--
-- 1) 确认 auth.users 里有注册用户：
--    SELECT id, username, email FROM auth.users;
--
-- 2) 确认 user_quiz_data 表结构：
--    \d public.user_quiz_data
--
-- 3) 确认 RLS 已启用：
--    SELECT tablename, rowsecurity FROM pg_tables
--      WHERE schemaname = 'public' AND tablename IN ('user_quiz_data', 'user_bindings');
--
-- 4) 确认策略存在：
--    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--      FROM pg_policies WHERE schemaname = 'public';
