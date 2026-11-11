-- Trace redesign (5 of 5): cover the composite foreign keys (performance advisor).
--
-- Each child table points at its parent by (id, user_id), so a parent delete
-- or update looks children up by both columns. These indexes replace the
-- single-column ones added in the schema migration, which they make redundant.
-- private.document_files is left as it is: its foreign key leads with
-- document_id, which is its primary key, so the lookup is already unique.

create index health_event_prescriptions_event_user_idx on public.health_event_prescriptions (event_id, user_id);
create index health_event_prescriptions_medication_user_idx on public.health_event_prescriptions (medication_id, user_id);
create index health_event_prescriptions_period_user_idx on public.health_event_prescriptions (medication_period_id, user_id);
create index medication_periods_medication_user_idx on public.medication_periods (medication_id, user_id);
create index relative_conditions_relative_user_idx on public.relative_conditions (relative_id, user_id);
create index result_values_entry_user_idx on public.result_values (entry_id, user_id);

drop index public.health_event_prescriptions_medication_idx;
drop index public.health_event_prescriptions_period_idx;
drop index public.relative_conditions_relative_idx;
