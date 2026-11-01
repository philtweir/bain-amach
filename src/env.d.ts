/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
declare const __APP_VERSION__: string;
/** 'main' for the test build at /main/, 'release' otherwise (local dev included). */
declare const __APP_CHANNEL__: 'release' | 'main';
/** Short commit and ISO build time, set by CI; empty in local builds. */
declare const __APP_COMMIT__: string;
declare const __APP_BUILT__: string;
/** The newest release tag when this build was made (test build only); empty otherwise. */
declare const __APP_RELEASE__: string;
declare module '@deck' {
  const value: unknown;
  export default value;
}
