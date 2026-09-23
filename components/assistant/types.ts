export type Finding = {
  label: string;
  value: string;
  unit: string;
  range: string;
  page: number | null;
  quote: string;
  // true: found in the PDF text layer; false: not found; null/absent: no text layer to compare.
  verified?: boolean | null;
};
export type AssistantDocument = {
  id: string;
  name: string;
  mime: string;
  status: "reading" | "ready" | "error";
  error_code?: string;
  extraction?: {
    text: string;
    kind: string;
    findings: Finding[];
    limitations: string[];
  };
};
export type Answer = {
  summary: string;
  interpretation: string;
  uncertainty: string;
  consultation: string[];
  followups: string[];
};
export type AssistantMessage = {
  id: string;
  request_id: string;
  question: string;
  document_ids: string[];
  answer: Answer | null;
  partial: string;
  status: "running" | "completed" | "stopped" | "error";
  error_code?: string;
};
export type Conversation = {
  id: string;
  expires_at: string;
  documents: AssistantDocument[];
  messages: AssistantMessage[];
};
export type StreamEvent = {
  type: "status" | "content" | "done" | "error";
  message?: AssistantMessage;
  text?: string;
  code?: string;
};
export type UploadFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  file?: File;
};
