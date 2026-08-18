# 🧬 Medical AI Analyzer

A full-stack AI application for comprehensive health risk assessment combining **lab reports**, **ECG analysis**, **X-ray analysis** and **lifestyle questionnaire**

## Features

- 🧪 **Lab Report Analysis** — Upload PDF/image lab reports; AI assesses risk for 10 diseases
- ❤️ **ECG Analysis** — AI interprets ECG images for rhythm, ST changes, and arrhythmias
- 🩻 **X-Ray Analysis** — Supports chest, bone, and abdominal X-rays with auto-detection
- 📋 **Lifestyle Questionnaire** — Smoking, alcohol, diet, exercise, sleep, stress, water intake
- 🤖 **MediBot** — Context-aware AI chatbot that knows your full report and answers health questions
- ⚡ **Quick Action Summary** — Highlights the most critical findings with specialist referral suggestions

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Axios |
| Backend | FastAPI, Python, Uvicorn |
| OCR | EasyOCR, PyMuPDF |
| AI (Text) | Groq API — Llama 3.3 70B |
| AI (Vision) | Google Gemini 2.5 Flash |
| AI (Chat) | Google Gemini 2.5 Flash |

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/Nimminhassan/medical-ai-analyzer.git
cd medical-ai-analyzer
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

### 3. Create `.env` file in `/backend`
```env
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Run the backend
```bash
uvicorn main:app --reload --port 8000
```

### 5. Frontend setup
```bash
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/extract` | OCR text extraction from lab report |
| POST | `/analyze-combined` | Lab + lifestyle + genetic combined analysis |
| POST | `/analyze-ecg` | ECG image analysis |
| POST | `/analyze-xray` | X-ray image analysis |
| POST | `/chat` | MediBot contextual chat |


## Disclaimer

This application is for educational purposes only. It does not provide medical diagnoses. Always consult a qualified healthcare professional.