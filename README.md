# AnatomyLens

## Current release

Hand anatomy is available. Face and full-body targets are disabled and marked **Coming soon**; their experimental renderers are not part of the current scanning workflow.

## Running locally

Run the local scanner frontend:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL, usually `http://localhost:5173`.

Tap Scan hand and grant camera permission to start. Choose Bones or Muscles, set labels in Settings, and switch between palm and back-of-hand muscle views. A Front/Rear button selects the camera before or during a scan. Face and full-body code is retained for development, but those targets are not available in the released app. AnatomyLens includes its landmark runtime and models; scanning makes no remote anatomy API request and needs no API key.

Camera frames, landmarks, and short continuity history are processed in memory on the device and are not uploaded by the app. The MediaPipe runtime and model files are bundled for the iOS build. The in-app Settings panel links to the current [privacy notice](public/privacy.html). This is an educational overlay, not medical imaging or medical advice.

## Full body mode — Coming soon

Full body is disabled in the target selector while its anatomy is developed. Hand + forearm remains available; its pose tracker still locates the elbow. The experimental body implementation is retained for future development.

## Hand and forearm

Bones now use a radiograph-inspired gray-white style: broad shafts, shaped joint ends with dark gaps, bright cortical rims, and subtle fixed internal grain. Whole-hand bones and retained finger close-ups share a painter. Dedicated radius and ulna contours use the same radiographic style, with the broad radius at the wrist and broad ulna at the elbow. Wrist bones use fitted individual contours in two curved rows, including an elongated scaphoid, crescent lunate, central capitate, and small overlying pisiform. Bone width scales with the approaching hand. The default wrist view shows A–H letters without the name-key panel. They match the [supplied reference figure](https://www.ncbi.nlm.nih.gov/books/NBK535382/figure/article-18977.image.f1/): A Scaphoid, B Lunate, C Triquetrum, D Pisiform, E Trapezium, F Trapezoid, G Capitate, H Hamate. Tap a letter for its bone information. Settings → Wrist labels offers Off, A–H, or A–H + names; selecting A–H + names explicitly opens the collapsible key. The key hides in finger-only close-ups. The reference guides the educational illustration; its pink highlights are not included.

Hand overlays retain up to 24 measured observations (at least four are required). The most recent five estimate position, scale, and rotation for up to 180 ms, then hold and fade out by one second without fresh evidence. A central close-up can use visible palm anchors to align the retained hand shape. The HUD says **Estimated tracking** while a hand is inferred. Estimated frames never renew their own lifetime, and a hand explicitly leaving the view clears its whole-hand history. Bones and Muscles share this behavior. An existing forearm placement can coast with the same predicted wrist for at most 180 ms during a hand-detector blink; those frames never create or refresh an elbow measurement or placement. Rescan, camera stream changes, and viewport changes discard the history.

For a finger-only close-up, first scan the whole hand, then approach while keeping the digit in the picture. A separate image tracker follows textured points on each previously recognized finger using small grayscale camera frames. Four measured hand observations establish identity; the latest five measured/image-supported observations predict motion, enlargement, and rotation for up to 300 ms during a detection or focus gap. The estimate then holds briefly and fades out by 1.2 seconds without fresh evidence. These predicted frames never extend their own deadline. A large central digit can also use this brief landmark-based prediction when skin has too little texture to seed image tracking. Only the most prominent central digit is retained in that case.

The last clear finger image remains available for recovery through a blur instead of being discarded after one failed match. Recent motion guides a bounded patch search, but image recovery still needs forward/backward agreement and consistent scale/rotation. Offscreen patches are excluded from the required match count so cropped bases and tips do not automatically erase the digit. The HUD identifies the digit, for example **Thumb close-up · estimated**. Only that digit's phalanges or palm/back tendon paths are drawn. Current image support can preserve the digit for up to eight seconds after the last measured hand. A gap between camera frames longer than 600 ms, a camera/viewport change, or expiry clears the history. Show the whole hand again to refresh identity. Small camera snapshots stay in memory and are never saved; this is an estimated educational projection.

The camera switch beside Scan (and in the active bottom bar) toggles **Rear / Front**. Switching releases the old camera before opening the selected one, keeps the current Bones/Muscles view, and clears all old-lens hand/finger estimates and elbow calibration. Both camera previews and their overlays use the same unmirrored coordinates. Camera selection lasts until the app reloads.

Both Bones and Muscles include the forearm from wrist to elbow. A detected elbow matched to the current hand wrist sets its position automatically. If body pose detection is unavailable but the hand and palm remain visible, a connected approximate preview is shown with **Forearm preview · tap Align elbow**. Its initial direction and length come from the hand; subsequent previews retain that direction (or the last measured direction) while following wrist position and hand scale. Bending the hand does not rotate the entire preview. This estimate cannot locate an unseen elbow accurately. Brief pose losses retain the last measured elbow for at most 650 ms before returning to the approximate preview; estimated frames never refresh the measurement. An isolated large elbow jump requires confirmation on the next frame.

To position the forearm yourself, tap **Align elbow**, then tap your elbow in the camera picture while the hand remains visible. The selected point overrides body pose detection. Small grayscale camera frames can follow its image texture while forward/backward matches agree; the HUD says **Following your selected elbow**. Lost texture or a long frame gap pins the point where it was last supported and changes the message to **Elbow pinned · Align elbow to adjust**. Retap to realign, or select **Auto elbow** to return to automatic detection/preview. A pinned point does not follow later arm movement. Calibration clears on Stop, camera or viewport changes, or a hand absence longer than one second. No camera images are saved.

The hand and forearm share the same final wrist coordinates, including cropped-hand continuity frames. The distal forearm turns into the measured hand orientation; muscle tendons overlap slightly under the palm heel, while bones retain small wrist joint gaps. The observed elbow remains fixed when the hand bends. Hand, body, and close-up image tracking use the same captured video frame. The cover transform uses the displayed canvas bounds; camera-source, source-size, and viewport changes reset smoothing and tracking history. Adaptive smoothing damps small landmark jitter while responding quickly to deliberate movement.

Keep the hand, wrist, and elbow in the camera picture to see the complete overlay. Confident elbow landmarks may fall outside the camera crop; only the visible part is drawn and the HUD asks the user to move back. Cropped fingers can leave the forearm visible when current wrist and elbow measurements support it. No upper-arm bones or muscles are drawn. Anatomy remains an educational projection; running hand and body trackers together may reduce frame rate on slower devices.

### Forearm illustration

Tap a visible muscle or tendon label to open its name, location, and function in the same detail popup as Bones. This works for hand groups, detailed individual muscles, forearm labels, and retained finger tendon close-ups in Palm and Back views. Tap empty camera space to dismiss it. Switching layers or muscle label/side settings clears the popup. Hidden labels have no tap targets. Descriptions draw on [OpenStax upper-limb anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs), [hand muscles](https://www.ncbi.nlm.nih.gov/books/NBK537229/), [forearm muscles](https://www.ncbi.nlm.nih.gov/books/NBK536975/), [lumbricals](https://www.ncbi.nlm.nih.gov/books/NBK534876/), [interossei](https://www.ncbi.nlm.nih.gov/books/NBK534772/), and [forearm compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/).

Palm and Back muscle views use individually authored muscle contours, curved fascicles, tendon courses, and aponeuroses. Detailed labels identify the illustrated regions; selected deep muscles are exposed as a cutaway and labeled `(deep)`. This remains an approximate educational projection from the tracked wrist and a detected, selected, or estimated elbow, not a validated patient-specific anatomy model. The reference's upper-arm biceps/triceps are outside this elbow-to-wrist view.

Anatomical layout references: [OpenStax, upper-limb muscles](https://openstax.org/books/anatomy-and-physiology/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs) and [NCBI, forearm compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/). Paths and shading are original project artwork, not copied textbook images.
