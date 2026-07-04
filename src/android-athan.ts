import { registerPlugin } from '@capacitor/core';

export type AndroidAthanAlarm = {
  id: number;
  timestamp: number;
  prayer: string;
  city: string;
  audioReady?: boolean;
  language?: string;
};

type AndroidAthanPlugin = {
  prepare(options: { audioUrl: string }): Promise<{ ready: boolean }>;
  requestPermissions(): Promise<{ exactAlarmAllowed: boolean; notificationsAllowed: boolean }>;
  schedule(options: { alarms: AndroidAthanAlarm[] }): Promise<{ scheduled: number }>;
  pending(): Promise<{ scheduled: number }>;
  cancelAll(): Promise<void>;
  test(options: { language: string }): Promise<void>;
  stop(): Promise<void>;
};

export const AndroidAthan = registerPlugin<AndroidAthanPlugin>('AthanAlarm');
