# AT-ERP DESIGN SYSTEM
Version: 2.0
System: AT-ERP (AccountTech ERP)
Architecture: Multi-Tenant Enterprise SaaS ERP
Design Style: Bento Grid Enterprise SaaS
Authoritative File: design.md

---

# OVERVIEW

This document defines the official UI/UX Design System for AT-ERP.

The purpose of this document is to ensure:
- UI consistency
- scalability
- readability
- maintainability
- reusable enterprise components
- multi-tenant branding compatibility

This file acts as the SINGLE SOURCE OF TRUTH for:
- typography
- spacing
- tables
- cards
- dashboard layouts
- responsive behavior
- visual hierarchy
- component styling

All frontend/UI implementations MUST follow this document.

---

# CORE DESIGN PHILOSOPHY

AT-ERP is:
- a professional enterprise ERP
- accounting-heavy
- modular
- data-dense
- workflow-driven
- multi-tenant SaaS

The UI must prioritize:
- clarity over decoration
- fast readability
- low eye fatigue
- information hierarchy
- consistency
- enterprise professionalism
- modular scalability

The system must feel:
- modern
- premium
- structured
- efficient
- stable
- scalable

---

# DESIGN PRINCIPLES

## 1. Consistency First
All modules must visually feel part of the same system.

Avoid:
- random spacing
- inconsistent fonts
- varying card styles
- multiple button styles
- different table layouts

---

## 2. Information Density
ERP users work with:
- tables
- accounting data
- reports
- forms
- ledgers
- dashboards

The UI must maximize readability while minimizing wasted space.

---

## 3. Bento Grid Layout System
The entire ERP uses a modular Bento Grid system.

Meaning:
- modular cards
- reusable blocks
- structured sections
- clean dashboard composition

---

## 4. Multi-Tenant Branding Support
The system supports tenant/company branding.

Branding is controlled through:
- brandColor classnames
- tenant theme variables
- tenant logo
- tenant identity

IMPORTANT:
DO NOT REMOVE OR REPLACE EXISTING brandColor LOGIC.

Typography/layout improvements must work with any tenant branding color.

---

# GLOBAL TYPOGRAPHY SYSTEM

## Official UI Font

Primary Font:
Inter

Fallback:
sans-serif

Example:
font-family: 'Inter', sans-serif;

---

## Branding Font (Optional)
Used ONLY for:
- login page
- landing page
- branding
- marketing pages

Recommended:
General Sans

---

# TYPOGRAPHY SCALE

## Page Title
Used for:
- module headers
- dashboard titles

Style:
- font-size: 24px
- font-weight: 700
- line-height: 1.2
- letter-spacing: -0.03em

---

## Section Title
Used for:
- card groups
- section headers

Style:
- font-size: 18px
- font-weight: 600

---

## Card Title
Style:
- font-size: 13px
- font-weight: 600
- letter-spacing: -0.01em

---

## Card Value / KPI
Style:
- font-size: 28px
- font-weight: 700
- letter-spacing: -0.03em

---

## Body Text
Style:
- font-size: 14px
- font-weight: 400
- line-height: 1.5

---

## Sidebar Text
Style:
- font-size: 14px
- font-weight: 500

---

## Small Labels
Used for:
- captions
- helper text
- descriptions

Style:
- font-size: 12px
- font-weight: 400

---

# TABLE DESIGN SYSTEM

Tables are the MOST IMPORTANT UI COMPONENT in AT-ERP.

All tables must follow these standards.

---

# TABLE TYPOGRAPHY

## Table Header

Style:
- font-size: 12px
- font-weight: 600
- text-transform: uppercase
- letter-spacing: 0.03em

Color:
- slightly muted

Behavior:
- sticky header preferred

---

## Table Body

Style:
- font-size: 13px
- font-weight: 400
- line-height: 1.45

---

## Numeric Columns

IMPORTANT:
All accounting/numeric columns MUST use tabular numbers.

Style:
- font-variant-numeric: tabular-nums
- font-weight: 500

Applies to:
- currency
- debit/credit
- balances
- quantities
- totals

---

# TABLE SPACING

Row Height:
- compact
- enterprise density

Padding:
- vertical: 10px–12px
- horizontal: 14px–16px

Avoid:
- oversized rows
- excessive whitespace

---

# TABLE BEHAVIOR

Required:
- hover state
- row highlight
- loading skeleton
- empty state
- pagination
- responsive overflow

Preferred:
- sticky headers
- sticky action column

---

# CARD DESIGN SYSTEM

Cards follow Bento Grid principles.

Cards must feel:
- modular
- clean
- reusable
- structured

---

# CARD CONTAINER

Style:
- border-radius: 16px
- padding: 16px–20px
- soft shadow
- subtle border
- modular spacing

Avoid:
- heavy borders
- aggressive gradients
- excessive glow

---

# CARD HIERARCHY

Card Structure:
1. Label
2. Value
3. Description/Trend
4. Action (optional)

---

# KPI CARDS

Used for:
- dashboard statistics
- accounting totals
- summaries

Style:
- large numeric emphasis
- minimal clutter
- high readability

---

# BENTO GRID SYSTEM

## Desktop
- 12-column grid
- modular layout blocks

---

## Tablet
- 6-column grid

---

## Mobile
- single-column stack

---

# SPACING SYSTEM

Base Unit:
4px

Common Spacing:
- 4
- 8
- 12
- 16
- 20
- 24
- 32

Avoid arbitrary spacing values.

---

# BORDER RADIUS SYSTEM

Small:
8px

Medium:
12px

Large:
16px

Avoid inconsistent radius values.

---

# SHADOW SYSTEM

Use subtle shadows only.

Purpose:
- depth
- separation
- hierarchy

Avoid:
- strong glows
- heavy blur
- neon effects

---

# COLOR SYSTEM

IMPORTANT:
brandColor remains the official tenant branding system.

DO NOT:
- hardcode colors globally
- remove brandColor classes
- replace tenant branding logic

The UI must adapt dynamically to:
- tenant branding
- light/dark themes
- future white-label support

---

# BUTTON SYSTEM

Primary Button:
- uses brandColor
- medium emphasis

Secondary Button:
- neutral background

Danger Button:
- red accent

Buttons must:
- have consistent height
- consistent radius
- consistent padding

---

# FORM DESIGN SYSTEM

Forms must:
- prioritize readability
- maintain compact spacing
- avoid oversized controls

Input Height:
- medium density

Labels:
- small uppercase optional
- clear hierarchy

---

# MODAL DESIGN SYSTEM

Modals must:
- maintain focus
- avoid excessive size
- support scrolling

Preferred:
- sticky header/footer

---

# SIDEBAR SYSTEM

Sidebar must:
- remain compact
- support many modules
- avoid visual clutter

Navigation Items:
- consistent spacing
- clear active state
- readable typography

---

# DASHBOARD SYSTEM

Dashboards use Bento Grid layout.

Structure:
- KPI row
- charts
- activity panels
- quick actions
- transaction previews

Dashboards must remain scannable within 3 seconds.

---

# RESPONSIVE RULES

Desktop:
optimized for productivity

Tablet:
prioritize stacking

Mobile:
prioritize readability

---

# PERFORMANCE RULES

Avoid:
- excessive DOM rendering
- unnecessary animations
- oversized shadows
- huge gradients

Required:
- lazy loading
- skeleton loaders
- pagination
- optimized tables

---

# ACCESSIBILITY RULES

Required:
- readable contrast
- visible hover states
- visible focus states
- keyboard accessibility

Avoid:
- ultra-light text
- tiny clickable areas

---

# COMPONENT REUSABILITY RULE

If a new component is created:
- it MUST follow this design system
- it MUST be reusable
- it MUST support brandColor
- it MUST support dark/light themes

---

# STRICT AI AGENT RULES

When refactoring UI:

DO:
- update typography
- update spacing
- update table styling
- update card styling
- centralize theme logic
- reuse components

DO NOT:
- modify business logic
- modify APIs
- modify workflows
- modify database queries
- modify accounting logic
- remove brandColor logic

Priority Order:
1. Tables
2. Cards
3. Sidebar
4. Dashboard
5. Forms
6. Modals

---

# TARGET VISUAL DIRECTION

AT-ERP visual direction is inspired by:
- modern enterprise ERP
- Bento SaaS dashboards
- Acumatica
- Linear
- Stripe
- Supabase
- modern fintech systems

The final UI must feel:
- enterprise-grade
- scalable
- premium
- modern
- efficient
- accounting-friendly

---

# FINAL RULE

ALL UI CHANGES MUST:
- improve consistency
- improve readability
- reduce visual clutter
- maintain scalability
- preserve tenant branding
- preserve existing business logic