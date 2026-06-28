# ENDONELA ERP - STANDARDIZED CHART OF ACCOUNTS

> Consolidated from the default ERP COA and the organization's audited
> financial statements.

## 1000 ASSETS

### 1100 Current Assets

  Code   Account Name
  ------ -----------------------------------------
  1101   Cash on Hand
  1102   Petty Cash
  1103   Cash in Bank - Operating
  1104   Cash in Bank - Payroll
  1110   Accounts Receivable - Students
  1111   Accounts Receivable - Corporate Clients
  1112   Accounts Receivable - Other
  1113   Allowance for Doubtful Accounts
  1120   Training Fee Receivable
  1121   Assessment Fee Receivable
  1130   Advances to Officers and Employees
  1131   Employee Advances
  1132   Other Receivables
  1140   Prepaid Rent
  1141   Prepaid Insurance
  1142   Prepaid Software Licenses
  1143   Prepaid Expenses
  1144   Advance Payment - Management System
  1150   Input VAT
  1160   Training Materials Inventory
  1161   Office Supplies Inventory
  1170   Performance Bond

### 1200 Property, Plant & Equipment

  Code   Account Name
  ------ -----------------------------------------
  1201   Land
  1202   Building
  1203   Leasehold Improvements
  1204   Heavy Equipment - Backhoe/Bulldozer
  1205   Laboratory Facilities
  1206   Training Equipment
  1207   Mixer
  1208   Room and Office Facilities
  1209   Vehicles and Canopy - MTP
  1210   School Vehicle
  1211   Office Equipment
  1212   School and Office Equipment
  1213   Computers and Laptops
  1214   Network Equipment
  1215   Furniture and Fixtures
  1216   Tools and Equipment
  1217   School Training Van
  1218   Fire Extinguisher
  1219   Classroom Chairs
  1220   Canteen Utensils
  1290   Accumulated Depreciation (Contra Asset)

## 2000 LIABILITIES

### 2100 Current Liabilities

  Code   Account Name
  ------ ---------------------------
  2101   Accounts Payable
  2102   Accounts Payable - Others
  2110   Accrued Salaries
  2111   Accrued Expenses
  2112   Accrued Expense Payable
  2120   SSS Payable
  2121   PhilHealth Payable
  2122   Pag-IBIG Payable
  2123   SSS/PHIC/HDMF Payable
  2124   Withholding Tax Payable
  2130   Output VAT
  2140   Unearned Training Revenue
  2141   Student Deposits
  2142   Deferred Enrollment Fees

### 2200 Long-Term Liabilities

  Code   Account Name
  ------ -----------------
  2201   Bank Loan
  2202   Equipment Loan
  2203   Lease Liability
  2204   Loans Payable

## 3000 EQUITY

-   3101 Capital
-   3201 Retained Earnings
-   3301 Current Year Earnings

## 4000 REVENUE

-   4110 Training Fees
-   4111 Enrollment Fees
-   4112 Assessment Fees
-   4113 Certification Fees
-   4114 Graduation Fees
-   4120 Corporate Training Revenue
-   4121 Customized Training Revenue
-   4130 Training Material Revenue
-   4140 Other Educational Revenue
-   8110 Interest Income
-   8120 Rental Income
-   8130 Miscellaneous Income

## 5100 PROGRAM EXPENSES

-   Trainer Fees
-   Instructor Salaries
-   Laboratory Consumable Materials
-   Training Materials Expense
-   Student Kits Expense
-   Learning Materials Expense
-   Assessor's Fee
-   Assessment Fees Expense
-   Certification Fees Expense
-   Laundry
-   Light & Power
-   Marketing Expense
-   Interest Expense
-   Rental
-   Salaries, Wages & Other Benefits
-   Students Assessment Expense
-   School Activities
-   Student Medical Assistance
-   Students Uniform, ID and Insurance
-   Repair & Maintenance - Training Equipment
-   Repair & Maintenance - Facilities & Equipment
-   Transportation Expense - Program
-   Meals Expense - Program
-   Vehicle Registration
-   Training Expense
-   Scholarship Expense
-   Trainee Allowances
-   Other Program Expenses

## 5200 ADMINISTRATIVE EXPENSES

-   13th Month Pay and Other Benefits
-   Accreditation
-   Allowances
-   Administrative Salaries
-   Management Salaries
-   Bank Charges
-   Communication
-   Depreciation Expense
-   Documentary Stamp Tax
-   Donation / Financial Assistance
-   Gasoline and Oil
-   Internet Expense
-   Telephone Expense
-   Membership and Dues
-   Miscellaneous Expense
-   Office Supplies Expense
-   Postage
-   Professional Fees
-   Rent Expense
-   Repairs and Maintenance - Office Equipment
-   Repairs and Maintenance - School Vehicle
-   Representation
-   Software Subscription Expense
-   SSS/PHIC/HDMF Contribution
-   School and Office Supplies
-   Taxes and Licenses
-   Trainings and Seminar
-   Travel and Transportation
-   Utilities Expense

## 5300 MARKETING EXPENSES

-   Advertising Expense
-   Facebook Advertising
-   Promotional Materials
-   Events and Seminars
-   Marketing Campaign Expense

## 5400 FINANCE COSTS

-   Interest Expense
-   Loan Charges
-   Financing Charges

## 9100 OTHER EXPENSES

-   Penalties and Surcharges
-   Loss on Disposal of Assets
-   Miscellaneous Expense

------------------------------------------------------------------------

# ERP Design Guidelines

-   One account per accounting purpose.
-   Do **not** create accounts per course, student, training batch, or
    branch.
-   Use dimensions instead:
    -   organization_id
    -   campus_id
    -   department_id
    -   course_id
    -   training_batch_id
    -   student_id
    -   project_id
    -   invoice_id
    -   cost_center_id
-   Support multi-company and multi-branch using dimensions rather than
    duplicating the Chart of Accounts.
