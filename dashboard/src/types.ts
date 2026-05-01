export interface InstanceConfig {
  id: string;
  name: string;
  sessionId: string;
  apiKey: string;
  apiUrl: string;
  createdAt: number;
}

export type SessionStatus =
  | "connecting"
  | "qr_ready"
  | "connected"
  | "disconnected"
  | "unknown";

export interface InstanceState extends InstanceConfig {
  status: SessionStatus;
  phone: string | null;
  qrCode: string | null;
  loading: boolean;
  error: string | null;
}

export interface CreateInstanceForm {
  name: string;
  apiKey: string;
  apiUrl: string;
  sessionId: string;
}
