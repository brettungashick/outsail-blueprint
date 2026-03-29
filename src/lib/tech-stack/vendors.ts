export const HCM_CAPABILITIES = [
  'Payroll', 'HRIS', 'Benefits Administration', 'Time & Attendance',
  'Onboarding', 'Performance Management', 'Compensation Planning',
  'Learning & Development', 'Recruiting', 'Employee Engagement'
]

export const HRIS_VENDORS = [
  'Workday', 'ADP Workforce Now', 'ADP Vantage HCM', 'UKG Pro', 'UKG Ready',
  'Paycom', 'Paylocity', 'Rippling', 'BambooHR', 'Gusto', 'Namely',
  'SAP SuccessFactors', 'Oracle HCM Cloud', 'Dayforce', 'Paychex Flex',
  'iSolved', 'TriNet', 'Zenefits', 'HiBob', 'Lattice', 'Greenhouse',
  'Lever', 'Docebo', 'Absorb LMS', 'Cornerstone OnDemand', 'ServiceNow HR',
  'Workable', 'Paychex Oasis', 'Benefitfocus', 'PlanSource'
]

export const VENDOR_DEFAULT_MODULES: Record<string, string[]> = {
  'Workday': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management', 'Compensation Planning', 'Learning & Development', 'Recruiting'],
  'ADP Workforce Now': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding'],
  'ADP Vantage HCM': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management'],
  'UKG Pro': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management', 'Compensation Planning'],
  'UKG Ready': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance'],
  'Paycom': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management', 'Learning & Development', 'Recruiting'],
  'Paylocity': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management', 'Employee Engagement'],
  'Rippling': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Learning & Development'],
  'BambooHR': ['HRIS', 'Onboarding', 'Performance Management', 'Recruiting'],
  'Gusto': ['HRIS', 'Payroll', 'Benefits Administration', 'Onboarding'],
  'Namely': ['HRIS', 'Payroll', 'Benefits Administration', 'Performance Management'],
  'SAP SuccessFactors': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management', 'Compensation Planning', 'Learning & Development', 'Recruiting', 'Employee Engagement'],
  'Oracle HCM Cloud': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management', 'Compensation Planning', 'Learning & Development', 'Recruiting'],
  'Dayforce': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding', 'Performance Management', 'Compensation Planning', 'Recruiting'],
  'Paychex Flex': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance', 'Onboarding'],
  'iSolved': ['HRIS', 'Payroll', 'Benefits Administration', 'Time & Attendance'],
  'HiBob': ['HRIS', 'Onboarding', 'Performance Management', 'Compensation Planning', 'Employee Engagement'],
}
