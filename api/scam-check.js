import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get the Gemini Pro model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
    Analyze the following message for potential financial scams. Provide your analysis in EXACTLY this format:
    
    Explanation
    [Your explanation here. Explain why this message is or isn't a scam. Mention specific red flags or safe indicators. Keep it concise but informative.]
    
    Safety Tips
    [Provide 4-5 actionable safety tips. Each tip should be on a new line starting with "- ". Make them practical and specific for Indian students.]

    The message to analyze: "${message}"
    
    Important: Follow the format exactly as shown above with "Explanation" and "Safety Tips" headings.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the response to separate explanation and safety tips
    const lines = text.split('\n');
    let explanation = '';
    let safetyTips = [];
    let isExplanationSection = false;
    let isSafetyTipsSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toLowerCase().startsWith('explanation')) {
        isExplanationSection = true;
        isSafetyTipsSection = false;
        explanation = trimmedLine.replace(/^explanation\s*:?\s*/i, '');
      } else if (trimmedLine.toLowerCase().startsWith('safety tips')) {
        isExplanationSection = false;
        isSafetyTipsSection = true;
      } else if (isExplanationSection && trimmedLine) {
        explanation += ' ' + trimmedLine;
      } else if (isSafetyTipsSection && trimmedLine) {
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
          safetyTips.push(trimmedLine.substring(1).trim());
        } else if (/^\d+\./.test(trimmedLine)) {
          safetyTips.push(trimmedLine.replace(/^\d+\.\s*/, '').trim());
        }
      }
    }

    // Clean up explanation
    explanation = explanation.trim();

    // If we didn't get safety tips in the expected format, create some default ones
    if (safetyTips.length === 0) {
      safetyTips = [
        "Verify the sender's identity through official channels",
        "Look for spelling and grammar errors which are common in scams",
        "Check if the offer seems too good to be true (it probably is)",
        "Contact the organization directly using contact info from their official website",
        "Never share OTP, PIN, or password with anyone"
      ];
    }

    // Determine a verdict based on the explanation
    let verdict = "Possibly Safe";
    let badgeClass = "safe";
    let verdictText = "This message appears to be safe";

    const lowerExplanation = explanation.toLowerCase();
    if (lowerExplanation.includes('scam') || 
        lowerExplanation.includes('fraud') || 
        lowerExplanation.includes('suspicious') ||
        lowerExplanation.includes('dangerous') ||
        lowerExplanation.includes('malicious')) {
      
      if (lowerExplanation.includes('likely') || 
          lowerExplanation.includes('probably') ||
          lowerExplanation.includes('high risk')) {
        verdict = "Likely Scam";
        badgeClass = "danger";
        verdictText = "⚠️ DANGER! This message shows strong signs of being a financial scam";
      } else {
        verdict = "Suspicious";
        badgeClass = "warning";
        verdictText = "⚠️ This message contains suspicious elements - proceed with caution";
      }
    }

    return res.status(200).json({
      verdict,
      verdictText,
      badgeClass,
      explanation,
      safetyTips
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ 
      error: "Failed to analyze message",
      message: error.message 
    });
  }
}