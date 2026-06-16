/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKGROUND_IMAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
