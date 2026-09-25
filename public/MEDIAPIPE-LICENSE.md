# MediaPipe runtime and model notices

AnatomyLens bundles the MediaPipe Tasks Vision runtime and the hand, face, and pose landmark model files for on-device processing. The JavaScript package declares Apache-2.0 licensing; retain its package notice with every distribution. Retain the model distribution terms and any required notices supplied by the model publisher with the release archive. Verify those terms again when changing model versions.

Source references used to obtain the bundled files:

- Runtime: `@mediapipe/tasks-vision` 0.10.35, installed package under `node_modules/@mediapipe/tasks-vision`.
- Hand model: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`.
- Face model: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
- Pose model: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`.

The SHA-256 hashes of the exact files in this checkout are recorded in the release notes/checklist. The model URLs are source references, not runtime endpoints.

The bundled assets are used only to calculate landmarks locally. They do not receive camera frames from a remote service.
