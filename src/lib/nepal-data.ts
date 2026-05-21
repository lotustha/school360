export const NEPAL_DISTRICTS = [
  "Achham","Arghakhanchi","Baglung","Baitadi","Bajhang","Bajura","Banke","Bara",
  "Bardiya","Bhaktapur","Bhojpur","Chitwan","Dadeldhura","Dailekh","Dang","Darchula",
  "Dhading","Dhankuta","Dhanusa","Dolakha","Dolpa","Doti","Eastern Rukum","Gorkha",
  "Gulmi","Humla","Ilam","Jajarkot","Jhapa","Jumla","Kailali","Kalikot","Kanchanpur",
  "Kapilvastu","Kaski","Kathmandu","Kavrepalanchok","Khotang","Lalitpur","Lamjung",
  "Mahottari","Makwanpur","Manang","Morang","Mugu","Mustang","Myagdi",
  "Nawalparasi East","Nawalparasi West","Nuwakot","Okhaldhunga","Palpa","Panchthar",
  "Parbat","Parsa","Pyuthan","Ramechhap","Rasuwa","Rautahat","Rolpa","Rupandehi",
  "Salyan","Sankhuwasabha","Saptari","Sarlahi","Sindhuli","Sindhupalchok","Siraha",
  "Solukhumbu","Sunsari","Surkhet","Syangja","Taplejung","Terhathum","Udayapur",
  "Western Rukum",
] as const

// EMIS Nepal ethnic/caste categories (DoE standard 10 groups)
export const EMIS_ETHNICITY_GROUPS = [
  "Brahmin-Hill",
  "Chhetri",
  "Dalit-Hill",
  "Dalit-Terai",
  "Newar",
  "Janajati-Hill",
  "Janajati-Terai",
  "Madhesi-Other",
  "Muslim",
  "Other",
] as const

// Legacy compatibility
export const NEPAL_CASTE_CATEGORIES = EMIS_ETHNICITY_GROUPS

export const NEPAL_RELIGIONS = [
  "Hindu","Buddhist","Muslim","Kirat","Christian","Prakriti","Bon","Jain","Bahai","Other",
] as const

export const MOTHER_TONGUE_OPTIONS = [
  "Nepali","Maithili","Bhojpuri","Tharu","Tamang","Newari","Magar","Awadhi",
  "Doteli","Urdu","Sunuwar","Limbu","Gurung","Rai","Sherpa","Bajjika","Rajbanshi","Other",
] as const

export const BLOOD_GROUPS = [
  "A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown",
] as const

export const GUARDIAN_RELATIONS = [
  "Father","Mother","Guardian","Uncle","Aunt","Grandfather","Grandmother","Other",
] as const

export const GENDER_OPTIONS = ["Male","Female","Other"] as const

// EMIS disability classification (DoE standard)
export const DISABILITY_OPTIONS = [
  { value: "NONE",         label: "None" },
  { value: "PHYSICAL",     label: "Physical" },
  { value: "VISUAL",       label: "Visual / Blind" },
  { value: "HEARING",      label: "Hearing / Deaf" },
  { value: "INTELLECTUAL", label: "Intellectual" },
  { value: "SPEECH",       label: "Speech" },
  { value: "MULTIPLE",     label: "Multiple Disabilities" },
] as const

// EMIS scholarship categories
export const SCHOLARSHIP_TYPES = [
  { value: "NONE",       label: "None" },
  { value: "GOVERNMENT", label: "Government (DoE)" },
  { value: "SCHOOL",     label: "School Scholarship" },
  { value: "DALIT",      label: "Dalit Scholarship" },
  { value: "JANAJATI",   label: "Janajati Scholarship" },
  { value: "DISABILITY", label: "Disability Scholarship" },
  { value: "OTHER",      label: "Other" },
] as const

// Guardian/parent education levels (EMIS)
export const EDUCATION_LEVELS = [
  "Illiterate",
  "Literate (Non-formal)",
  "Primary (Grade 1–5)",
  "Lower Secondary (Grade 6–8)",
  "Secondary (SLC/SEE)",
  "Higher Secondary (+2/NEB)",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD / Above",
] as const

export const EMPLOYEE_TYPES = ["Permanent","Contract","Part-Time","Temporary"] as const

export const ACADEMIC_LEVELS = [
  "SLC/SEE","+2/NEB","Bachelor","Master","PhD","Other",
] as const

export const NATIONALITY_OPTIONS = [
  "Nepali","Indian","Chinese","Other",
] as const
