CREATE OR REPLACE FUNCTION public.normalize_player_name(input_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select btrim(coalesce(input_name, ''));
$function$
