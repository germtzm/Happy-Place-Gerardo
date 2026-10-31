-- B03 : (1) pas d'alerte aux managers pour une demande saisie déjà validée ou refusée (saisie admin) ;
--       (2) une erreur de notification reste non bloquante mais devient visible dans les logs.

CREATE OR REPLACE FUNCTION private.notify_new_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  BEGIN
    IF NEW.status = 'en attente'::public.submission_status THEN
      INSERT INTO public.notifications (recipient_email, type, submission_id)
      SELECT DISTINCT lower(u.email), 'nouvelle_demande', NEW.id
      FROM public.allowed_users u
      JOIN public.allowed_user_roles r
        ON r.allowed_user_id = u.id AND r.role = 'manager'::public.app_role
      JOIN public.manager_teams mt
        ON mt.allowed_user_id = u.id
      WHERE lower(btrim(mt.team)) = lower(btrim(NEW.team))
        AND lower(u.email) IS DISTINCT FROM lower(NEW.submitted_by_email);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notification ignorée : %', SQLERRM;
  END;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION private.notify_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _actor text := lower(nullif(auth.jwt() ->> 'email', ''));
BEGIN
  BEGIN
    IF NEW.status IN ('validée'::public.submission_status, 'refusée'::public.submission_status)
       AND OLD.status = 'en attente'::public.submission_status
       AND _actor IS NOT NULL
       AND nullif(NEW.submitted_by_email, '') IS NOT NULL
       AND _actor <> lower(NEW.submitted_by_email) THEN
      INSERT INTO public.notifications (recipient_email, type, submission_id)
      VALUES (lower(NEW.submitted_by_email), 'decision', NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notification ignorée : %', SQLERRM;
  END;
  RETURN NEW;
END
$$;
