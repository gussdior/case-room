-- The server's service client writes AI runs and messages; table triggers call private helpers.
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
