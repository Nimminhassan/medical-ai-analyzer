import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    system_instruction="""
You are MediBot — a warm, knowledgeable, and caring health assistant. 
You're like a doctor friend who explains things clearly without being cold or clinical.

YOUR PERSONALITY:
- Warm, empathetic, and encouraging — never robotic or dismissive
- Use simple everyday language, not heavy medical jargon
- Be specific and direct — never give vague non-answers like "it depends" or "consult a doctor" alone
- Show genuine concern for the patient's wellbeing
- Use light encouragement — e.g. "The good news is..." or "This is very manageable..."
- Keep responses focused: 3-5 sentences for simple questions, a short structured list for complex ones
- Never start with "Certainly!", "Of course!", "Great question!" — just answer naturally

WHAT YOU CAN DO:
- Explain what specific lab values mean in plain language
- Give practical, specific diet and lifestyle advice based on the patient's actual results
- Explain what a disease risk means and how serious it is
- Suggest what type of doctor to see for specific findings
- Answer general health questions naturally

WHAT YOU MUST NOT DO:
- Never make a definitive diagnosis
- Never say things are "fine" if the report shows otherwise
- Never give the same generic advice regardless of the actual report values
- Never just say "please consult a doctor" without also giving useful information
- Never repeat the same phrase across responses

RESPONSE FORMAT:
- For simple factual questions: 2-3 sentences, conversational
- For advice questions: start with a direct answer, then 2-3 specific bullet points
- For serious findings: acknowledge the concern empathetically first, then explain clearly
- Use **bold** only for the most important word or phrase, not for whole sentences
"""
)

def build_context_text(lab_text: str = None, analysis: dict = None) -> str:
    """Build a concise patient context string."""
    context = ""

    if analysis:
        diseases = analysis.get("diseases", [])
        high    = [d for d in diseases if d.get("risk_level") == "HIGH RISK"]
        moderate = [d for d in diseases if d.get("risk_level") == "MODERATE RISK"]
        low     = [d for d in diseases if d.get("risk_level") == "LOW RISK"]
        missing = [d for d in diseases if d.get("risk_level") == "INSUFFICIENT DATA"]

        context += f"\n=== THIS PATIENT'S REPORT SUMMARY ===\n"
        context += f"{analysis.get('patient_summary', '')}\n\n"

        if high:
            context += "HIGH RISK findings:\n"
            for d in high:
                indicators = ", ".join(d.get("key_indicators", []))
                context += f"  • {d['disease']}: {d.get('reasoning', '')} [{indicators}]\n"

        if moderate:
            context += "\nMODERATE RISK findings:\n"
            for d in moderate:
                indicators = ", ".join(d.get("key_indicators", []))
                context += f"  • {d['disease']}: {d.get('reasoning', '')} [{indicators}]\n"

        if low:
            context += f"\nLOW RISK: {', '.join([d['disease'] for d in low])}\n"

        if missing:
            context += f"\nINSUFFICIENT DATA for: {', '.join([d['disease'] for d in missing])}\n"

    if lab_text:
        trimmed = lab_text[:2000] + "..." if len(lab_text) > 2000 else lab_text
        context += f"\n=== RAW LAB VALUES (use for specific questions) ===\n{trimmed}\n"

    return context


def chat_with_bot(message: str, history: list, lab_text: str = None, analysis: dict = None) -> str:
    """Send a message to Gemini with full patient context."""

    patient_context = build_context_text(lab_text, analysis)

    # Build the conversation history for Gemini
    gemini_history = []

    # Inject patient context as the very first user/model exchange
    # so it's always in scope throughout the conversation
    if patient_context:
        gemini_history.append({
            "role": "user",
            "parts": [f"Here is the patient's lab report context for our conversation:\n{patient_context}"]
        })
        gemini_history.append({
            "role": "model",
            "parts": ["Got it — I've reviewed this patient's lab results and I'm ready to help answer questions about them."]
        })

    # Add conversation history (last 10 messages)
    for msg in history[-10:]:
        role = "user" if msg.role == "user" else "model"
        gemini_history.append({"role": role, "parts": [msg.content]})

    # Start a chat session with history
    chat_session = model.start_chat(history=gemini_history)

    # Send the current message
    response = chat_session.send_message(message)
    return response.text