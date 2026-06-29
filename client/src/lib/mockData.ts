// Medicare Advantage Plan Quote Engine — Mock Data
// POPULAR_RX_DRUGS: common drug suggestions for RxDrugsModal + GuidedWorkflowModal.
// (MOCK_PLANS / POPULAR_DOCTORS / CARRIER_COLORS removed — confirmed zero importers.)

export const POPULAR_RX_DRUGS = [
  // --- Blood Pressure / Heart ---
  { id: "rx-1", name: "Metformin", dosage: "500mg", frequency: "Twice daily", isGeneric: true },
  { id: "rx-2", name: "Lisinopril", dosage: "10mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-3", name: "Atorvastatin", dosage: "20mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-4", name: "Amlodipine", dosage: "5mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-5", name: "Omeprazole", dosage: "20mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-6", name: "Eliquis", dosage: "5mg", frequency: "Twice daily", isGeneric: false },
  { id: "rx-7", name: "Jardiance", dosage: "10mg", frequency: "Once daily", isGeneric: false },
  { id: "rx-8", name: "Xarelto", dosage: "20mg", frequency: "Once daily", isGeneric: false },
  { id: "rx-9", name: "Entresto", dosage: "49/51mg", frequency: "Twice daily", isGeneric: false },
  { id: "rx-10", name: "Ozempic", dosage: "0.5mg", frequency: "Weekly injection", isGeneric: false },
  { id: "rx-11", name: "Losartan", dosage: "50mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-12", name: "Metoprolol Succinate", dosage: "25mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-13", name: "Hydrochlorothiazide", dosage: "25mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-14", name: "Carvedilol", dosage: "12.5mg", frequency: "Twice daily", isGeneric: true },
  { id: "rx-15", name: "Valsartan", dosage: "160mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-16", name: "Warfarin", dosage: "5mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-17", name: "Clopidogrel", dosage: "75mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-18", name: "Diltiazem", dosage: "120mg", frequency: "Once daily", isGeneric: true },
  // --- Diabetes ---
  { id: "rx-19", name: "Glipizide", dosage: "5mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-20", name: "Januvia", dosage: "100mg", frequency: "Once daily", isGeneric: false },
  { id: "rx-21", name: "Trulicity", dosage: "1.5mg", frequency: "Weekly injection", isGeneric: false },
  { id: "rx-22", name: "Farxiga", dosage: "10mg", frequency: "Once daily", isGeneric: false },
  { id: "rx-23", name: "Lantus", dosage: "100 units/mL", frequency: "Once daily", isGeneric: false },
  { id: "rx-24", name: "Humalog", dosage: "100 units/mL", frequency: "With meals", isGeneric: false },
  { id: "rx-25", name: "Rybelsus", dosage: "7mg", frequency: "Once daily", isGeneric: false },
  { id: "rx-26", name: "Mounjaro", dosage: "5mg", frequency: "Weekly injection", isGeneric: false },
  // --- Cholesterol ---
  { id: "rx-27", name: "Rosuvastatin", dosage: "10mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-28", name: "Simvastatin", dosage: "20mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-29", name: "Pravastatin", dosage: "40mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-30", name: "Ezetimibe", dosage: "10mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-31", name: "Repatha", dosage: "140mg", frequency: "Every 2 weeks", isGeneric: false },
  // --- Pain / Inflammation ---
  { id: "rx-32", name: "Gabapentin", dosage: "300mg", frequency: "Three times daily", isGeneric: true },
  { id: "rx-33", name: "Tramadol", dosage: "50mg", frequency: "Every 6 hours as needed", isGeneric: true },
  { id: "rx-34", name: "Meloxicam", dosage: "15mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-35", name: "Pregabalin", dosage: "75mg", frequency: "Twice daily", isGeneric: true },
  { id: "rx-36", name: "Celecoxib", dosage: "200mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-37", name: "Duloxetine", dosage: "60mg", frequency: "Once daily", isGeneric: true },
  // --- Respiratory ---
  { id: "rx-38", name: "Albuterol Inhaler", dosage: "90mcg", frequency: "As needed", isGeneric: true },
  { id: "rx-39", name: "Symbicort", dosage: "160/4.5mcg", frequency: "Twice daily", isGeneric: false },
  { id: "rx-40", name: "Spiriva", dosage: "18mcg", frequency: "Once daily", isGeneric: false },
  { id: "rx-41", name: "Breo Ellipta", dosage: "100/25mcg", frequency: "Once daily", isGeneric: false },
  { id: "rx-42", name: "Trelegy Ellipta", dosage: "100/62.5/25mcg", frequency: "Once daily", isGeneric: false },
  { id: "rx-43", name: "Montelukast", dosage: "10mg", frequency: "Once daily", isGeneric: true },
  // --- Mental Health ---
  { id: "rx-44", name: "Sertraline", dosage: "50mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-45", name: "Escitalopram", dosage: "10mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-46", name: "Trazodone", dosage: "50mg", frequency: "At bedtime", isGeneric: true },
  { id: "rx-47", name: "Buspirone", dosage: "10mg", frequency: "Twice daily", isGeneric: true },
  { id: "rx-48", name: "Mirtazapine", dosage: "15mg", frequency: "At bedtime", isGeneric: true },
  // --- Thyroid ---
  { id: "rx-49", name: "Levothyroxine", dosage: "50mcg", frequency: "Once daily", isGeneric: true },
  { id: "rx-50", name: "Synthroid", dosage: "100mcg", frequency: "Once daily", isGeneric: false },
  // --- Eye Care ---
  { id: "rx-51", name: "Latanoprost", dosage: "0.005%", frequency: "Once daily at bedtime", isGeneric: true },
  { id: "rx-52", name: "Timolol Eye Drops", dosage: "0.5%", frequency: "Twice daily", isGeneric: true },
  // --- GI / Acid Reflux ---
  { id: "rx-53", name: "Pantoprazole", dosage: "40mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-54", name: "Famotidine", dosage: "20mg", frequency: "Twice daily", isGeneric: true },
  { id: "rx-55", name: "Ondansetron", dosage: "4mg", frequency: "As needed", isGeneric: true },
  // --- Bone Health ---
  { id: "rx-56", name: "Alendronate", dosage: "70mg", frequency: "Once weekly", isGeneric: true },
  { id: "rx-57", name: "Prolia", dosage: "60mg", frequency: "Every 6 months", isGeneric: false },
  // --- Blood Thinners / Misc ---
  { id: "rx-58", name: "Furosemide", dosage: "40mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-59", name: "Spironolactone", dosage: "25mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-60", name: "Tamsulosin", dosage: "0.4mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-61", name: "Finasteride", dosage: "5mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-62", name: "Potassium Chloride", dosage: "20mEq", frequency: "Once daily", isGeneric: true },
  { id: "rx-63", name: "Prednisone", dosage: "10mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-64", name: "Allopurinol", dosage: "300mg", frequency: "Once daily", isGeneric: true },
  { id: "rx-65", name: "Colchicine", dosage: "0.6mg", frequency: "Once daily", isGeneric: true },
  // --- Specialty / Brand ---
  { id: "rx-66", name: "Humira", dosage: "40mg", frequency: "Every 2 weeks", isGeneric: false },
  { id: "rx-67", name: "Keytruda", dosage: "200mg", frequency: "Every 3 weeks", isGeneric: false },
  { id: "rx-68", name: "Xeljanz", dosage: "5mg", frequency: "Twice daily", isGeneric: false },
  { id: "rx-69", name: "Rinvoq", dosage: "15mg", frequency: "Once daily", isGeneric: false },
  { id: "rx-70", name: "Stelara", dosage: "45mg", frequency: "Every 12 weeks", isGeneric: false },
];
