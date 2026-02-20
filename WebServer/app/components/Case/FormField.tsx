"use client";

import React from "react";

type Props = {
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  error?: string | undefined;
};

export default function FormField({ label, htmlFor, children, error }: Props) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend text-base font-semibold">
        {label}
      </legend>
      <div className="mt-2 text-base">{children}</div>
      {error && (
        <p className="label mt-2">
          <span className="label-text-alt text-error">{error}</span>
        </p>
      )}
    </fieldset>
  );
}
