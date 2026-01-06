export interface Identity {
  uid: string;
  email?: string;
  [key: string]: unknown;
}
