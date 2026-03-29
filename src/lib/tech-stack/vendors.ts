export const HCM_CAPABILITIES = [
  'Payroll',
  'Benefits Admin',
  'Time & Attendance',
  'Onboarding',
  'Core HR',
  'Performance',
  'Compensation',
  'Learning/LMS',
  'Recruiting/ATS',
  'AI',
  'Expense',
  'SSO',
  'ERP/General Ledger',
  'Global Payroll',
  'Custom',
]

// Kept for backwards compatibility
export const HRIS_VENDORS: string[] = []

export const VENDOR_DEFAULT_MODULES: Record<string, string[]> = {
  'Workday HCM': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Compensation', 'Learning/LMS', 'Recruiting/ATS'],
  'SAP SuccessFactors': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Compensation', 'Learning/LMS', 'Recruiting/ATS'],
  'Oracle HCM Cloud': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Compensation', 'Learning/LMS', 'Recruiting/ATS'],
  'ADP Workforce Now': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding'],
  'ADP Vantage HCM': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Compensation'],
  'UKG Pro': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Compensation'],
  'UKG Ready': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance'],
  'Dayforce': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Compensation', 'Recruiting/ATS'],
  'Paycom': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Learning/LMS', 'Recruiting/ATS'],
  'Paylocity': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance'],
  'Rippling': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Learning/LMS', 'SSO'],
  'BambooHR': ['Core HR', 'Onboarding', 'Performance', 'Recruiting/ATS'],
  'Gusto': ['Core HR', 'Payroll', 'Benefits Admin', 'Onboarding'],
  'Namely': ['Core HR', 'Payroll', 'Benefits Admin', 'Performance'],
  'HiBob': ['Core HR', 'Onboarding', 'Performance', 'Compensation'],
  'Paychex Flex': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding'],
  'iSolved': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance'],
  'Paycor': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Recruiting/ATS'],
  'Infor CloudSuite HCM': ['Core HR', 'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding', 'Performance', 'Compensation'],
}

// Categories typically covered by add-on point solutions (not primary HCM)
export const POINT_SOLUTION_CATEGORIES = [
  'AI',
  'Expense',
  'SSO',
  'ERP/General Ledger',
  'Global Payroll',
  'Custom',
]
