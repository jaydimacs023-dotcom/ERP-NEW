# Student Document Upload - Independent Update Functions

## Overview

The Student Portal now supports **independent document uploading** for different document types. This means uploading or updating one document (e.g., TOR) will not affect any other documents (e.g., Birth Certificate, Application Form, or Profile Photo).

## Document Types

The system supports four primary document types:

| Document Type | Constant | Description |
|---|---|---|
| Profile Photo | `PHOTO` | Passport size photo stored in `student.profilePhoto` |
| Transcript of Records | `TOR` | Student academic transcript |
| Birth Certificate | `BIRTH_CERTIFICATE` | Official birth certificate |
| Application Form | `APPLICATION_FORM` | Student application form |

## Available Functions

### 1. `updateProfilePhoto(student, fileData)`
**Updates only the profile photo independently**

- **Parameters:**
  - `student` (Student): The student object to update
  - `fileData` (string): Base64-encoded image data
  
- **Returns:** Updated Student object with new profile photo
- **Effect:** Only modifies `student.profilePhoto`; documents array remains unchanged

```typescript
import { updateProfilePhoto } from '../services/StudentDocumentService';

const updatedStudent = updateProfilePhoto(student, photoBase64Data);
onUpdateStudent(updatedStudent);
```

### 2. `updateTOR(student, fileData)`
**Updates only the Transcript of Records independently**

- **Parameters:**
  - `student` (Student): The student object to update
  - `fileData` (string): Base64-encoded file data (PDF or image)
  
- **Returns:** Updated Student object with new TOR
- **Effect:** Only modifies the TOR document in the documents array; profile photo and other documents remain unchanged

```typescript
import { updateTOR } from '../services/StudentDocumentService';

const updatedStudent = updateTOR(student, torFileData);
onUpdateStudent(updatedStudent);
```

### 3. `updateBirthCertificate(student, fileData)`
**Updates only the Birth Certificate independently**

- **Parameters:**
  - `student` (Student): The student object to update
  - `fileData` (string): Base64-encoded file data (PDF or image)
  
- **Returns:** Updated Student object with new Birth Certificate
- **Effect:** Only modifies the Birth Certificate document; other documents remain unchanged

```typescript
import { updateBirthCertificate } from '../services/StudentDocumentService';

const updatedStudent = updateBirthCertificate(student, bcFileData);
onUpdateStudent(updatedStudent);
```

### 4. `updateApplicationForm(student, fileData)`
**Updates only the Application Form independently**

- **Parameters:**
  - `student` (Student): The student object to update
  - `fileData` (string): Base64-encoded file data (PDF or image)
  
- **Returns:** Updated Student object with new Application Form
- **Effect:** Only modifies the Application Form document; other documents remain unchanged

```typescript
import { updateApplicationForm } from '../services/StudentDocumentService';

const updatedStudent = updateApplicationForm(student, appFormData);
onUpdateStudent(updatedStudent);
```

## Utility Functions

### `updateDocument(student, docType, fileData)`
Generic function that routes to the appropriate handler based on document type.

```typescript
import { updateDocument } from '../services/StudentDocumentService';

const updatedStudent = updateDocument(student, 'TOR', fileData);
onUpdateStudent(updatedStudent);
```

### `getDocumentByType(student, docType)`
Retrieve a specific document by type.

```typescript
import { getDocumentByType } from '../services/StudentDocumentService';

const torDocument = getDocumentByType(student, 'TOR');
if (torDocument?.fileData) {
  console.log('TOR is uploaded');
}
```

### `isDocumentUploaded(student, docType)`
Check if a specific document is uploaded.

```typescript
import { isDocumentUploaded } from '../services/StudentDocumentService';

if (isDocumentUploaded(student, 'BIRTH_CERTIFICATE')) {
  console.log('Birth Certificate has been uploaded');
}
```

### `isDocumentVerified(student, docType)`
Check if a specific document is verified by the auditor.

```typescript
import { isDocumentVerified } from '../services/StudentDocumentService';

if (isDocumentVerified(student, 'TOR')) {
  console.log('TOR has been verified');
}
```

### `getDocumentUploadProgress(student)`
Get the upload status for all document types.

```typescript
import { getDocumentUploadProgress } from '../services/StudentDocumentService';

const progress = getDocumentUploadProgress(student);
// Returns: { PHOTO: true, TOR: false, BIRTH_CERTIFICATE: true, APPLICATION_FORM: false }
```

### `getCompliancePercentage(student)`
Calculate the overall compliance percentage (0-100).

```typescript
import { getCompliancePercentage } from '../services/StudentDocumentService';

const compliance = getCompliancePercentage(student);
console.log(`Student is ${compliance}% compliant`);
```

## Implementation in StudentPortalView

The StudentPortalView automatically routes document uploads to the appropriate independent handler:

```typescript
// Profile photo upload
handleProfilePhotoUpload(photoData);
// ✓ Updates only student.profilePhoto
// ✓ Documents array is NOT modified

// TOR upload
handleTORUpload(torData);
// ✓ Updates only the TOR document
// ✓ Profile photo is NOT modified
// ✓ Other documents are NOT modified

// Birth Certificate upload
handleBirthCertificateUpload(bcData);
// ✓ Updates only the Birth Certificate document
// ✓ All other documents are NOT modified

// Application Form upload
handleApplicationFormUpload(appFormData);
// ✓ Updates only the Application Form document
// ✓ All other documents are NOT modified
```

## Document Status Flow

Each document (except profile photo) has the following status flow:

```
PENDING → UPLOADED → VERIFIED
         ↓
       REJECTED
```

### Status Definitions

- **PENDING**: Document not yet uploaded
- **UPLOADED**: Document uploaded but pending verification
- **VERIFIED**: Document verified by auditor
- **REJECTED**: Document rejected and requires re-upload

## StudentDocument Interface

```typescript
interface StudentDocument {
  id: string;                          // Unique identifier
  name: string;                        // Document type name (e.g., "Transcript of Records")
  status: 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';
  fileData?: string;                   // Base64-encoded file content
  isOther?: boolean;                   // Custom document flag
  verifiedAt?: string;                 // Verification timestamp
  verifiedBy?: string;                 // Verifier ID
  remarks?: string;                    // Verification remarks
}
```

## Key Benefits

✅ **Independent Updates**: Each document type has its own update function
✅ **No Cross-Contamination**: Uploading one document doesn't affect others
✅ **Type Safety**: TypeScript ensures correct usage
✅ **Immutable Pattern**: Uses spread operators for safe object updates
✅ **Automatic Document Creation**: Automatically creates document records if they don't exist
✅ **Status Tracking**: Automatically sets status to 'UPLOADED' when file is provided

## Example: Complete Upload Flow

```typescript
import { 
  updateTOR, 
  updateBirthCertificate,
  getDocumentUploadProgress,
  getCompliancePercentage
} from '../services/StudentDocumentService';

// User uploads TOR
async function onTORSelected(file: File) {
  const fileData = await prepareUploadData(file);
  const updatedStudent = updateTOR(student, fileData);
  await onUpdateStudent(updatedStudent);
  
  // Check progress
  const progress = getDocumentUploadProgress(updatedStudent);
  const compliance = getCompliancePercentage(updatedStudent);
  console.log(`Compliance: ${compliance}%`, progress);
}

// User uploads Birth Certificate
async function onBCSelected(file: File) {
  const fileData = await prepareUploadData(file);
  // This update is completely independent of TOR upload
  const updatedStudent = updateBirthCertificate(student, fileData);
  await onUpdateStudent(updatedStudent);
  
  // Check progress again
  const progress = getDocumentUploadProgress(updatedStudent);
  const compliance = getCompliancePercentage(updatedStudent);
  console.log(`Compliance: ${compliance}%`, progress);
}
```

## Testing the Independent Updates

### Test Case 1: Upload TOR doesn't affect Birth Certificate
```typescript
const student1 = updateTOR(student, torData);
// ✓ student1.documents contains TOR with fileData
// ✓ Birth Certificate (if exists) is unchanged

const student2 = updateBirthCertificate(student1, bcData);
// ✓ Both TOR and Birth Certificate have fileData
// ✓ TOR remains unchanged from previous update
```

### Test Case 2: Upload profile photo doesn't affect documents array
```typescript
const student1 = updateTOR(student, torData);
// ✓ student1.documents contains TOR
// ✓ student1.profilePhoto may be empty

const student2 = updateProfilePhoto(student1, photoData);
// ✓ student2.profilePhoto is updated
// ✓ student2.documents (with TOR) remains exactly the same
```

## Migration Guide

If you had code using the old `handleDocumentUpload` pattern:

### Before (Old Pattern)
```typescript
const handleDocumentUpload = (docId: string, fileData: string) => {
  const nextDocs = normalizedDocuments.map(d => 
    d.id === docId ? { ...d, status: 'UPLOADED', fileData } : d
  );
  onUpdateStudent({
    ...student,
    profilePhoto: student.profilePhoto,
    documents: nextDocs,
  });
};
```

### After (New Independent Pattern)
```typescript
import { updateTOR } from '../services/StudentDocumentService';

const updatedStudent = updateTOR(student, fileData);
onUpdateStudent(updatedStudent);
```

The old generic handler still works in StudentPortalView, but using the specific functions is recommended for clarity and better type safety.
