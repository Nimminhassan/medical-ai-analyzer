from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from extractor import extract_text
from analyzer import analyze_lab_report
from chatbot import chat_with_bot
from image_analyzer import analyze_ecg, analyze_xray

app = FastAPI(title="Lab Risk Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Lab Risk Analyzer API is running"}


# ── Extract only (OCR, no AI analysis) ───────────────────────────────────────
@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    """Step 1: Extract text from uploaded file. Fast — returns immediately."""
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/tiff"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and image files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    try:
        lab_text = extract_text(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

    if not lab_text:
        raise HTTPException(status_code=422, detail="Could not extract text from the file.")

    return {"success": True, "extracted_text": lab_text}


# ── Combined analysis (lab text + lifestyle) ──────────────────────────────────
class CombinedAnalysisRequest(BaseModel):
    extracted_text: str
    lifestyle: Optional[Dict[str, Any]] = None

@app.post("/analyze-combined")
async def analyze_combined(request: CombinedAnalysisRequest):
    """Step 2: Analyze extracted text + lifestyle data together."""
    try:
        result = analyze_lab_report(request.extracted_text, request.lifestyle)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    return {
        "success": True,
        "extracted_text": request.extracted_text,
        "analysis": result
    }


# ── Original analyze endpoint (kept for compatibility) ────────────────────────
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/tiff"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and image files are supported.")
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    try:
        lab_text = extract_text(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")
    if not lab_text:
        raise HTTPException(status_code=422, detail="Could not extract text from the file.")
    try:
        result = analyze_lab_report(lab_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    return {"success": True, "extracted_text": lab_text, "analysis": result}


# ── Chat ──────────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]
    lab_text: Optional[str] = None
    analysis: Optional[dict] = None

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        reply = chat_with_bot(
            message=request.message,
            history=request.history,
            lab_text=request.lab_text,
            analysis=request.analysis
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ── ECG ───────────────────────────────────────────────────────────────────────
@app.post("/analyze-ecg")
async def analyze_ecg_endpoint(file: UploadFile = File(...)):
    allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Please upload a PNG or JPG image of the ECG.")
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    try:
        result = analyze_ecg(file_bytes, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ECG analysis failed: {str(e)}")
    return {"success": True, "analysis": result}


# ── X-Ray ─────────────────────────────────────────────────────────────────────
@app.post("/analyze-xray")
async def analyze_xray_endpoint(file: UploadFile = File(...)):
    allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Please upload a PNG or JPG X-ray image.")
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    try:
        result = analyze_xray(file_bytes, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"X-ray analysis failed: {str(e)}")
    return {"success": True, "analysis": result}
