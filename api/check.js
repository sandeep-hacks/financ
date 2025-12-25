import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const prompt = `You are a financial safety assistant for Indian students. Analyze this suspicious message and provide results in this EXACT format:

Explanation
[Explain in 2-3 sentences why this message is or isn't suspicious. Mention specific red flags found.]

Safety Tips
[Provide 4-5 actionable safety tips as bullet points. Each tip should start with a verb and be practical for Indian students.]

Message to analyze: ${message}

Remember: Keep the response clear, practical, and focused on financial safety for students.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the response into structured format
    const lines = text.split('\n');
    let explanation = '';
    let safetyTips = [];
    let currentSection = '';

    for (const line of lines) {
      if (line.toLowerCase().includes('explanation')) {
        currentSection = 'explanation';
      } else if (line.toLowerCase().includes('safety tips')) {
        currentSection = 'safetyTips';
      } else if (currentSection === 'explanation' && line.trim()) {
        explanation += line + ' ';
      } else if (currentSection === 'safetyTips' && line.trim() && (line.includes('-') || line.includes('•') || line.includes('1.') || line.includes('2.'))) {
        // Clean the bullet point
        const cleanTip = line.replace(/^[\-\•\d\.\s]+/, '').trim();
        if (cleanTip) safetyTips.push(cleanTip);
      }
    }

    // Fallback if parsing fails
    if (!explanation || safetyTips.length === 0) {
      const parts = text.split('Safety Tips');
      if (parts.length === 2) {
        explanation = parts[0].replace('Explanation', '').trim();
        const tipsText = parts[1];
        safetyTips = tipsText.split('\n')
          .filter(line => line.trim() && (line.includes('-') || line.includes('•') || line.includes('1.') || line.includes('2.')))
          .map(line => line.replace(/^[\-\•\d\.\s]+/, '').trim());
      }
    }

    // Final fallback
    if (!explanation) explanation = text;
    if (safetyTips.length === 0) {
      safetyTips = [
        "Never share personal or financial information via SMS or WhatsApp",
        "Verify any claims directly with your bank or financial institution",
        "Avoid clicking on links in unsolicited messages",
        "Check for spelling and grammar errors which are common in scams"
      ];
    }

    return res.status(200).json({
      explanation: explanation.trim(),
      safetyTips: safetyTips.filter(tip => tip.length > 0)
    });

  } catch (err) {
    console.error("Gemini API error:", err);
    return res.status(500).json({ 
      error: "AI analysis error",
      fallback: {
        explanation: "Unable to analyze the message due to technical issues. Here's general advice:",
        safetyTips: [
          "Never share OTPs, passwords, or PINs with anyone",
          "Verify any unexpected messages directly with your bank",
          "Don't click on suspicious links",
          "Be wary of 'too good to be true' offers"
        ]
      }
    });
  }
}