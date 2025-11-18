
export interface Message {
  role: 'user' | 'model';
  content: string;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
}

export type VerificationState = 'unverified' | 'verifying' | 'verified' | 'error';
