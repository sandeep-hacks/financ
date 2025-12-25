import { GoogleGenerativeAI } from "@google/generative-ai";

// Get API key from environment
const apiKey = process.env.GEMINI_API_KEY;

// Log for debugging (remove in production if needed)
console.log("Gemini API Key Present:", !!apiKey);

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY environment variable is not set!");
  console.error("Please set GEMINI_API_KEY in Vercel environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey || "dummy-key-for-init");

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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

    // Check if API key is configured
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Gemini API key is not configured. Please check server settings.',
        fallback: true
      });
    }

    console.log(`📨 Received message to analyze (${message.length} chars):`, 
                message.substring(0, 100) + (message.length > 100 ? '...' : ''));

    // ✅ FIXED: Use correct Gemini model names
    // Available models: 
    // - gemini-1.5-flash (fast, cheap, good for this use case)
    // - gemini-1.5-pro (more capable, slightly slower)
    // - gemini-1.0-pro (legacy)
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // ✅ Changed from gemini-2.5-flash
      generationConfig: {
        temperature: 0.2, // Lower temperature for more consistent outputs
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `You are a financial safety expert specializing in Indian student scams.
    
    Analyze the following message for potential scams, fraud, or suspicious financial activities.
    
    IMPORTANT: Respond in EXACTLY this format:

    EXPLANATION:
    [Provide a concise analysis here. Identify if it's a scam or safe. Mention specific red flags or safe indicators.
    Focus on Indian context - mention UPI, OTP, KYC, Indian bank names if relevant.]

    SAFETY TIPS:
    - [Tip 1 for Indian students]
    - [Tip 2 for Indian students]
    - [Tip 3 for Indian students]
    - [Tip 4 for Indian students]

    The message to analyze: "${message}"

    Rules:
    1. If message is clearly safe (like normal conversation), say it's safe
    2. If message has scam indicators, explain them clearly
    3. Tips must be specific to Indian students/young adults
    4. Use simple, clear language
    5. Don't add any other text outside the format`;

    console.log('🤖 Calling Gemini API...');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini API Response received');
    console.log('Response preview:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));

    // Parse the response - more robust parsing
    const lines = text.split('\n');
    let explanation = '';
    let safetyTips = [];
    let currentSection = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      // Check for section headers
      if (line.toLowerCase().startsWith('explanation')) {
        currentSection = 'explanation';
        // Remove "EXPLANATION:" or "Explanation:" etc.
        explanation = line.replace(/^explanation\s*:?\s*/i, '');
      } else if (line.toLowerCase().includes('safety tip')) {
        currentSection = 'safetyTips';
        // Skip the header line
        continue;
      } else if (currentSection === 'explanation') {
        explanation += (explanation ? ' ' : '') + line;
      } else if (currentSection === 'safetyTips') {
        // Handle bullet points with various formats
        const cleanLine = line.replace(/^[-\•*]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
        if (cleanLine && cleanLine.length > 5) { // Minimum length check
          safetyTips.push(cleanLine);
        }
      }
    }

    // Clean up explanation
    explanation = explanation.trim();
    
    // If we didn't get enough safety tips, add defaults
    if (safetyTips.length < 2) {
      console.log('⚠️ Not enough safety tips, adding defaults');
      safetyTips = [
        "Never share OTP, UPI PIN, or CVV with anyone - banks never ask for these",
        "Verify offers by contacting the organization through official website/phone",
        "Check URLs carefully - scammers use fake websites that look real",
        "If an offer seems too good to be true, it's probably a scam",
        "Enable two-factor authentication on all financial apps"
      ];
    }

    // Determine verdict based on explanation content
    let verdict = "Possibly Safe";
    let badgeClass = "safe";
    let verdictText = "This message appears to be safe";

    const lowerExplanation = explanation.toLowerCase();
    
    // Check for strong scam indicators
    const strongScamIndicators = [
      'definitely a scam', 
      'is a scam', 
      'fraudulent', 
      'do not trust',
      'malicious',
      'phishing',
      'steal your money',
      'fake website',
      'impersonating'
    ];
    
    // Check for warning indicators
    const warningIndicators = [
      'suspicious',
      'be cautious',
      'potential scam',
      'might be a scam',
      'red flag',
      'warning',
      'exercise caution'
    ];
    
    // Check for safe indicators
    const safeIndicators = [
      'appears safe',
      'legitimate',
      'genuine',
      'no scam indicators',
      'normal message',
      'safe to proceed'
    ];
    
    let strongScamCount = 0;
    let warningCount = 0;
    let safeCount = 0;
    
    strongScamIndicators.forEach(indicator => {
      if (lowerExplanation.includes(indicator)) strongScamCount++;
    });
    
    warningIndicators.forEach(indicator => {
      if (lowerExplanation.includes(indicator)) warningCount++;
    });
    
    safeIndicators.forEach(indicator => {
      if (lowerExplanation.includes(indicator)) safeCount++;
    });
    
    // Determine verdict
    if (strongScamCount >= 1) {
      verdict = "Likely Scam";
      badgeClass = "danger";
      verdictText = "⚠️ DANGER! This message shows strong signs of being a financial scam";
    } else if (warningCount >= 2 || (warningCount >= 1 && strongScamCount >= 1)) {
      verdict = "Suspicious";
      badgeClass = "warning";
      verdictText = "⚠️ This message contains suspicious elements - proceed with caution";
    } else if (safeCount >= 2) {
      verdict = "Possibly Safe";
      badgeClass = "safe";
      verdictText = "This message appears to be safe";
    } else {
      // Default based on general sentiment
      if (lowerExplanation.includes('scam') || lowerExplanation.includes('fraud')) {
        verdict = "Suspicious";
        badgeClass = "warning";
        verdictText = "⚠️ This message contains suspicious elements";
      }
    }

    console.log('📊 Analysis complete:', { 
      verdict, 
      badgeClass, 
      explanationLength: explanation.length,
      tipsCount: safetyTips.length 
    });

    return res.status(200).json({
      success: true,
      verdict,
      verdictText,
      badgeClass,
      explanation,
      safetyTips,
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Gemini API Error:', {
      message: error.message,
      stack: error.stack,
      apiKeyConfigured: !!apiKey
    });
    
    // Provide fallback response
    return res.status(500).json({ 
      error: "API service temporarily unavailable",
      message: "Using offline analysis",
      fallback: true,
      verdict: "Analysis Error",
      verdictText: "⚠️ Service temporarily unavailable - using basic analysis",
      badgeClass: "warning",
      explanation: "We're having trouble connecting to our AI service. Please be extra cautious with this message.",
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
