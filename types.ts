export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'model';
  timestamp: number;
  language?: string;
  isTranslating?: boolean;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}
