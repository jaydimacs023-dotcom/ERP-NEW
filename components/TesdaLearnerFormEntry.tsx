import React, { useEffect, useState } from 'react';
import { ChevronLeft, Check, Upload } from 'lucide-react';
import { Student } from '../types';

type TesdaLearnerFormEntryProps = {
  formData: Partial<Student>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Student>>>;
  photoPreview: string | null;
  setPhotoPreview: React.Dispatch<React.SetStateAction<string | null>>;
  brandColor: string;
  courseName?: string;
  onBack: () => void;
  onSubmit: (event: React.FormEvent) => void;
};

const civilStatuses = ['Single', 'Married', 'Separated', 'Widowed', 'Common Law/Live-in'];
const employmentStatuses = ['Wage-Employed', 'Underemployed', 'Self-Employed', 'Unemployed'];
const employmentTypes = ['None', 'Casual', 'Probationary', 'Contractual', 'Regular', 'Job Order', 'Permanent', 'Temporary'];
const educationOptions = [
  'No Grade Completed',
  'Elementary Undergraduate',
  'Elementary Graduate',
  'High School Undergraduate',
  'High School Graduate',
  'Junior High (K-12)',
  'Senior High (K-12)',
  'Post-Secondary Non-Tertiary/Technical Vocational Course Undergraduate',
  'Post-Secondary Non-Tertiary/Technical Vocational Course Graduate',
  'College Undergraduate',
  'College Graduate',
  'Masteral',
  'Doctorate'
];
const classifications = [
  '4Ps Beneficiary',
  'Agrarian Reform Beneficiary',
  'Balik Probinsya',
  'Displaced Workers',
  'Drug Dependents Surrenderees/Surrenderers',
  'Family Members of AFP and PNP Killed-in-Action',
  'Family Members of AFP and PNP Wounded-in-Action',
  'Farmers and Fishermen',
  'Indigenous People & Cultural Communities',
  'Industry Workers',
  'Inmates and Detainees',
  'MILF Beneficiary',
  'Out-of-School-Youth',
  'Overseas Filipino Workers (OFW) Dependent',
  'RCEF-RESP',
  'Rebel Returnees/Decommissioned Combatants',
  'Returning/Repatriated Overseas Filipino Workers (OFW)',
  'Student',
  'TESDA Alumni',
  'TVET Trainers',
  'Uniformed Personnel',
  'Victim of Natural Disasters and Calamities',
  'Wounded-in-Action AFP & PNP Personnel',
  'Others'
];
const disabilities = [
  'Mental/Intellectual',
  'Visual Disability',
  'Orthopedic (Musculoskeletal) Disability',
  'Hearing Disability',
  'Speech Impairment',
  'Multiple Disabilities, specify',
  'Psychosocial Disability',
  'Disability Due to Chronic Illness',
  'Learning Disability'
];
const disabilityCauses = ['Congenital/Inborn', 'Illness', 'Injury'];

const inputClass = 'w-full h-8 border-0 bg-transparent px-1 text-[10px] font-semibold uppercase text-gray-900 outline-none focus:bg-teal-50';
const smallInputClass = 'h-8 border border-gray-500 bg-transparent px-1 text-[10px] font-semibold uppercase outline-none focus:bg-teal-50';
const cellClass = 'border border-gray-700 align-top';
const labelClass = 'text-[10px] font-bold leading-tight text-gray-800';
const sectionTitleClass = 'border border-gray-700 bg-gray-100 px-1.5 py-1 text-[13px] font-black leading-none text-gray-900';

function setField(
  setFormData: React.Dispatch<React.SetStateAction<Partial<Student>>>,
  field: keyof Student,
  value: string
) {
  setFormData(prev => ({ ...prev, [field]: value }));
}

function dateParts(value?: string) {
  if (!value) return { month: '', day: '', year: '', age: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { month: '', day: '', year: '', age: '' };
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const delta = now.getMonth() - date.getMonth();
  if (delta < 0 || (delta === 0 && now.getDate() < date.getDate())) age -= 1;
  return {
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
    year: String(date.getFullYear()),
    age: String(Math.max(0, age))
  };
}

const Box: React.FC<{
  label: string;
  checked?: boolean;
  onChange?: () => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex min-h-[18px] items-start gap-1.5 text-[10px] font-semibold leading-tight text-gray-800">
    <input type="checkbox" checked={checked} onChange={onChange} className="mt-[1px] h-3 w-3 shrink-0 accent-teal-700" />
    <span>{label}</span>
  </label>
);

const RadioBox: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex min-h-[18px] items-center gap-1.5 text-[10px] font-semibold leading-tight text-gray-800">
    <input type="radio" checked={checked} onChange={onChange} className="h-3 w-3 shrink-0 accent-teal-700" />
    <span>{label}</span>
  </label>
);

const RequiredMark = () => <span className="ml-0.5 text-red-600">*</span>;

const LabeledInput: React.FC<{
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  type?: string;
  inputHeightClass?: string;
}> = ({ label, value, onChange, required, type = 'text', inputHeightClass = 'h-8' }) => (
  <div className="flex h-full flex-col">
    <input required={required} type={type} value={value || ''} onChange={event => onChange?.(event.target.value)} className={`${inputClass} ${inputHeightClass}`} />
    <div className="border-t border-gray-700 py-0.5 text-center text-[9px] font-bold leading-none text-gray-700">{label}{required && <RequiredMark />}</div>
  </div>
);

const TesdaLearnerFormEntry: React.FC<TesdaLearnerFormEntryProps> = ({
  formData,
  setFormData,
  photoPreview,
  setPhotoPreview,
  brandColor,
  courseName,
  onBack,
  onSubmit
}) => {
  const [employmentStatus, setEmploymentStatus] = useState(formData.tesdaEmploymentStatus || '');
  const [employmentType, setEmploymentType] = useState(formData.tesdaEmploymentType || '');
  const [scholarship, setScholarship] = useState(formData.tesdaScholarshipPackage || '');
  const [courseQualification, setCourseQualification] = useState(formData.tesdaCourseQualification || '');
  const [mailingRegion, setMailingRegion] = useState(formData.mailingRegion || '');
  const [privacyConsent, setPrivacyConsent] = useState<'Agree' | 'Disagree' | ''>((formData.tesdaPrivacyConsent as 'Agree' | 'Disagree' | '') || '');
  const [otherClassification, setOtherClassification] = useState(formData.tesdaOtherClassification || '');
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>(formData.tesdaLearnerClassifications?.length ? formData.tesdaLearnerClassifications : ['Student']);
  const [selectedDisabilities, setSelectedDisabilities] = useState<string[]>(formData.tesdaDisabilityTypes || []);
  const [selectedDisabilityCauses, setSelectedDisabilityCauses] = useState<string[]>(formData.tesdaDisabilityCauses || []);
  const dob = dateParts(formData.dateOfBirth);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      mailingRegion: mailingRegion || undefined,
      tesdaEmploymentStatus: employmentStatus || undefined,
      tesdaEmploymentType: employmentType || undefined,
      tesdaLearnerClassifications: selectedClassifications.length ? selectedClassifications : undefined,
      tesdaOtherClassification: otherClassification || undefined,
      tesdaDisabilityTypes: selectedDisabilities.length ? selectedDisabilities : undefined,
      tesdaDisabilityCauses: selectedDisabilityCauses.length ? selectedDisabilityCauses : undefined,
      tesdaCourseQualification: courseQualification || undefined,
      tesdaScholarshipPackage: scholarship || undefined,
      tesdaPrivacyConsent: privacyConsent || undefined
    }));
  }, [
    courseQualification,
    employmentStatus,
    employmentType,
    mailingRegion,
    otherClassification,
    privacyConsent,
    scholarship,
    selectedClassifications,
    selectedDisabilities,
    selectedDisabilityCauses,
    setFormData
  ]);

  const toggleClassification = (classification: string) => {
    setSelectedClassifications(prev =>
      prev.includes(classification)
        ? prev.filter(item => item !== classification)
        : [...prev, classification]
    );
  };

  const toggleListValue = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev =>
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
      <div className="p-5 border-b bg-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800 uppercase tracking-tight">TESDA Form Entry</h3>
          <p className="text-xs font-semibold text-gray-500 mt-1">Official two-page learner profile recreated as native inputs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors text-xs font-semibold uppercase tracking-wide">
            <ChevronLeft size={16} /> Back
          </button>
          <button type="submit" form="tesda-native-registration-form" className="inline-flex items-center gap-2 px-5 py-2 text-white rounded text-xs font-semibold uppercase tracking-wide shadow-sm" style={{ backgroundColor: brandColor }}>
            <Check size={15} /> Save Learner
          </button>
        </div>
      </div>

      <form id="tesda-native-registration-form" onSubmit={onSubmit} className="bg-slate-100 p-4 md:p-6 overflow-x-auto">
        <div className="mx-auto flex min-w-[794px] max-w-[794px] flex-col gap-6">
          <section className="bg-white p-7 shadow-md">
            <div className="grid grid-cols-[125px_1fr_85px] border border-gray-700">
              <div className="flex items-center justify-center border-r border-gray-700 p-2">
                <img src="/print-templates/tesda-logo.svg" alt="TESDA" className="h-14 w-14 object-contain" />
              </div>
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <div className="text-[16px] font-black leading-tight">Technical Education and Skills Development Authority</div>
                <div className="text-[13px] font-semibold leading-tight">Pangasiwaan sa Edukasyong Teknikal at Pagpapaunlad ng Kasanayan</div>
              </div>
              <div className="flex items-center justify-center border-l border-gray-700 text-center text-[12px] font-black italic leading-tight">
                MIS 03-01<br />(ver. 2021)
              </div>
            </div>
            <div className="border-x border-b border-gray-700 py-1 text-center text-[28px] font-black tracking-[0.08em]">Registration Form</div>
            <div className="grid grid-cols-[1fr_150px] border-x border-b border-gray-700">
              <div className="flex items-center justify-center py-9 text-[19px] font-black tracking-[0.24em] text-black" style={{ fontFamily: 'Arial Black, Arial, Helvetica, sans-serif' }}>LEARNERS PROFILE FORM</div>
              <label className="m-3 flex cursor-pointer items-center justify-center border-2 border-gray-700 text-center text-[11px] font-semibold" style={{ width: '35mm', height: '45mm' }}>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                {photoPreview ? <img src={photoPreview} alt="Learner" className="h-full w-full object-cover" /> : <span><Upload size={16} className="mx-auto mb-1" />I.D. Picture</span>}
              </label>
            </div>

            <div className={sectionTitleClass}>1. T2MIS Auto Generated</div>
            <div className="grid grid-cols-[145px_1fr_110px_170px] border-x border-b border-gray-700">
              <div className="p-1 text-center text-[10px] font-bold">1.1.<br />Unique Learner<br />Identifier (ULI) Number:<RequiredMark /></div>
              <div className="border-l border-gray-700">
                <input required value={formData.uli || ''} onChange={event => setField(setFormData, 'uli', event.target.value)} className={inputClass} />
              </div>
              <div className="border-l border-gray-700 p-2 text-[10px] font-bold">1.2. Entry Date:</div>
              <div className="border-l border-gray-700 p-1 text-center text-[12px] font-semibold">mm/dd/yy</div>
            </div>

            <div className={sectionTitleClass}>2. Learner/Manpower Profile</div>
            <div className="grid grid-cols-[125px_1fr_1fr_145px] border-x border-b border-gray-700">
              <div className={`${cellClass} border-l-0 border-t-0 p-2 ${labelClass}`}>2.1. &nbsp; Name:</div>
              <div className={`${cellClass} border-t-0 h-11`}><LabeledInput required inputHeightClass="h-8" label="Last Name, Extension Name (Jr., Sr.)" value={[formData.lastName, formData.extension].filter(Boolean).join(', ')} onChange={value => setField(setFormData, 'lastName', value)} /></div>
              <div className={`${cellClass} border-t-0 h-11`}><LabeledInput required inputHeightClass="h-8" label="First" value={formData.firstName} onChange={value => setField(setFormData, 'firstName', value)} /></div>
              <div className={`${cellClass} border-r-0 border-t-0 h-11`}><LabeledInput inputHeightClass="h-8" label="Middle" value={formData.middleName} onChange={value => setField(setFormData, 'middleName', value)} /></div>

              <div className={`${cellClass} row-span-3 border-l-0 p-2 text-center ${labelClass}`}>2.2<br />Complete<br />Permanent<br />Mailing<br />Address:</div>
              <div className={cellClass}><LabeledInput required label="Number, Street" value={formData.street} onChange={value => setField(setFormData, 'street', value)} /></div>
              <div className={cellClass}><LabeledInput required label="Barangay" value={formData.barangay} onChange={value => setField(setFormData, 'barangay', value)} /></div>
              <div className={`${cellClass} border-r-0`}><LabeledInput label="District" value={formData.district} onChange={value => setField(setFormData, 'district', value)} /></div>

              <div className={cellClass}><LabeledInput required label="City/Municipality" value={formData.city} onChange={value => setField(setFormData, 'city', value)} /></div>
              <div className={cellClass}><LabeledInput required label="Province" value={formData.province} onChange={value => setField(setFormData, 'province', value)} /></div>
              <div className={`${cellClass} border-r-0`}><LabeledInput label="Region" value={mailingRegion} onChange={setMailingRegion} /></div>

              <div className={cellClass}><LabeledInput required type="email" label="Email Address/Facebook Account" value={formData.email} onChange={value => setField(setFormData, 'email', value)} /></div>
              <div className={cellClass}><LabeledInput required label="Contact No:" value={formData.contactNumber} onChange={value => setField(setFormData, 'contactNumber', value)} /></div>
              <div className={`${cellClass} border-r-0`}><LabeledInput required label="Nationality" value={formData.nationality} onChange={value => setField(setFormData, 'nationality', value)} /></div>
            </div>

            <div className={sectionTitleClass}>3. Personal Information</div>
            <div className="grid grid-cols-[160px_220px_1fr] border-x border-b border-gray-700">
              <div className={`${cellClass} border-l-0 border-t-0 p-2`}><div className={labelClass}>3.1. Sex<RequiredMark /></div><div className="mt-4 space-y-1"><RadioBox label="Male" checked={formData.sex === 'Male'} onChange={() => setField(setFormData, 'sex', 'Male')} /><RadioBox label="Female" checked={formData.sex === 'Female'} onChange={() => setField(setFormData, 'sex', 'Female')} /></div></div>
              <div className={`${cellClass} border-t-0 p-2`}><div className={labelClass}>3.2. Civil Status<RequiredMark /></div><div className="mt-3 space-y-1">{civilStatuses.map(status => <RadioBox key={status} label={status} checked={formData.civilStatus === status} onChange={() => setField(setFormData, 'civilStatus', status)} />)}</div></div>
              <div className={`${cellClass} border-r-0 border-t-0 p-2`}>
                <div className={labelClass}>3.3 Employment (before the training)</div>
                <div className="mt-1 grid grid-cols-[150px_1fr] items-start gap-5">
                  <div>
                    <div className="mb-1 h-7 pt-0 text-[10px] font-bold leading-tight">Employment Status</div>
                    <div className="space-y-1">
                      {employmentStatuses.map(status => <RadioBox key={status} label={status} checked={employmentStatus === status} onChange={() => setEmploymentStatus(status)} />)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 h-7 pt-0 text-[10px] font-bold leading-tight">Employment Type<br /><span className="italic">(if Wage-employed or Underemployed)</span></div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-1">
                      {employmentTypes.map(type => <RadioBox key={type} label={type} checked={employmentType === type} onChange={() => setEmploymentType(type)} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[125px_1fr_1fr_1fr_145px] border-x border-b border-gray-700">
              <div className={`p-2 ${labelClass}`}>3.4 Birthdate</div>
              <LabeledInput required type="date" label="Month of Birth" value={formData.dateOfBirth} onChange={value => setField(setFormData, 'dateOfBirth', value)} />
              <LabeledInput label="Day of Birth" value={dob.day} />
              <LabeledInput label="Year of Birth" value={dob.year} />
              <LabeledInput label="Age" value={dob.age} />
            </div>
            <div className="grid grid-cols-[125px_1fr_1fr_145px] border-x border-b border-gray-700">
              <div className={`p-2 ${labelClass}`}>3.5 Birthplace</div>
              <LabeledInput label="City/Municipality" value={formData.birthCity} onChange={value => setField(setFormData, 'birthCity', value)} />
              <LabeledInput label="Province" value={formData.birthProvince} onChange={value => setField(setFormData, 'birthProvince', value)} />
              <LabeledInput label="Region" value={formData.birthRegion} onChange={value => setField(setFormData, 'birthRegion', value)} />
            </div>
            <div className="border-x border-b border-gray-700 p-1">
              <div className={labelClass}>3.6 Educational Attainment Before the Training (Trainee)<RequiredMark /></div>
              <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1">
                {educationOptions.map(option => <RadioBox key={option} label={option} checked={formData.educationalAttainment === option} onChange={() => setField(setFormData, 'educationalAttainment', option)} />)}
              </div>
            </div>
            <div className="grid grid-cols-[160px_1fr_1.4fr] border-x border-b border-gray-700">
              <div className={`p-2 ${labelClass}`}>3.7 Parent/Guardian<RequiredMark /></div>
              <LabeledInput required label="Name" value={formData.guardian} onChange={value => setField(setFormData, 'guardian', value)} />
              <LabeledInput label="Complete Permanent Mailing Address" />
            </div>
          </section>

          <section className="bg-white p-7 shadow-md">
            <div className={sectionTitleClass}>4. Learner/Trainee/Student (Clients) Classification:</div>
            <div className="grid grid-cols-3 border-x border-b border-gray-700">
              {classifications.map((item, index) => (
                <div key={item} className={`${cellClass} min-h-[28px] p-1 ${index % 3 === 0 ? 'border-l-0' : ''} ${index % 3 === 2 ? 'border-r-0' : ''}`}>
                  <Box label={item} checked={selectedClassifications.includes(item)} onChange={() => toggleClassification(item)} />
                  {item === 'Others' && <input value={otherClassification} onChange={event => setOtherClassification(event.target.value)} className={`${smallInputClass} mt-1 w-full`} placeholder="Please specify" />}
                </div>
              ))}
            </div>
            <div className={sectionTitleClass}>5. Type of Disability (for Persons with Disability Only): <span className="italic font-semibold">To be filled up by the TESDA personnel</span></div>
            <div className="grid grid-cols-3 border-x border-b border-gray-700">{disabilities.map((item, index) => <div key={item} className={`${cellClass} p-1 ${index % 3 === 0 ? 'border-l-0' : ''} ${index % 3 === 2 ? 'border-r-0' : ''}`}><Box label={item} checked={selectedDisabilities.includes(item)} onChange={() => toggleListValue(item, setSelectedDisabilities)} /></div>)}</div>
            <div className={sectionTitleClass}>6. Causes of Disability (for Persons with Disability Only): <span className="italic font-semibold">To be filled up by the TESDA personnel</span></div>
            <div className="grid grid-cols-3 border-x border-b border-gray-700">{disabilityCauses.map((item, index) => <div key={item} className={`${cellClass} p-1 ${index === 0 ? 'border-l-0' : ''} ${index === 2 ? 'border-r-0' : ''}`}><Box label={item} checked={selectedDisabilityCauses.includes(item)} onChange={() => toggleListValue(item, setSelectedDisabilityCauses)} /></div>)}</div>
            <div className={sectionTitleClass}>7. Name of Course/Qualification</div>
            <input value={courseQualification} onChange={event => setCourseQualification(event.target.value)} className="h-8 w-full border-x border-b border-gray-700 bg-transparent px-2 text-[12px] font-semibold uppercase outline-none focus:bg-teal-50" />
            <div className={sectionTitleClass}>8. If Scholar, What Type of Scholarship Package (TWSP, PESFA, STEP, others)?</div>
            <input value={scholarship} onChange={event => setScholarship(event.target.value)} className="h-12 w-full border-x border-b border-gray-700 bg-transparent px-2 text-[12px] font-semibold uppercase outline-none focus:bg-teal-50" />
            <div className={sectionTitleClass}>9. Privacy Consent and Disclaimer</div>
            <div className="border-x border-b border-gray-700 p-2 text-[11px] font-semibold italic leading-snug">
              I hereby attest that I have read and understood the Privacy Notice of TESDA through its website (https://www.tesda.gov.ph) and thereby giving my consent in the processing of my personal information indicated in this Learners Profile. The processing includes scholarships, employment, survey, and all other related TESDA programs that may be beneficial to my qualifications.
              <div className="mt-3 flex justify-center gap-20 not-italic">
                <RadioBox label="Agree" checked={privacyConsent === 'Agree'} onChange={() => setPrivacyConsent('Agree')} />
                <RadioBox label="Disagree" checked={privacyConsent === 'Disagree'} onChange={() => setPrivacyConsent('Disagree')} />
              </div>
            </div>
            <div className={sectionTitleClass}>10. Applicant's Signature</div>
            <div className="border-x border-b border-gray-700 p-4">
              <div className="mb-8 text-center text-[11px] font-semibold italic">This is to certify that the information stated above is true and correct.</div>
              <div className="grid grid-cols-[1fr_190px_145px] gap-6">
                <div className="space-y-10">
                  <div><div className="border-b border-gray-800">&nbsp;</div><div className="text-center text-[10px] font-black">APPLICANT'S SIGNATURE OVER PRINTED NAME</div></div>
                  <div><div className="text-[11px] font-bold">Noted by:</div><div className="mt-6 border-b border-gray-800">&nbsp;</div><div className="text-center text-[10px] font-black">REGISTRAR/SCHOOL ADMINISTRATOR<br />(Signature Over Printed Name)</div></div>
                </div>
                <div className="space-y-10">
                  <div><div className="border-b border-gray-800">&nbsp;</div><div className="text-center text-[10px] font-black">DATE ACCOMPLISHED</div></div>
                  <div><div className="mt-12 border-b border-gray-800">&nbsp;</div><div className="text-center text-[10px] font-black">DATE RECEIVED</div></div>
                </div>
                <div className="space-y-4">
                  <div className="flex h-32 items-center justify-center border-2 border-gray-700 text-center text-[15px] font-serif">1x1 picture taken<br />within the last 6<br />months</div>
                  <div className="h-28 border-2 border-gray-700" />
                  <div className="text-center text-[12px] font-black">Right Thumbmark</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
};

export default TesdaLearnerFormEntry;
