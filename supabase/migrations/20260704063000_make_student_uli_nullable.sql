-- Make ULI column nullable in students table
ALTER TABLE public.students ALTER COLUMN uli DROP NOT NULL;
