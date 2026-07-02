import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const platformName = () => Capacitor.getPlatform();

export const isIosNative = () => isNativePlatform() && platformName() === 'ios';

export const appBasePath = () => import.meta.env.BASE_URL.replace(/\/?$/, '/');

