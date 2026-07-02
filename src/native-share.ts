import { Clipboard } from '@capacitor/clipboard';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativePlatform } from './platform.js';
import { buildIcsCalendar, buildItineraryText, safeTripFilename, type TripExportSnapshot } from './trip-share.js';

export type ShareOutcome = 'shared' | 'cancelled' | 'unavailable';

export async function copyText(text: string) {
  if (isNativePlatform()) {
    await Clipboard.write({ string: text });
    return;
  }
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

export async function shareText(title: string, text: string): Promise<ShareOutcome> {
  if (isNativePlatform()) {
    try {
      await Share.share({ title, text });
      return 'shared';
    } catch (error) {
      return (error as Error).message?.toLowerCase().includes('cancel') ? 'cancelled' : 'unavailable';
    }
  }
  if (typeof navigator.share !== 'function') return 'unavailable';
  try {
    await navigator.share({ title, text });
    return 'shared';
  } catch (error) {
    return (error as Error).name === 'AbortError' ? 'cancelled' : 'unavailable';
  }
}

export async function exportTripCalendarFile(snapshot: TripExportSnapshot) {
  const ics = buildIcsCalendar(snapshot);
  const filename = safeTripFilename(snapshot.name);
  if (isNativePlatform()) {
    await Filesystem.writeFile({
      path: filename,
      data: ics,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const uri = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({
      title: snapshot.name,
      text: buildItineraryText(snapshot),
      url: uri.uri,
      dialogTitle: snapshot.name,
    });
    return filename;
  }
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

