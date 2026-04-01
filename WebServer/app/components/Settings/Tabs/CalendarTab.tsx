"use client";

import { useState } from "react";
import {
  SaveButton,
  SelectField,
  SettingsCard,
  SettingsRow,
  Toggle,
} from "../SettingsPrimitives";

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
    <div className="space-y-6">
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
            className="input input-bordered text-sm h-10 bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-lg"
          />
        </SettingsRow>
        <SettingsRow label="Work End Time">
          <input
            type="time"
            value={workEnd}
            onChange={(e) => setWorkEnd(e.target.value)}
            className="input input-bordered text-sm h-10 bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-lg"
          />
        </SettingsRow>
        <div className="px-7 py-5">
          <p className="text-sm font-semibold text-base-content mb-4">
            Court Days
          </p>
          <div className="flex gap-2.5">
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
                  "w-12 h-12 rounded-xl text-[13px] font-bold transition-all duration-200",
                  d.active
                    ? "bg-primary text-primary-content shadow-md"
                    : "bg-base-200 text-base-content/30 hover:bg-base-300 hover:text-base-content/50",
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
              <span className="text-xs text-success font-semibold bg-success/8 px-2.5 py-1 rounded-full">
                Connected
              </span>
            )}
            <button
              onClick={() => setSyncGoogle(!syncGoogle)}
              className={[
                "btn btn-sm gap-1.5 text-[13px] rounded-lg",
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
              <span className="text-xs text-success font-semibold bg-success/8 px-2.5 py-1 rounded-full">
                Connected
              </span>
            )}
            <button
              onClick={() => setSyncOutlook(!syncOutlook)}
              className={[
                "btn btn-sm gap-1.5 text-[13px] rounded-lg",
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

export default CalendarTab;
