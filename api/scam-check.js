import { GoogleGenerativeAI } from "@google/generative-ai";

// Get API key from environment
const apiKey = process.env.GEMINI_API_KEY;

// Validate API key on startup
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY environment variable is not set!");
  console.error("Please set GEMINI_API_KEY in Vercel environment variables");
}

let genAI = null;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

export default async function handler(req, res) {
  // Configure CORS - update with your frontend URL
  const allowedOrigins = ['https://your-frontend.com', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted' 
    });
  }

  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        error: 'Message is required',
        message: 'Please provide a message to analyze' 
      });
    }

    // Validate message length
    if (message.length > 5000) {
      return res.status(400).json({ 
        error: 'Message too long',
        message: 'Please keep messages under 5000 characters' 
      });
    }

    // Check if API key and client are configured
    if (!apiKey || !genAI) {
      console.error('GEMINI_API_KEY is not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Gemini API key is not configured. Please check server settings.',
        fallback: true
      });
    }

    console.log(`📨 Received message to analyze (${message.length} chars):`, 
                message.substring(0, 100) + (message.length > 100 ? '...' : ''));

    // Use Gemini model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7, // Increased for better nuance in scam detection
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `You are a financial safety expert specializing in Indian student scams.
    
Analyze the following message for potential scams, fraud, or suspicious financial activities. Focus on common Indian scams: UPI fraud, fake job offers, scholarship scams, KYC update scams, etc.

CRITICAL: Respond in EXACTLY this JSON format:
{
  "explanation": "Your analysis here. Mention specific red flags or why it's safe. Keep it concise.",
  "safetyTips": [
    "Tip 1 for Indian students",
    "Tip 2 for Indian students",
    "Tip 3 for Indian students",
    "Tip 4 for Indian students"
  ],
  "confidence": "high|medium|low",
  "verdict": "likely_scam|suspicious|possibly_safe|safe"
}

Rules:
1. If message is clearly safe (normal conversation), mark as "safe"
2. If message has scam indicators, explain them clearly
3. Tips must be specific to Indian students/young adults
4. Use simple, clear language
5. Focus on Indian context - mention UPI, OTP, KYC, RBI guidelines, etc.

The message to analyze: "${message}"`;

    console.log('🤖 Calling Gemini API...');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini API Response received');
    
    // Try to parse as JSON first
    let parsedResponse;
    try {
      // Extract JSON from response (might have extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback parsing:', parseError.message);
      
      // Fallback to text parsing
      parsedResponse = {
        explanation: text.split('\n')[0] || 'Analysis not available',
        safetyTips: [
          "Never share OTP, UPI PIN, or CVV with anyone",
          "Verify offers by contacting organization through official channels",
          "Check URLs carefully for spelling mistakes",
          "Enable two-factor authentication on financial apps"
        ],
        confidence: "medium",
        verdict: "suspicious"
      };
    }

    // Validate and sanitize response
    const explanation = parsedResponse.explanation || text.substring(0, 200);
    let safetyTips = Array.isArray(parsedResponse.safetyTips) 
      ? parsedResponse.safetyTips.slice(0, 5) 
      : [
          "Never share OTP, UPI PIN, or CVV with anyone",
          "Verify offers by contacting organization through official channels",
          "Check URLs carefully for spelling mistakes",
          "Enable two-factor authentication on financial apps"
        ];

    // Map verdict to UI properties
    const verdictMapping = {
      'likely_scam': { verdict: "Likely Scam", badgeClass: "danger", verdictText: "⚠️ DANGER! This appears to be a financial scam" },
      'suspicious': { verdict: "Suspicious", badgeClass: "warning", verdictText: "⚠️ This message contains suspicious elements" },
      'possibly_safe': { verdict: "Possibly Safe", badgeClass: "safe", verdictText: "This message appears to be safe" },
      'safe': { verdict: "Safe", badgeClass: "safe", verdictText: "✅ This message appears safe" }
    };

    const verdictKey = parsedResponse.verdict || 'suspicious';
    const verdictInfo = verdictMapping[verdictKey] || verdictMapping.suspicious;

    console.log('📊 Analysis complete:', { 
      verdict: verdictInfo.verdict, 
      confidence: parsedResponse.confidence || 'medium'
    });

    return res.status(200).json({
      success: true,
      ...verdictInfo,
      explanation,
      safetyTips,
      confidence: parsedResponse.confidence || 'medium',
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error:', {
      message: error.message,
      stack: error.stack,
      apiKeyConfigured: !!apiKey
    });
    
    // Provide fallback response
    return res.status(500).json({ 
      error: "API service temporarily unavailable",
      message: error.message,
      fallback: true,
      verdict: "Analysis Error",
      verdictText: "⚠️ Service temporarily unavailable",
      badgeClass: "warning",
      explanation: "We're having trouble analyzing this message. Please be cautious.",
      safetyTips: [
        "Never share personal or financial information via SMS/WhatsApp",
        "Verify all financial offers through official channels",
        "Contact your bank directly using official customer service numbers",
        "Enable two-factor authentication on all accounts",
        "Report suspicious messages to Cyber Crime Police (1930)"
      ]
    });
  }
}
