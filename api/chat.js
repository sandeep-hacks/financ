import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are FinSafe AI, a financial safety assistant for Indian students."
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI error" });
  }
}
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Create a detailed prompt for financial scam detection
    const prompt = `You are FinSafe AI, a financial safety assistant for Indian students and first-time earners. Analyze the following message for potential scams and provide a response in this EXACT format:

EXPLANATION: [Your detailed explanation of why this message might be a scam, focusing on specific red flags found in the message. Mention common Indian financial scam patterns if relevant.]

SAFETY TIPS:
1. [First safety tip - specific and actionable]
2. [Second safety tip - specific and actionable]
3. [Third safety tip - specific and actionable]
4. [Fourth safety tip - specific and actionable]

Message to analyze: "${message}"

Important guidelines:
1. Focus on Indian financial scams targeting students and young earners
2. Identify specific red flags like urgency, too-good-to-be-true offers, suspicious links, requests for personal information, etc.
3. Provide actionable advice that is specific to Indian context
4. Use simple, clear language suitable for students
5. If the message is safe, still provide safety tips for caution`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the response into structured format
    const parts = parseGeminiResponse(text);

    return res.status(200).json({
      reply: text,
      explanation: parts.explanation,
      safetyTips: parts.safetyTips,
      verdict: parts.verdict || "Needs Analysis",
      riskLevel: parts.riskLevel || "medium"
    });

  } catch (err) {
    console.error("Gemini API Error:", err);
    
    // Fallback response
    return res.status(500).json({
      reply: `EXPLANATION: Unable to analyze message due to technical issues. Please be cautious with financial messages.\n\nSAFETY TIPS:\n1. Never share OTPs, passwords, or PINs via SMS or WhatsApp\n2. Verify any claims directly with your bank's official website\n3. Avoid clicking links in unsolicited messages\n4. Check sender details carefully`,
      explanation: "Technical error prevented analysis. Please exercise caution.",
      safetyTips: [
        "Never share OTPs, passwords, or PINs via SMS or WhatsApp",
        "Verify any claims directly with your bank's official website",
        "Avoid clicking links in unsolicited messages",
        "Check sender details carefully"
      ],
      verdict: "Analysis Unavailable",
      riskLevel: "medium"
    });
  }
}

// Helper function to parse Gemini response
function parseGeminiResponse(text) {
  try {
    const lines = text.split('\n');
    let explanation = '';
    let safetyTips = [];
    let verdict = '';
    let riskLevel = 'medium';
    
    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('EXPLANATION:')) {
        currentSection = 'explanation';
        explanation = trimmed.replace('EXPLANATION:', '').trim();
      } else if (trimmed.startsWith('SAFETY TIPS:')) {
        currentSection = 'safetyTips';
      } else if (trimmed.match(/^\d+\./)) {
        // This is a numbered safety tip
        const tip = trimmed.replace(/^\d+\.\s*/, '').trim();
        if (tip) safetyTips.push(tip);
      } else if (currentSection === 'explanation' && trimmed && !explanation.endsWith(trimmed)) {
        explanation += ' ' + trimmed;
      }
    }
    
    // Clean up explanation
    explanation = explanation.replace(/\s+/g, ' ').trim();
    
    // Determine verdict based on keywords in explanation
    const lowerExplanation = explanation.toLowerCase();
    if (lowerExplanation.includes('scam') || 
        lowerExplanation.includes('fraud') || 
        lowerExplanation.includes('malicious') ||
        lowerExplanation.includes('dangerous')) {
      verdict = "HIGH RISK SCAM";
      riskLevel = "high";
    } else if (lowerExplanation.includes('suspicious') || 
               lowerExplanation.includes('warning') || 
               lowerExplanation.includes('caution')) {
      verdict = "SUSPICIOUS";
      riskLevel = "medium";
    } else if (lowerExplanation.includes('safe') || 
               lowerExplanation.includes('legitimate')) {
      verdict = "POSSIBLY SAFE";
      riskLevel = "low";
    } else {
      verdict = "NEEDS VERIFICATION";
      riskLevel = "medium";
    }
    
    return {
      explanation,
      safetyTips: safetyTips.length > 0 ? safetyTips : [
        "Verify sender identity through official channels",
        "Look for spelling and grammar errors common in scams",
        "Check if offer seems too good to be true",
        "Contact organization using official contact info"
      ],
      verdict,
      riskLevel
    };
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    return {
      explanation: "This message requires careful analysis. Always verify through official channels.",
      safetyTips: [
        "Never share personal or financial information",
        "Verify any claims directly with official sources",
        "Avoid clicking on links in unsolicited messages",
        "Check sender details carefully"
      ],
      verdict: "Analysis Error",
      riskLevel: "medium"
    };
  }
}