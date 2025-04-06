import { Store } from 'jotai/vanilla';

// Define build info interface
interface BuildInfo {
  buildId: string;
  buildTimestamp: string;
  buildDate: string;
}

declare global {
  interface Window {
    jotaiStore?: Store;
    buildInfo?: BuildInfo;
  }
}

export {};
