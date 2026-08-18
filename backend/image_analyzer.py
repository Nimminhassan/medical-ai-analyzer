import os
import json
import re
import base64
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

# ─────────────────────────────────────────────
# ECG ANALYZER
# ─────────────────────────────────────────────

ECG_PROMPT = """
You are a expert cardiologist AI assistant analyzing an ECG (electrocardiogram) image.

Analyze the ECG image carefully and respond in ONLY valid JSON with no extra text or markdown.

Focus on:
1. General ECG interpretation (rhythm, rate, axis, waveforms)
2. ST elevation or depression (heart attack / ischemia risk)
3. Any arrhythmias or conduction abnormalities visible

Use this exact JSON format:
{
  "ecg_summary": "One sentence overall interpretation of this ECG",
  "heart_rate_estimate": "e.g. 72 bpm (normal) or Unable to determine",
  "rhythm": "e.g. Normal Sinus Rhythm / Atrial Fibrillation / etc.",
  "overall_risk": "HIGH RISK | MODERATE RISK | LOW RISK",
  "findings": [
    {
      "finding": "Finding name",
      "status": "ABNORMAL | BORDERLINE | NORMAL",
      "severity": "HIGH | MODERATE | LOW | NONE",
      "description": "What was found and what it means clinically"
    }
  ],
  "st_analysis": {
    "st_elevation": "Present / Absent / Cannot determine",
    "st_depression": "Present / Absent / Cannot determine",
    "leads_affected": ["e.g. Lead II", "V1-V4"],
    "clinical_significance": "What the ST changes mean for the patient"
  },
  "urgent_flags": ["List any findings that need IMMEDIATE medical attention"],
  "recommendations": ["Practical next steps for the patient"],
  "disclaimer": "This ECG interpretation is AI-generated and must be confirmed by a qualified cardiologist."
}

If the image is not a valid ECG, return:
{"error": "The uploaded image does not appear to be an ECG. Please upload a clear ECG strip or 12-lead ECG image."}
"""

def analyze_ecg(image_bytes: bytes, mime_type: str) -> dict:
    """Analyze an ECG image using Gemini Vision."""
    image_part = {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}

    response = model.generate_content(
        [ECG_PROMPT, image_part],
        generation_config={"temperature": 0.1, "max_output_tokens": 2000}
    )

    text = response.text.strip()
    # Strip markdown code fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            raise ValueError("Could not parse ECG analysis response.")

    if "error" in result:
        raise ValueError(result["error"])

    return result


# ─────────────────────────────────────────────
# X-RAY ANALYZER
# ─────────────────────────────────────────────

XRAY_PROMPT = """
You are an expert radiologist AI assistant analyzing a medical X-ray image.

First determine what type of X-ray this is (chest, bone/skeletal, abdominal, or other).
Then analyze it thoroughly and respond in ONLY valid JSON — no extra text, no markdown.

Use this exact JSON format:
{
  "xray_type": "Chest X-ray | Bone X-ray | Abdominal X-ray | Other",
  "xray_summary": "One sentence overall interpretation",
  "overall_risk": "HIGH RISK | MODERATE RISK | LOW RISK",
  "image_quality": "Good | Fair | Poor — brief note on image quality",
  "findings": [
    {
      "region": "e.g. Right lung / Left femur / Abdomen",
      "finding": "Finding name e.g. Pleural effusion / Fracture / Consolidation",
      "status": "ABNORMAL | BORDERLINE | NORMAL",
      "severity": "HIGH | MODERATE | LOW | NONE",
      "description": "Detailed description of what is seen and clinical significance"
    }
  ],
  "type_specific_analysis": {
    "chest": {
      "lungs": "Description of lung fields",
      "heart_size": "Normal / Enlarged / Cannot assess",
      "pleura": "Normal / Abnormal findings",
      "bones_visible": "Any rib or clavicle findings",
      "mediastinum": "Normal / Widened / Other"
    },
    "bone": {
      "fracture_present": "Yes / No / Suspected",
      "fracture_location": "Specific location or N/A",
      "bone_density": "Normal / Reduced (osteopenia) / Cannot assess",
      "joint_spaces": "Normal / Narrowed / Other",
      "soft_tissue": "Normal / Swelling noted"
    },
    "abdominal": {
      "bowel_gas_pattern": "Normal / Abnormal",
      "organomegaly": "None / Liver enlarged / Spleen enlarged",
      "calcifications": "None / Present (describe)",
      "free_air": "Absent / Present (emergency)"
    }
  },
  "urgent_flags": ["List any critical findings requiring immediate attention"],
  "recommendations": ["Next steps — follow-up imaging, specialist referral, etc."],
  "disclaimer": "This X-ray analysis is AI-generated and must be confirmed by a qualified radiologist."
}

If the image is not a valid X-ray, return:
{"error": "The uploaded image does not appear to be a medical X-ray. Please upload a valid X-ray image."}
"""

def analyze_xray(image_bytes: bytes, mime_type: str) -> dict:
    """Analyze an X-ray image using Gemini Vision."""
    image_part = {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}

    response = model.generate_content(
        [XRAY_PROMPT, image_part],
        generation_config={"temperature": 0.1, "max_output_tokens": 2500}
    )

    text = response.text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            raise ValueError("Could not parse X-ray analysis response.")

    if "error" in result:
        raise ValueError(result["error"])

    return result