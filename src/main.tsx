import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabaseClient';
import type { User, AuthSession } from '@supabase/supabase-js';

// --- TYPE DEFINITIONS ---
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'researcher' | 'data-entry';
  centerId: number | null;
  centers: { name: string } | null;
};
type Center = {
  id: number;
  name: string;
  location: string;
};
type Patient = {
  id: number;
  patientId: string;
  age: number;
  sex: string;
  centerId: number;
  dateAdded: string;
  centers: { name: string } | null;
  formData?: any;
};
type NotificationType = {
  id: number;
  message: string;
  type: 'success' | 'error';
};
type Invitation = {
    email: string;
    role: 'admin' | 'researcher' | 'data-entry';
    centerId: number;
};

type FormField = {
    id: string;
    label: string;
    type: 'text' | 'number' | 'radio' | 'checkbox' | 'monitoring_table' | 'textarea';
    options?: string[];
    required?: boolean;
    helpText?: string;
    condition?: (formData: any) => boolean;
    subFields?: FormField[];
    gridColumns?: number;
};

type FormSection = {
    title: string;
    description?: string;
    fields: FormField[];
};


// --- FORM STRUCTURE (from Google Apps Script) ---
const formStructure: FormSection[] = [
    {
        title: 'Demographic Data',
        fields: [
            { id: 'centerId', label: 'Center ID', type: 'number', required: false },
            { id: 'serialNumber', label: 'Serial Number/Institutional Code', type: 'text', required: true },
            { id: 'age', label: 'Age (years)', type: 'number', required: true },
            { id: 'hospitalName', label: 'Hospital Name', type: 'text', required: true },
            { id: 'hospitalLocation', label: 'Location of Hospital (State)', type: 'text', required: true },
            { id: 'geographicalZone', label: 'Geographical Zone', type: 'text', required: true },
            { id: 'sex', label: 'Sex', type: 'radio', options: ['Male', 'Female'], required: true },
            { id: 'occupation', label: 'Occupation', type: 'radio', options: ['Civil servant', 'Professional', 'Trading', 'Farming', 'Retiree', 'Others'], required: true },
            { id: 'occupationOther', label: 'If Others, specify occupation', type: 'text', condition: (data) => data.occupation === 'Others' },
            { id: 'educationLevel', label: 'Education Level', type: 'radio', options: ['Nil', 'Primary', 'Secondary', 'Tertiary', 'Other'], required: true },
            { id: 'educationLevelOther', label: 'If Other, specify education level', type: 'text', condition: (data) => data.educationLevel === 'Other' },
            { id: 'residentialArea', label: 'Residential Area', type: 'radio', options: ['Urban', 'Semi-urban', 'Rural'], required: true },
        ],
    },
    {
        title: 'Diabetes History',
        fields: [
            { id: 'diabetesType', label: 'Type of diabetes', type: 'radio', options: ['Type 1', 'Type 2', 'Other'], required: true },
            { id: 'diabetesTypeOther', label: 'If Other, specify type', type: 'text', condition: (data) => data.diabetesType === 'Other' },
            { id: 'previousDiagnosis', label: 'Previous diagnosis of diabetes', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'durationOfDiabetes', label: 'If Yes, duration of diabetes (years)', type: 'number', condition: (data) => data.previousDiagnosis === 'Yes' },
            { id: 'currentMedications', label: 'Current medications', type: 'checkbox', options: ['Oral hypoglycemics', 'Insulin', 'Others'], required: true },
            { id: 'oralHypoglycemicAgents', label: 'Oral hypoglycemic agents', type: 'checkbox', options: ['Sulfonylureas', 'TZD', 'SGLUTI', 'None'], required: true },
            { id: 'medicationOther', label: 'If Others medication, specify', type: 'text', condition: (data) => data.currentMedications?.includes('Others') },
            { id: 'medicationAdherence', label: 'Adherence to medication', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'previousAdmissions', label: 'Previous hospital admissions for diabetes-related complications', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'previousAdmissionsCount', label: 'If Yes, how many times?', type: 'number', condition: (data) => data.previousAdmissions === 'Yes' },
            { id: 'lastAdmissionDate', label: 'How long ago was the last admission?', type: 'text', condition: (data) => data.previousAdmissions === 'Yes' },
            { id: 'hypertension', label: 'Hypertension', type: 'radio', options: ['Yes', 'No'], required: true, helpText: "Presence of comorbidities" },
            { id: 'ckd', label: 'CKD (Chronic Kidney Disease)', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'previousStroke', label: 'Previous stroke', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'heartFailure', label: 'Heart failure', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'otherComorbidities', label: 'Other comorbidities (specify)', type: 'text' },
        ],
    },
    {
        title: 'Admission Info',
        fields: [
            { id: 'admissionDiagnosis', label: 'Admission diagnosis', type: 'checkbox', options: ['Infection', 'DKA', 'HHS', 'Cardiovascular event', 'Other'], required: true },
            { id: 'admissionDiagnosisOther', label: 'If Other, specify', type: 'text', condition: (data) => data.admissionDiagnosis?.includes('Other') },
            { id: 'bloodPressure', label: 'Blood Pressure (mmHg)', type: 'text', required: true, helpText: 'Vital signs at admission' },
            { id: 'pulseRate', label: 'Pulse rate (/min)', type: 'text', required: true },
            { id: 'temperature', label: 'Temperature (°C)', type: 'text', required: true },
            { id: 'respiratoryRate', label: 'Respiratory rate (/min)', type: 'text', required: true },
        ],
    },
    {
        title: 'Lab Findings',
        fields: [
            { id: 'glucoseMeasurementMethod', label: 'How was the blood glucose measured?', type: 'radio', options: ['Glucometer', 'Laboratory', 'Both'], required: true },
            { id: 'bloodGlucoseAdmission', label: 'Blood glucose levels at admission (mg/dL or mmol/L)', type: 'text', required: true },
            { id: 'hba1c', label: 'HbA1c (%; if available)', type: 'text' },
            { id: 'wbc', label: 'WBC (total)', type: 'text', required: true, helpText: 'Complete blood count' },
            { id: 'neutrophil', label: 'Neutrophil (%)', type: 'text', required: true },
            { id: 'lymphocytes', label: 'Lymphocytes (%)', type: 'text', required: true },
            { id: 'pcv', label: 'PCV (%)', type: 'text', required: true },
            { id: 'bloodCulture', label: 'Blood culture', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'bloodCultureOrganism', label: 'If Yes, isolated organism(s)', type: 'text', condition: (data) => data.bloodCulture === 'Yes' },
            { id: 'bloodCultureSensitivity', label: 'Antibiotic sensitivity', type: 'text', condition: (data) => data.bloodCulture === 'Yes' },
            { id: 'bloodCultureResistance', label: 'Antibiotic resistance', type: 'text', condition: (data) => data.bloodCulture === 'Yes' },
            { id: 'sputumCulture', label: 'Sputum culture (If available)', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'sputumCultureOrganism', label: 'If Yes, isolated organism(s)', type: 'text', condition: (data) => data.sputumCulture === 'Yes' },
            { id: 'sputumSensitivity', label: 'Sputum antibiotic sensitivity', type: 'text', condition: (data) => data.sputumCulture === 'Yes' },
            { id: 'sputumResistance', label: 'Sputum antibiotic resistance', type: 'text', condition: (data) => data.sputumCulture === 'Yes' },
        ],
    },
    {
        title: 'ECG & Renal',
        fields: [
            { id: 'ecgHeartRate', label: 'Heart Rate', type: 'text', required: true, helpText: "ECG" },
            { id: 'ecgLvh', label: 'LVH (Left Ventricular Hypertrophy)', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'ecgAcuteMI', label: 'Features of Acute MI', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'ecgAcuteMIFeatures', label: 'If Yes, list features', type: 'text', condition: (data) => data.ecgAcuteMI === 'Yes' },
            { id: 'renalCreatinine', label: 'Creatinine (micromol/L)', type: 'text', required: true, helpText: "Renal function tests" },
            { id: 'renalUrea', label: 'Urea (mg/dl)', type: 'text', required: true },
            { id: 'elSodium', label: 'Sodium', type: 'text', required: true, helpText: "Electrolyte levels" },
            { id: 'elPotassium', label: 'Potassium', type: 'text', required: true },
            { id: 'elHco3', label: 'HCO3', type: 'text', required: true },
            { id: 'elCl', label: 'Cl', type: 'text', required: true },
            { id: 'urineGlucose', label: 'Glucose in urine', type: 'radio', options: ['Yes', 'No'], required: true, helpText: "Urinalysis" },
            { id: 'urineKetone', label: 'Ketone in urine', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'urineProtein', label: 'Protein in urine', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'urineNitrites', label: 'Nitrites in urine', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'urineCulture', label: 'Urine culture', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'urineCultureOrganism', label: 'If Yes, isolated organism(s)', type: 'text', condition: (data) => data.urineCulture === 'Yes' },
            { id: 'urineSensitivity', label: 'Urine antibiotic sensitivity', type: 'text', condition: (data) => data.urineCulture === 'Yes' },
            { id: 'urineResistance', label: 'Urine antibiotic resistance', type: 'text', condition: (data) => data.urineCulture === 'Yes' },
            { id: 'lftAlt', label: 'ALT', type: 'radio', options: ['High', 'Normal', 'Low'], required: true, helpText: "Liver function tests" },
            { id: 'lftAst', label: 'AST', type: 'radio', options: ['High', 'Normal', 'Low'], required: true },
        ],
    },
    {
        title: 'In-Hospital Monitoring',
        description: 'Capillary Blood Glucose Readings (Day 1 to Day 14)',
        fields: [
            { id: 'glucoseMonitoring', label: 'Daily Glucose Readings', type: 'monitoring_table', required: true },
            { id: 'hypoglycemiaEpisodes', label: 'Episodes of hypoglycemia (<70 mg/dL)', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'hypoglycemiaCount', label: 'Number of hypoglycemia episodes', type: 'number', condition: (data) => data.hypoglycemiaEpisodes === 'Yes' },
            { id: 'hyperglycemiaEpisodes', label: 'Episodes of hyperglycemia (>250 mg/dL)', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'hyperglycemiaCount', label: 'Number of hyperglycemia episodes', type: 'number', condition: (data) => data.hyperglycemiaEpisodes === 'Yes' },
        ],
    },
    {
        title: 'Complications & Interventions',
        fields: [
            { id: 'complicationInfections', label: 'Infections', type: 'checkbox', options: ['Sepsis', 'Pneumonia', 'Urinary tract infections', 'Other infections'], required: true, helpText: "New-onset Complications" },
            { id: 'complicationInfectionsOther', label: 'If Other infections, specify', type: 'text', condition: (data) => data.complicationInfections?.includes('Other infections') },
            { id: 'complicationAki', label: 'Acute kidney injury', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'complicationCardio', label: 'Cardiovascular events', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'complicationOther', label: 'Other complications (specify)', type: 'text' },
            { id: 'interventionInsulin', label: 'Insulin therapy', type: 'radio', options: ['Yes', 'No'], required: true, helpText: "Interventions" },
            { id: 'interventionInsulinDoses', label: 'Doses per day', type: 'number', condition: (data) => data.interventionInsulin === 'Yes' },
            { id: 'interventionInsulinTypes', label: 'Types of Insulin used', type: 'checkbox', options: ['Rapidly acting insulin', 'Soluble insulin', 'Others'], condition: (data) => data.interventionInsulin === 'Yes' },
            { id: 'interventionInsulinTypesOther', label: 'If Others, specify type', type: 'text', condition: (data) => data.interventionInsulin === 'Yes' && data.interventionInsulinTypes?.includes('Others') },
            { id: 'interventionInsulinAverageDose', label: 'Average dose of insulin used/day', type: 'text', condition: (data) => data.interventionInsulin === 'Yes' },
            { id: 'interventionInsulinMode', label: 'Mode of insulin administration', type: 'radio', options: ['Periodic administration', 'Intravenous insulin infusion', 'Others'], condition: (data) => data.interventionInsulin === 'Yes' },
            { id: 'interventionInsulinModeOther', label: 'If Others, specify mode', type: 'text', condition: (data) => data.interventionInsulin === 'Yes' && data.interventionInsulinMode === 'Others' },
            { id: 'interventionAntibiotic', label: 'Antibiotic therapy', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'interventionFluid', label: 'Fluid management', type: 'radio', options: ['Yes', 'No'], required: true },
        ],
    },
    {
        title: 'Discharge & Resources',
        fields: [
            { id: 'dischargeStayLength', label: 'Length of hospital stay (days)', type: 'number', required: true, helpText: "Discharge Information" },
            { id: 'dischargeStatus', label: 'Discharge status', type: 'radio', options: ['Recovery', 'Transfer', 'Death'], required: true },
            { id: 'dischargeDiagnosis', label: 'Discharge diagnosis', type: 'text', required: true },
            { id: 'dischargeFollowUp', label: 'Follow-up recommendations', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'dischargeCauseOfDeath', label: 'If death, cause of death', type: 'text', condition: (data) => data.dischargeStatus === 'Death' },
            { id: 'additionalTotalAdmitted', label: 'Total number of patients admitted into medical wards within the study period', type: 'number', required: true, helpText: "Additional Information" },
            { id: 'resourceEndocrinologist', label: 'Endocrinologist', type: 'radio', options: ['Yes', 'No'], required: true, helpText: "Resources Available in the Hospital" },
            { id: 'resourceRegistrar', label: 'Senior registrar in EDM', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'resourceDiabeticNurse', label: 'Diabetic nurse', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'resourceOrthoSurgeon', label: 'Orthopaedic surgeon', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'resourcePlasticSurgeon', label: 'Plastic surgeon', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'resourcePodiatrist', label: 'Podiatrist/orthotist', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'resourceNutritionist', label: 'Nutritionist/dietician', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'resourceInfusionPump', label: 'Infusion given pump', type: 'radio', options: ['Yes', 'No'], required: true },
            { id: 'resourceInsulinPump', label: 'Insulin infusion pump', type: 'radio', options: ['Yes', 'No'], required: true },
        ],
    },
    {
        title: 'Cost Analysis',
        fields: [
            { id: 'costPatientLocation', label: 'Where is the patient managed?', type: 'checkbox', options: ['Emergency Unit', 'General Ward', 'ICU/HDU', 'Isolation Ward'], required: true },
            { id: 'costBedDaysEU', label: 'Bed-days: Emergency Unit', type: 'number', required: true, helpText: "Put 0 if not applicable" },
            { id: 'costBedDaysGW', label: 'Bed-days: General Ward', type: 'number', required: true },
            { id: 'costBedDaysICU', label: 'Bed-days: ICU/HDU', type: 'number', required: true },
            { id: 'costBedDaysIW', label: 'Bed-days: Isolation Ward', type: 'number', required: true },
            { id: 'costDiagFBC', label: 'Diagnostics: FBC (quantity)', type: 'number', required: true },
            { id: 'costDiagUE', label: 'Diagnostics: U + E / Creatinine (quantity)', type: 'number', required: true },
            { id: 'costDiagLFTs', label: 'Diagnostics: LFTs (quantity)', type: 'number', required: true },
            { id: 'costDiagCRPESR', label: 'Diagnostics: CRP / ESR (quantity)', type: 'number', required: true },
            { id: 'costDiagGlucose', label: 'Diagnostics: Blood Glucose (quantity)', type: 'number', required: true },
            { id: 'costDiagBloodCulture', label: 'Diagnostics: Blood Culture (quantity)', type: 'number', required: true },
            { id: 'costDiagWoundCulture', label: 'Diagnostics: Wound Culture (quantity)', type: 'number', required: true },
            { id: 'costDiagABG', label: 'Diagnostics: Arterial Blood Gases (ABG) (quantity)', type: 'number', required: true },
            { id: 'costDiagHbA1c', label: 'Diagnostics: HbA1c (quantity)', type: 'number', required: true },
            { id: 'costDiagFLP', label: 'Diagnostics: FLP (quantity)', type: 'number', required: true },
            { id: 'costDiagOthers', label: 'Diagnostics: Others / Specify (quantity)', type: 'number', required: true },
            { id: 'costImagingCXR', label: 'Imaging: CXR (quantity)', type: 'number', required: true },
            { id: 'costImagingDoppler', label: 'Imaging: Doppler / Ultrasound (quantity)', type: 'number', required: true },
            { id: 'costImagingECG', label: 'Imaging: ECG (quantity)', type: 'number', required: true },
            { id: 'costImagingEcho', label: 'Imaging: Echocardiography (quantity)', type: 'number', required: true },
            { id: 'costImagingCTMRI', label: 'Imaging: CT / MRI (quantity)', type: 'number', required: true },
            { id: 'costImagingXray', label: 'Imaging: X-ray (quantity)', type: 'number', required: true },
            { id: 'costImagingOthers', label: 'Imaging: Others (Specify) (quantity)', type: 'number', required: true },
            { id: 'costProcABI', label: 'Procedures: ABI (quantity)', type: 'number', required: true },
            { id: 'costProcWound', label: 'Procedures: Wound swab / debridement (quantity)', type: 'number', required: true },
            { id: 'costProcSurgery', label: 'Procedures: Surgery (quantity)', type: 'number', required: true },
            { id: 'costMedsInsulin', label: 'Medicine: Insulin (types)', type: 'text', required: true },
            { id: 'costMedsOral', label: 'Medicine: Oral antidiabetic (if used)', type: 'text', required: true },
            { id: 'costMedsAntibiotics', label: 'Medicine: Antibiotics (agents / days)', type: 'text', required: true },
            { id: 'costMedsIV', label: 'Medicine: IV fluid', type: 'text', required: true },
            { id: 'costMedsAnticoagulants', label: 'Medicine: Anticoagulants', type: 'text', required: true },
            { id: 'costMedsAnalgesics', label: 'Medicine: Analgesics', type: 'text', required: true },
            { id: 'costMedsAntihypertensives', label: 'Medicine: Antihypertensives', type: 'text', required: true },
            { id: 'costMedsOthers', label: 'Medicine: Others (Specify)', type: 'text', required: true },
            { id: 'costConsumablesCatheter', label: 'Consumables: Catheter (quantity)', type: 'number', required: true },
            { id: 'costConsumablesCannulas', label: 'Consumables: Cannulas (quantity)', type: 'number', required: true },
            { id: 'costConsumablesDressing', label: 'Consumables: Dressing (quantity)', type: 'number', required: true },
            { id: 'costConsumablesStrips', label: 'Consumables: Glucose test strips (quantity)', type: 'number', required: true },
            { id: 'costConsumablesLancets', label: 'Consumables: Lancets (quantity)', type: 'number', required: true },
            { id: 'costConsumablesSyringes', label: 'Consumables: Syringes (quantity)', type: 'number', required: true },
            { id: 'costProfSpecialist', label: 'Professional Services: Specialist Consults', type: 'text', required: true },
            { id: 'costProfNursing', label: 'Professional Services: Nursing Procedures', type: 'text', required: true },
            { id: 'costProfPhysio', label: 'Professional Services: Physiotherapy fee', type: 'text', required: true },
            { id: 'costProfDietetics', label: 'Professional Services: Dietetics Consulting', type: 'text', required: true },
            { id: 'costHealthInsurance', label: 'Do you have health insurance?', type: 'radio', options: ['NHIA', 'State Scheme', 'Private', 'None'], required: true },
            { id: 'costNonMedIncome', label: 'Monthly personal income (Naira ₦)', type: 'number', required: true, helpText: "Non-medical costs during admission" },
            { id: 'costNonMedPatientTransport', label: 'Patient transport to hospital (Naira ₦)', type: 'number', required: true },
            { id: 'costNonMedCaregiverTransport', label: 'Caregiver transport (Naira ₦)', type: 'number', required: true },
            { id: 'costNonMedMeals', label: 'Cost of meals for patient (Naira ₦)', type: 'number', required: true },
            { id: 'costNonMedMisc', label: 'Miscellaneous (Naira ₦)', type: 'number', required: true },
        ],
    },
];


// --- HELPER & UI COMPONENTS ---

const LoadingSpinner = () => (
    <div className="loading-container">
        <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="var(--primary-color)">
            <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
            <path d="M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.54,1.54,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </path>
        </svg>
    </div>
);

type NotificationProps = {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
};
const Notification = ({ message, type, onClose }: NotificationProps) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`notification ${type}`}>
            {message}
        </div>
    );
};

type ModalProps = {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
};
const Modal = ({ title, children, onClose, onConfirm, confirmText = "Confirm" }: ModalProps) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {onConfirm && (
                    <div className="modal-actions">
                        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                        <button onClick={onConfirm} className="btn">{confirmText}</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- ICONS ---
const IconDashboard = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const IconPatients = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const IconUsers = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 006-5.197" /></svg>;
const IconCenters = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1m-1-4h1" /></svg>;
const IconLogout = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const IconPlus = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const IconExport = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const IconMenu = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;

// --- LAYOUT COMPONENTS ---

type SidebarProps = {
    currentPage: string;
    setCurrentPage: (page: string) => void;
    userRole: UserProfile['role'];
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
};
function Sidebar({ currentPage, setCurrentPage, userRole, isOpen, setIsOpen }: SidebarProps) {
    const navLinks = [
        { name: 'Dashboard', icon: <IconDashboard />, page: 'dashboard', roles: ['admin', 'researcher', 'data-entry'] },
        { name: 'Patients', icon: <IconPatients />, page: 'patients', roles: ['admin', 'researcher', 'data-entry'] },
        { name: 'Add Patient', icon: <IconPlus />, page: 'add_patient', roles: ['admin', 'data-entry', 'researcher'] },
        { name: 'Users', icon: <IconUsers />, page: 'users', roles: ['admin'] },
        { name: 'Centers', icon: <IconCenters />, page: 'centers', roles: ['admin'] },
    ];

    const handleNav = (page: string) => {
        setCurrentPage(page);
        setIsOpen(false); // Close sidebar on navigation on mobile
    };

    return (
        <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <span className="logo">NIDIPO</span>
            </div>
            {navLinks.filter(link => link.roles.includes(userRole)).map(link => (
                <a
                    key={link.name}
                    className={`nav-item ${currentPage === link.page ? 'active' : ''}`}
                    onClick={() => handleNav(link.page)}
                >
                    {link.icon}
                    {link.name}
                </a>
            ))}
        </nav>
    );
}

type HeaderProps = {
    currentUser: UserProfile;
    onLogout: () => void;
    onMenuClick: () => void;
};
function Header({ currentUser, onLogout, onMenuClick }: HeaderProps) {
    return (
        <header className="header">
            <button className="mobile-menu-btn" onClick={onMenuClick}>
                <IconMenu />
            </button>
            <div className="user-info">
                <span>Welcome, {currentUser.name}</span>
                <button onClick={onLogout} className="logout-btn" aria-label="Logout">
                    <IconLogout />
                </button>
            </div>
        </header>
    );
}

// --- PAGE COMPONENTS ---

type DashboardPageProps = {
    stats: {
        patients: number;
        users: number;
        centers: number;
    };
};
const DashboardPage = ({ stats }: DashboardPageProps) => (
    <div>
        <div className="page-header">
            <h1>Dashboard</h1>
        </div>
        <div className="dashboard-grid">
            <div className="dashboard-card">
                <h3>Total Patients</h3>
                <div className="metric">{stats.patients}</div>
            </div>
            <div className="dashboard-card">
                <h3>Total Users</h3>
                <div className="metric">{stats.users}</div>
            </div>
            <div className="dashboard-card">
                <h3>Research Centers</h3>
                <div className="metric">{stats.centers}</div>
            </div>
        </div>
    </div>
);

type PatientsPageProps = {
    currentUser: UserProfile;
    showNotification: (message: string, type: 'success' | 'error') => void;
};
function PatientsPage({ currentUser, showNotification }: PatientsPageProps) {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPatients = useCallback(async () => {
    setLoading(true);
    
    // Explicitly list fields instead of using *
    let query = supabase
        .from('patients')
        .select('id, patientId, age, sex, centerId, dateAdded, formData, centers(name)');
    
    if (currentUser.role !== 'admin') {
        query = query.eq('centerId', currentUser.centerId);
    }

    const { data, error } = await query.order('dateAdded', { ascending: false });

    if (error) {
        showNotification('Error fetching patients: ' + error.message, 'error');
        console.error(`Fetch error (center ${currentUser.centerId}):`, error);
    } else {
        setPatients(data || []);
    }
    setLoading(false);
}, [currentUser, showNotification]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const filteredPatients = useMemo(() => {
        return patients.filter(p => 
            p.patientId.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [patients, searchTerm]);
    
    const exportToCsv = () => {
        const headers = ['Patient ID', 'Age', 'Sex', 'Center', 'Date Added'];
        const rows = filteredPatients.map(p => [
            p.patientId,
            p.age,
            p.sex,
            p.centers?.name || 'N/A',
            p.dateAdded
        ]);

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "patients_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }


    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div className="page-header">
                <h1>Patient Data</h1>
            </div>
            <div className="table-container">
                <div className="table-controls">
                    <input
                        type="text"
                        placeholder="Search by Patient ID..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="table-actions">
                         <button className="btn" onClick={exportToCsv}>
                            <IconExport />
                            Export CSV
                        </button>
                    </div>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Age</th>
                                <th>Sex</th>
                                <th>Center</th>
                                <th>Date Added</th>
                                {/*<th>Actions</th>*/}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map(patient => (
                                <tr key={patient.id}>
                                    <td>{patient.patientId}</td>
                                    <td>{patient.age}</td>
                                    <td>{patient.sex}</td>
                                    <td>{patient.centers?.name || 'N/A'}</td>
                                    <td>{new Date(patient.dateAdded).toLocaleDateString()}</td>
                                   {/* <td className="actions-cell">
                                        <button aria-label={`Edit patient ${patient.patientId}`}><IconEdit /></button>
                                        <button aria-label={`Delete patient ${patient.patientId}`}><IconDelete /></button>
                                    </td> */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

type AddUserFormData = {
    name: string;
    email: string;
    role: 'researcher' | 'data-entry';
    centerId: number;
};
type AddUserFormProps = {
    centers: Center[];
    onAddUser: (user: AddUserFormData) => Promise<void>;
    onCancel: () => void;
    showNotification: (message: string, type: 'success' | 'error') => void;
};
function AddUserForm({ centers, onAddUser, onCancel, showNotification }: AddUserFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'researcher' | 'data-entry'>('data-entry');
    const [centerId, setCenterId] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !role || !centerId) {
            showNotification('All fields are required.', 'error');
            return;
        }
        setIsSubmitting(true);
        await onAddUser({ name, email, role, centerId: Number(centerId) });
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
                <label htmlFor="role">Role</label>
                <select id="role" value={role} onChange={e => setRole(e.target.value as any)} required>
                    <option value="data-entry">Data Entry</option>
                    <option value="researcher">Researcher</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="center">Research Center</label>
                <select id="center" value={centerId} onChange={e => setCenterId(Number(e.target.value))} required>
                    <option value="" disabled>Select a center</option>
                    {centers.map(center => <option key={center.id} value={center.id}>{center.name}</option>)}
                </select>
            </div>
            <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </button>
            </div>
        </form>
    );
}

type UsersPageProps = {
    showNotification: (message: string, type: 'success' | 'error') => void;
};
function UsersPage({ showNotification }: UsersPageProps) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [centers, setCenters] = useState<Center[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [invitationLink, setInvitationLink] = useState('');
    const [showLinkModal, setShowLinkModal] = useState(false);


    const fetchData = useCallback(async () => {
        setLoading(true);
        const [usersRes, centersRes] = await Promise.all([
            supabase.from('profiles').select('*, centers(name)'),
            supabase.from('centers').select('*')
        ]);

        if (usersRes.error) showNotification('Error fetching users: ' + usersRes.error.message, 'error');
        else setUsers(usersRes.data as UserProfile[]);

        if (centersRes.error) showNotification('Error fetching centers: ' + centersRes.error.message, 'error');
        else setCenters(centersRes.data as Center[]);

        setLoading(false);
    }, [showNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleInviteUser = async (newUserData: AddUserFormData) => {
        const { data, error } = await supabase
            .from('invitations')
            .insert({
                email: newUserData.email,
                role: newUserData.role,
                centerId: newUserData.centerId
            })
            .select()
            .single();

        if (error) {
            showNotification(`Error creating invitation: ${error.message}`, 'error');
            return;
        }

        const token = data.token;
        const baseUrl = window.location.origin + window.location.pathname;
        const link = `${baseUrl}#/?token=${token}`;

        setInvitationLink(link);
        setShowAddUserModal(false);
        setShowLinkModal(true);
        showNotification('Invitation link generated successfully.', 'success');
    };
    

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            {showAddUserModal && (
                <Modal title="Invite New User" onClose={() => setShowAddUserModal(false)}>
                    <AddUserForm 
                        centers={centers} 
                        onAddUser={handleInviteUser}
                        onCancel={() => setShowAddUserModal(false)}
                        showNotification={showNotification}
                    />
                </Modal>
            )}
             {showLinkModal && (
                <Modal title="Invitation Link" onClose={() => setShowLinkModal(false)}>
                    <p>Share this link with the new user to complete their registration:</p>
                    <input type="text" readOnly value={invitationLink} style={{width: '100%', padding: '0.5rem', marginTop: '1rem'}} />
                    <div className="modal-actions">
                        <button className="btn" onClick={() => {
                            navigator.clipboard.writeText(invitationLink);
                            showNotification('Link copied to clipboard!', 'success');
                        }}>Copy Link</button>
                    </div>
                </Modal>
            )}
            <div className="page-header">
                <h1>User Management</h1>
            </div>
            <div className="table-container">
                 <div className="table-controls">
                    <p className="table-description">Manage user roles and center assignments.</p>
                    <div className="table-actions">
                         <button className="btn" onClick={() => setShowAddUserModal(true)}>
                            <IconPlus /> Add User
                        </button>
                    </div>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Center</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>{user.role}</td>
                                    <td>{user.centers?.name || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

type CentersPageProps = {
    showNotification: (message: string, type: 'success' | 'error') => void;
};
function CentersPage({ showNotification }: CentersPageProps) {
    const [centers, setCenters] = useState<Center[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCenters = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('centers').select('*');
        if (error) {
            showNotification('Error fetching centers: ' + error.message, 'error');
        } else {
            setCenters(data as Center[]);
        }
        setLoading(false);
    }, [showNotification]);

    useEffect(() => {
        fetchCenters();
    }, [fetchCenters]);

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div className="page-header">
                <h1>Research Centers</h1>
            </div>
            <div className="table-container">
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {centers.map(center => (
                                <tr key={center.id}>
                                    <td>{center.name}</td>
                                    <td>{center.location}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

type AddPatientPageProps = {
    showNotification: (message: string, type: 'success' | 'error') => void;
    onPatientAdded: () => void;
    currentUser: UserProfile;
};
function AddPatientPage({ showNotification, onPatientAdded, currentUser }: AddPatientPageProps) {
    const [currentStep, setCurrentStep] = useState(0);
    // Fix: Specify `any` type for formData state to allow dynamic properties and prevent errors on access.
    const [formData, setFormData] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (fieldId: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [fieldId]: value
        }));
    };

    const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
        const currentValues = formData[fieldId] || [];
        const newValues = checked
            ? [...currentValues, option]
            : currentValues.filter((item: string) => item !== option);
        setFormData((prev: any) => ({ ...prev, [fieldId]: newValues }));
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, formStructure.length - 1));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const coreData = {
            patientId: formData.serialNumber,
            age: formData.age,
            sex: formData.sex,
            centerId: currentUser.role === 'admin' && formData.centerId 
            ? parseInt(formData.centerId) 
            : currentUser.centerId,
        };

        const { error } = await supabase.from('patients').insert({
            ...coreData,
            formData: formData, // Store the complete form data in the JSONB column
        });

        setIsSubmitting(false);
        if (error) {
            showNotification(`Error saving patient data: ${error.message}`, 'error');
        } else {
            showNotification('Patient data saved successfully!', 'success');
            onPatientAdded();
        }
    };

    const renderField = (field: FormField) => {
        if (field.condition && !field.condition(formData)) {
            return null;
        }

        const commonProps = {
            id: field.id,
            value: formData[field.id] || '',
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleInputChange(field.id, e.target.value),
        };

        return (
            <div key={field.id} className={`form-group ${field.gridColumns === 1 ? 'full-width' : ''}`}>
                <label htmlFor={field.id}>{field.label}</label>
                {field.type === 'text' && <input type="text" {...commonProps} />}
                {field.type === 'number' && <input type="number" {...commonProps} />}
                {field.type === 'textarea' && <textarea {...commonProps} rows={3} />}
                {field.type === 'radio' && (
                    <div className="radio-group">
                        {field.options?.map(option => (
                            <label key={option}>
                                <input
                                    type="radio"
                                    name={field.id}
                                    value={option}
                                    checked={formData[field.id] === option}
                                    onChange={e => handleInputChange(field.id, e.target.value)}
                                />
                                {option}
                            </label>
                        ))}
                    </div>
                )}
                {field.type === 'checkbox' && (
                     <div className="checkbox-group">
                        {field.options?.map(option => (
                            <label key={option}>
                                <input
                                    type="checkbox"
                                    checked={formData[field.id]?.includes(option) || false}
                                    onChange={e => handleCheckboxChange(field.id, option, e.target.checked)}
                                />
                                {option}
                            </label>
                        ))}
                    </div>
                )}
                {field.type === 'monitoring_table' && <MonitoringTable formData={formData} handleInputChange={handleInputChange} />}
                {field.helpText && <p className="help-text">{field.helpText}</p>}
            </div>
        );
    };

    return (
        <div className="form-page-container">
            <div className="page-header">
                <h1>Add New Patient Data</h1>
            </div>
            <div className="form-content-wrapper">
                 <ProgressBar currentStep={currentStep} steps={formStructure.map(s => s.title)} />
                <form onSubmit={handleSubmit}>
                    <h2>{formStructure[currentStep].title}</h2>
                    {formStructure[currentStep].description && (
                        <p className="form-section-description">{formStructure[currentStep].description}</p>
                    )}
                    <div className="form-step-fields">
                        {formStructure[currentStep].fields.map((field) => renderField(field))}
                    </div>
                     <div className="form-navigation">
                        <button type="button" className="btn btn-secondary" onClick={prevStep} disabled={currentStep === 0}>Previous</button>
                        <div className="form-navigation-steps">
                            {currentStep < formStructure.length - 1 ? (
                                <button type="button" className="btn" onClick={nextStep}>Next</button>
                            ) : (
                                <button type="submit" className="btn" disabled={isSubmitting}>
                                    {isSubmitting ? 'Submitting...' : 'Submit Form'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

type MonitoringTableProps = {
    formData: any;
    handleInputChange: (fieldId: string, value: any) => void;
};
const MonitoringTable = ({ formData, handleInputChange }: MonitoringTableProps) => {
    const days = Array.from({ length: 14 }, (_, i) => i + 1);
    const times = ['Morning', 'Afternoon', 'Night'];

    return (
        <div className="monitoring-table-wrapper">
            <table className="monitoring-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        {days.map(day => <th key={day}>Day {day}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {times.map(time => (
                        <tr key={time}>
                            <td>{time}</td>
                            {days.map(day => (
                                <td key={day}>
                                    <input
                                        type="text"
                                        aria-label={`Day ${day} ${time}`}
                                        value={formData[`glucose_day${day}_${time.toLowerCase()}`] || ''}
                                        onChange={e => handleInputChange(`glucose_day${day}_${time.toLowerCase()}`, e.target.value)}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

type ProgressBarProps = {
    currentStep: number;
    steps: string[];
};
const ProgressBar = ({ currentStep, steps }: ProgressBarProps) => (
    <div className="progress-bar">
        {steps.map((step, index) => (
            <div key={index} className={`progress-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}>
                <div className="step-number">{index < currentStep ? '✓' : index + 1}</div>
                <div className="step-label">{step}</div>
            </div>
        ))}
    </div>
);


// --- AUTH COMPONENTS ---

type InvitationSignUpPageProps = {
    token: string;
    showNotification: (message: string, type: 'success' | 'error') => void;
    onSignedUp: () => void;
};
function InvitationSignUpPage({ token, showNotification, onSignedUp }: InvitationSignUpPageProps) {
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchInvitation = async () => {
            const { data, error } = await supabase
                .from('invitations')
                .select('email, role, centerId')
                .eq('token', token)
                .single();

            if (error || !data) {
                setError('This invitation link is invalid or has expired.');
            } else {
                setInvitation(data);
            }
            setLoading(false);
        };
        fetchInvitation();
    }, [token]);

    const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    setLoading(true);
    setError('');

    try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: invitation.email,
            password: password,
            options: {
                data: {
                    name: name,
                    role: invitation.role,
                    centerId: invitation.centerId
                }
            }
        });
        
        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
        }

        if (signUpData.user) {
            await supabase.rpc('delete_invitation', { invitation_token: token });
            showNotification('Sign up successful! Please check your email for verification.', 'success');
            onSignedUp();
        }
    } catch (err) {
        setError('An unexpected error occurred.');
        console.error('Sign up error:', err);
    } finally {
        setLoading(false);
    }
};
    if (loading) return <LoadingSpinner />;

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h1>Complete Your Registration</h1>
                {error ? <p className="error-message">{error}</p> : 
                invitation ? (
                <form onSubmit={handleSignUp}>
                    <p>Welcome! Create your account to join the platform.</p>
                     <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={invitation.email} disabled />
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn" disabled={loading}>
                        {loading ? 'Signing Up...' : 'Sign Up'}
                    </button>
                </form>
                ) : null}
            </div>
        </div>
    );
}

type AuthPageProps = {
    hasAdmin: boolean;
    onAdminCreated: () => void;
};
function AuthPage({ hasAdmin, onAdminCreated }: AuthPageProps) {
    const mode = hasAdmin ? 'login' : 'admin_signup';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };

    const handleAdminSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } }
        });

        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
        }

        if (data.user) {
            const { error: rpcError } = await supabase.rpc('promote_user_to_admin', { user_id: data.user.id });

            if (rpcError) {
                setError(`Failed to set admin role: ${rpcError.message}`);
            } else {
                onAdminCreated();
            }
        }
        setLoading(false);
    };

    const renderForm = () => {
        if (mode === 'admin_signup') {
            return (
                <form onSubmit={handleAdminSignUp}>
                    <h1>Create Admin Account</h1>
                    <p>This is a one-time setup for the first administrator.</p>
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn" disabled={loading}>{loading ? 'Creating...' : 'Create Admin'}</button>
                </form>
            );
        }
        
        return (
            <form onSubmit={handleLogin}>
                <h1>Welcome Back</h1>
                <p>Log in to access the research platform.</p>
                <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn" disabled={loading}>{loading ? 'Logging In...' : 'Log In'}</button>
            </form>
        );
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                {renderForm()}
                {error && <p className="error-message">{error}</p>}
            </div>
        </div>
    );
}


// --- MAIN APP COMPONENT ---

function App() {
    const [session, setSession] = useState<AuthSession | null>(null);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasAdmin, setHasAdmin] = useState(true);
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [stats, setStats] = useState({ patients: 0, users: 0, centers: 0 });
    const [notifications, setNotifications] = useState<NotificationType[]>([]);
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    // Check for invitation token in URL
    const urlHash = window.location.hash;
    const params = new URLSearchParams(urlHash.substring(urlHash.indexOf('?')));
    const invitationToken = params.get('token');

    const showNotification = useCallback((message: string, type: 'success' | 'error') => {
        const newNotif = { id: Date.now(), message, type };
        setNotifications(prev => [...prev, newNotif]);
    }, []);

    const handleSignedUp = () => {
         // Clear the token from the URL
        window.location.hash = '/';
        // Force a re-check of auth state, which will show login page
        setSession(null); 
    };

    useEffect(() => {
    const checkAdminExists = async () => {
        const { data, error } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
        if (error) {
            console.error("Error checking for admin:", error);
            setHasAdmin(true);
        } else {
            setHasAdmin(data.length > 0);
        }
    };

    const fetchInitialData = async (user: User) => {
        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*, centers(name)')
                .eq('id', user.id)
                .single();

            if (profileError) {
                showNotification("Could not fetch user profile.", "error");
                await supabase.auth.signOut();
                return;
            }

            setCurrentUser(profile as UserProfile);

            // Fetch stats in background for admin
            if (profile.role === 'admin') {
                Promise.all([
                    supabase.from('patients').select('id', { count: 'exact', head: true }),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }),
                    supabase.from('centers').select('id', { count: 'exact', head: true }),
                ]).then(([patientsRes, usersRes, centersRes]) => {
                    setStats({
                        patients: patientsRes.count || 0,
                        users: usersRes.count || 0,
                        centers: centersRes.count || 0
                    });
                }).catch(err => console.error("Error fetching stats:", err));
            }
        } catch (error) {
            console.error("Error in fetchInitialData:", error);
        }
    };

    const initializeSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                showNotification("Failed to initialize session.", "error");
                setLoading(false);
                return;
            }

            if (!session) {
                await checkAdminExists();
            }

            setSession(session);
            setLoading(false); // Stop loading immediately
            
            if (session?.user) {
                fetchInitialData(session.user); // Don't await
            }
        } catch (error) {
            console.error("Error initializing session:", error);
            setLoading(false);
        }
    };

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
            setSession(session);
            if (session?.user) {
                fetchInitialData(session.user);
            } else {
                setCurrentUser(null);
                await checkAdminExists();
            }
        }
    );

    return () => {
        authListener.subscription.unsubscribe();
    };
}, [showNotification]);



    const handleLogout = async () => {
        await supabase.auth.signOut();
        setCurrentPage('dashboard');
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (invitationToken) {
        return (
            <>
              {notifications.map(n => <Notification key={n.id} {...n} onClose={() => setNotifications(p => p.filter(i => i.id !== n.id))} />)}
              <InvitationSignUpPage token={invitationToken} showNotification={showNotification} onSignedUp={handleSignedUp} />
            </>
        );
    }
    
    if (!session || !currentUser) {
        return <AuthPage hasAdmin={hasAdmin} onAdminCreated={() => {
            showNotification('Admin created! Please check your email to verify, then log in.', 'success');
            setHasAdmin(true);
        }}/>;
    }

    // Show loading if we have session but profile hasn't loaded
if (session && !currentUser) {
    return <LoadingSpinner />;
}
    
    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardPage stats={stats} />;
            case 'patients':
                return <PatientsPage currentUser={currentUser} showNotification={showNotification} />;
            case 'add_patient':
                 if (!['admin', 'data-entry', 'researcher'].includes(currentUser.role)) {
                    setCurrentPage('dashboard'); // Redirect if no access
                    return <DashboardPage stats={stats} />;
                }
                return <AddPatientPage showNotification={showNotification} onPatientAdded={() => setCurrentPage('patients')} currentUser={currentUser} />;
            case 'users':
                if (currentUser.role !== 'admin') return <DashboardPage stats={stats} />;
                return <UsersPage showNotification={showNotification} />;
            case 'centers':
                 if (currentUser.role !== 'admin') return <DashboardPage stats={stats} />;
                return <CentersPage showNotification={showNotification} />;
            default:
                return <DashboardPage stats={stats} />;
        }
    };
    
    return (
        <div className="app-layout">
            {notifications.map(n => <Notification key={n.id} {...n} onClose={() => setNotifications(p => p.filter(i => i.id !== n.id))} />)}
            <Sidebar 
                currentPage={currentPage} 
                setCurrentPage={setCurrentPage} 
                userRole={currentUser.role}
                isOpen={isSidebarOpen}
                setIsOpen={setSidebarOpen}
            />
            <main className="main-content">
                <Header 
                    currentUser={currentUser} 
                    onLogout={handleLogout}
                    onMenuClick={() => setSidebarOpen(!isSidebarOpen)} 
                />
                <div className="page-content">
                    {renderPage()}
                </div>
            </main>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
