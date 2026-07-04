import { registerPlugin } from '@capacitor/core';

export type AndroidAthanAlarm = {
  id: number;
  timestamp: number;
  prayer: string;
  city: string;
};

type AndroidAthanPlugin = {
  prepare(options: { audioUrl: string }): Promise<{ ready: boolean }>;
  schedule(options: { alarms: AndroidAthanAlarm[] }): Promise<{ scheduled: number }>;
  cancelAll(): Promise<void>;
  test(): Promise<void>;
  stop(): Promise<void>;
};

export const AndroidAthan = registerPlugin<AndroidAthanPlugin>('AthanAlarm');
