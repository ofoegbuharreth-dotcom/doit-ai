import html2canvas from 'html2canvas';

import { SHARE_CARD_FORMATS, type ShareCardFormat } from './share-card';

export async function exportShareCard(ref: { current?: HTMLElement | null } | HTMLElement, format: ShareCardFormat) {
  const element = ref instanceof HTMLElement ? ref : ref.current;
  if (!element) throw new Error('The plan preview is not ready yet.');
  const size = SHARE_CARD_FORMATS[format];
  const source = await html2canvas(element, { backgroundColor: '#090A0C', logging: false, scale: 2, useCORS: true });
  const output = document.createElement('canvas'); output.width = size.width; output.height = size.height;
  output.getContext('2d')?.drawImage(source, 0, 0, size.width, size.height);
  return output.toDataURL('image/png', 1);
}

export async function downloadShareCard(uri: string) {
  const link = document.createElement('a'); link.download = `doit-plan-${Date.now()}.png`; link.href = uri; link.click();
}

export async function shareShareCard(uri: string) {
  const blob = await (await fetch(uri)).blob(); const file = new File([blob], 'doit-plan.png', { type: 'image/png' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) return navigator.share({ title: 'My DOIT plan', files: [file] });
  await downloadShareCard(uri);
}

export async function copyShareText(text: string) {
  if (!navigator.clipboard) throw new Error('Clipboard access is unavailable in this browser.');
  await navigator.clipboard.writeText(text);
}
