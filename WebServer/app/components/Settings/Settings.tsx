"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";
import {
  FiBell,
  FiCalendar,
  FiChevronRight,
  FiDatabase,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiGlobe,
  FiInfo,
  FiMail,
  FiMonitor,
  FiPhone,
  FiSave,
  FiServer,
  FiShield,
  FiUpload,
  FiUser,
} from "react-icons/fi";
import DashboardLayout from "../Dashboard/DashboardLayout";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: string[]; // which roles see this tab
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS: TabConfig[] = [
  {
    id: "profile",
    label: "Profile",
    icon: <FiUser size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "security",
    label: "Security",
    icon: <FiShield size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <FiBell size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <FiMonitor size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "case-config",
    label: "Case Config",
    icon: <FiFileText size={18} />,
    roles: [Roles.ADMIN],
  },
  {
    id: "system",
    label: "System",
    icon: <FiServer size={18} />,
    roles: [Roles.ADMIN],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: <FiCalendar size={18} />,
    roles: [Roles.ATTY],
  },
];

// ─── Reusable settings primitives ─────────────────────────────────────────────

const SettingsCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.22 }}
    className="bg-base-100 rounded-xl border border-base-300 overflow-hidden"
    style={{ boxShadow: "var(--shadow-xs)" }}
  >
    <div className="px-6 py-5 border-b border-base-300">
      <h3 className="text-[15px] font-bold text-base-content">{title}</h3>
      {description && (
        <p className="text-[13px] text-base-content/50 mt-0.5">{description}</p>
      )}
    </div>
    <div className="divide-y divide-base-200">{children}</div>
  </motion.div>
);

const SettingsRow = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 px-6 py-4">
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-base-content">{label}</p>
      {description && (
        <p className="text-[12px] text-base-content/45 mt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={[
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      checked ? "bg-primary" : "bg-base-300",
    ].join(" ")}
  >
    <span
      className={[
        "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-6" : "translate-x-1",
      ].join(" ")}
    />
  </button>
);

const SelectField = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="select select-bordered select-sm text-[13px] min-w-40 bg-base-100 focus:outline-none focus:border-primary"
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

const InputField = ({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className="input input-bordered input-sm text-[13px] w-full max-w-65 bg-base-100 focus:outline-none focus:border-primary disabled:opacity-50"
  />
);

const SaveButton = ({ onClick }: { onClick?: () => void }) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="btn btn-primary btn-sm gap-2 text-[13px] font-semibold px-5 mt-6"
  >
    <FiSave size={14} />
    Save Changes
  </motion.button>
);

// ─── Profile Tab ──────────────────────────────────────────────────────────────
const ProfileTab = ({ role }: { role: string }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [branch, setBranch] = useState("");

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Personal Information"
        description="Update your profile details visible across the system."
      >
        {/* Avatar */}
        <div className="px-6 py-5 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shrink-0">
            <FiUser size={28} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-base-content">
              Profile Photo
            </p>
            <p className="text-[12px] text-base-content/45 mt-0.5">
              JPG, PNG or WEBP. Max 2MB.
            </p>
            <button className="btn btn-ghost btn-xs gap-1.5 mt-2 text-primary hover:bg-primary/10">
              <FiUpload size={12} /> Upload Photo
            </button>
          </div>
        </div>

        <SettingsRow
          label="Full Name"
          description="Your legal name as it appears on court records."
        >
          <InputField
            value={name}
            onChange={setName}
            placeholder="Enter full name"
          />
        </SettingsRow>

        <SettingsRow
          label="Email Address"
          description="Primary email for system notifications."
        >
          <div className="flex items-center gap-2">
            <FiMail size={14} className="text-base-content/30" />
            <InputField
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="email@example.com"
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label="Phone Number"
          description="Contact number for urgent case matters."
        >
          <div className="flex items-center gap-2">
            <FiPhone size={14} className="text-base-content/30" />
            <InputField
              value={phone}
              onChange={setPhone}
              placeholder="+63 9XX XXX XXXX"
            />
          </div>
        </SettingsRow>

        {role === Roles.ATTY && (
          <>
            <SettingsRow
              label="Roll / Bar Number"
              description="Your IBP or Supreme Court roll number."
            >
              <InputField
                value={barNumber}
                onChange={setBarNumber}
                placeholder="e.g. 12345"
              />
            </SettingsRow>
            <SettingsRow
              label="Sala / Branch"
              description="Assigned court branch or sala."
            >
              <SelectField
                value={branch}
                onChange={setBranch}
                options={[
                  { value: "", label: "Select branch" },
                  { value: "branch-1", label: "Branch 1" },
                  { value: "branch-2", label: "Branch 2" },
                  { value: "branch-3", label: "Branch 3" },
                  { value: "branch-4", label: "Branch 4" },
                  { value: "branch-5", label: "Branch 5" },
                ]}
              />
            </SettingsRow>
          </>
        )}
      </SettingsCard>

      {role === Roles.ATTY && (
        <SettingsCard
          title="Digital Signature"
          description="Upload your signature for orders and decisions."
        >
          <div className="px-6 py-5">
            <div className="border-2 border-dashed border-base-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-primary/40 transition-colors cursor-pointer">
              <FiEdit3 size={28} className="text-base-content/25 mb-3" />
              <p className="text-[13px] font-semibold text-base-content/60">
                Drag & drop your signature or click to upload
              </p>
              <p className="text-[11px] text-base-content/35 mt-1">
                Transparent PNG recommended · Max 1MB
              </p>
              <button className="btn btn-outline btn-primary btn-xs gap-1 mt-4">
                <FiUpload size={12} /> Choose File
              </button>
            </div>
          </div>
        </SettingsCard>
      )}

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

// ─── Security Tab ─────────────────────────────────────────────────────────────
const SecurityTab = ({ role }: { role: string }) => {
  const [twoFA, setTwoFA] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMinLength, setPasswordMinLength] = useState("8");
  const [passwordExpiry, setPasswordExpiry] = useState("90");
  const [lockoutThreshold, setLockoutThreshold] = useState("5");
  const isAdmin = role === Roles.ADMIN;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Password"
        description="Manage your account password and authentication."
      >
        <SettingsRow label="Current Password">
          <div className="relative">
            <InputField
              value=""
              onChange={() => {}}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content/60"
            >
              {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
            </button>
          </div>
        </SettingsRow>
        <SettingsRow label="New Password">
          <InputField
            value=""
            onChange={() => {}}
            type="password"
            placeholder="Enter new password"
          />
        </SettingsRow>
        <SettingsRow label="Confirm New Password">
          <InputField
            value=""
            onChange={() => {}}
            type="password"
            placeholder="Confirm new password"
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account."
      >
        <SettingsRow
          label="Enable 2FA"
          description="Require a code from your authenticator app on login."
        >
          <Toggle checked={twoFA} onChange={setTwoFA} />
        </SettingsRow>
        {twoFA && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 pb-4"
          >
            <div className="flex items-start gap-3 rounded-lg bg-info/8 border border-info/15 p-4">
              <FiInfo size={16} className="text-info shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-info">
                  Setup Required
                </p>
                <p className="text-[11px] text-base-content/50 mt-0.5">
                  Scan the QR code with Google Authenticator or Authy to
                  complete setup.
                </p>
                <button className="btn btn-xs btn-outline btn-info mt-2 gap-1">
                  <FiShield size={11} /> Generate QR Code
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </SettingsCard>

      {isAdmin && (
        <SettingsCard
          title="Organization Security Policy"
          description="These apply to all users organization-wide."
        >
          <SettingsRow
            label="Minimum Password Length"
            description="Enforce minimum characters for all passwords."
          >
            <SelectField
              value={passwordMinLength}
              onChange={setPasswordMinLength}
              options={[
                { value: "6", label: "6 characters" },
                { value: "8", label: "8 characters" },
                { value: "10", label: "10 characters" },
                { value: "12", label: "12 characters" },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Password Expiration"
            description="Force users to change passwords periodically."
          >
            <SelectField
              value={passwordExpiry}
              onChange={setPasswordExpiry}
              options={[
                { value: "0", label: "Never" },
                { value: "30", label: "Every 30 days" },
                { value: "60", label: "Every 60 days" },
                { value: "90", label: "Every 90 days" },
                { value: "180", label: "Every 180 days" },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Account Lockout Threshold"
            description="Lock account after X failed login attempts."
          >
            <SelectField
              value={lockoutThreshold}
              onChange={setLockoutThreshold}
              options={[
                { value: "3", label: "3 attempts" },
                { value: "5", label: "5 attempts" },
                { value: "10", label: "10 attempts" },
                { value: "0", label: "No lockout" },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Session Timeout"
            description="Automatically log out inactive users."
          >
            <SelectField
              value={sessionTimeout}
              onChange={setSessionTimeout}
              options={[
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "60", label: "1 hour" },
                { value: "120", label: "2 hours" },
                { value: "480", label: "8 hours" },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Enforce 2FA for All Users"
            description="Require two-factor authentication for every account."
          >
            <Toggle checked={false} onChange={() => {}} />
          </SettingsRow>
        </SettingsCard>
      )}

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

// ─── Notifications Tab ────────────────────────────────────────────────────────
const NotificationsTab = ({ role }: { role: string }) => {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [caseAssignment, setCaseAssignment] = useState(true);
  const [caseUpdates, setCaseUpdates] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);
  const [hearingReminders, setHearingReminders] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [reminderLeadTime, setReminderLeadTime] = useState("24");
  const isAdmin = role === Roles.ADMIN;
  const isAtty = role === Roles.ATTY;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Email Notifications"
        description="Control which emails you receive."
      >
        <SettingsRow
          label="Enable Email Notifications"
          description="Receive important updates via email."
        >
          <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
        </SettingsRow>
        <SettingsRow
          label="Weekly Digest"
          description="Get a summary of activity every Monday."
        >
          <Toggle checked={weeklyDigest} onChange={setWeeklyDigest} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Case Notifications"
        description="Stay informed about your cases."
      >
        <SettingsRow
          label="Case Assignment"
          description="Notify me when a new case is assigned."
        >
          <Toggle checked={caseAssignment} onChange={setCaseAssignment} />
        </SettingsRow>
        <SettingsRow
          label="Case Status Updates"
          description="Notify me when case status changes."
        >
          <Toggle checked={caseUpdates} onChange={setCaseUpdates} />
        </SettingsRow>
        <SettingsRow
          label="Deadline Reminders"
          description="Remind me before case deadlines."
        >
          <Toggle checked={deadlineReminders} onChange={setDeadlineReminders} />
        </SettingsRow>
        {(isAtty || isAdmin) && (
          <SettingsRow
            label="Hearing Reminders"
            description="Remind me before scheduled hearings."
          >
            <Toggle checked={hearingReminders} onChange={setHearingReminders} />
          </SettingsRow>
        )}
        {deadlineReminders && (
          <SettingsRow
            label="Reminder Lead Time"
            description="How early to send reminders."
          >
            <SelectField
              value={reminderLeadTime}
              onChange={setReminderLeadTime}
              options={[
                { value: "1", label: "1 hour before" },
                { value: "3", label: "3 hours before" },
                { value: "24", label: "1 day before" },
                { value: "72", label: "3 days before" },
                { value: "168", label: "1 week before" },
              ]}
            />
          </SettingsRow>
        )}
      </SettingsCard>

      <SettingsCard
        title="Security Notifications"
        description="Account activity alerts."
      >
        <SettingsRow
          label="Login Alerts"
          description="Get notified of new sign-ins to your account."
        >
          <Toggle checked={loginAlerts} onChange={setLoginAlerts} />
        </SettingsRow>
        {isAdmin && (
          <SettingsRow
            label="System Alerts"
            description="Receive alerts on system health and errors."
          >
            <Toggle checked={systemAlerts} onChange={setSystemAlerts} />
          </SettingsRow>
        )}
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

// ─── Appearance Tab ───────────────────────────────────────────────────────────
const AppearanceTab = () => {
  const [theme, setTheme] = useState<string>(
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") || "winter"
      : "winter",
  );
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const themes = [
    {
      value: "winter",
      label: "Light",
      desc: "Clean & professional",
      icon: "☀️",
    },
    { value: "dim", label: "Dark", desc: "Easy on the eyes", icon: "🌙" },
  ];

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Theme"
        description="Choose your preferred visual appearance."
      >
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTheme(t.value);
                  document.documentElement.setAttribute("data-theme", t.value);
                }}
                className={[
                  "relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200",
                  theme === t.value
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-base-300 hover:border-base-content/20 bg-base-100",
                ].join(" ")}
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="text-[13px] font-bold text-base-content">
                  {t.label}
                </span>
                <span className="text-[11px] text-base-content/40">
                  {t.desc}
                </span>
                {theme === t.value && (
                  <motion.div
                    layoutId="theme-check"
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  >
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      className="text-primary-content"
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Display Preferences"
        description="Customize tables, dates, and layout density."
      >
        <SettingsRow
          label="Table Rows per Page"
          description="Default number of rows shown in lists."
        >
          <SelectField
            value={rowsPerPage}
            onChange={setRowsPerPage}
            options={[
              { value: "5", label: "5 rows" },
              { value: "10", label: "10 rows" },
              { value: "25", label: "25 rows" },
              { value: "50", label: "50 rows" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Date Format"
          description="How dates appear throughout the system."
        >
          <SelectField
            value={dateFormat}
            onChange={setDateFormat}
            options={[
              { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
              { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
              { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
              { value: "MMM DD, YYYY", label: "MMM DD, YYYY" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Compact Mode"
          description="Reduce spacing for denser information display."
        >
          <Toggle checked={compactMode} onChange={setCompactMode} />
        </SettingsRow>
        <SettingsRow
          label="Animations"
          description="Enable smooth transitions and micro-interactions."
        >
          <Toggle checked={animationsEnabled} onChange={setAnimationsEnabled} />
        </SettingsRow>
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

// ─── Case Configuration Tab (Admin only) ─────────────────────────────────────
const CaseConfigTab = () => {
  const [autoNumbering, setAutoNumbering] = useState(true);
  const [numberFormat, setNumberFormat] = useState("YYYY-XXXXX");
  const [requireApproval, setRequireApproval] = useState(true);
  const [enableRaffle, setEnableRaffle] = useState(true);
  const [archiveAfter, setArchiveAfter] = useState("365");
  const [defaultBranch, setDefaultBranch] = useState("");

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Case Numbering"
        description="Configure how new case numbers are generated."
      >
        <SettingsRow
          label="Auto-Generate Case Numbers"
          description="Automatically assign sequential case numbers."
        >
          <Toggle checked={autoNumbering} onChange={setAutoNumbering} />
        </SettingsRow>
        {autoNumbering && (
          <SettingsRow
            label="Number Format"
            description="Pattern for new case numbers."
          >
            <SelectField
              value={numberFormat}
              onChange={setNumberFormat}
              options={[
                { value: "YYYY-XXXXX", label: "YYYY-XXXXX" },
                { value: "BR-YYYY-XXXXX", label: "BR-YYYY-XXXXX" },
                { value: "XXXXX-YYYY", label: "XXXXX-YYYY" },
              ]}
            />
          </SettingsRow>
        )}
      </SettingsCard>

      <SettingsCard
        title="Workflow Settings"
        description="Control case processing behavior."
      >
        <SettingsRow
          label="Require Approval for New Cases"
          description="New case entries must be approved by an admin before filing."
        >
          <Toggle checked={requireApproval} onChange={setRequireApproval} />
        </SettingsRow>
        <SettingsRow
          label="Enable Case Raffle"
          description="Use randomized assignment to distribute cases."
        >
          <Toggle checked={enableRaffle} onChange={setEnableRaffle} />
        </SettingsRow>
        <SettingsRow
          label="Default Branch Assignment"
          description="Automatically assign cases to a branch unless overridden."
        >
          <SelectField
            value={defaultBranch}
            onChange={setDefaultBranch}
            options={[
              { value: "", label: "None (manual)" },
              { value: "branch-1", label: "Branch 1" },
              { value: "branch-2", label: "Branch 2" },
              { value: "branch-3", label: "Branch 3" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Data Retention"
        description="Manage case data lifecycle."
      >
        <SettingsRow
          label="Auto-Archive Closed Cases"
          description="Move resolved cases to archive after a set period."
        >
          <SelectField
            value={archiveAfter}
            onChange={setArchiveAfter}
            options={[
              { value: "0", label: "Never" },
              { value: "90", label: "After 90 days" },
              { value: "180", label: "After 180 days" },
              { value: "365", label: "After 1 year" },
              { value: "730", label: "After 2 years" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

// ─── System Tab (Admin only) ──────────────────────────────────────────────────
const SystemTab = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [auditRetention, setAuditRetention] = useState("365");
  const [backupFrequency, setBackupFrequency] = useState("daily");
  const [smtpHost, setSmtpHost] = useState("");
  const [announceText, setAnnounceText] = useState("");

  return (
    <div className="space-y-5">
      <SettingsCard
        title="System Status"
        description="Monitor and control system-wide operations."
      >
        <SettingsRow
          label="Maintenance Mode"
          description="Temporarily restrict access. Only admins can sign in."
        >
          <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} />
        </SettingsRow>
        {maintenanceMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="px-6 pb-4"
          >
            <div className="flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/20 p-4">
              <FiInfo size={16} className="text-warning shrink-0 mt-0.5" />
              <p className="text-[12px] text-warning leading-relaxed font-medium">
                Maintenance mode is active. Regular users will see a maintenance
                page and cannot access the system until this is turned off.
              </p>
            </div>
          </motion.div>
        )}
      </SettingsCard>

      <SettingsCard
        title="System Announcement"
        description="Display a banner message to all users."
      >
        <div className="px-6 py-4">
          <textarea
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            placeholder="Type a system-wide announcement to display on all pages..."
            rows={3}
            className="textarea textarea-bordered w-full text-[13px] bg-base-100 focus:outline-none focus:border-primary resize-none"
          />
          <p className="text-[11px] text-base-content/35 mt-1.5">
            Leave empty to hide the banner.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Email Server (SMTP)"
        description="Configure outgoing email for notifications."
      >
        <SettingsRow label="SMTP Host" description="e.g. smtp.gmail.com">
          <InputField
            value={smtpHost}
            onChange={setSmtpHost}
            placeholder="smtp.example.com"
          />
        </SettingsRow>
        <SettingsRow label="SMTP Port">
          <InputField value="" onChange={() => {}} placeholder="587" />
        </SettingsRow>
        <SettingsRow label="Sender Email">
          <InputField
            value=""
            onChange={() => {}}
            placeholder="noreply@court.gov.ph"
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Backup & Audit"
        description="Database backup and activity log management."
      >
        <SettingsRow
          label="Automatic Backup Frequency"
          description="Schedule database backups."
        >
          <SelectField
            value={backupFrequency}
            onChange={setBackupFrequency}
            options={[
              { value: "manual", label: "Manual only" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Audit Log Retention"
          description="Automatically purge old activity logs."
        >
          <SelectField
            value={auditRetention}
            onChange={setAuditRetention}
            options={[
              { value: "90", label: "90 days" },
              { value: "180", label: "180 days" },
              { value: "365", label: "1 year" },
              { value: "730", label: "2 years" },
              { value: "0", label: "Keep forever" },
            ]}
          />
        </SettingsRow>
        <div className="px-6 py-4 flex gap-3">
          <button className="btn btn-outline btn-sm gap-2 text-[13px]">
            <FiDatabase size={14} /> Backup Now
          </button>
          <button className="btn btn-ghost btn-sm gap-2 text-[13px] text-base-content/50">
            <FiGlobe size={14} /> Export Audit Logs
          </button>
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

// ─── Calendar Tab (Atty only) ─────────────────────────────────────────────────
const CalendarTab = () => {
  const [defaultView, setDefaultView] = useState("week");
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("17:00");
  const [syncGoogle, setSyncGoogle] = useState(false);
  const [syncOutlook, setSyncOutlook] = useState(false);
  const [showWeekends, setShowWeekends] = useState(false);

  const workDays = [
    { day: "Mon", active: true },
    { day: "Tue", active: true },
    { day: "Wed", active: true },
    { day: "Thu", active: true },
    { day: "Fri", active: true },
    { day: "Sat", active: false },
    { day: "Sun", active: false },
  ];

  const [activeDays, setActiveDays] = useState(workDays);

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Calendar View"
        description="Set your preferred calendar defaults."
      >
        <SettingsRow
          label="Default View"
          description="Choose the view shown when you open the calendar."
        >
          <SelectField
            value={defaultView}
            onChange={setDefaultView}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "agenda", label: "Agenda" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Show Weekends"
          description="Display Saturday and Sunday in the calendar."
        >
          <Toggle checked={showWeekends} onChange={setShowWeekends} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Working Hours"
        description="Define your court day availability."
      >
        <SettingsRow label="Work Start Time">
          <input
            type="time"
            value={workStart}
            onChange={(e) => setWorkStart(e.target.value)}
            className="input input-bordered input-sm text-[13px] bg-base-100 focus:outline-none focus:border-primary"
          />
        </SettingsRow>
        <SettingsRow label="Work End Time">
          <input
            type="time"
            value={workEnd}
            onChange={(e) => setWorkEnd(e.target.value)}
            className="input input-bordered input-sm text-[13px] bg-base-100 focus:outline-none focus:border-primary"
          />
        </SettingsRow>
        <div className="px-6 py-4">
          <p className="text-[13px] font-semibold text-base-content mb-3">
            Court Days
          </p>
          <div className="flex gap-2">
            {activeDays.map((d, i) => (
              <button
                key={d.day}
                onClick={() =>
                  setActiveDays((prev) =>
                    prev.map((item, idx) =>
                      idx === i ? { ...item, active: !item.active } : item,
                    ),
                  )
                }
                className={[
                  "w-10 h-10 rounded-lg text-[12px] font-bold transition-all duration-200",
                  d.active
                    ? "bg-primary text-primary-content shadow-sm"
                    : "bg-base-200 text-base-content/35 hover:bg-base-300",
                ].join(" ")}
              >
                {d.day}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Calendar Sync"
        description="Connect external calendars for unified scheduling."
      >
        <SettingsRow
          label="Google Calendar"
          description="Sync hearings and events with Google Calendar."
        >
          <div className="flex items-center gap-3">
            {syncGoogle && (
              <span className="text-[11px] text-success font-semibold">
                Connected
              </span>
            )}
            <button
              onClick={() => setSyncGoogle(!syncGoogle)}
              className={[
                "btn btn-sm gap-1 text-[12px]",
                syncGoogle ? "btn-error btn-outline" : "btn-outline",
              ].join(" ")}
            >
              {syncGoogle ? "Disconnect" : "Connect"}
            </button>
          </div>
        </SettingsRow>
        <SettingsRow
          label="Outlook Calendar"
          description="Sync hearings and events with Microsoft Outlook."
        >
          <div className="flex items-center gap-3">
            {syncOutlook && (
              <span className="text-[11px] text-success font-semibold">
                Connected
              </span>
            )}
            <button
              onClick={() => setSyncOutlook(!syncOutlook)}
              className={[
                "btn btn-sm gap-1 text-[12px]",
                syncOutlook ? "btn-error btn-outline" : "btn-outline",
              ].join(" ")}
            >
              {syncOutlook ? "Disconnect" : "Connect"}
            </button>
          </div>
        </SettingsRow>
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

// ─── Tab content router ───────────────────────────────────────────────────────
const TabContent = ({ tabId, role }: { tabId: string; role: string }) => {
  switch (tabId) {
    case "profile":
      return <ProfileTab role={role} />;
    case "security":
      return <SecurityTab role={role} />;
    case "notifications":
      return <NotificationsTab role={role} />;
    case "appearance":
      return <AppearanceTab />;
    case "case-config":
      return <CaseConfigTab />;
    case "system":
      return <SystemTab />;
    case "calendar":
      return <CalendarTab />;
    default:
      return null;
  }
};

// ─── Main Settings Component ──────────────────────────────────────────────────
const Settings: React.FC = () => {
  const { data: session } = useSession();
  const role = session?.user?.role || Roles.USER;
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(role));
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || "profile");

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your preferences and system configuration."
    >
      <div className="flex flex-col lg:flex-row gap-6 mt-2">
        {/* ── Sidebar Nav ─────────────────────────────── */}
        <div className="lg:w-56 shrink-0">
          <nav className="bg-base-200 rounded-xl border border-base-300 p-2 space-y-0.5 lg:sticky lg:top-8">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "relative flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                    isActive
                      ? "bg-primary text-primary-content shadow-sm"
                      : "text-base-content/55 hover:bg-base-300/60 hover:text-base-content",
                  ].join(" ")}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                  {isActive && (
                    <FiChevronRight
                      size={14}
                      className="ml-auto opacity-60 shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Role badge */}
          <div className="mt-4 px-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/25">
              Signed in as
            </p>
            <p className="text-[12px] font-semibold text-base-content/70 mt-0.5 capitalize">
              {role === Roles.ADMIN
                ? "Administrator"
                : role === Roles.ATTY
                  ? "Attorney"
                  : "Staff"}
            </p>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <TabContent tabId={activeTab} role={role} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
