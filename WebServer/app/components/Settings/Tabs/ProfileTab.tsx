"use client";

import Roles from "@/app/lib/Roles";
import { useState } from "react";
import { FiEdit3, FiUpload, FiUser } from "react-icons/fi";
import {
  InputField,
  SaveButton,
  SelectField,
  SettingsCard,
  SettingsRow,
} from "../SettingsPrimitives";

const ProfileTab = ({ role }: { role: string }) => {
  const [name, setName] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [branch, setBranch] = useState("");

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Personal Information"
        description="Update your profile details visible across the system."
      >
        <div className="px-7 py-6 flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/8 flex items-center justify-center text-primary shrink-0 border border-primary/10">
            <FiUser size={32} />
          </div>
          <div>
            <p className="text-sm font-semibold text-base-content">
              Profile Photo
            </p>
            <p className="text-[13px] text-base-content/40 mt-0.5">
              JPG, PNG or WEBP. Max 2MB.
            </p>
            <button className="btn btn-ghost btn-sm gap-2 mt-3 text-primary hover:bg-primary/8 rounded-lg">
              <FiUpload size={14} /> Upload Photo
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

        {role === Roles.CRIMINAL && (
          <>
            <SettingsRow
              label="Section / Desk Code"
              description="Internal code used for the criminal section account."
            >
              <InputField
                value={barNumber}
                onChange={setBarNumber}
                placeholder="e.g. CRIM-01"
              />
            </SettingsRow>
            <SettingsRow
              label="Assigned Branch"
              description="Primary branch handled by this criminal section account."
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

      {role === Roles.CRIMINAL && (
        <SettingsCard
          title="Section Signature"
          description="Upload the signature asset used by the criminal section."
        >
          <div className="px-7 py-6">
            <div className="border-2 border-dashed border-base-300/70 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-primary/30 transition-colors cursor-pointer group">
              <FiEdit3
                size={32}
                className="text-base-content/20 mb-4 group-hover:text-primary/40 transition-colors"
              />
              <p className="text-sm font-semibold text-base-content/55">
                Drag & drop your signature or click to upload
              </p>
              <p className="text-[12px] text-base-content/30 mt-1.5">
                Transparent PNG recommended · Max 1MB
              </p>
              <button className="btn btn-outline btn-primary btn-sm gap-2 mt-5 rounded-lg">
                <FiUpload size={14} /> Choose File
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

export default ProfileTab;

