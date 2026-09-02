-- Registrar users may create a learner stub with names only and complete the
-- remaining profile information later.
ALTER TABLE public.students
  ALTER COLUMN date_of_birth DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;
-- Registrar users may create a learner stub with names only and complete the
-- remaining profile information later.
ALTER TABLE public.students
  ALTER COLUMN date_of_birth DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;
