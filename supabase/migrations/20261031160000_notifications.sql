-- B03 : notifications alimentées par la base (nouvelle demande pour les managers de l'équipe,
-- décision pour l'auteur). Aucun texte de demande : seulement le destinataire, le type et la demande liée.

-- 1) Table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  type text NOT NULL CHECK (type IN ('nouvelle_demande', 'decision')),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notifications_unread_idx ON public.notifications (recipient_email) WHERE read_at IS NULL;

-- 2) RLS : lecture de ses propres lignes uniquement ; aucune écriture pour authenticated
--    (le marquage « lu » arrive en T10).
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (private.is_allowed() AND recipient_email = lower(auth.jwt() ->> 'email'));

-- 3) Nouvelle demande : une ligne par manager de l'équipe, sauf l'auteur.
--    Une erreur de notification est ignorée : elle ne doit jamais bloquer la soumission.
CREATE OR REPLACE FUNCTION private.notify_new_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (recipient_email, type, submission_id)
    SELECT DISTINCT lower(u.email), 'nouvelle_demande', NEW.id
    FROM public.allowed_users u
    JOIN public.allowed_user_roles r
      ON r.allowed_user_id = u.id AND r.role = 'manager'::public.app_role
    JOIN public.manager_teams mt
      ON mt.allowed_user_id = u.id
    WHERE lower(btrim(mt.team)) = lower(btrim(NEW.team))
      AND lower(u.email) IS DISTINCT FROM lower(NEW.submitted_by_email);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END
$$;

CREATE TRIGGER notify_new_submission
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION private.notify_new_submission();

-- 4) Décision : une ligne pour l'auteur quand une demande « en attente » est validée ou refusée.
--    Pas de notification sans JWT (changement automatique du cron) ni pour soi-même.
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
    NULL;
  END;
  RETURN NEW;
END
$$;

CREATE TRIGGER notify_decision
AFTER UPDATE OF status ON public.submissions
FOR EACH ROW EXECUTE FUNCTION private.notify_decision();

-- 6) Script de test RLS (à exécuter à la main dans l'éditeur SQL, il se termine par ROLLBACK).
--    Remplacer les quatre adresses :
--      GONTRAN = collaborateur de l'équipe Product
--      KESHA   = manager de l'équipe Product
--      AUTRE   = manager d'une autre équipe
--      OLIVIA  = collaboratrice (autre équipe que Product)
--
-- BEGIN;
--   -- Gontran soumet
--   SELECT set_config('request.jwt.claims', '{"email":"GONTRAN"}', true);
--   SET LOCAL ROLE authenticated;
--   INSERT INTO public.submissions (author_name, team, content) VALUES ('Gontran', 'x', 'Test notif B03');
--   RESET ROLE;
--
--   -- Kesha valide
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   UPDATE public.submissions SET status = 'validée' WHERE content = 'Test notif B03';
--   RESET ROLE;
--
--   -- Chacun ne lit que ses lignes (attendu : Kesha 1 nouvelle_demande, Gontran 1 decision, AUTRE 0, OLIVIA 0)
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT 'KESHA' AS compte, type, recipient_email FROM public.notifications;
--   RESET ROLE;
--
--   SELECT set_config('request.jwt.claims', '{"email":"GONTRAN"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT 'GONTRAN' AS compte, type, recipient_email FROM public.notifications;
--   RESET ROLE;
--
--   SELECT set_config('request.jwt.claims', '{"email":"AUTRE"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT 'AUTRE' AS compte, count(*) FROM public.notifications;   -- 0
--   RESET ROLE;
--
--   SELECT set_config('request.jwt.claims', '{"email":"OLIVIA"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT 'OLIVIA' AS compte, count(*) FROM public.notifications;  -- 0
--   RESET ROLE;
--
--   -- Aucune écriture possible pour authenticated (attendu : erreur « permission denied »)
--   -- SET LOCAL ROLE authenticated; INSERT INTO public.notifications (recipient_email, type, submission_id)
--   --   SELECT 'x', 'decision', id FROM public.submissions LIMIT 1;
-- ROLLBACK;
