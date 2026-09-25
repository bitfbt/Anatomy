# AnatomyLens iOS release preparation

Status: an unsigned Release archive builds successfully. It is not signed for distribution and has not been uploaded to App Store Connect.

App name: AnatomyLens. Provisional bundle identifier: com.bitfbt.anatomy.
Confirm this identifier in the publishing Apple Developer account before creating the App Store record.

## Build and test

1. Install Xcode 26 or later from the Mac App Store, open it, and install iOS platform support.
2. In Xcode Settings > Accounts, sign in to the Apple Developer account.
3. Run `pnpm ios:sync` then `pnpm ios:open` in this project.
4. Select the App target and the developer team under Signing & Capabilities.
5. Run on a physical iPhone. Verify camera permission, deny/retry behavior, hand tracking, portrait/landscape layout, background/resume, muscle and skeleton modes, and performance.
6. Archive for a generic iOS device and distribute to App Store Connect. Validate with TestFlight before submitting for review.

## Store listing draft

Name: AnatomyLens
Subtitle: Explore hand bones and muscles
Category: Education
Description: Explore hand anatomy with interactive camera overlays. Switch between skeleton and muscle views, inspect anatomical labels, and compare palm and back-of-hand views. Overlays are educational illustrations estimated from visible hand landmarks; they do not image structures beneath the skin and are not intended for diagnosis.

Reviewer notes: Tap Scan, allow camera access, and show an open hand to the camera. Select Skeleton or Muscles and use the label controls. No account is required. Face anatomy is not available in this release.

## Remaining submission assets and account details

- The Xcode project now uses Bhawana's Apple Developer team, matching the local Apple Development certificate. Confirm the final bundle identifier (`com.bitfbt.anatomy` is provisional) and install/create an Apple Distribution identity before producing a distributable archive.
- Review the new AnatomyLens app icon in the asset catalog and capture final screenshots on supported iPhones.
- Publish the privacy policy and support pages at public HTTPS URLs, and provide the support contact.
- App privacy answers and age rating in App Store Connect.
- Review contact, pricing, territories, export compliance answers, and release timing.

## Local archive check

An unsigned Release archive was created at `/tmp/AnatomyLens-release-current.xcarchive` on 24 September 2026. Xcode validated its iPhoneOS platform and the embedded app reports display name `AnatomyLens`, version `1.0` (build `1`); the asset catalog compiled successfully. This archive is useful for local packaging review but cannot be submitted to the App Store. Create a signed archive after confirming the bundle ID and installing/creating an Apple Distribution identity.

Camera frames are processed by the local MediaPipe tracker. The runtime and hand/face/pose model files are bundled in the app, so tracking does not need to send camera data to a remote service or download a model at startup. Recheck the final archive and the bundled asset licenses before submission.

References: https://capacitorjs.com/docs/ios and https://developer.apple.com/app-store/submitting/
