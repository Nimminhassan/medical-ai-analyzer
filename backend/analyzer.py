import os
import json
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def build_lifestyle_summary(lifestyle: dict) -> str:
    if not lifestyle:
        return ""
    lines = ["\n=== PATIENT LIFESTYLE PROFILE ==="]
    mapping = {
        "smoking":      ("Smoking",         {"never": "Non-smoker", "occasionally": "Occasional smoker", "regularly": "Regular smoker", "heavy": "Heavy smoker (>10/day)", "ex_smoker": "Ex-smoker"}),
        "alcohol":      ("Alcohol",          {"never": "Non-drinker", "occasionally": "Occasional (1-2x/month)", "regularly": "Regular (1-2x/week)", "frequently": "Frequent (3+/week)"}),
        "junk_food":    ("Junk Food",        {"rarely": "Rarely eats junk", "sometimes": "1-2x/week", "often": "3-4x/week", "daily": "Daily junk food"}),
        "exercise":     ("Exercise",         {"daily": "Daily exercise", "often": "3-5x/week", "sometimes": "1-2x/week", "rarely": "Rarely", "never": "Sedentary lifestyle"}),
        "sleep":        ("Sleep",            {"less5": "<5 hrs/night (severe deprivation)", "five_six": "5-6 hrs/night (below recommended)", "seven_eight": "7-8 hrs/night (optimal)", "more9": ">9 hrs/night"}),
        "stress":       ("Stress Level",     {"low": "Low stress", "moderate": "Moderate stress", "high": "High stress", "very_high": "Very high / chronic stress"}),
        "water":        ("Water Intake",     {"less1": "<1L/day (dehydrated)", "one_two": "1-2L/day", "two_three": "2-3L/day", "more3": ">3L/day (well hydrated)"}),
        "family_history": ("Family History", None),
    }
    for key, (label, options) in mapping.items():
        value = lifestyle.get(key)
        if not value:
            continue
        if key == "family_history":
            if isinstance(value, list) and value:
                lines.append(f"  • {label}: {', '.join(value)}")
        elif options and value in options:
            lines.append(f"  • {label}: {options[value]}")

    lines.append("\nUse the lifestyle profile to ADJUST risk levels:")
    lines.append("  - Smoking significantly raises Cardiovascular, Lung, and Metabolic risk")
    lines.append("  - Heavy alcohol raises Liver Disease and Cardiovascular risk")
    lines.append("  - Sedentary lifestyle + junk food raises Diabetes and Metabolic Syndrome risk")
    lines.append("  - Family history of a disease raises that disease's risk by one level if lab data is borderline")
    lines.append("  - Poor sleep + high stress raises Cardiovascular and Metabolic risk")
    lines.append("  - Low water intake raises Kidney Disease risk")
    return "\n".join(lines)


SYSTEM_PROMPT = """
You are a medical AI assistant analyzing laboratory reports combined with patient lifestyle data.
Assess disease risk using BOTH lab values AND lifestyle factors together.

CRITICAL RULES:
- ALWAYS give a prediction for all 10 diseases — never skip any.
- Use lab values as the PRIMARY signal. Use lifestyle as a MODIFIER.
- If a lab marker is borderline AND lifestyle is poor for that disease → raise to next risk level.
- If lab markers are normal BUT lifestyle is very poor → flag as MODERATE RISK with explanation.
- If no relevant lab markers exist → use lifestyle alone to estimate risk, clearly stating this.
- HIGH RISK requires strong lab evidence OR borderline lab + severely poor lifestyle.
- LOW RISK means normal labs AND reasonable lifestyle for that disease.
- Be specific — always cite the exact lab value OR the lifestyle factor driving the risk.
- Never assign HIGH RISK based on lifestyle alone — maximum MODERATE RISK without lab evidence.
- Be conservative and accurate — do not over-diagnose.

risk_level: "HIGH RISK" | "MODERATE RISK" | "LOW RISK"
risk_color: "red" | "orange" | "green"

Respond in ONLY valid JSON, no markdown, no extra text.

{
  "patient_summary": "Summary of key lab findings and notable lifestyle factors",
  "diseases": [
    {
      "disease": "Disease Name",
      "risk_level": "HIGH RISK | MODERATE RISK | LOW RISK",
      "risk_color": "red | orange | green",
      "key_indicators": ["Lab value or lifestyle factor driving this risk"],
      "reasoning": "Explain using both lab values AND lifestyle factors. Be specific.",
      "lifestyle_contribution": "How lifestyle specifically affected this risk level",
      "lifestyle_tips": ["3 specific actionable tips for HIGH/MODERATE, 1 general tip for LOW"],
      "dietary_advice": ["Specific dietary advice based on this patient's profile"],
      "quick_remedy": "Single most important action for HIGH/MODERATE. Empty string for LOW."
    }
  ],
  "disclaimer": "This is not a medical diagnosis. Please consult a qualified healthcare provider.",
  "overall_health_note": "Key observations about this patient's overall health picture"
}

Disease markers (use primary first, fallback if primary missing):
1. Type 2 Diabetes — Primary: HbA1c, Fasting Glucose | Fallback: Random Glucose, BMI, lifestyle
2. Cardiovascular Disease — Primary: LDL, HDL, Cholesterol, Triglycerides | Fallback: CRP, lifestyle (smoking, stress)
3. Chronic Kidney Disease — Primary: Creatinine, eGFR, BUN | Fallback: Uric Acid, water intake
4. Liver Disease — Primary: ALT, AST, ALP, GGT | Fallback: Bilirubin, alcohol consumption
5. Anemia — Primary: Hemoglobin, Hematocrit, RBC | Fallback: MCV, MCH, diet quality
6. Thyroid Dysfunction — Primary: TSH, T3, T4 | Fallback: Symptoms, stress levels
7. Vitamin D Deficiency — Primary: 25-OH Vitamin D | Fallback: Calcium, sun exposure (lifestyle)
8. Iron Deficiency — Primary: Serum Iron, Ferritin, TIBC | Fallback: Hemoglobin, MCV, diet
9. High Cholesterol — Primary: Total Cholesterol, LDL, HDL | Fallback: Triglycerides, lifestyle
10. Metabolic Syndrome — Primary: Glucose, Triglycerides, HDL, BP | Fallback: BMI, lifestyle combo
"""

def analyze_lab_report(lab_text: str, lifestyle: dict = None) -> dict:
    if not lab_text or len(lab_text.strip()) < 50:
        raise ValueError("Lab report text is too short or empty.")

    lifestyle_summary = build_lifestyle_summary(lifestyle or {})

    user_message = f"Analyze this lab report and patient lifestyle profile. Return ONLY JSON:\n\n=== LAB REPORT ===\n{lab_text}"
    if lifestyle_summary:
        user_message += f"\n\n{lifestyle_summary}"

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message}
        ],
        temperature=0.1,
        max_tokens=3000,
        response_format={"type": "json_object"}
    )

    text = response.choices[0].message.content
    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            raise ValueError("Could not parse analysis response.")
    return result