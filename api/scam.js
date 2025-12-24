import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      Analyze this message for financial scams targeting Indian users:
      "${message}"
      
      Respond in this exact JSON format:
      {
        "verdict": "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "SAFE",
        "confidence": 0-100,
        "explanation": "Brief explanation",
        "redFlags": ["array", "of", "red", "flags"],
        "safetyTips": ["array", "of", "tips"],
        "scamType": "LOAN_SCAM" | "INVESTMENT_SCAM" | "BANKING_SCAM" | "JOB_SCAM" | "PHISHING" | "UNKNOWN"
      }
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to extract JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : createFallbackResponse();
      
      return res.status(200).json({
        ...parsed,
        mode: "gemini"
      });
    } catch (parseError) {
      return res.status(200).json(createFallbackResponse());
    }
    
  } catch (error) {
    console.error('Scam analysis error:', error);
    return res.status(500).json(createFallbackResponse());
  }
}

function createFallbackResponse() {
  return {
    verdict: "MEDIUM_RISK",
    confidence: 65,
    explanation: "Analysis service temporarily unavailable. Please verify manually.",
    redFlags: ["Service unavailable"],
    safetyTips: [
      "Verify through official bank channels",
      "Do not share personal information",
      "Contact bank directly if unsure"
    ],
    scamType: "UNKNOWN"
  };
}