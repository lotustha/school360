export const SYSTEM_PERMISSIONS = [
  {
    module: "Academics",
    permissions: [
      { code: "academic:view", label: "View Academics", description: "View subjects, classes, and sections." },
      { code: "academic:manage", label: "Manage Academics", description: "Create and edit subjects and syllabus." },
      { code: "gradebook:view", label: "View Gradebook", description: "View student marks and report cards." },
      { code: "gradebook:edit", label: "Edit Gradebook", description: "Enter and edit student marks." },
    ]
  },
  {
    module: "Finance & Accounts",
    permissions: [
      { code: "finance:view", label: "View Finances", description: "View fee structures and payment history." },
      { code: "finance:manage", label: "Manage Finances", description: "Create fee structures, issue invoices, and record payments." },
      { code: "payroll:view", label: "View Payroll", description: "View employee payroll and salary sheets." },
      { code: "payroll:manage", label: "Manage Payroll", description: "Process payroll, TDS, and SSF calculations." },
    ]
  },
  {
    module: "Users & HR",
    permissions: [
      { code: "student:view", label: "View Students", description: "View the student directory." },
      { code: "student:manage", label: "Manage Students", description: "Admit new students and edit profiles." },
      { code: "employee:view", label: "View Employees", description: "View staff and teacher directory." },
      { code: "employee:manage", label: "Manage Employees", description: "Add and edit employee profiles." },
      { code: "attendance:view", label: "View Attendance", description: "View student and staff attendance." },
      { code: "attendance:manage", label: "Take Attendance", description: "Manually input or override attendance." },
    ]
  },
  {
    module: "System Settings",
    permissions: [
      { code: "settings:view", label: "View Settings", description: "View school configuration." },
      { code: "settings:manage", label: "Manage Settings", description: "Edit school configuration and integrations." },
      { code: "rbac:manage", label: "Manage Access Control", description: "Create roles and manage user permissions." },
    ]
  }
];

export const getAllPermissionCodes = () => {
  return SYSTEM_PERMISSIONS.flatMap(module => module.permissions.map(p => p.code));
};
