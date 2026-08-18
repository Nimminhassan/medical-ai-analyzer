import os
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

import fitz  # PyMuPDF
import easyocr
from PIL import Image
import io
import numpy as np

# Initialize once — downloads models on first run (~100MB, one time only)
ocr_engine = easyocr.Reader(['en'], gpu=False)  # gpu=True if you have NVIDIA GPU

def extract_text_from_image_array(img_array: np.ndarray) -> str:
    """Run EasyOCR on a numpy image array."""
    results = ocr_engine.readtext(img_array)
    lines = []
    for (bbox, text, confidence) in results:
        if confidence > 0.4:  # Filter low-confidence reads
            lines.append(text)
    return "\n".join(lines)

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF lab report."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        page_text = page.get_text()
        if page_text.strip():
            # Embedded text — fastest and most accurate
            full_text += page_text
        else:
            # Scanned page — render to image and OCR
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            full_text += extract_text_from_image_array(np.array(image))
    return full_text.strip()

def extract_text_from_image(file_bytes: bytes) -> str:
    """Extract text from an image lab report using EasyOCR."""
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return extract_text_from_image_array(np.array(image))

def extract_text(file_bytes: bytes, filename: str) -> str:
    """Route to correct extractor based on file type."""
    filename_lower = filename.lower()
    if filename_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif filename_lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        return extract_text_from_image(file_bytes)
    else:
        raise ValueError("Unsupported file type. Please upload PDF or image.")