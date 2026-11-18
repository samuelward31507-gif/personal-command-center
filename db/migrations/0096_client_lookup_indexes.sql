-- Indexes for the lookups the app makes per job (thread_id) and per business (project_id) on tables that had none.
-- The tables are small today, so these cost nearly nothing to build; without them every record and board load reads
-- the whole table once a business has a few thousand rows. Additive only: no table or row changes.
CREATE INDEX IF NOT EXISTS client_activity_thread_idx ON public.client_activity (thread_id);
CREATE INDEX IF NOT EXISTS client_appointments_thread_idx ON public.client_appointments (thread_id);
CREATE INDEX IF NOT EXISTS client_appointments_project_idx ON public.client_appointments (project_id, starts_at);
CREATE INDEX IF NOT EXISTS client_auto_sends_thread_idx ON public.client_auto_sends (thread_id);
CREATE INDEX IF NOT EXISTS client_bookings_project_idx ON public.client_bookings (project_id);
CREATE INDEX IF NOT EXISTS client_change_orders_project_idx ON public.client_change_orders (project_id);
CREATE INDEX IF NOT EXISTS client_equipment_project_idx ON public.client_equipment (project_id);
CREATE INDEX IF NOT EXISTS client_files_project_idx ON public.client_files (project_id);
CREATE INDEX IF NOT EXISTS client_lead_mail_thread_idx ON public.client_lead_mail (thread_id);
CREATE INDEX IF NOT EXISTS client_payments_thread_idx ON public.client_payments (thread_id);
CREATE INDEX IF NOT EXISTS client_photos_project_idx ON public.client_photos (project_id);
CREATE INDEX IF NOT EXISTS client_plans_thread_idx ON public.client_plans (thread_id);
CREATE INDEX IF NOT EXISTS client_properties_project_idx ON public.client_properties (project_id);
CREATE INDEX IF NOT EXISTS client_quotes_project_idx ON public.client_quotes (project_id);
CREATE INDEX IF NOT EXISTS client_refunds_thread_idx ON public.client_refunds (thread_id);
CREATE INDEX IF NOT EXISTS client_reviews_project_idx ON public.client_reviews (project_id);
CREATE INDEX IF NOT EXISTS client_signoffs_project_idx ON public.client_signoffs (project_id);
CREATE INDEX IF NOT EXISTS client_tasks_thread_idx ON public.client_tasks (thread_id);
CREATE INDEX IF NOT EXISTS client_time_thread_idx ON public.client_time (thread_id);
CREATE INDEX IF NOT EXISTS client_visits_thread_idx ON public.client_visits (thread_id);
CREATE INDEX IF NOT EXISTS client_visits_project_idx ON public.client_visits (project_id);
