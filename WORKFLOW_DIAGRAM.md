# GitHub Actions Workflow Diagram

## 🔄 Automated Build Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPER ACTIONS                            │
│                                                                 │
│  1. Update code                                                 │
│  2. git tag -a v1.8.0 -m "Release 1.8.0"                       │
│  3. git push origin v1.8.0                                      │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GITHUB ACTIONS TRIGGERED                       │
│                    (Automatic from tag push)                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD JOB (Matrix)                           │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐         │
│  │   Apple Silicon      │    │      Intel           │         │
│  │     (arm64)          │    │      (x64)           │         │
│  └──────────────────────┘    └──────────────────────┘         │
│           │                            │                        │
│           └────────────┬───────────────┘                        │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                SETUP & PREPARATION                              │
│                                                                 │
│  1. ✓ Checkout code                                            │
│  2. ✓ Setup Node.js 20                                         │
│  3. ✓ Install dependencies (yarn)                              │
│  4. ✓ Import signing certificate                               │
│  5. ✓ Create temporary keychain                                │
│  6. ✓ Verify signing identity                                  │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               BUILD & PACKAGE                                   │
│                                                                 │
│  1. ✓ Run Electron Forge make                                  │
│  2. ✓ Build for architecture (arm64 or x64)                    │
│  3. ✓ Sign application with Developer ID                       │
│  4. ✓ Sign all binaries (yt-dlp, ffmpeg)                       │
│  5. ✓ Create PKG installer                                     │
│  6. ✓ Create DMG image                                         │
│  7. ✓ Create ZIP archive                                       │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 NOTARIZATION                                    │
│                                                                 │
│  1. ✓ Submit PKG to Apple notary service                       │
│  2. ✓ Wait for Apple approval (~3-8 minutes)                   │
│  3. ✓ Staple notarization ticket                               │
│  4. ✓ Verify notarization                                      │
│  5. ✓ Check Gatekeeper assessment                              │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              ARTIFACT UPLOAD                                    │
│                                                                 │
│  1. ✓ Generate artifacts list                                  │
│  2. ✓ Upload PKG files                                         │
│  3. ✓ Upload DMG files                                         │
│  4. ✓ Upload ZIP files                                         │
│  5. ✓ Store for 30 days                                        │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLEANUP & VERIFY                                   │
│                                                                 │
│  1. ✓ Delete temporary keychain                                │
│  2. ✓ Verify all artifacts generated                           │
│  3. ✓ Create build summary                                     │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│           CREATE GITHUB RELEASE                                 │
│        (Only if tag push or manual with flag)                   │
│                                                                 │
│  1. ✓ Download all artifacts                                   │
│  2. ✓ Generate release notes                                   │
│  3. ✓ Create GitHub Release                                    │
│  4. ✓ Upload all artifacts to release                          │
│  5. ✓ Generate changelog                                       │
│  6. ✓ Publish release                                          │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUCCESS! 🎉                                   │
│                                                                 │
│  Release URL:                                                   │
│  https://github.com/YOUR_USERNAME/Downlodr/releases/tag/v1.8.0 │
│                                                                 │
│  Artifacts (6 files):                                           │
│  - Downlodr-darwin-arm64-1.8.0.pkg (~180MB)                    │
│  - Downlodr-darwin-x64-1.8.0.pkg (~180MB)                      │
│  - Downlodr-darwin-arm64-1.8.0.dmg (~170MB)                    │
│  - Downlodr-darwin-x64-1.8.0.dmg (~170MB)                      │
│  - Downlodr-darwin-arm64-1.8.0.zip (~160MB)                    │
│  - Downlodr-darwin-x64-1.8.0.zip (~160MB)                      │
│                                                                 │
│  All artifacts:                                                 │
│  ✓ Signed with Developer ID                                    │
│  ✓ Notarized by Apple                                          │
│  ✓ Gatekeeper verified                                         │
│  ✓ Ready for distribution                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

## ⏱️ Timeline

```
0:00  - Tag pushed to GitHub
0:01  - Workflow triggered
0:02  - Setup complete
0:03  - Dependencies installed
0:05  - Certificate imported
0:06  - Build started (arm64)
0:15  - Build complete (arm64)
0:16  - Notarization submitted (arm64)
0:22  - Notarization complete (arm64)
0:23  - Build started (x64)
0:32  - Build complete (x64)
0:33  - Notarization submitted (x64)
0:39  - Notarization complete (x64)
0:40  - Release creation started
0:42  - All artifacts uploaded
0:43  - Release published
✓     - DONE!
```

**Total Time:** ~35-40 minutes (fully automated)

## 🔐 Security Flow

```
Developer Secrets (GitHub)
    │
    ├─ MACOS_CERTIFICATE ────────┐
    ├─ MACOS_CERTIFICATE_PWD ────┤
    ├─ KEYCHAIN_PASSWORD ────────┤
    │                             │
    │                             ▼
    │                    Temporary Keychain
    │                    (Created & Destroyed)
    │                             │
    ├─ APPLE_IDENTITY ───────────┤
    ├─ APPLE_INSTALLER_ID ───────┤
    │                             │
    │                             ▼
    │                       Code Signing
    │                             │
    ├─ APPLE_ID ─────────────────┤
    ├─ APPLE_PASSWORD ───────────┤
    ├─ APPLE_TEAM_ID ────────────┤
    │                             │
    │                             ▼
    │                      Notarization
    │                             │
    │                             ▼
    └────────────────────> Signed & Notarized
                           Artifacts
```

## 📊 Artifact Flow

```
Source Code
    │
    ▼
Electron Forge Build
    │
    ├─ arm64 ────────────┬─ .app Bundle
    │                    ├─ .pkg Installer
    │                    ├─ .dmg Disk Image
    │                    └─ .zip Archive
    │
    └─ x64 ──────────────┬─ .app Bundle
                         ├─ .pkg Installer
                         ├─ .dmg Disk Image
                         └─ .zip Archive
                              │
                              ▼
                         Code Signing
                              │
                              ▼
                        Notarization
                              │
                              ▼
                      GitHub Release
                              │
                              ▼
                        End Users! 🎉
```

## 🎯 Decision Points

```
Tag Push Event
    │
    ├─ Starts with 'v'? ──Yes──> Trigger Build
    │                            │
    │                            ├─ Build Matrix
    │                            │   ├─ arm64
    │                            │   └─ x64
    │                            │
    │                            ├─ Code Sign? ───> Check APPLE_IDENTITY
    │                            │   ├─ Present: Sign
    │                            │   └─ Absent: Skip
    │                            │
    │                            ├─ Notarize? ────> Check Credentials
    │                            │   ├─ Valid: Notarize
    │                            │   └─ Invalid: Fail
    │                            │
    │                            └─ Create Release? ─> Yes (auto)
    │
    └─ No ──────────────────────> Ignore
```

## 🔄 Parallel Processing

```
arm64 Build (15 min)     x64 Build (15 min)
    │                         │
    ▼                         ▼
Notarize (6 min)         Notarize (6 min)
    │                         │
    └───────┬─────────────────┘
            │
            ▼
       Both Complete
            │
            ▼
     Create Release
```

**Total:** ~21 minutes (parallel) vs ~42 minutes (sequential)

---

**Key Points:**
- ⚡ Fully automated from tag push
- 🔐 Secure secret handling
- 🔄 Parallel architecture builds
- ✅ Complete verification
- 📦 Professional artifacts
- 🚀 Zero manual intervention
