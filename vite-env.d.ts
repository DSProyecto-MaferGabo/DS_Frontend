/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USERS_API_URL?: string;
  readonly VITE_EVENTS_API_URL?: string;
  readonly VITE_PAYMENTS_API_URL?: string;
  readonly VITE_NOTIFICATIONS_API_URL?: string;
  readonly VITE_SURVEYS_API_URL?: string;
  // add other env vars as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
