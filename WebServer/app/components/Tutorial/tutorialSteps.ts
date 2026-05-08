import Roles from "@/app/lib/Roles";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  route?: string;
  target?: string;
  settingsTab?: string;
}

const pageTarget = '[data-tour="page-content"], [data-tour="app-main"]';
const themeTarget =
  '[data-tour="sidebar-action-dark-mode"], [data-tour="sidebar-action-light-mode"]';

const introSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to RTC Database",
    body: "This guided tour will walk through the workspace available to your account type. Use Next and Back at your own pace, or Cancel to skip it for now.",
  },
  {
    id: "sidebar",
    title: "Your main navigation",
    body: "The sidebar is your map. It changes by role, so every account sees only the areas it needs for court records, reports, messages, and settings.",
    target: '[data-tour="app-sidebar"]',
  },
  {
    id: "sidebar-brand",
    title: "Court workspace identity",
    body: "The top of the sidebar anchors the Regional Trial Court workspace. The navigation below it is grouped by work area.",
    target: '[data-tour="sidebar-brand"]',
  },
  {
    id: "sidebar-collapse",
    title: "Collapse or expand",
    body: "Use this control when you need more table space. In collapsed mode, hover over icons to see their labels.",
    target: '[data-tour="sidebar-collapse"]',
  },
  {
    id: "dashboard-nav",
    title: "Dashboard",
    body: "The dashboard is the starting point after login. It summarizes the most useful activity for your role.",
    route: "/user/dashboard",
    target: '[data-tour="sidebar-nav-dashboard"]',
  },
  {
    id: "dashboard-page",
    title: "Dashboard overview",
    body: "Use this screen for quick status checks, recent activity, and shortcuts before opening the detailed record pages.",
    route: "/user/dashboard",
    target: pageTarget,
  },
];

const communicationSteps: TutorialStep[] = [
  {
    id: "messages-nav",
    title: "Messages",
    body: "Messages let users coordinate inside the system. Direct chats are created with users in the same role so handoffs stay close to the records.",
    route: "/user/messages",
    target: '[data-tour="sidebar-action-messages"]',
  },
  {
    id: "messages-page",
    title: "Conversation workspace",
    body: "Use this page for direct and group conversations, file attachments, pinned messages, and record-related coordination.",
    route: "/user/messages",
    target: pageTarget,
  },
];

const closingSteps: TutorialStep[] = [
  {
    id: "theme-toggle",
    title: "Light and dark mode",
    body: "This toggle saves your preferred theme to your account so it follows you on later logins.",
    target: themeTarget,
  },
  {
    id: "user-card",
    title: "Your account card",
    body: "Your name and role stay visible at the bottom of the sidebar. Sign out is directly below it.",
    target: '[data-tour="sidebar-user-card"]',
  },
  {
    id: "complete",
    title: "You are ready",
    body: "The tutorial will not appear again after you finish or cancel it. You can restart it from Settings whenever you want a refresher.",
  },
];

const caseManagementSteps: TutorialStep[] = [
  {
    id: "cases-overview",
    title: "Case management",
    body: "Case Management groups the main docket workflows. Open it to reach criminal, civil, petition, special proceeding, receiving log, sheriff, and diversion records.",
    route: "/user/cases/criminal",
    target: '[data-tour="sidebar-nav-cases"]',
  },
  {
    id: "criminal-cases",
    title: "Criminal cases",
    body: "Criminal Cases is where you search, add, import, export, view, and update criminal case records and their related docket details.",
    route: "/user/cases/criminal",
    target: '[data-tour="sidebar-subnav-cases-criminal"]',
  },
  {
    id: "criminal-page",
    title: "Working with case tables",
    body: "Most case pages follow this pattern: filters and actions near the top, a searchable table in the center, and row actions for viewing or editing details.",
    route: "/user/cases/criminal",
    target: pageTarget,
  },
  {
    id: "civil-cases",
    title: "Civil cases",
    body: "Civil Cases tracks civil filings, parties, notes, reraffle data, consolidation data, remand details, and undocketed entries.",
    route: "/user/cases/civil",
    target: '[data-tour="sidebar-subnav-cases-civil"]',
  },
  {
    id: "petition-cases",
    title: "Petitions",
    body: "Petition records cover petitioner information, raffled branch or staff, dates, and nature of petition.",
    route: "/user/cases/petition",
    target: '[data-tour="sidebar-subnav-cases-petition"]',
  },
  {
    id: "special-proceedings",
    title: "Special proceedings",
    body: "Special Proceedings keeps LRC and related proceeding records separate while using the same table, details, import, and update flow.",
    route: "/user/cases/proceedings",
    target: '[data-tour="sidebar-subnav-cases-proceedings"]',
  },
  {
    id: "receiving-logs",
    title: "Receiving logs",
    body: "Receiving Logs record incoming documents, case references, book and page, branch number, content, and notes.",
    route: "/user/cases/receiving",
    target: '[data-tour="sidebar-subnav-cases-receiving"]',
  },
  {
    id: "sheriff-cases",
    title: "Sheriff records",
    body: "Sheriff records cover mortgagee, mortgagor, remarks, and sheriff assignment details for sheriff-related case work.",
    route: "/user/cases/sheriff",
    target: '[data-tour="sidebar-subnav-cases-sheriff"]',
  },
  {
    id: "diversion",
    title: "Diversion",
    body: "Diversion gathers dedicated diversion records so the court can review unload, consolidation, reraffle, and related case movement activity.",
    route: "/user/cases/diversion",
    target: '[data-tour="sidebar-subnav-cases-diversion"]',
  },
];

const statisticsSteps: TutorialStep[] = [
  {
    id: "statistics-overview",
    title: "Statistics",
    body: "Statistics pages turn case activity into monthly, annual, judgment, and summary reports for management and official reporting.",
    route: "/user/statistics/monthly",
    target: '[data-tour="sidebar-nav-statistics"]',
  },
  {
    id: "monthly-statistics",
    title: "Monthly reports",
    body: "Monthly Reports track criminal, civil, and total counts by category, branch, and month.",
    route: "/user/statistics/monthly",
    target: '[data-tour="sidebar-subnav-statistics-monthly"]',
  },
  {
    id: "annual-statistics",
    title: "Annual reports",
    body: "Annual Reports cover RTC, MTC, and inventory-style reporting for yearly received and disposed records.",
    route: "/user/statistics/annual",
    target: '[data-tour="sidebar-subnav-statistics-annual"]',
  },
  {
    id: "judgement-statistics",
    title: "Judgment Day reports",
    body: "Judgment reports track heard, disposed, PDL, sentence, dismissal, acquittal, probation, and related judgment metrics.",
    route: "/user/statistics/judgement",
    target: '[data-tour="sidebar-subnav-statistics-judgement"]',
  },
  {
    id: "summary-statistics",
    title: "Summary reports",
    body: "Summary reports consolidate raffle, added, disposed, pending, unloaded, and reraffled counts by court type and branch.",
    route: "/user/statistics/summary",
    target: '[data-tour="sidebar-subnav-statistics-summary"]',
  },
];

const adminOnlySteps: TutorialStep[] = [
  {
    id: "archive-explorer",
    title: "Archive Explorer",
    body: "Archive Explorer manages stored folders, files, documents, and spreadsheets. Use it for long-term record organization and document lookup.",
    route: "/user/cases/archive",
    target: '[data-tour="sidebar-nav-cases-archive"]',
  },
  {
    id: "notarial-records",
    title: "Notarial records",
    body: "Notarial records handle notarial documents, attached files, folder browsing, imports, and review workflows.",
    route: "/user/cases/notarial",
    target: '[data-tour="sidebar-nav-cases-notarial"]',
  },
  {
    id: "notarial-commission",
    title: "Notarial Commission",
    body: "Notarial Commission stores commission petitions, names, address details, terms, images, imports, and exports.",
    route: "/user/notarial-commission",
    target: '[data-tour="sidebar-nav-notarial-commission"]',
  },
  {
    id: "employees",
    title: "Employees",
    body: "Employees is the HR-style roster for employee information, photos, employment type, branch assignment, and import or export actions.",
    route: "/user/employees",
    target: '[data-tour="sidebar-nav-employees"]',
  },
  {
    id: "accounts",
    title: "Account management",
    body: "Account Management is where administrators create accounts, assign roles, manage status, and connect users to employee records.",
    route: "/user/account",
    target: '[data-tour="sidebar-nav-account"]',
  },
  {
    id: "activity-logs",
    title: "Activity logs",
    body: "Activity Logs provide an audit trail for logins, case changes, user management, imports, exports, and profile updates.",
    route: "/user/activity-reports",
    target: '[data-tour="sidebar-nav-activity-reports"]',
  },
];

const notarialOnlySteps: TutorialStep[] = [
  {
    id: "notarial-records",
    title: "Notarial records",
    body: "Notarial is your main workspace for searching, importing, reviewing, opening files, editing metadata, and managing notarial folders.",
    route: "/user/cases/notarial",
    target: '[data-tour="sidebar-nav-cases-notarial"]',
  },
  {
    id: "notarial-page",
    title: "Notarial table and explorer",
    body: "Use the notarial page to switch between table review and folder-style browsing, then open records for file preview or edits.",
    route: "/user/cases/notarial",
    target: pageTarget,
  },
  {
    id: "notarial-commission",
    title: "Notarial Commission",
    body: "Commission records keep term ranges, petition information, names, addresses, and supporting images together.",
    route: "/user/notarial-commission",
    target: '[data-tour="sidebar-nav-notarial-commission"]',
  },
];

const archiveOnlySteps: TutorialStep[] = [
  {
    id: "archive-explorer",
    title: "Archive Explorer",
    body: "Archive Explorer is your primary workspace for organizing folders, previewing stored files, and maintaining archive metadata.",
    route: "/user/cases/archive",
    target: '[data-tour="sidebar-nav-cases-archive"]',
  },
  {
    id: "archive-page",
    title: "Archive records",
    body: "Use the archive page for folder creation, document upload, spreadsheet review, file preview, and record lookup.",
    route: "/user/cases/archive",
    target: pageTarget,
  },
];

const settingsStepsByRole = (role: string): TutorialStep[] => {
  const steps: TutorialStep[] = [
    {
      id: "settings-nav",
      title: "Settings",
      body: "Settings holds your profile, password and security options, notification choices, appearance preferences, and tutorial controls.",
      route: "/user/settings",
      target: '[data-tour="sidebar-action-settings"]',
    },
    {
      id: "settings-tabs",
      title: "Settings tabs",
      body: "Use these tabs to move between settings categories. The visible tabs are tailored to your role.",
      route: "/user/settings",
      target: '[data-tour="settings-sidebar"]',
    },
    {
      id: "settings-profile",
      title: "Profile",
      body: "Profile settings are for account identity details such as name, branch-related fields, and profile assets when enabled.",
      route: "/user/settings",
      settingsTab: "profile",
      target: '[data-tour="settings-tab-profile"]',
    },
    {
      id: "settings-security",
      title: "Security",
      body: "Security settings cover password changes and two-factor authentication, plus policy information when your role can view it.",
      route: "/user/settings",
      settingsTab: "security",
      target: '[data-tour="settings-tab-security"]',
    },
    {
      id: "settings-notifications",
      title: "Notifications",
      body: "Notification settings control email, case, and security alerts so updates reach you without unnecessary noise.",
      route: "/user/settings",
      settingsTab: "notifications",
      target: '[data-tour="settings-tab-notifications"]',
    },
    {
      id: "settings-appearance",
      title: "Appearance",
      body: "Appearance settings let you choose the theme from inside Settings as well as from the sidebar quick toggle.",
      route: "/user/settings",
      settingsTab: "appearance",
      target: '[data-tour="settings-tab-appearance"]',
    },
  ];

  if (role === Roles.ADMIN) {
    steps.push(
      {
        id: "settings-system",
        title: "System settings",
        body: "System settings are admin-only controls for maintenance mode, announcements, SMTP email, Garage storage, and security policies.",
        route: "/user/settings",
        settingsTab: "system",
        target: '[data-tour="settings-tab-system"]',
      },
      {
        id: "settings-backup",
        title: "Backup and audit",
        body: "Backup settings manage schedules, destinations, run status, and the backup console for cases and notarial storage.",
        route: "/user/settings",
        settingsTab: "backup",
        target: '[data-tour="settings-tab-backup"]',
      },
    );
  }

  if (role === Roles.CRIMINAL) {
    steps.push({
      id: "settings-calendar",
      title: "Calendar",
      body: "Calendar settings help the criminal section manage working hours and calendar sync preferences.",
      route: "/user/settings",
      settingsTab: "calendar",
      target: '[data-tour="settings-tab-calendar"]',
    });
  }

  steps.push({
    id: "settings-tutorial",
    title: "Restart this tutorial",
    body: "The Tutorial tab lets you restart the walkthrough after completing or canceling it. Restarting sets your tutorial status back to pending.",
    route: "/user/settings",
    settingsTab: "tutorial",
    target: '[data-tour="settings-tab-tutorial"]',
  });

  return steps;
};

export const getTutorialSteps = (role: string): TutorialStep[] => {
  const normalizedRole = role.toLowerCase();

  if (normalizedRole === Roles.ADMIN) {
    return [
      ...introSteps,
      ...caseManagementSteps,
      ...statisticsSteps,
      ...adminOnlySteps,
      ...communicationSteps,
      ...settingsStepsByRole(Roles.ADMIN),
      ...closingSteps,
    ];
  }

  if (normalizedRole === Roles.CRIMINAL) {
    return [
      ...introSteps,
      ...caseManagementSteps,
      ...communicationSteps,
      ...settingsStepsByRole(Roles.CRIMINAL),
      ...closingSteps,
    ];
  }

  if (normalizedRole === Roles.STATISTICS) {
    return [
      ...introSteps,
      ...statisticsSteps,
      ...communicationSteps,
      ...settingsStepsByRole(Roles.STATISTICS),
      ...closingSteps,
    ];
  }

  if (normalizedRole === Roles.NOTARIAL) {
    return [
      ...introSteps,
      ...notarialOnlySteps,
      ...communicationSteps,
      ...settingsStepsByRole(Roles.NOTARIAL),
      ...closingSteps,
    ];
  }

  if (normalizedRole === Roles.ARCHIVE) {
    return [
      ...introSteps,
      ...archiveOnlySteps,
      ...communicationSteps,
      ...settingsStepsByRole(Roles.ARCHIVE),
      ...closingSteps,
    ];
  }

  return [
    ...introSteps,
    ...caseManagementSteps,
    ...communicationSteps,
    ...settingsStepsByRole(Roles.USER),
    ...closingSteps,
  ];
};
