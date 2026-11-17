/* Settings for the Autoimmune Encephalitis app. Edit here, not in app.js.
   NOTE: this repo is public, so anything in this file is visible to anyone. */
window.AE_CONFIG = {
  clientId: '09c38f54-fb4d-4664-87b6-67b57983ac01',
  // launch.html adds 'launch' (EHR launch) or 'launch/patient' (standalone launch).
  // Every scope listed here must also be ticked in the app's registration in the Cerner Code Console.
  scope: [
    'openid', 'fhirUser', 'online_access',
    'patient/Patient.read', 'patient/Observation.read', 'patient/Condition.read',
    'patient/MedicationRequest.read', 'patient/DocumentReference.read',
    'patient/DiagnosticReport.read', 'patient/Binary.read'
  ].join(' '),

  // Optional default physician for the requisition. Left blank because this repo is public:
  // pick "Other physician…" in the app and click "Save as a physician on this computer" instead.
  // Format if you ever fill it in: { label:'Dr. First Last', name:'Last, First', phone:'', fax:'', email:'', comments:'College ID; MSP' }
  defaultPhysician: null,

  // How many recent notes to scan for symptoms (each one is a separate download).
  maxNotes: 20
};
