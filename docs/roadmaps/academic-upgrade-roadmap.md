# Academic and Hybrid Institution Upgrade TODO

## Objective

Extend AT-ERP from a training-center ERP into a multi-institution education ERP without breaking the current training workflow.

Supported institution modes:

- `TRAINING`: existing TESDA/training workflow remains unchanged.
- `ACADEMIC`: school/college workflow using academic programs, school years, terms, sections, subjects, academic enrollments, academic fees, grades, and attendance.
- `HYBRID`: one tenant can use both Training and Academic workflows side by side.

The institution classification is already implemented through:

- `Organization.institutionType`
- `public.organizations.institution_type`
- allowed values: `TRAINING`, `ACADEMIC`, `HYBRID`

Existing tenants are already treated as `TRAINING`. Do not redesign current training billing. Add a separate academic billing path that can create invoices for academic enrollments while leaving current `Batch`, `Enrollment`, `CourseFee`, invoice, payment, ledger, student portal, trainer portal, and registrar behavior intact.

---

## Non-Negotiables

- [ ] Do not rename or overload `Batch` to mean academic class.
- [ ] Do not merge Training `Enrollment` with Academic Enrollment.
- [ ] Do not rewrite current invoice/payment/accounting behavior for training.
- [ ] Do not remove existing `batch_id`, `enrollment_id`, `assessment_registration_id`, or `course_fee_id` usage.
- [ ] Do not force academic data into TESDA-specific fields.
- [ ] Do not place new active views under `src/views`; this app uses root `views/`.
- [ ] Do not add packages unless the project cannot reasonably solve the problem with existing React, TypeScript, Supabase service, Tailwind, and lucide-react patterns.

---

## Tenant Isolation Rules

AT-ERP is a SaaS application. Academic and Hybrid upgrades must preserve strict tenant data separation.

- [ ] Every new academic table must include `org_id`.
- [ ] Every tenant-owned query must filter by `org_id`.
- [ ] Every insert must set `org_id` from the active tenant context, not from user-entered form data.
- [ ] Every update/delete/archive must scope by both record `id` and `org_id` where possible.
- [ ] Every RLS policy must enforce tenant access through `org_id`.
- [ ] Never fetch academic rows globally and filter only in React.
- [ ] Never trust route params, selected IDs, or form data as proof of tenant ownership.
- [ ] Cross-table joins and RPCs must verify all joined records belong to the same `org_id`.
- [ ] Foreign-key validation must reject links to records from another tenant.
- [ ] Indexes for tenant-owned academic tables must start with `org_id` unless there is a specific database reason not to.
- [ ] Shared finance screens may list invoices from Training and Academic, but only for the active `org_id`.
- [ ] Student, faculty, billing, grades, attendance, and report queries must never cross tenants.
- [ ] Tests must verify tenant A cannot read, update, bill, delete, or report tenant B data.

---

## Current System Facts

- The active app path is `index.tsx` -> `App.tsx`.
- `App.tsx` owns current tab navigation, state, view rendering, tenant selection, and brand color variables.
- Current training billing path is:
  - `Qualification -> Batch -> Enrollment -> Invoice`
- Current training billing fields include:
  - `Batch.qualificationId`
  - `Batch.studentIds`
  - `Enrollment.batchId`
  - `Invoice.batchId`
  - `Invoice.enrollmentId`
  - `Invoice.assessmentRegistrationId`
  - `InvoiceLine.enrollmentId`
  - `InvoiceLine.courseFeeId`
  - `JournalLine.batchId`
- Course fees are currently tied to `Qualification`.
- Student/customer AR already supports `studentId` and `sponsorId`.
- `SupabaseDataService` uses explicit select columns, camel/snake transforms, and table schema allow-lists. Every new academic table and column must be registered there.
- Server-side pagination already exists through `fetchPage()`.
- `design.md` exists and should guide visual consistency. `PROJECT_RULES.md` may not exist, so verify before relying on it.

---

## Target Architecture

Training and Academic must be separate operational paths that meet only at invoice/payment/accounting boundaries.

```txt
TRAINING path:
Qualification -> Batch -> Enrollment -> CourseFee -> Invoice -> Payment -> Ledger

ACADEMIC path:
AcademicProgram -> AcademicYear/Term -> Section -> ClassOffering
AcademicEnrollment -> AcademicFee -> Academic Billing Preview -> Invoice -> Payment -> Ledger

HYBRID path:
Enable both paths in one tenant. Shared finance screens can list invoices/payments from both paths.
```

Important rule: Finance can pay, age, print, post, void, and report invoices after creation without needing to know whether the invoice came from Training or Academic. Workflow-specific logic belongs before invoice creation.

---

## Modular Architecture Rules

- [ ] Create clear domain boundaries:
  - [ ] `core`: organizations, users, roles, permissions, branding, audit, notifications.
  - [ ] `training`: qualifications, batches, training enrollments, TESDA forms, assessment registrations, training schedules.
  - [ ] `academic`: programs, academic years, terms, levels, subjects, sections, class offerings, academic enrollments, academic fees, grades, attendance.
  - [ ] `finance`: invoices, invoice lines, payments, applications, AR/AP, ledger, banking, revenue recognition.
- [ ] Keep existing training components and handlers working as they are.
- [ ] Add academic service methods beside existing service methods.
- [ ] Avoid academic conditionals inside training views.
- [ ] Avoid training conditionals inside academic views.
- [ ] Keep shared behavior in small reusable primitives, not in a giant academic super-component.
- [ ] Use module metadata for scalable navigation:
  - [ ] module id
  - [ ] label
  - [ ] icon
  - [ ] institution type availability
  - [ ] required permission
  - [ ] tab id
  - [ ] component/view mapping
- [ ] Keep `App.tsx` integration thin:
  - [ ] import academic views
  - [ ] register tabs
  - [ ] pass org/user/brand props
  - [ ] avoid adding large academic business logic directly in `App.tsx`

Suggested files:

```txt
config/
  institutions.ts
  academicModules.ts

services/
  AcademicService.ts

views/
  AcademicProgramsView.tsx
  AcademicYearsView.tsx
  AcademicTermsView.tsx
  AcademicLevelsView.tsx
  SubjectsView.tsx
  AcademicSectionsView.tsx
  ClassOfferingsView.tsx
  AcademicEnrollmentsView.tsx
  AcademicFeesView.tsx
  AcademicBillingView.tsx

components/
  academic/
    AcademicPageHeader.tsx
    AcademicTableShell.tsx
    AcademicFilterToolbar.tsx
    AcademicFormModal.tsx
    AcademicStatusBadge.tsx
    AcademicEmptyState.tsx
    AcademicLoadingState.tsx
```

Only create shared components when at least two academic views need the same behavior.

---

## UI and React Standards

- [ ] Follow the existing root `views/*View.tsx` style.
- [ ] Keep the design minimalist, data-dense, and ERP-appropriate.
- [ ] Use the current tenant brand color for:
  - [ ] primary buttons
  - [ ] active states
  - [ ] focus rings
  - [ ] selected rows
  - [ ] important badges
  - [ ] subtle highlights
- [ ] Prefer CSS variables already set by `App.tsx` such as brand-related variables when available.
- [ ] Avoid hardcoded primary colors for actions.
- [ ] Keep cards simple: compact spacing, subtle borders, restrained shadows.
- [ ] Avoid heavy gradients unless matching an existing local pattern.
- [ ] Use lucide-react icons for actions and navigation.
- [ ] Keep table behavior consistent with existing list screens:
  - [ ] clickable rows
  - [ ] row hover state
  - [ ] row click opens view/edit mode
  - [ ] delete remains an explicit action with confirmation
  - [ ] search and filters at top
  - [ ] server-side pagination from day one
  - [ ] loading, empty, and error states
  - [ ] disabled submit button while saving
  - [ ] backend validation errors shown clearly
- [ ] Keep view components thin:
  - [ ] no direct Supabase calls inside views
  - [ ] use `AcademicService` or `DataServiceFactory.getService()`
  - [ ] debounce search
  - [ ] memoize derived rows/options when useful
  - [ ] avoid duplicated local state
  - [ ] keep form defaults and validation helpers close but extracted when reused

---

## Phase 0 - Verification Before Changes

- [ ] Confirm React and dependency versions in `package.json`.
- [ ] Inspect current patterns in:
  - [ ] `App.tsx`
  - [ ] `views/BatchesView.tsx`
  - [ ] `views/InvoicesView.tsx`
  - [ ] `views/CourseFeesView.tsx`
  - [ ] `components/PaginationControls.tsx`
  - [ ] `services/SupabaseDataService.ts`
  - [ ] `services/IDataService.ts`
  - [ ] `types.ts`
  - [ ] `config/permissions.ts`
  - [ ] `design.md`
- [ ] Verify whether `PROJECT_RULES.md` exists before referencing it.
- [ ] Confirm current `institution_type` migration has already been applied or is safe to apply.

---

## Phase 1 - Institution Helpers and Navigation Gates

- [ ] Add institution helpers:
  - [ ] `isTrainingOrg(org)`
  - [ ] `isAcademicOrg(org)`
  - [ ] `isHybridOrg(org)`
  - [ ] `supportsTraining(org)`
  - [ ] `supportsAcademic(org)`
- [ ] Use existing `institutionType || 'TRAINING'` fallback.
- [ ] Add academic module IDs to `config/permissions.ts`.
- [ ] Add academic navigation metadata with institution availability:
  - [ ] Training modules visible for `TRAINING` and `HYBRID`.
  - [ ] Academic modules visible for `ACADEMIC` and `HYBRID`.
  - [ ] `TRAINING` tenants see no academic modules.
  - [ ] `ACADEMIC` tenants do not show Training Batches or Assessment Registrations unless deliberately enabled later.
- [ ] Keep visible labels institution-aware:
  - [ ] `Learners` can become `Students` for Academic.
  - [ ] `Trainers` can remain training-specific.
  - [ ] Academic can use `Faculty` label while reusing trainer/user data only if that is explicitly chosen.
  - [ ] `Training Batches` remains training-only.

Acceptance:

- [ ] Existing `TRAINING` tenant navigation is unchanged.
- [ ] `ACADEMIC` tenant sees academic registrar modules.
- [ ] `HYBRID` tenant sees both training and academic registrar groups.
- [ ] Unauthorized roles still cannot access tabs even if institution type supports them.

---

## Phase 2 - Academic Core Data Model

Create new academic tables beside existing training tables.

- [ ] Add `academic_programs`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `code`
  - [ ] `name`
  - [ ] `level`: `K12`, `COLLEGE`, `GRADUATE`, `OTHER`
  - [ ] `department`
  - [ ] `duration_years`
  - [ ] `is_active`
  - [ ] audit/delete columns following existing project conventions where practical
- [ ] Add `academic_years`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `school_year`
  - [ ] `starts_at`
  - [ ] `ends_at`
  - [ ] `status`
- [ ] Add `academic_terms`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `academic_year_id`
  - [ ] `term_code`
  - [ ] `name`
  - [ ] `starts_at`
  - [ ] `ends_at`
  - [ ] `status`
- [ ] Add `academic_levels`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `program_id`
  - [ ] `code`
  - [ ] `name`
  - [ ] `sort_order`
- [ ] Add `subjects`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `program_id`
  - [ ] `code`
  - [ ] `name`
  - [ ] `units`
  - [ ] `lecture_hours`
  - [ ] `lab_hours`
  - [ ] `is_active`
- [ ] Add `academic_sections`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `academic_year_id`
  - [ ] `term_id`
  - [ ] `program_id`
  - [ ] `level_id`
  - [ ] `code`
  - [ ] `name`
  - [ ] `capacity`
  - [ ] `status`
- [ ] Add `class_offerings`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `term_id`
  - [ ] `section_id`
  - [ ] `subject_id`
  - [ ] `faculty_id`
  - [ ] `location_id`
  - [ ] `schedule_json`
  - [ ] `capacity`
  - [ ] `status`
- [ ] Add `academic_enrollments`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `student_id`
  - [ ] `program_id`
  - [ ] `level_id`
  - [ ] `academic_year_id`
  - [ ] `term_id`
  - [ ] `section_id`
  - [ ] `status`
  - [ ] `billing_status`
  - [ ] `enrollment_date`
  - [ ] `total_fees`
  - [ ] `billed_amount`
- [ ] Add `academic_enrollment_subjects`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `academic_enrollment_id`
  - [ ] `class_offering_id`
  - [ ] `subject_id`
  - [ ] `status`

Migration rules:

- [ ] Use nullable academic FKs where rollout requires online compatibility.
- [ ] Add `org_id` to every academic table.
- [ ] Add RLS policies using `org_id`.
- [ ] Add indexes in the same or follow-up migration.
- [ ] Do not migrate existing `batches` into academic sections.

---

## Phase 3 - TypeScript Models and Service Registration

- [ ] Add academic model types in `types.ts` or a clearly imported academic types file:
  - [ ] `AcademicProgram`
  - [ ] `AcademicYear`
  - [ ] `AcademicTerm`
  - [ ] `AcademicLevel`
  - [ ] `Subject`
  - [ ] `AcademicSection`
  - [ ] `ClassOffering`
  - [ ] `AcademicEnrollment`
  - [ ] `AcademicEnrollmentSubject`
- [ ] Add status/type unions:
  - [ ] academic program level
  - [ ] academic year/term status
  - [ ] section status
  - [ ] class offering status
  - [ ] academic enrollment status
  - [ ] academic billing status
- [ ] Update `IDataService` with academic CRUD/page methods only where typed methods are useful.
- [ ] Register academic tables in `SupabaseDataService`:
  - [ ] explicit select columns
  - [ ] table schema allow-list
  - [ ] readonly fields where needed
  - [ ] generic create/update/delete support
  - [ ] page loading through `fetchPage()`
- [ ] Keep academic list screens server-paginated; do not add them to massive initial preload.

Acceptance:

- [ ] Academic entities can be created, updated, deleted/archived, and fetched by page.
- [ ] Existing initial load does not become heavier.
- [ ] Existing training entity CRUD still works.

---

## Phase 4 - Academic Registrar CRUD Screens

Build in this order to reduce dependency friction:

- [ ] `AcademicProgramsView.tsx`
- [ ] `AcademicYearsView.tsx`
- [ ] `AcademicTermsView.tsx`
- [ ] `AcademicLevelsView.tsx`
- [ ] `SubjectsView.tsx`
- [ ] `AcademicSectionsView.tsx`
- [ ] `ClassOfferingsView.tsx`
- [ ] `AcademicEnrollmentsView.tsx`

Each screen must include:

- [ ] minimalist header with title and primary action
- [ ] compact search/filter toolbar
- [ ] server-side paginated table
- [ ] clickable rows for view/edit
- [ ] explicit delete/archive action with confirmation
- [ ] form modal or side panel
- [ ] loading state
- [ ] empty state
- [ ] error state
- [ ] save-in-progress disabled state
- [ ] clear validation feedback
- [ ] brand color aware buttons/focus/active states

Suggested first-pass filters:

- [ ] Programs: search, level, active status.
- [ ] Academic Years: search, status.
- [ ] Terms: school year, status.
- [ ] Levels: program.
- [ ] Subjects: program, active status.
- [ ] Sections: school year, term, program, level, status.
- [ ] Class Offerings: term, section, subject, faculty, status.
- [ ] Academic Enrollments: term, program, level, section, status, billing status.

Acceptance:

- [ ] Screens feel consistent with existing views.
- [ ] Tables behave like existing table screens.
- [ ] No academic screen directly calls Supabase from UI code.
- [ ] No academic screen depends on Training Batch data.

---

## Phase 5 - Academic Fee Model

Academic fees are separate from existing `CourseFee`. Do not modify training course fee behavior except for shared display/reporting compatibility where necessary.

- [ ] Add `academic_fees`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `fee_code`
  - [ ] `fee_name`
  - [ ] `program_id`
  - [ ] `level_id`
  - [ ] `term_id`
  - [ ] `subject_id`
  - [ ] `billing_basis`: `PER_TERM`, `PER_SUBJECT`, `PER_UNIT`, `PER_STUDENT`, `ONE_TIME`
  - [ ] `amount`
  - [ ] `gl_account_id`
  - [ ] `tax_category_id`
  - [ ] `is_active`
- [ ] Add `AcademicFee` TypeScript model.
- [ ] Register `academic_fees` in `SupabaseDataService`.
- [ ] Create `AcademicFeesView.tsx` with the same table standards as Phase 4.
- [ ] Add fee categories/templates:
  - [ ] Tuition
  - [ ] Miscellaneous
  - [ ] Laboratory
  - [ ] Registration
  - [ ] Library
  - [ ] Other school fees

Acceptance:

- [ ] Training `CourseFeesView` remains unchanged.
- [ ] Academic fees can be managed independently.
- [ ] Academic fees support program/level/term/subject scoping.

---

## Phase 6 - Academic Billing Path

Add a new academic billing workflow. Do not change existing training invoice generation behavior.

Recommended UI:

- [ ] `AcademicBillingView.tsx`

Academic billing flow:

```txt
Select student or academic enrollment
Select term
Load academic enrollment details
Load enrolled subjects/class offerings
Compute academic fee lines
Preview invoice
Generate draft/on-hold invoice
Route created invoice to existing invoice/payment lifecycle
```

Academic billing source fields:

- [ ] Add nullable invoice columns:
  - [ ] `academic_enrollment_id`
  - [ ] `academic_term_id`
  - [ ] `class_offering_id`
  - [ ] `billing_source_type`
  - [ ] `billing_source_id`
- [ ] Add nullable invoice line columns:
  - [ ] `academic_fee_id`
  - [ ] `academic_enrollment_id`
  - [ ] `class_offering_id`
- [ ] Add TypeScript invoice fields:
  - [ ] `academicEnrollmentId`
  - [ ] `academicTermId`
  - [ ] `classOfferingId`
  - [ ] `billingSourceType`
  - [ ] `billingSourceId`
- [ ] Add TypeScript invoice line fields:
  - [ ] `academicFeeId`
  - [ ] `academicEnrollmentId`
  - [ ] `classOfferingId`

Billing source types:

- [ ] `ACADEMIC_ENROLLMENT`
- [ ] `ACADEMIC_TERM`
- [ ] `CLASS_OFFERING`

Compatibility note:

- [ ] Existing training invoices may keep `billing_source_type` empty during first rollout.
- [ ] Do not require training code to set `billing_source_type` before academic billing ships.
- [ ] If backfilling later, map old training invoice fields without changing old UI behavior.

Academic billing validations:

- [ ] Prevent duplicate active academic enrollment per student/term unless explicitly allowed.
- [ ] Prevent duplicate academic invoice for the same student/source unless explicitly overridden.
- [ ] Do not bill dropped/inactive subjects unless configured.
- [ ] Require GL account on billable academic fees.
- [ ] Require tax category when needed by VAT configuration.

Acceptance:

- [ ] Existing `InvoicesView` still creates and edits training/manual invoices as before.
- [ ] Academic billing can create a valid invoice with academic source columns.
- [ ] Existing payments apply to academic invoices without special payment logic.
- [ ] Existing invoice posting/voiding rules still apply.

---

## Phase 7 - Grades and Attendance

Add after academic enrollment and class offerings are stable.

- [ ] Add `grades`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `student_id`
  - [ ] `academic_enrollment_subject_id`
  - [ ] `grading_period`
  - [ ] `raw_score`
  - [ ] `grade`
  - [ ] `remarks`
  - [ ] `posted_by`
  - [ ] `posted_at`
- [ ] Add `attendance_records`
  - [ ] `id`
  - [ ] `org_id`
  - [ ] `student_id`
  - [ ] `class_offering_id`
  - [ ] `attendance_date`
  - [ ] `status`
  - [ ] `remarks`
- [ ] Add TypeScript models and service registration.
- [ ] Create:
  - [ ] `GradesView.tsx`
  - [ ] `AttendanceView.tsx`
- [ ] Keep grading schemes configurable later; do not hardcode one school-wide grading scale in first release.

---

## Phase 8 - Student and Faculty Portals

- [ ] Extend `StudentPortalView` by institution support:
  - [ ] `TRAINING`: keep current behavior.
  - [ ] `ACADEMIC`: show academic enrollment, term statement, subjects, schedule, grades, attendance.
  - [ ] `HYBRID`: show `Training`, `Academic`, and `Billing` sections/tabs.
- [ ] Decide faculty model before coding:
  - [ ] Option A: reuse `Trainer` as instructor/faculty alias.
  - [ ] Option B: add separate `faculty` table.
  - [ ] Option C: use `users` with role/profile extensions.
- [ ] Add or extend faculty portal:
  - [ ] assigned class offerings
  - [ ] roster
  - [ ] attendance entry
  - [ ] grade entry

Acceptance:

- [ ] Training portal behavior is unchanged for `TRAINING`.
- [ ] Academic portal data is hidden from tenants that do not support Academic.
- [ ] Hybrid students can distinguish training and academic records clearly.

---

## Phase 9 - Reports and Dashboards

- [ ] Academic Enrollment Summary
- [ ] Masterlist by Program/Level/Section
- [ ] Class Roster
- [ ] Statement of Account by Term
- [ ] Aging by Student/Guardian/Sponsor
- [ ] Collection Report by Program/Term
- [ ] Grade Report
- [ ] Attendance Report
- [ ] Hybrid consolidated student ledger
- [ ] Add academic dimensions to report filters:
  - [ ] Academic year
  - [ ] Term
  - [ ] Program
  - [ ] Level
  - [ ] Section
  - [ ] Subject
- [ ] Add summary RPCs only when needed by performance:
  - [ ] `rpc_academic_enrollment_summary`
  - [ ] `rpc_academic_billing_preview`
  - [ ] `rpc_academic_student_statement`
  - [ ] `rpc_academic_dashboard_summary`

---

## Phase 10 - Security, Indexes, and Performance

- [ ] Add RLS policies for all academic tables using `org_id`.
- [ ] Add indexes:
  - [ ] `academic_programs(org_id, code)`
  - [ ] `academic_years(org_id, school_year)`
  - [ ] `academic_terms(org_id, academic_year_id, starts_at)`
  - [ ] `academic_levels(org_id, program_id, sort_order)`
  - [ ] `subjects(org_id, program_id, code)`
  - [ ] `academic_sections(org_id, term_id, program_id, level_id)`
  - [ ] `class_offerings(org_id, term_id, section_id, subject_id)`
  - [ ] `academic_enrollments(org_id, term_id, student_id)`
  - [ ] `academic_enrollments(org_id, status, enrollment_date desc)`
  - [ ] `academic_enrollment_subjects(org_id, academic_enrollment_id)`
  - [ ] `academic_fees(org_id, term_id, program_id, level_id)`
  - [ ] `grades(org_id, student_id, academic_enrollment_subject_id)`
  - [ ] `attendance_records(org_id, class_offering_id, attendance_date)`
  - [ ] `invoices(org_id, academic_enrollment_id)`
  - [ ] `invoices(org_id, billing_source_type, billing_source_id)`
- [ ] Keep academic list screens lazy-loaded.
- [ ] Do not add academic tables to `getInitialData()` unless a small metadata list is truly required.
- [ ] Prefer `fetchPage()` and RPC summaries over full-table client filtering.

---

## Phase 11 - Migration and Backward Compatibility

- [ ] Keep all existing tenants as `TRAINING`.
- [ ] Keep all existing training tables and current relationships.
- [ ] Add academic tables first.
- [ ] Add nullable academic invoice fields after academic tables exist.
- [ ] Do not require training invoice rows to backfill immediately.
- [ ] Optional later backfill for reporting:
  - [ ] if `assessment_registration_id` exists, set source to `ASSESSMENT_REGISTRATION`
  - [ ] else if `enrollment_id` exists, set source to `TRAINING_ENROLLMENT`
  - [ ] else if `batch_id` exists, set source to `TRAINING_BATCH`
  - [ ] else keep source empty/manual
- [ ] Add compatibility reads in `SupabaseDataService` while online migrations are being applied.
- [ ] Add tenant-level feature flags only if rollout needs staged enablement:
  - [ ] `academicCore`
  - [ ] `academicBilling`
  - [ ] `academicGrades`
  - [ ] `academicAttendance`
  - [ ] `hybridConsolidatedLedger`

---

## Phase 12 - Tests

- [ ] Regression-test current training invoice flow.
- [ ] Regression-test current course fee flow.
- [ ] Regression-test current payment application flow.
- [ ] Regression-test sponsor-funded batch cap logic.
- [ ] Unit-test institution helper selectors.
- [ ] Unit-test academic model mapping and service column transforms.
- [ ] Unit-test academic fee calculation.
- [ ] Integration-test academic invoice creation.
- [ ] Integration-test payment application against academic invoice.
- [ ] Test role access:
  - [ ] Admin
  - [ ] Registrar
  - [ ] Accountant
  - [ ] AR Specialist
  - [ ] Student
  - [ ] Trainer/Faculty
- [ ] Test tenant modes:
  - [ ] `TRAINING`: no academic modules.
  - [ ] `ACADEMIC`: academic modules visible, training batch/assessment modules hidden.
  - [ ] `HYBRID`: both groups visible.
- [ ] Run:
  - [ ] `npm test`
  - [ ] `npm run build`

---

## Recommended Build Order

1. Institution helpers and academic navigation gates.
2. Academic core migrations.
3. Academic TypeScript models and `SupabaseDataService` table registration.
4. Academic Programs, Years, Terms, Levels, and Subjects screens.
5. Academic Sections and Class Offerings screens.
6. Academic Enrollments screen.
7. Academic Fees model and screen.
8. Academic Billing Preview and academic invoice generation.
9. Academic portal extensions.
10. Grades and Attendance.
11. Academic reports and RPC performance work.
12. Hybrid consolidated ledger/dashboard polish.

---

## First Release Scope

Recommended first release:

- [ ] Institution-aware navigation.
- [ ] Academic core tables.
- [ ] Academic models and service registration.
- [ ] Academic Programs CRUD.
- [ ] Academic Years CRUD.
- [ ] Academic Terms CRUD.
- [ ] Academic Levels CRUD.
- [ ] Subjects CRUD.
- [ ] Academic Sections CRUD.
- [ ] Class Offerings CRUD.
- [ ] Academic Enrollments CRUD.
- [ ] Academic Fees CRUD.
- [ ] Academic Billing Preview that creates an invoice through a separate academic path.

Not first release:

- [ ] replacing training batches
- [ ] rewriting accounting
- [ ] migrating old batches into sections
- [ ] forcing one grading scheme
- [ ] complex faculty HR model
- [ ] advanced academic analytics
