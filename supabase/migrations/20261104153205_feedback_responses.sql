-- Dispositif de feedback anonyme.
-- Les réponses vont dans public.feedback_responses, sans aucune colonne d'identité (ni user_id, ni email).
-- Aucune politique INSERT/UPDATE/DELETE : les clients ne peuvent pas écrire directement dans la table.
-- Seule la fonction public.submit_feedback (SECURITY DEFINER) y insère, avec le rôle pris dans
-- private.current_app_role(). Seul l'admin peut lire les réponses.
-- created_at ne garde que le jour (date_trunc('day', now())) : l'heure exacte d'une réponse pourrait
-- être recoupée avec les journaux de connexion et permettre de retrouver son auteur, ce qui romprait l'anonymat.
--
-- Annulation (à exécuter à la main si besoin) :
--   DROP FUNCTION IF EXISTS public.submit_feedback(smallint, smallint, smallint, smallint, text);
--   DROP TABLE IF EXISTS public.feedback_responses;

CREATE TABLE public.feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT date_trunc('day', now()),
  role public.app_role NOT NULL,
  satisfaction smallint NOT NULL CHECK (satisfaction BETWEEN 1 AND 5),
  q_accueil smallint CHECK (q_accueil BETWEEN 1 AND 5),
  q_demandes smallint CHECK (q_demandes BETWEEN 1 AND 5),
  q_notifications smallint CHECK (q_notifications BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 500),
  is_demo boolean NOT NULL DEFAULT false
);

ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

-- Droits : on retire tout (y compris les privilèges par défaut du projet), puis SELECT seul pour authenticated.
REVOKE ALL ON public.feedback_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feedback_responses TO authenticated;
GRANT ALL ON public.feedback_responses TO service_role;

-- Lecture réservée à l'admin. Aucune politique INSERT, UPDATE ni DELETE.
CREATE POLICY "Admins read feedback"
ON public.feedback_responses FOR SELECT TO authenticated
USING (private.is_admin());

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_satisfaction smallint,
  p_accueil smallint DEFAULT NULL,
  p_demandes smallint DEFAULT NULL,
  p_notifications smallint DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_role public.app_role;
  v_comment text;
BEGIN
  IF NOT coalesce(private.is_allowed(), false) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  -- Le rôle vient toujours de la base, jamais d'un paramètre.
  v_role := private.current_app_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  IF p_satisfaction IS NULL OR p_satisfaction NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'La note de satisfaction est obligatoire et doit être comprise entre 1 et 5'
      USING ERRCODE = '22023';
  END IF;
  IF p_accueil IS NOT NULL AND p_accueil NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'La note accueil doit être comprise entre 1 et 5' USING ERRCODE = '22023';
  END IF;
  IF p_demandes IS NOT NULL AND p_demandes NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'La note demandes doit être comprise entre 1 et 5' USING ERRCODE = '22023';
  END IF;
  IF p_notifications IS NOT NULL AND p_notifications NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'La note notifications doit être comprise entre 1 et 5' USING ERRCODE = '22023';
  END IF;

  -- Commentaire vide ou fait uniquement d'espaces : NULL.
  v_comment := CASE WHEN p_comment IS NULL OR p_comment ~ '^\s*$' THEN NULL ELSE p_comment END;
  IF v_comment IS NOT NULL AND char_length(v_comment) > 500 THEN
    RAISE EXCEPTION 'Le commentaire ne doit pas dépasser 500 caractères' USING ERRCODE = '22023';
  END IF;

  -- is_demo n'est jamais posé à vrai ici : on laisse la valeur par défaut (false).
  INSERT INTO public.feedback_responses (role, satisfaction, q_accueil, q_demandes, q_notifications, comment)
  VALUES (v_role, p_satisfaction, p_accueil, p_demandes, p_notifications, v_comment);
END
$$;

REVOKE ALL ON FUNCTION public.submit_feedback(smallint, smallint, smallint, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_feedback(smallint, smallint, smallint, smallint, text) TO authenticated;
