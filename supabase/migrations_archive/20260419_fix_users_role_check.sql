update public.users
set role = upper(role)
where role in (
  'system_admin',
  'admin',
  'president',
  'finance_manager',
  'accountant',
  'ar_specialist',
  'ap_specialist',
  'ap_clerk',
  'ap_supervisor',
  'treasury',
  'auditor',
  'registrar',
  'trainer',
  'student'
);

alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check
check (
  role = any (
    array[
      'SYSTEM_ADMIN',
      'ADMIN',
      'PRESIDENT',
      'FINANCE_MANAGER',
      'ACCOUNTANT',
      'AR_SPECIALIST',
      'AP_SPECIALIST',
      'AP_CLERK',
      'AP_SUPERVISOR',
      'TREASURY',
      'AUDITOR',
      'REGISTRAR',
      'TRAINER',
      'STUDENT',
      'VIEWER'
    ]::text[]
  )
);
