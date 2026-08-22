import { describe, expect, it } from 'vitest';

import { parseDesktopRelease } from './desktop-release';

describe('desktop release metadata', () => {
  it('selects the latest Windows and universal macOS installers', () => {
    const release = parseDesktopRelease({
      tag_name: 'v1.2.3',
      html_url: 'https://github.com/example/releases/tag/v1.2.3',
      assets: [
        { name: 'DOIT-AI-Setup-1.2.3-x64.exe.blockmap', browser_download_url: 'blockmap' },
        { name: 'DOIT-AI-1.2.3-universal.zip', browser_download_url: 'zip' },
        { name: 'DOIT-AI-Setup-1.2.3-x64.exe', browser_download_url: 'windows' },
        { name: 'DOIT-AI-1.2.3-universal.dmg', browser_download_url: 'mac' },
      ],
    });

    expect(release).toMatchObject({
      version: '1.2.3',
      windowsUrl: 'windows',
      macUrl: 'mac',
    });
  });
});
