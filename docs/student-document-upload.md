# Student Document Upload Architecture & API Guide

## 1. System Architecture

The Student Portal features independent document uploading for each required document type. Updating one document (e.g., Transcript of Records) never alters or overwrites other student documents or the profile photo.

```
┌─────────────────────────────────────────────────────────────────┐
│                       StudentPortalView                         │
│  - User uploads document (click button)                         │
│  - Shows camera or file picker                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │    File/Camera Input Handler       │
        │  - prepareUploadData()             │
        │  - Optimize image if needed        │
        │  - Convert to base64               │
        └────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────┐
    │   handleDocumentUpload (Router Function)   │
    │  - Identify document type from docId      │
    │  - Route to appropriate handler           │
    └────────────┬───────────────────────────────┘
                 │
        ┌────────┴─────────┬──────────────┬─────────────────┐
        │                  │              │                 │
        ▼                  ▼              ▼                 ▼
    Profile Photo       TOR Upload    Birth Cert      Application
    Upload             Upload        Upload          Form Upload
    ┌──────────┐    ┌──────────┐  ┌──────────┐    ┌──────────┐
    │updateProf│    │updateTOR │  │updateBC  │    │updateApp │
    │ilePhoto()│    │()        │  │()        │    │Form()    │
    └────┬─────┘    └────┬─────┘  └────┬─────┘    └────┬─────┘
         │               │             │               │
         │               └─────┬───────┘               │
         │                     │                       │
         │          ┌──────────▼────────────┐         │
         │          │StudentDocumentService │         │
         │          │  - Independent logic  │         │
         │          │  - Isolation ensures  │         │
         │          │  - No cross-effects   │         │
         │          └──────────┬────────────┘         │
         │                     │                       │
         ├─────────────────────┴───────────────────────┤
         │                                             │
         ▼                                             ▼
    ┌──────────────────┐                    ┌──────────────────┐
    │ student.profile  │                    │ student.documents│
    │   Photo: Data    │                    │ Array:           │
    │                  │                    │  - TOR           │
    │ (ISOLATED)       │                    │  - Birth Cert    │
    │                  │                    │  - App Form      │
    │ (INDEPENDENT)    │                    │                  │
    │                  │                    │ (ISOLATED)       │
    │                  │                    │ (INDEPENDENT)    │
    └──────────────────┘                    └──────────────────┘
         │                                             │
         └─────────────────┬──────────────────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │   Updated Student Object │
              │  (Passed to parent via   │
              │   onUpdateStudent())     │
              └──────────────────────────┘
```

---

## 2. Document Types

The system supports four primary student document types:

| Document Type | Constant | Description | Storage Field |
|---|---|---|---|
| Profile Photo | `PHOTO` | Passport-sized learner portrait | `student.profilePhoto` |
| Transcript of Records | `TOR` | Prior academic records | `student.documents[]` (name: "Transcript of Records") |
| Birth Certificate | `BIRTH_CERTIFICATE` | PSA / official certificate | `student.documents[]` (name: "Birth Certificate") |
| Application Form | `APPLICATION_FORM` | Signed admission form | `student.documents[]` (name: "Application Form") |

---

## 3. Available Service Functions

All functions reside in [`services/StudentDocumentService.ts`](file:///e:/laragon/www/ERP-NEW/services/StudentDocumentService.ts).

### `updateProfilePhoto(student, fileData)`
Updates only `student.profilePhoto`. The `documents` array remains untouched.

```typescript
import { updateProfilePhoto } from '../services/StudentDocumentService';

const updatedStudent = updateProfilePhoto(student, photoBase64Data);
onUpdateStudent(updatedStudent);
```

### `updateTOR(student, fileData)`
Updates only the Transcript of Records entry in `student.documents[]`.

```typescript
import { updateTOR } from '../services/StudentDocumentService';

const updatedStudent = updateTOR(student, torFileData);
onUpdateStudent(updatedStudent);
```

### `updateBirthCertificate(student, fileData)`
Updates only the Birth Certificate entry in `student.documents[]`.

```typescript
import { updateBirthCertificate } from '../services/StudentDocumentService';

const updatedStudent = updateBirthCertificate(student, bcFileData);
onUpdateStudent(updatedStudent);
```

### `updateApplicationForm(student, fileData)`
Updates only the Application Form entry in `student.documents[]`.

```typescript
import { updateApplicationForm } from '../services/StudentDocumentService';

const updatedStudent = updateApplicationForm(student, appFormData);
onUpdateStudent(updatedStudent);
```

---

## 4. Helper & Compliance Queries

```typescript
import { 
  getDocumentByType, 
  isDocumentUploaded, 
  isDocumentVerified, 
  getDocumentUploadProgress, 
  getCompliancePercentage 
} from '../services/StudentDocumentService';

// Fetch single document record
const tor = getDocumentByType(student, 'TOR');

// Boolean checks
const hasBC = isDocumentUploaded(student, 'BIRTH_CERTIFICATE');
const torVerified = isDocumentVerified(student, 'TOR');

// Progress checklist map
const progress = getDocumentUploadProgress(student);
// => { PHOTO: true, TOR: false, BIRTH_CERTIFICATE: true, APPLICATION_FORM: false }

// Percentage compliance score (0 - 100)
const score = getCompliancePercentage(student);
```

---

## 5. Lifecycle & Verification Flow

```
PENDING ──► UPLOADED ──► VERIFIED
               │
               └──► REJECTED (Requires re-upload)
```

- **PENDING**: Placeholder created, file awaiting learner upload.
- **UPLOADED**: File received, queued for registrar/auditor review.
- **VERIFIED**: Auditor confirmed document authenticity.
- **REJECTED**: Document rejected with audit remarks.
