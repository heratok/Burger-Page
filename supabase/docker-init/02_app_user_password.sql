-- Solo para el stack Docker efímero de tests (docker-compose.yml, tmpfs, se
-- destruye en cada corrida) — mismo nivel de "secreto" que POSTGRES_PASSWORD:
-- postgres ya hardcodeado en ese archivo. Nunca usar este password fuera de
-- este contenedor de test.
ALTER ROLE app_user WITH PASSWORD 'app_user_test_only';
