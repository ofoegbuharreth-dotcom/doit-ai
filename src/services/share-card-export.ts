import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { SHARE_CARD_FORMATS, type ShareCardFormat } from './share-card';

export async function exportShareCard(ref: unknown, format: ShareCardFormat) {
  const size = SHARE_CARD_FORMATS[format];
  return captureRef(ref as never, { format: 'png', quality: 1, result: 'tmpfile', width: size.width, height: size.height });
}

export async function downloadShareCard(uri: string) {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save your DOIT plan card' });
}

export async function shareShareCard(uri: string) {
  if (await Sharing.isAvailableAsync()) return Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your DOIT plan' });
}

export async function copyShareText(text: string) { await Share.share({ message: text }); }
