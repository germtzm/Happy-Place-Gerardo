-- Fin du choix libre du rôle : seuls les admins attribuent les rôles
REVOKE EXECUTE ON FUNCTION public.choisir_mon_role(public.app_role, text, text, text) FROM authenticated;

-- Premier admin (le prénom et le nom se complètent dans l'app)
WITH u AS (
  INSERT INTO public.allowed_users (email, first_name)
  VALUES ('germtzm@gmail.com', 'Gerardo')
  ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
  RETURNING id
)
INSERT INTO public.allowed_user_roles (allowed_user_id, role)
SELECT id, 'admin' FROM u
ON CONFLICT (allowed_user_id) DO UPDATE SET role = 'admin';