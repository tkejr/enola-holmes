from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
import cv2
import numpy as np
from typing import List, Dict
import io

app = FastAPI(title="Face Detection Service")

# Enable CORS for Expo app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5
)

# MediaPipe landmark indices for different facial features
FACE_OUTLINE_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                         397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                         172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

LEFT_EYEBROW_INDICES = [70, 63, 105, 66, 107]
RIGHT_EYEBROW_INDICES = [336, 296, 334, 293, 300]

LEFT_EYE_INDICES = [33, 133, 157, 158, 159, 145]  # Just 6 key points around eye
RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 374]  # Just 6 key points around eye

NOSE_BRIDGE_INDICES = [168, 6]  # Just top and center of bridge
NOSE_TIP_INDICES = [1, 2]  # Just tip center
NOSE_BASE_INDICES = [49, 5, 279]  # Just left, center, right of base

UPPER_LIP_INDICES = [61, 37, 0, 267, 291]  # Key points only
LOWER_LIP_INDICES = [146, 84, 17, 314, 375]  # Key points only
MOUTH_INNER_INDICES = []  # Remove inner mouth entirely


def normalize_landmarks(landmarks, image_width: int, image_height: int) -> List[Dict]:
    """Convert MediaPipe landmarks to normalized coordinates with types"""
    facial_points = []

    # Face outline
    for idx in FACE_OUTLINE_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "outline",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Left eyebrow
    for idx in LEFT_EYEBROW_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "eyebrow",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Right eyebrow
    for idx in RIGHT_EYEBROW_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "eyebrow",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Left eye
    for idx in LEFT_EYE_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "eye",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Right eye
    for idx in RIGHT_EYE_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "eye",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Nose bridge
    for idx in NOSE_BRIDGE_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "nose",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Nose tip
    for idx in NOSE_TIP_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "nose",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Nose base
    for idx in NOSE_BASE_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "nose",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Upper lip
    for idx in UPPER_LIP_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "mouth",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Lower lip
    for idx in LOWER_LIP_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "mouth",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    # Mouth inner
    for idx in MOUTH_INNER_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            facial_points.append({
                "type": "mouth",
                "x": float(lm.x),
                "y": float(lm.y)
            })

    return facial_points


@app.get("/")
async def root():
    return {
        "service": "Face Detection Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/detect-face")
async def detect_face(file: UploadFile = File(...)):
    """
    Detect facial landmarks in an uploaded image.

    Returns:
        - faceDetected: bool
        - numFaces: int
        - facialPoints: list of {type, x, y} objects
        - imageWidth: int
        - imageHeight: int
    """
    try:
        # Read uploaded image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Get image dimensions
        image_height, image_width = image.shape[:2]

        # Convert BGR to RGB for MediaPipe
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Process the image with MediaPipe
        results = face_mesh.process(image_rgb)

        # Check if face was detected
        if not results.multi_face_landmarks:
            response = {
                "faceDetected": False,
                "numFaces": 0,
                "facialPoints": [],
                "imageWidth": image_width,
                "imageHeight": image_height
            }
            print("Response:", response)
            return response

        # Get the first face's landmarks
        face_landmarks = results.multi_face_landmarks[0]

        # Normalize landmarks to 0-1 range with semantic types
        facial_points = normalize_landmarks(
            face_landmarks.landmark,
            image_width,
            image_height
        )

        response = {
            "faceDetected": True,
            "numFaces": len(results.multi_face_landmarks),
            "facialPoints": facial_points,
            "imageWidth": image_width,
            "imageHeight": image_height,
            "totalLandmarks": len(facial_points)
        }
        print("Response:", response)
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
