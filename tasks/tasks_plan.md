# Downlodr Build Workflow for Mac

## Phase 1: Environment Setup

- [ ] Install Xcode and Command Line Tools
- [ ] Install Node.js (v20.17.0+)
- [ ] Install Yarn package manager (v1.22.19+)
- [ ] Set up Git and development tools

## Phase 2: Project Setup

- [ ] Navigate to the project directory
- [ ] Install project dependencies with `yarn`
- [ ] Install yt-dlp-helper dependency

## Phase 3: Development and Testing

- [ ] Run application in development mode (`yarn start`)
- [ ] Test download functionality
- [ ] Test user interface components
- [ ] Test settings and configurations
- [ ] Debug any issues specific to macOS

## Phase 4: Building for macOS (Within Project)

- [ ] Review forge.config.ts for macOS build settings
- [ ] Configure code signing if needed (using project's forge.config.ts)
- [ ] Build the application with `yarn make` in the project directory
- [ ] Verify output in the project's out/make directory

## Phase 5: Distribution and Packaging

- [ ] Test the built package from the out/make directory
- [ ] The ZIP file is automatically created in out/make
- [ ] The PKG installer is automatically created in out/make
- [ ] Prepare for App Store submission (if applicable)

## Phase 6: Advanced Configuration

- [ ] Update custom icons and branding in src/Assets/AppLogo
- [ ] Configure notarization in forge.config.ts
- [ ] Set up auto-update mechanism in the project (if needed)
- [ ] Optimize package size and performance

## Phase 7: Quality Assurance

- [ ] Install and test the built app from the out/make directory
- [ ] Verify application functionality on different macOS versions
- [ ] Check for compatibility issues
- [ ] Resolve any code signing or permission issues

## Phase 8: Release and Deployment

- [ ] Prepare release notes
- [ ] Create GitHub release using the built packages from out/make
- [ ] Deploy to distribution channels
- [ ] Monitor initial user feedback

## Common Issues and Solutions

- Code signing issues: Verify Apple Developer ID configuration in forge.config.ts
- Build failures: Check Node.js/Yarn versions, reinstall dependencies within the project
- Runtime errors: Check logs for missing dependencies, verify file access permissions
