AnatomyLens — free student study app: release checklist
=================================================

Prepared 20 September 2026; production/security status reviewed 24 September 2026. Intended launch: worldwide App Store, general audience, free to download and use. This is a planning checklist, not a completed compliance audit or legal clearance for every territory. Recheck requirements when submitting.

The recommended first release has no advertising, paid features, accounts, cloud image uploads, or personal medical assessments. These are recommendations for keeping the release simple; the user's confirmed commitment is that the app will be free. The current exposed anatomy target is hand and forearm. Do not advertise unfinished targets.

1. **Record the intended educational purpose.**

   Write and retain a short intended-use statement: “Anatomy helps students and general learners study anatomy through generic illustrations aligned approximately to camera landmarks.” Keep the app, screenshots, description, and support replies consistent with that purpose. Do not imply that the app detects a user's internal structures, injuries, disease, or treatment needs.

   The FDA lists interactive anatomy diagrams as an example of software that is not a medical device. The present educational purpose appears consistent with that example; this is not an FDA determination or an assessment for every country. Medical functionality or claims require another regulatory assessment before release. [FDA examples](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-are-not-medical-devices)

   Completion evidence: dated intended-use statement and reviewed store copy.

2. **Choose the publisher and confirm enrollment.**

   Apple allows individual enrollment; forming a company is not an Apple requirement. An individual publisher's personal name is displayed as the seller. Confirm account ownership, legal identity, two-factor authentication, and the local age-of-majority enrollment requirement. If publishing through a school, agree who owns the app and maintains its account. [Enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)

   Budget for the standard US$99 yearly Developer Program membership, or local pricing. Student status alone does not qualify an individual for the institutional fee waiver; eligible educational institutions and other qualifying organizations can apply. [Membership](https://developer.apple.com/support/compare-memberships/), [fee-waiver eligibility](https://developer.apple.com/help/account/membership/fee-waivers)

   Free-only distribution is covered by Apple's Developer Program agreement. The Paid Applications Agreement is for paid apps and in-app purchases; there is no need to configure paid products for this release. Complete other account declarations Apple requires. [Developer agreements](https://developer.apple.com/support/terms/)

   Completion evidence: enrolled publisher, account access, final bundle identifier, and renewal date. Do not assume the personal development build proves paid membership is active.

3. **Check ownership and licenses.**

   Make an asset register recording each illustration, model, font, library, and substantial text source; its creator; exact license; required notices; and modifications. Check any school/course, collaborator, or employment ownership terms that actually apply. Keep permissions in the project. A free educational app is not automatically exempt from copyright restrictions. Attribution does not replace permission.

   The project has a skull license note at `public/SKULL-LICENSE.md`; that is a starting record, not proof that all assets have been reviewed. Confirm MediaPipe code and model licenses separately, font terms, and any notices needed for dependencies. Reference X-rays and textbook screenshots need their own reuse rights if included. Review distributed assets even when a feature is hidden, and remove unused ones where practical. [Apple content-rights requirements](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)

   Completion evidence: asset register, required notices/credits, and permission records or replacement assets.

   The current bundled model hashes are: hand `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`, face `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`, and pose `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`. Recompute them after any asset update.

4. **Review the anatomy and explain the estimates.**

   Have an anatomy instructor or appropriately qualified reviewer check names, A–H wrist mapping, bone and muscle positions, laterality, attachments/functions in popups, and hand-to-forearm continuity. Record sources and corrections. This is a recommended quality step; it is not a claim that Apple requires an instructor's certificate.

   Show a short explanation before the first scan and keep it available in About/Help. Suggested original wording:

   > Anatomy displays estimated educational illustrations based on camera landmarks. It does not see beneath your skin or diagnose conditions. Alignment and proportions may be inaccurate.

   Preserve the visible “estimated” status for close-up prediction and approximate elbow placement. Review what remains visible when tracking disappears. Avoid unsupported accuracy percentages or clinical claims. [Apple physical-harm guidance](https://developer.apple.com/app-store/review/guidelines/#physical-harm)

   Completion evidence: content review notes, in-app sources, first-use explanation, and tracking-loss checks.

5. **Finish and document the camera/data design.**

   Trace camera frames, grayscale snapshots, landmarks, logs, settings, network traffic, support requests, and any crash reporting. Record what exists only in memory, what persists, what leaves the phone, who receives it, and for how long. Verify both cameras, Stop, backgrounding, interrupted capture, and permission denial. Keep camera permission limited to the feature that needs it; no microphone is needed for this release.

   The source now bundles the MediaPipe runtime and hand/face/pose models and no longer imports the Google Fonts stylesheet. Verify first launch in airplane mode and inspect network activity in the release build before describing the app as offline. Retain the bundled asset notices and recheck licenses when dependencies change.

   Completion evidence: data-flow inventory, device network check, retention behavior, and camera lifecycle results.

6. **Create the privacy and support pages.**

   Publish stable HTTPS pages with the publisher's identity, support contact, policy date, camera/landmark use, temporary retention, any external recipients, support-email handling, applicable privacy rights, and how to contact the publisher about them. Describe actual practices; do not copy another app's policy or claim that nothing is collected without checking support and third-party flows. Add an easily accessible in-app privacy link, including a route available before camera permission is granted. Apple requires an in-app policy link. [Apple privacy rules](https://developer.apple.com/app-store/review/guidelines/#privacy)

   Enter the public policy URL and truthful App Privacy answers in App Store Connect. On-device processing is different from Apple's definition of off-device collection, but partner practices must also be considered. “Data Not Collected” remains a candidate answer pending the final audit, not a declaration already justified by this checklist. [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [privacy-label definitions](https://developer.apple.com/app-store/app-privacy-details/)

   For EU/UK and other destinations, assess the privacy laws applicable to the actual processing and publisher. Where personal data is processed, address lawful basis, notice, minimization, security, retention, rights, and any transfers or representation obligations that apply. A camera permission dialog is not a full privacy assessment. [GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/reform/rules-business-and-organisations/principles-gdpr/overview-principles/what-data-can-we-process-and-under-which-conditions_en)

   Completion evidence: live URLs, links checked on phone, dated policy, and a record supporting each App Privacy answer.

7. **Verify SDK declarations in the distribution archive.**

   Generate and inspect the Xcode archive's privacy report. Check the required privacy manifests and approved reasons for covered APIs in app and dependency code. The inspected development build includes Capacitor and Cordova manifests; that does not establish that the final distribution archive is complete. Capacitor and Cordova are on Apple's listed SDK requirements. Do not add arbitrary reason codes simply to suppress validation errors. [SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/), [required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

   Completion evidence: reviewed archive report and successful App Store Connect validation.

8. **Complete audience, age-rating, and medical-status declarations.**

   Use Education as the primary category if it accurately describes the final app. Complete Apple's current age questionnaire based on the actual content, including anatomy/health information. Do not select an arbitrary age solely to avoid obligations. General audience and Apple's Kids Category are different decisions. [Age ratings](https://developer.apple.com/documentation/appstoreconnectapi/age-ratings)

   COPPA may apply to child-directed services or known collection of personal information from children under 13. UK children's design requirements can also concern services processing personal data that are likely to be accessed by children. Evaluate the real intended/likely audience, not only the store category. Keep the first-release design minimal; assess any proposed school or child-focused feature separately. [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [ICO children's code](https://ico.org.uk/media/for-organisations/ico-codes-of-practice/age-appropriate-design-a-code-of-practice-for-online-services-2-1.pdf)

   Apple can require a regulated-medical-device declaration for Medical/Health & Fitness categories or a “frequent” Medical or Treatment Information answer in certain regions. If the field appears, make a truthful, documented declaration based on the final intended purpose; do not change accurate category/rating answers to hide the field. An educational app is not automatically a regulated device just because it must answer this question. [Medical-device declaration](https://developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status/)

   Completion evidence: audience rationale and saved age/medical-status answers.

9. **Choose territories and assess EU trader status.**

   Worldwide availability is the goal, but check each destination's applicable publishing requirements before enabling it. Record which territories are enabled, excluded, or awaiting review. Apple identifies mainland China as a destination where some apps need an ICP filing or other documentation; assess applicability instead of assuming every free app is exempt. [Regional app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)

   A personal, noncommercial student hobby project may fit non-trader status under Apple's EU DSA guidance. Free pricing alone does not decide this: commercial intent, promotion, professional context, and other factors matter. Write down the genuine circumstances, complete the declaration, and revisit it if they change. Traders must provide verified contact information for public display. Get advice if the status remains uncertain. [EU trader assessment](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements)

   Completion evidence: territory list, applicable filings, and dated trader assessment. This checklist does not certify all-country compliance.

10. **Prepare the App Store record and legal settings.**

    Confirm the publisher and bundle identifier before creating the record. Set the app price to Free and create no in-app purchase products for this release. Supply the final name, icon, description, authentic screenshots, Education category, copyright/content-rights answers, support/privacy URLs, and review contact. Choose manual release if you want control over the launch date. The existing draft is in `APP_STORE_RELEASE.md`; update it to match the final features. [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow)

    Apple's standard EULA applies if a custom EULA is not supplied; a bespoke terms document is not automatically necessary for this simple release. The EULA does not replace the privacy policy or erase statutory obligations. [Standard EULA](https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement)

    Answer encryption/export questions using the final app and libraries, including HTTPS/system encryption. An exemption may apply, but do not equate exempt encryption with no encryption. Check any territory-specific documentation prompted by App Store Connect. [Export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/)

    Completion evidence: complete draft record, checked URLs/screenshots, legal answers, and accurate free pricing.

11. **Run a small TestFlight study before public review.**

    Build and archive with the currently required SDK. As checked on 20 September 2026, Apple requires Xcode 26 or later and the iOS 26 SDK or later for uploads. Recheck this when uploading. This build-tool requirement does not require setting the minimum supported device OS to iOS 26. [Current requirements](https://developer.apple.com/news/upcoming-requirements/)

    Invite a small set of anatomy learners and an instructor through TestFlight; external testing may need beta review. Explain how feedback/screenshots are handled. [TestFlight process](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

    Suggested device coverage: both cameras; permission deny/allow; app restart; background/resume; loss of hand; thumb close-up; elbow alignment; different skin tones, lighting and hand sizes; available supported iPhones/iPads; rotation; text readability and accessibility; sustained use/heat; and network failure. Check that Apple's Camera works after Anatomy stops. Automated tracking fixtures do not substitute for these real-camera checks.

    Record results and fix material defects before submission. Preserve the tested version/commit, archive, asset inventory, and outstanding limitations.

12. **Submit, launch, and maintain.**

    Review notes should explain how to start scanning, switch cameras, see bone/muscle details, and interpret estimated overlays. State the absence of accounts/payments only if still true. Explain any necessary network connection honestly. Attach accurate review information and respond to Apple's questions with evidence. Release the approved build only when the preceding items are complete. [Submission guidance](https://developer.apple.com/app-store/submitting/)

    Keep the support address and policy pages working, renew membership, follow Apple requirement changes, fix significant anatomy/tracking defects, and keep dependencies and notices current. Before every update, check whether privacy answers, age rating, claims, screenshots, licenses, or territory declarations changed. Before introducing ads, accounts, cloud processing, health assessments, child-focused features, donations, or paid features, revisit the affected obligations rather than reusing this release's answers.

    If an issue arises, record it, correct the app/disclosures, and restrict affected functionality or availability where necessary. A free price or disclaimer is not a guarantee against future obligations.

Current readiness snapshot (24 September 2026)
---------------------------------------------

| Item | Evidence/status as of this review |
| --- | --- |
| Free, worldwide, general-audience intent | Confirmed by user |
| Camera permission purpose string | Present in `ios/App/App/Info.plist`; camera starts from Scan only |
| Physical camera evidence | User confirmed camera and overlay work with screen sharing off; this security audit did not use the simulator for camera testing |
| Capacitor/Cordova privacy manifests | App manifest is present; final signed archive and App Store validation still need review |
| First-use educational explanation | Educational limitation is present in Settings; a dedicated first-scan introduction remains recommended |
| In-app privacy link/public policy | In-app link and bundled `public/privacy.html` added; a public HTTPS URL is still needed for App Store Connect |
| Runtime and models | Required runtime and hand/face/pose models are bundled locally; app release build passed; license/asset register review remains pending |
| Complete asset/content review | Pending qualified anatomy review and complete asset register; bundled MediaPipe license notice is present |
| Age, trader, export, territory answers | Not verified in App Store Connect |
| Publisher membership/account readiness | Not verified |
| Security audit and source checks | Completed 24 September 2026; 150 tests, lint and production build passed; production dependency audit has zero advisories |
| Release archive | Unsigned iPhoneOS Release archive built and validated locally; it is not uploadable |
| Signing identity | Xcode project team now matches Bhawana's local Apple Development identity; Apple Distribution identity is not installed |
| App icon | Custom 1024 × 1024 AnatomyLens skeleton-hand icon added and compiled into the iOS Release build; final owner review recommended |
| TestFlight, signed distribution archive, App Store submission | Not performed; still required before release |

Next release work: confirm the bundle identifier; install/create the Apple Distribution signing identity; publish the privacy and support URLs; complete the asset register and qualified anatomy review; inspect the signed archive privacy report; complete App Store Connect privacy, age, export and territory answers; then run TestFlight on real devices with screen sharing off for camera checks.
