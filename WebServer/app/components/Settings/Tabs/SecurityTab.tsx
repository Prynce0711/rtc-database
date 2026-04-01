"use client";

import Roles from "@/app/lib/Roles";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiInfo, FiShield } from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import { getSystemSettings, updateSystemSettings } from "../SettingsActions";
import {
  InputField,
  SaveButton,
  SelectField,
  SettingsCard,
  SettingsRow,
  Toggle,
} from "../SettingsPrimitives";

const SecurityTab = ({ role }: { role: string }) => {
  const popup = usePopup();
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("THIRTY_MINUTES");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordExpiry, setPasswordExpiry] = useState("NEVER");
  const [lockoutThreshold, setLockoutThreshold] = useState("NONE");
  const isAdmin = role === Roles.ADMIN;

  useEffect(() => {
    if (!isAdmin) {
      setLoadingPolicy(false);
      return;
    }

    const loadPolicy = async () => {
      setLoadingPolicy(true);
      const result = await getSystemSettings();
      if (!result.success) {
        popup.showError(result.error || "Failed to load security policy");
        setLoadingPolicy(false);
        return;
      }

      setPasswordExpiry(result.result.passwordExpiration);
      setLockoutThreshold(result.result.lockoutThreshold);
      setSessionTimeout(result.result.sessionTimeout);
      setLoadingPolicy(false);
    };

    void loadPolicy();
  }, [isAdmin, popup]);

  const handleSavePolicy = async () => {
    if (!isAdmin) return;

    setSavingPolicy(true);
    popup.showLoading("Saving security policy...");

    const result = await updateSystemSettings({
      passwordExpiration: passwordExpiry,
      lockoutThreshold,
      sessionTimeout,
    });

    setSavingPolicy(false);
    if (!result.success) {
      popup.showError(result.error || "Failed to save security policy");
      return;
    }

    popup.showSuccess("Security policy saved successfully.");
  };

  return (
    <div className="space-y-6">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/25 hover:text-base-content/60 transition-colors"
            >
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
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
            className="px-7 pb-5"
          >
            <div className="flex items-start gap-4 rounded-xl bg-info/6 border border-info/12 p-5">
              <FiInfo size={18} className="text-info shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-info">
                  Setup Required
                </p>
                <p className="text-[12px] text-base-content/45 mt-1 leading-relaxed">
                  Scan the QR code with Google Authenticator or Authy to
                  complete setup.
                </p>
                <button className="btn btn-sm btn-outline btn-info mt-3 gap-1.5 rounded-lg">
                  <FiShield size={13} /> Generate QR Code
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
            label="Password Expiration"
            description="Force users to change passwords periodically."
          >
            <SelectField
              value={passwordExpiry}
              onChange={setPasswordExpiry}
              options={[
                { value: "NEVER", label: "Never" },
                { value: "ONE_MONTH", label: "Every 30 days" },
                { value: "TWO_MONTHS", label: "Every 60 days" },
                { value: "THREE_MONTHS", label: "Every 90 days" },
                { value: "SIX_MONTHS", label: "Every 180 days" },
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
                { value: "THREE_ATTEMPTS", label: "3 attempts" },
                { value: "FIVE_ATTEMPTS", label: "5 attempts" },
                { value: "TEN_ATTEMPTS", label: "10 attempts" },
                { value: "NONE", label: "No lockout" },
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
                { value: "FIFTEEN_MINUTES", label: "15 minutes" },
                { value: "THIRTY_MINUTES", label: "30 minutes" },
                { value: "ONE_HOUR", label: "1 hour" },
                { value: "TWO_HOURS", label: "2 hours" },
                { value: "FOUR_HOURS", label: "4 hours" },
                { value: "EIGHT_HOURS", label: "8 hours" },
                { value: "NEVER", label: "Never timeout" },
              ]}
            />
          </SettingsRow>

          {loadingPolicy && (
            <div className="px-7 pb-5 text-xs text-base-content/40">
              Loading policy values...
            </div>
          )}
        </SettingsCard>
      )}

      <div className="flex justify-end">
        <SaveButton onClick={savingPolicy ? undefined : handleSavePolicy} />
      </div>
    </div>
  );
};

export default SecurityTab;
