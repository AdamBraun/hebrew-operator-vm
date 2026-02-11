import React from "react";

type InputRTLProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function InputRTL({ value, onChange, error }: InputRTLProps) {
  return (
    <div>
      <textarea
        id="hebrew-input"
        className="rtl-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type Hebrew letters + niqqud"
      />
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}
