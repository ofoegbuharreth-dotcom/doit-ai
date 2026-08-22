const LATEST_RELEASE_API = 'https://api.github.com/repos/ofoegbuharreth-dotcom/doit-ai/releases/latest';
const RELEASE_CACHE_KEY = 'doit:latest-desktop-release:v1';
const CACHE_MAX_AGE = 60 * 60 * 1000;

type GitHubAsset = { name?: string; browser_download_url?: string };
type GitHubRelease = { tag_name?: string; published_at?: string; html_url?: string; assets?: GitHubAsset[] };

export type DesktopRelease = {
  version: string;
  windowsUrl?: string;
  macUrl?: string;
  releaseUrl?: string;
  publishedAt?: string;
};

export function parseDesktopRelease(release: GitHubRelease): DesktopRelease {
  const assets = release.assets ?? [];
  const windows = assets.find((asset) => /DOIT-AI-Setup-.*-x64\.exe$/i.test(asset.name ?? ''))
    ?? assets.find((asset) => /\.exe$/i.test(asset.name ?? ''));
  const mac = assets.find((asset) => /DOIT-AI-.*-universal\.dmg$/i.test(asset.name ?? ''))
    ?? assets.find((asset) => /\.dmg$/i.test(asset.name ?? ''));
  return {
    version: String(release.tag_name ?? '').replace(/^v/i, '') || 'Latest',
    windowsUrl: windows?.browser_download_url,
    macUrl: mac?.browser_download_url,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
  };
}

function readCachedRelease(): DesktopRelease | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const cached = JSON.parse(window.localStorage.getItem(RELEASE_CACHE_KEY) ?? '') as { savedAt: number; release: DesktopRelease };
    return Date.now() - cached.savedAt < CACHE_MAX_AGE ? cached.release : undefined;
  } catch { return undefined; }
}

function cacheRelease(release: DesktopRelease) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), release })); } catch { /* Downloads still work without caching. */ }
}

export async function loadLatestDesktopRelease(): Promise<DesktopRelease> {
  const cached = readCachedRelease();
  if (cached?.windowsUrl && cached.macUrl) return cached;
  const response = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  const release = parseDesktopRelease(await response.json() as GitHubRelease);
  if (!release.windowsUrl && !release.macUrl) throw new Error('The latest release has no desktop installers yet.');
  cacheRelease(release);
  return release;
}
