# DOIT AI desktop releases

DOIT AI now ships as an Electron desktop application. Its interface is bundled inside the installer and served from the private `doit://app` origin, so it opens in a dedicated application window without a browser address bar or development server.

## Build locally

- Windows: `npm run build:desktop:windows`
- macOS (run on a Mac): `npm run build:desktop:mac`
- Launch the compiled interface for development: `npm run desktop:dev`

Windows output is written to `release/DOIT-AI-Setup-<version>-x64.exe`. macOS produces universal Intel/Apple-silicon `.dmg` and `.zip` files in `release/`.

## Publish downloads

The included GitHub Actions workflow builds both operating systems. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as GitHub Actions repository secrets, then push a tag such as `v1.0.0`. The workflow creates a GitHub Release containing the installers.

Set these values before rebuilding and deploying the website:

```env
EXPO_PUBLIC_DESKTOP_WINDOWS_URL=https://github.com/OWNER/REPOSITORY/releases/latest/download/DOIT-AI-Setup-1.0.0-x64.exe
EXPO_PUBLIC_DESKTOP_MAC_URL=https://github.com/OWNER/REPOSITORY/releases/latest/download/DOIT-AI-1.0.0-universal.dmg
```

The website's `/download` page will then deliver the actual installers. Large installers should use GitHub Releases or object storage rather than Cloudflare Pages static files.

## Signing note

The current builds are unsigned. Windows may show a SmartScreen warning and macOS may require right-clicking the app and choosing Open. Removing those warnings for public release requires a Windows code-signing certificate and an Apple Developer certificate/notarisation respectively.
