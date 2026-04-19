import {
  updateProfilePhoto,
  updateTOR,
  updateBirthCertificate,
  updateApplicationForm,
  getDocumentByType,
  isDocumentUploaded,
  isDocumentVerified,
  getDocumentUploadProgress,
  getCompliancePercentage,
} from '../services/StudentDocumentService';
import { Student } from '../types';

/**
 * Test suite for StudentDocumentService
 * Demonstrates that each document type updates independently
 */

// Sample student object for testing
const mockStudent: Student = {
  id: 'STU-001',
  firstName: 'John',
  lastName: 'Doe',
  uli: 'ULI-2024-001',
  email: 'john.doe@example.com',
  phone: '09123456789',
  dateOfBirth: '2000-01-15',
  gender: 'MALE',
  city: 'Manila',
  province: 'NCR',
  address: '123 Main St, Manila',
  profilePhoto: undefined,
  documents: [],
};

describe('StudentDocumentService - Independent Updates', () => {
  describe('Profile Photo Updates', () => {
    it('should update profile photo independently without affecting documents', () => {
      const photoData = 'data:image/jpeg;base64,abc123';
      const updated = updateProfilePhoto(mockStudent, photoData);

      expect(updated.profilePhoto).toBe(photoData);
      expect(updated.documents).toEqual(mockStudent.documents);
    });

    it('should preserve existing documents when updating profile photo', () => {
      const studentWithDocs = {
        ...mockStudent,
        documents: [
          {
            id: 'doc-tor-1',
            name: 'Transcript of Records',
            status: 'UPLOADED' as const,
            fileData: 'data:application/pdf;base64,pdf123',
          },
        ],
      };

      const photoData = 'data:image/jpeg;base64,photo123';
      const updated = updateProfilePhoto(studentWithDocs, photoData);

      expect(updated.profilePhoto).toBe(photoData);
      expect(updated.documents).toEqual(studentWithDocs.documents);
      expect(updated.documents.length).toBe(1);
    });
  });

  describe('TOR (Transcript of Records) Updates', () => {
    it('should create and update TOR document independently', () => {
      const torData = 'data:application/pdf;base64,tor123';
      const updated = updateTOR(mockStudent, torData);

      expect(updated.documents.length).toBe(1);
      const torDoc = updated.documents[0];
      expect(torDoc.name).toBe('Transcript of Records');
      expect(torDoc.status).toBe('UPLOADED');
      expect(torDoc.fileData).toBe(torData);
    });

    it('should preserve profile photo when updating TOR', () => {
      const studentWithPhoto = {
        ...mockStudent,
        profilePhoto: 'data:image/jpeg;base64,photo123',
      };

      const torData = 'data:application/pdf;base64,tor123';
      const updated = updateTOR(studentWithPhoto, torData);

      expect(updated.profilePhoto).toBe('data:image/jpeg;base64,photo123');
      expect(updated.documents.length).toBe(1);
    });

    it('should update existing TOR without creating duplicates', () => {
      const studentWithTOR = {
        ...mockStudent,
        documents: [
          {
            id: 'doc-tor-1',
            name: 'Transcript of Records',
            status: 'PENDING' as const,
            fileData: undefined,
          },
        ],
      };

      const torData = 'data:application/pdf;base64,tor123';
      const updated = updateTOR(studentWithTOR, torData);

      expect(updated.documents.length).toBe(1);
      expect(updated.documents[0].fileData).toBe(torData);
      expect(updated.documents[0].status).toBe('UPLOADED');
    });

    it('should not affect Birth Certificate when updating TOR', () => {
      const studentWithBothDocs = {
        ...mockStudent,
        documents: [
          {
            id: 'doc-bc-1',
            name: 'Birth Certificate',
            status: 'UPLOADED' as const,
            fileData: 'data:image/jpeg;base64,bc123',
          },
        ],
      };

      const torData = 'data:application/pdf;base64,tor123';
      const updated = updateTOR(studentWithBothDocs, torData);

      expect(updated.documents.length).toBe(2);
      const bcDoc = updated.documents.find(d => d.name === 'Birth Certificate');
      expect(bcDoc?.fileData).toBe('data:image/jpeg;base64,bc123');
    });
  });

  describe('Birth Certificate Updates', () => {
    it('should create and update Birth Certificate independently', () => {
      const bcData = 'data:image/jpeg;base64,bc123';
      const updated = updateBirthCertificate(mockStudent, bcData);

      expect(updated.documents.length).toBe(1);
      const bcDoc = updated.documents[0];
      expect(bcDoc.name).toBe('Birth Certificate');
      expect(bcDoc.status).toBe('UPLOADED');
      expect(bcDoc.fileData).toBe(bcData);
    });

    it('should not affect TOR when updating Birth Certificate', () => {
      const studentWithTOR = {
        ...mockStudent,
        documents: [
          {
            id: 'doc-tor-1',
            name: 'Transcript of Records',
            status: 'VERIFIED' as const,
            fileData: 'data:application/pdf;base64,tor123',
            verifiedAt: '2024-01-01',
            verifiedBy: 'AUDITOR-001',
          },
        ],
      };

      const bcData = 'data:image/jpeg;base64,bc123';
      const updated = updateBirthCertificate(studentWithTOR, bcData);

      expect(updated.documents.length).toBe(2);
      const torDoc = updated.documents.find(d => d.name === 'Transcript of Records');
      expect(torDoc?.status).toBe('VERIFIED');
      expect(torDoc?.fileData).toBe('data:application/pdf;base64,tor123');
    });
  });

  describe('Application Form Updates', () => {
    it('should create and update Application Form independently', () => {
      const appData = 'data:application/pdf;base64,app123';
      const updated = updateApplicationForm(mockStudent, appData);

      expect(updated.documents.length).toBe(1);
      const appDoc = updated.documents[0];
      expect(appDoc.name).toBe('Application Form');
      expect(appDoc.status).toBe('UPLOADED');
      expect(appDoc.fileData).toBe(appData);
    });

    it('should not affect other documents when updating Application Form', () => {
      const studentWithMultipleDocs = {
        ...mockStudent,
        documents: [
          {
            id: 'doc-tor-1',
            name: 'Transcript of Records',
            status: 'UPLOADED' as const,
            fileData: 'data:application/pdf;base64,tor123',
          },
          {
            id: 'doc-bc-1',
            name: 'Birth Certificate',
            status: 'VERIFIED' as const,
            fileData: 'data:image/jpeg;base64,bc123',
            verifiedAt: '2024-01-01',
          },
        ],
      };

      const appData = 'data:application/pdf;base64,app123';
      const updated = updateApplicationForm(studentWithMultipleDocs, appData);

      expect(updated.documents.length).toBe(3);
      const torDoc = updated.documents.find(d => d.name === 'Transcript of Records');
      const bcDoc = updated.documents.find(d => d.name === 'Birth Certificate');

      expect(torDoc?.fileData).toBe('data:application/pdf;base64,tor123');
      expect(bcDoc?.fileData).toBe('data:image/jpeg;base64,bc123');
      expect(bcDoc?.status).toBe('VERIFIED');
    });
  });

  describe('Utility Functions', () => {
    describe('getDocumentByType', () => {
      it('should return undefined for photo type', () => {
        const doc = getDocumentByType(mockStudent, 'PHOTO');
        expect(doc).toBeUndefined();
      });

      it('should retrieve document by type', () => {
        const studentWithDocs = {
          ...mockStudent,
          documents: [
            {
              id: 'doc-tor-1',
              name: 'Transcript of Records',
              status: 'UPLOADED' as const,
              fileData: 'data:application/pdf;base64,tor123',
            },
          ],
        };

        const doc = getDocumentByType(studentWithDocs, 'TOR');
        expect(doc?.name).toBe('Transcript of Records');
        expect(doc?.fileData).toBe('data:application/pdf;base64,tor123');
      });
    });

    describe('isDocumentUploaded', () => {
      it('should check if photo is uploaded', () => {
        expect(isDocumentUploaded(mockStudent, 'PHOTO')).toBe(false);

        const studentWithPhoto = { ...mockStudent, profilePhoto: 'photo123' };
        expect(isDocumentUploaded(studentWithPhoto, 'PHOTO')).toBe(true);
      });

      it('should check if document is uploaded', () => {
        const studentWithTOR = {
          ...mockStudent,
          documents: [
            {
              id: 'doc-tor-1',
              name: 'Transcript of Records',
              status: 'UPLOADED' as const,
              fileData: 'data:application/pdf;base64,tor123',
            },
          ],
        };

        expect(isDocumentUploaded(studentWithTOR, 'TOR')).toBe(true);
        expect(isDocumentUploaded(studentWithTOR, 'BIRTH_CERTIFICATE')).toBe(false);
      });
    });

    describe('isDocumentVerified', () => {
      it('should check if document is verified', () => {
        const studentWithVerifiedTOR = {
          ...mockStudent,
          documents: [
            {
              id: 'doc-tor-1',
              name: 'Transcript of Records',
              status: 'VERIFIED' as const,
              fileData: 'data:application/pdf;base64,tor123',
              verifiedAt: '2024-01-01',
              verifiedBy: 'AUDITOR-001',
            },
          ],
        };

        expect(isDocumentVerified(studentWithVerifiedTOR, 'TOR')).toBe(true);
        expect(isDocumentVerified(studentWithVerifiedTOR, 'BIRTH_CERTIFICATE')).toBe(false);
      });
    });

    describe('getDocumentUploadProgress', () => {
      it('should return progress for all document types', () => {
        const studentWithSomeDocs = {
          ...mockStudent,
          profilePhoto: 'photo123',
          documents: [
            {
              id: 'doc-tor-1',
              name: 'Transcript of Records',
              status: 'UPLOADED' as const,
              fileData: 'tor123',
            },
          ],
        };

        const progress = getDocumentUploadProgress(studentWithSomeDocs);
        expect(progress.PHOTO).toBe(true);
        expect(progress.TOR).toBe(true);
        expect(progress.BIRTH_CERTIFICATE).toBe(false);
        expect(progress.APPLICATION_FORM).toBe(false);
      });
    });

    describe('getCompliancePercentage', () => {
      it('should calculate 0% for student with no documents', () => {
        const percentage = getCompliancePercentage(mockStudent);
        expect(percentage).toBe(0);
      });

      it('should calculate 50% for student with 2 out of 4 documents', () => {
        const studentWithSomeDocs = {
          ...mockStudent,
          profilePhoto: 'photo123',
          documents: [
            {
              id: 'doc-tor-1',
              name: 'Transcript of Records',
              status: 'UPLOADED' as const,
              fileData: 'tor123',
            },
          ],
        };

        const percentage = getCompliancePercentage(studentWithSomeDocs);
        expect(percentage).toBe(50);
      });

      it('should calculate 100% for fully compliant student', () => {
        const fullyCompliantStudent = {
          ...mockStudent,
          profilePhoto: 'photo123',
          documents: [
            {
              id: 'doc-tor-1',
              name: 'Transcript of Records',
              status: 'UPLOADED' as const,
              fileData: 'tor123',
            },
            {
              id: 'doc-bc-1',
              name: 'Birth Certificate',
              status: 'UPLOADED' as const,
              fileData: 'bc123',
            },
            {
              id: 'doc-app-1',
              name: 'Application Form',
              status: 'UPLOADED' as const,
              fileData: 'app123',
            },
          ],
        };

        const percentage = getCompliancePercentage(fullyCompliantStudent);
        expect(percentage).toBe(100);
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle sequential updates without interference', () => {
      let student = mockStudent;

      // Step 1: Upload profile photo
      student = updateProfilePhoto(student, 'photo123');
      expect(student.profilePhoto).toBe('photo123');
      expect(student.documents.length).toBe(0);

      // Step 2: Upload TOR
      student = updateTOR(student, 'tor123');
      expect(student.profilePhoto).toBe('photo123');
      expect(student.documents.length).toBe(1);

      // Step 3: Upload Birth Certificate
      student = updateBirthCertificate(student, 'bc123');
      expect(student.profilePhoto).toBe('photo123');
      expect(student.documents.length).toBe(2);

      // Step 4: Upload Application Form
      student = updateApplicationForm(student, 'app123');
      expect(student.profilePhoto).toBe('photo123');
      expect(student.documents.length).toBe(3);

      // Verify all documents are present and intact
      const progress = getDocumentUploadProgress(student);
      expect(progress.PHOTO).toBe(true);
      expect(progress.TOR).toBe(true);
      expect(progress.BIRTH_CERTIFICATE).toBe(true);
      expect(progress.APPLICATION_FORM).toBe(true);

      const compliance = getCompliancePercentage(student);
      expect(compliance).toBe(100);
    });

    it('should handle re-uploads without creating duplicates', () => {
      let student = mockStudent;

      // Initial upload
      student = updateTOR(student, 'tor123');
      expect(student.documents.length).toBe(1);

      // Re-upload same document
      student = updateTOR(student, 'tor456');
      expect(student.documents.length).toBe(1);
      expect(student.documents[0].fileData).toBe('tor456');
    });
  });
});
