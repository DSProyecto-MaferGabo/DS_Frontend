import React from "react";
import { availableLanguages, setLanguage, getLanguage } from "../i18n";

export default function LanguageSelector() {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ marginRight: 8 }}>Idioma:</label>
      <select
        value={getLanguage()}
        onChange={e => setLanguage(e.target.value)}
        style={{ padding: 4 }}
      >
        {availableLanguages.map(l => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </div>
  );
}
