-- Un collaborateur lit ses demandes et les demandes validées de son équipe.
-- Un manager lit celles de ses équipes. Un admin lit tout.
CREATE OR REPLACE FUNCTION private.own_team()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT team FROM public.allowed_users WHERE email = lower(auth.jwt() ->> 'email')
$$;
REVOKE ALL ON FUNCTION private.own_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.own_team() TO authenticated;

DROP POLICY IF EXISTS "Allowed read submissions" ON public.submissions;
CREATE POLICY "Allowed read submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    private.is_allowed() AND (
      private.is_admin()
      OR (private.current_app_role() = 'manager'::public.app_role AND private.can_review_team(team))
      OR submitted_by_email = lower(auth.jwt() ->> 'email')
      OR (status = 'validée'::public.submission_status
          AND private.current_app_role() = 'collaborateur'::public.app_role
          AND team = private.own_team())
    )
  );