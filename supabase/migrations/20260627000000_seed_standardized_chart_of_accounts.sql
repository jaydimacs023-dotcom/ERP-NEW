-- Seed the standardized ENDONELA chart of accounts from coa.md.
--
-- This migration applies the template to every existing organization. It is
-- idempotent by (org_id, code): existing accounts retain their IDs (and any
-- journal references) while their template fields are standardized.
--
-- coa.md does not assign codes to individual expense accounts. Sequential
-- codes were assigned within the 5100, 5200, 5300, 5400, and 9100 sections.

create temporary table coa_seed (
  code text primary key,
  name text not null,
  class text not null,
  parent_code text,
  is_header boolean not null
) on commit drop;

insert into coa_seed (code, name, class, parent_code, is_header) values
  ('1000', 'ASSETS', 'ASSET', null, true),
  ('1100', 'Current Assets', 'ASSET', '1000', true),
  ('1101', 'Cash on Hand', 'ASSET', '1100', false),
  ('1102', 'Petty Cash', 'ASSET', '1100', false),
  ('1103', 'Cash in Bank - Operating', 'ASSET', '1100', false),
  ('1104', 'Cash in Bank - Payroll', 'ASSET', '1100', false),
  ('1110', 'Accounts Receivable - Students', 'ASSET', '1100', false),
  ('1111', 'Accounts Receivable - Corporate Clients', 'ASSET', '1100', false),
  ('1112', 'Accounts Receivable - Other', 'ASSET', '1100', false),
  ('1113', 'Allowance for Doubtful Accounts', 'ASSET', '1100', false),
  ('1120', 'Training Fee Receivable', 'ASSET', '1100', false),
  ('1121', 'Assessment Fee Receivable', 'ASSET', '1100', false),
  ('1130', 'Advances to Officers and Employees', 'ASSET', '1100', false),
  ('1131', 'Employee Advances', 'ASSET', '1100', false),
  ('1132', 'Other Receivables', 'ASSET', '1100', false),
  ('1140', 'Prepaid Rent', 'ASSET', '1100', false),
  ('1141', 'Prepaid Insurance', 'ASSET', '1100', false),
  ('1142', 'Prepaid Software Licenses', 'ASSET', '1100', false),
  ('1143', 'Prepaid Expenses', 'ASSET', '1100', false),
  ('1144', 'Advance Payment - Management System', 'ASSET', '1100', false),
  ('1150', 'Input VAT', 'ASSET', '1100', false),
  ('1160', 'Training Materials Inventory', 'ASSET', '1100', false),
  ('1161', 'Office Supplies Inventory', 'ASSET', '1100', false),
  ('1170', 'Performance Bond', 'ASSET', '1100', false),
  ('1200', 'Property, Plant & Equipment', 'ASSET', '1000', true),
  ('1201', 'Land', 'ASSET', '1200', false),
  ('1202', 'Building', 'ASSET', '1200', false),
  ('1203', 'Leasehold Improvements', 'ASSET', '1200', false),
  ('1204', 'Heavy Equipment - Backhoe/Bulldozer', 'ASSET', '1200', false),
  ('1205', 'Laboratory Facilities', 'ASSET', '1200', false),
  ('1206', 'Training Equipment', 'ASSET', '1200', false),
  ('1207', 'Mixer', 'ASSET', '1200', false),
  ('1208', 'Room and Office Facilities', 'ASSET', '1200', false),
  ('1209', 'Vehicles and Canopy - MTP', 'ASSET', '1200', false),
  ('1210', 'School Vehicle', 'ASSET', '1200', false),
  ('1211', 'Office Equipment', 'ASSET', '1200', false),
  ('1212', 'School and Office Equipment', 'ASSET', '1200', false),
  ('1213', 'Computers and Laptops', 'ASSET', '1200', false),
  ('1214', 'Network Equipment', 'ASSET', '1200', false),
  ('1215', 'Furniture and Fixtures', 'ASSET', '1200', false),
  ('1216', 'Tools and Equipment', 'ASSET', '1200', false),
  ('1217', 'School Training Van', 'ASSET', '1200', false),
  ('1218', 'Fire Extinguisher', 'ASSET', '1200', false),
  ('1219', 'Classroom Chairs', 'ASSET', '1200', false),
  ('1220', 'Canteen Utensils', 'ASSET', '1200', false),
  ('1290', 'Accumulated Depreciation (Contra Asset)', 'ASSET', '1200', false),

  ('2000', 'LIABILITIES', 'LIABILITY', null, true),
  ('2100', 'Current Liabilities', 'LIABILITY', '2000', true),
  ('2101', 'Accounts Payable', 'LIABILITY', '2100', false),
  ('2102', 'Accounts Payable - Others', 'LIABILITY', '2100', false),
  ('2110', 'Accrued Salaries', 'LIABILITY', '2100', false),
  ('2111', 'Accrued Expenses', 'LIABILITY', '2100', false),
  ('2112', 'Accrued Expense Payable', 'LIABILITY', '2100', false),
  ('2120', 'SSS Payable', 'LIABILITY', '2100', false),
  ('2121', 'PhilHealth Payable', 'LIABILITY', '2100', false),
  ('2122', 'Pag-IBIG Payable', 'LIABILITY', '2100', false),
  ('2123', 'SSS/PHIC/HDMF Payable', 'LIABILITY', '2100', false),
  ('2124', 'Withholding Tax Payable', 'LIABILITY', '2100', false),
  ('2130', 'Output VAT', 'LIABILITY', '2100', false),
  ('2140', 'Unearned Training Revenue', 'LIABILITY', '2100', false),
  ('2141', 'Student Deposits', 'LIABILITY', '2100', false),
  ('2142', 'Deferred Enrollment Fees', 'LIABILITY', '2100', false),
  ('2200', 'Long-Term Liabilities', 'LIABILITY', '2000', true),
  ('2201', 'Bank Loan', 'LIABILITY', '2200', false),
  ('2202', 'Equipment Loan', 'LIABILITY', '2200', false),
  ('2203', 'Lease Liability', 'LIABILITY', '2200', false),
  ('2204', 'Loans Payable', 'LIABILITY', '2200', false),

  ('3000', 'EQUITY', 'EQUITY', null, true),
  ('3101', 'Capital', 'EQUITY', '3000', false),
  ('3201', 'Retained Earnings', 'EQUITY', '3000', false),
  ('3301', 'Current Year Earnings', 'EQUITY', '3000', false),

  ('4000', 'REVENUE', 'REVENUE', null, true),
  ('4100', 'Educational Revenue', 'REVENUE', '4000', true),
  ('4110', 'Training Fees', 'REVENUE', '4100', false),
  ('4111', 'Enrollment Fees', 'REVENUE', '4100', false),
  ('4112', 'Assessment Fees', 'REVENUE', '4100', false),
  ('4113', 'Certification Fees', 'REVENUE', '4100', false),
  ('4114', 'Graduation Fees', 'REVENUE', '4100', false),
  ('4120', 'Corporate Training Revenue', 'REVENUE', '4100', false),
  ('4121', 'Customized Training Revenue', 'REVENUE', '4100', false),
  ('4130', 'Training Material Revenue', 'REVENUE', '4100', false),
  ('4140', 'Other Educational Revenue', 'REVENUE', '4100', false),
  ('8000', 'OTHER INCOME', 'REVENUE', null, true),
  ('8100', 'Other Income', 'REVENUE', '8000', true),
  ('8110', 'Interest Income', 'REVENUE', '8100', false),
  ('8120', 'Rental Income', 'REVENUE', '8100', false),
  ('8130', 'Miscellaneous Income', 'REVENUE', '8100', false),

  ('5000', 'EXPENSES', 'EXPENSE', null, true),
  ('5100', 'PROGRAM EXPENSES', 'EXPENSE', '5000', true),
  ('5101', 'Trainer Fees', 'EXPENSE', '5100', false),
  ('5102', 'Instructor Salaries', 'EXPENSE', '5100', false),
  ('5103', 'Laboratory Consumable Materials', 'EXPENSE', '5100', false),
  ('5104', 'Training Materials Expense', 'EXPENSE', '5100', false),
  ('5105', 'Student Kits Expense', 'EXPENSE', '5100', false),
  ('5106', 'Learning Materials Expense', 'EXPENSE', '5100', false),
  ('5107', 'Assessor''s Fee', 'EXPENSE', '5100', false),
  ('5108', 'Assessment Fees Expense', 'EXPENSE', '5100', false),
  ('5109', 'Certification Fees Expense', 'EXPENSE', '5100', false),
  ('5110', 'Laundry', 'EXPENSE', '5100', false),
  ('5111', 'Light & Power', 'EXPENSE', '5100', false),
  ('5112', 'Marketing Expense', 'EXPENSE', '5100', false),
  ('5113', 'Interest Expense', 'EXPENSE', '5100', false),
  ('5114', 'Rental', 'EXPENSE', '5100', false),
  ('5115', 'Salaries, Wages & Other Benefits', 'EXPENSE', '5100', false),
  ('5116', 'Students Assessment Expense', 'EXPENSE', '5100', false),
  ('5117', 'School Activities', 'EXPENSE', '5100', false),
  ('5118', 'Student Medical Assistance', 'EXPENSE', '5100', false),
  ('5119', 'Students Uniform, ID and Insurance', 'EXPENSE', '5100', false),
  ('5120', 'Repair & Maintenance - Training Equipment', 'EXPENSE', '5100', false),
  ('5121', 'Repair & Maintenance - Facilities & Equipment', 'EXPENSE', '5100', false),
  ('5122', 'Transportation Expense - Program', 'EXPENSE', '5100', false),
  ('5123', 'Meals Expense - Program', 'EXPENSE', '5100', false),
  ('5124', 'Vehicle Registration', 'EXPENSE', '5100', false),
  ('5125', 'Training Expense', 'EXPENSE', '5100', false),
  ('5126', 'Scholarship Expense', 'EXPENSE', '5100', false),
  ('5127', 'Trainee Allowances', 'EXPENSE', '5100', false),
  ('5128', 'Other Program Expenses', 'EXPENSE', '5100', false),

  ('5200', 'ADMINISTRATIVE EXPENSES', 'EXPENSE', '5000', true),
  ('5201', '13th Month Pay and Other Benefits', 'EXPENSE', '5200', false),
  ('5202', 'Accreditation', 'EXPENSE', '5200', false),
  ('5203', 'Allowances', 'EXPENSE', '5200', false),
  ('5204', 'Administrative Salaries', 'EXPENSE', '5200', false),
  ('5205', 'Management Salaries', 'EXPENSE', '5200', false),
  ('5206', 'Bank Charges', 'EXPENSE', '5200', false),
  ('5207', 'Communication', 'EXPENSE', '5200', false),
  ('5208', 'Depreciation Expense', 'EXPENSE', '5200', false),
  ('5209', 'Documentary Stamp Tax', 'EXPENSE', '5200', false),
  ('5210', 'Donation / Financial Assistance', 'EXPENSE', '5200', false),
  ('5211', 'Gasoline and Oil', 'EXPENSE', '5200', false),
  ('5212', 'Internet Expense', 'EXPENSE', '5200', false),
  ('5213', 'Telephone Expense', 'EXPENSE', '5200', false),
  ('5214', 'Membership and Dues', 'EXPENSE', '5200', false),
  ('5215', 'Miscellaneous Expense', 'EXPENSE', '5200', false),
  ('5216', 'Office Supplies Expense', 'EXPENSE', '5200', false),
  ('5217', 'Postage', 'EXPENSE', '5200', false),
  ('5218', 'Professional Fees', 'EXPENSE', '5200', false),
  ('5219', 'Rent Expense', 'EXPENSE', '5200', false),
  ('5220', 'Repairs and Maintenance - Office Equipment', 'EXPENSE', '5200', false),
  ('5221', 'Repairs and Maintenance - School Vehicle', 'EXPENSE', '5200', false),
  ('5222', 'Representation', 'EXPENSE', '5200', false),
  ('5223', 'Software Subscription Expense', 'EXPENSE', '5200', false),
  ('5224', 'SSS/PHIC/HDMF Contribution', 'EXPENSE', '5200', false),
  ('5225', 'School and Office Supplies', 'EXPENSE', '5200', false),
  ('5226', 'Taxes and Licenses', 'EXPENSE', '5200', false),
  ('5227', 'Trainings and Seminar', 'EXPENSE', '5200', false),
  ('5228', 'Travel and Transportation', 'EXPENSE', '5200', false),
  ('5229', 'Utilities Expense', 'EXPENSE', '5200', false),

  ('5300', 'MARKETING EXPENSES', 'EXPENSE', '5000', true),
  ('5301', 'Advertising Expense', 'EXPENSE', '5300', false),
  ('5302', 'Facebook Advertising', 'EXPENSE', '5300', false),
  ('5303', 'Promotional Materials', 'EXPENSE', '5300', false),
  ('5304', 'Events and Seminars', 'EXPENSE', '5300', false),
  ('5305', 'Marketing Campaign Expense', 'EXPENSE', '5300', false),

  ('5400', 'FINANCE COSTS', 'EXPENSE', '5000', true),
  ('5401', 'Interest Expense', 'EXPENSE', '5400', false),
  ('5402', 'Loan Charges', 'EXPENSE', '5400', false),
  ('5403', 'Financing Charges', 'EXPENSE', '5400', false),

  ('9000', 'OTHER EXPENSES', 'EXPENSE', null, true),
  ('9100', 'Other Expenses', 'EXPENSE', '9000', true),
  ('9101', 'Penalties and Surcharges', 'EXPENSE', '9100', false),
  ('9102', 'Loss on Disposal of Assets', 'EXPENSE', '9100', false),
  ('9103', 'Miscellaneous Expense', 'EXPENSE', '9100', false);

-- Insert missing accounts first. Parent links are populated in a second pass
-- because parent and child rows may both be new.
insert into public.chart_of_accounts (
  org_id,
  code,
  name,
  class,
  parent_id,
  is_header,
  is_active
)
select
  organization.id,
  seed.code,
  seed.name,
  seed.class,
  null,
  seed.is_header,
  true
from public.organizations as organization
cross join coa_seed as seed
where not exists (
  select 1
  from public.chart_of_accounts as account
  where account.org_id = organization.id
    and account.code = seed.code
);

-- Standardize template-controlled fields without replacing account IDs.
update public.chart_of_accounts as account
set
  name = seed.name,
  class = seed.class,
  is_header = seed.is_header,
  is_active = true
from coa_seed as seed
where account.code = seed.code;

-- Resolve each parent within the same organization. Ordering keeps this safe
-- for legacy databases that may already contain duplicate account codes.
update public.chart_of_accounts as account
set parent_id = case
  when seed.parent_code is null then null
  else (
    select parent.id
    from public.chart_of_accounts as parent
    where parent.org_id = account.org_id
      and parent.code = seed.parent_code
    order by parent.id
    limit 1
  )
end
from coa_seed as seed
where account.code = seed.code;
