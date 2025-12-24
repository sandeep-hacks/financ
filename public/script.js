// Handle finance query with ChatGPT API
async function handleFinanceQuery() {
    const query = document.getElementById('financeSearch').value.trim();
    
    if (!query) {
        alert('Please enter a finance question.');
        return;
    }
    
    // Show loading state
    const askButton = document.getElementById('askButton');
    const originalContent = askButton.innerHTML;
    askButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    askButton.disabled = true;
    
    // Clear previous results
    const resultContainer = document.getElementById('aiResponseContainer');
    resultContainer.innerHTML = '';
    resultContainer.style.display = 'none';
    
    try {
        // First, test if server is reachable
        try {
            const testResponse = await fetch('http://localhost:3000/test', { 
                method: 'GET',
                timeout: 3000 
            });
            
            if (!testResponse.ok) {
                throw new Error('Server test failed');
            }
        } catch (testError) {
            console.log('Server test failed, showing offline mode');
            // Use offline mock response
            const offlineResponse = getOfflineResponse(query);
            displayAIResponse(query, offlineResponse);
            return;
        }
        
        // Call your backend API
        console.log('Sending request to server for query:', query);
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: query })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Display the response
        displayAIResponse(query, data.reply);
        
        // Clear search input
        document.getElementById('financeSearch').value = '';
        
    } catch (error) {
        console.error('Error details:', error);
        
        // Provide helpful error message
        let errorMessage = `Sorry, I encountered an error: ${error.message}\n\n`;
        errorMessage += "Possible solutions:\n";
        errorMessage += "1. Make sure your server is running (run: node server.js)\n";
        errorMessage += "2. Check if you have internet connection\n";
        errorMessage += "3. Verify your OpenAI API key in .env file\n\n";
        errorMessage += "For now, here's some general advice:\n";
        errorMessage += getOfflineResponse(query);
        
        displayAIResponse(query, errorMessage);
        
    } finally {
        // Reset button state
        askButton.innerHTML = originalContent;
        askButton.disabled = false;
    }
}

// Get offline response when server is not available
function getOfflineResponse(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('emi')) {
        return "EMI (Equated Monthly Installment) is a fixed monthly payment for loans. As a student, try to keep EMIs below 30% of your income. Tip: Consider longer tenures for lower EMIs but remember you'll pay more interest overall.";
    } else if (lowerQuery.includes('credit card')) {
        return "Credit cards can be risky due to high interest rates (18-42% in India). Always pay the full amount due each month to avoid interest charges. Tip: Set a spending limit below your actual credit limit.";
    } else if (lowerQuery.includes('scam')) {
        return "Common student scams: fake job offers, scholarship frauds, and phishing messages. Never share OTPs or banking details. Verify all offers through official channels.";
    } else if (lowerQuery.includes('save') || lowerQuery.includes('budget')) {
        return "Start with the 50-30-20 rule: 50% needs, 30% wants, 20% savings. Use budgeting apps and track every expense for a month to understand spending patterns.";
    } else if (lowerQuery.includes('loan') || lowerQuery.includes('debt')) {
        return "Student loans should ideally not exceed your expected first year's salary. Compare interest rates from different lenders and check for education loan subsidies.";
    } else {
        return "I understand you're asking about financial matters. For personalized advice, ensure the server is running and your OpenAI API key is properly configured. General tip: Always build an emergency fund of 3-6 months' expenses.";
    }
}
// ==============================================
// ENHANCED SCAM ANALYSIS FUNCTION
// ==============================================

function analyzeScamMessage(message) {
    const lowerMessage = message.toLowerCase();
    let matches = [];
    let totalScore = 0;
    let detectedPatterns = [];
    
    console.log('🔍 Analyzing message:', lowerMessage);
    
    // Check against each scam pattern
    for (const [patternId, pattern] of Object.entries(scamPatterns)) {
        let patternScore = 0;
        let matchedKeywords = [];
        
        // Check each keyword in the pattern - FIXED LOGIC
        pattern.keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            
            // Check for exact keyword match
            if (lowerMessage.includes(keywordLower)) {
                patternScore += 15; // Higher score for exact match
                matchedKeywords.push(keyword);
                console.log(`✅ Matched keyword "${keyword}" in pattern "${pattern.name}"`);
            }
            // Also check for partial matches (e.g., "instant" when keyword is "instant loan")
            else if (keywordLower.includes(' ') && lowerMessage.includes(keywordLower.split(' ')[0])) {
                patternScore += 8; // Lower score for partial match
                matchedKeywords.push(keyword + " (partial)");
                console.log(`⚠️ Partial match for "${keyword}" in pattern "${pattern.name}"`);
            }
        });
        
        // Check additional keyword categories
        Object.entries(scamKeywords).forEach(([category, words]) => {
            words.forEach(word => {
                if (lowerMessage.includes(word.toLowerCase())) {
                    patternScore += 8; // Additional score for category matches
                    matchedKeywords.push(word + " (" + category + ")");
                }
            });
        });
        
        // If pattern matched, add to results
        if (matchedKeywords.length > 0) {
            console.log(`🎯 Pattern "${pattern.name}" detected with ${matchedKeywords.length} keywords`);
            
            matches.push({
                pattern: pattern.name,
                score: patternScore,
                keywords: matchedKeywords,
                explanation: pattern.explanation,
                safetyTips: pattern.safetyTips,
                severity: pattern.severity
            });
            
            totalScore += patternScore;
            detectedPatterns.push(pattern.name);
        }
    }
    
    // Special detection for common Indian scam phrases
    const commonScamPhrases = [
        { phrase: "instant loan", score: 25, pattern: "Fake Loan Offer" },
        { phrase: "pre approved", score: 20, pattern: "Fake Loan Offer" },
        { phrase: "no documents", score: 20, pattern: "Fake Loan Offer" },
        { phrase: "click here", score: 30, pattern: "Suspicious Link" },
        { phrase: "urgent", score: 15, pattern: "Urgency Scam" },
        { phrase: "guaranteed", score: 15, pattern: "Investment Fraud" }
    ];
    
    commonScamPhrases.forEach(item => {
        if (lowerMessage.includes(item.phrase.toLowerCase())) {
            // Check if pattern already exists
            const existingPattern = matches.find(m => m.pattern === item.pattern);
            if (existingPattern) {
                existingPattern.score += item.score;
                existingPattern.keywords.push(item.phrase);
            } else {
                matches.push({
                    pattern: item.pattern,
                    score: item.score,
                    keywords: [item.phrase],
                    explanation: `Detected common scam phrase: "${item.phrase}"`,
                    safetyTips: ["Be extremely cautious with messages containing this phrase"],
                    severity: "high"
                });
                totalScore += item.score;
            }
            console.log(`🚨 Detected scam phrase: "${item.phrase}"`);
        }
    });
    
    // Check for URL patterns
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.match(urlRegex);
    if (urls) {
        totalScore += 40; // Very high score for suspicious links
        const linkPattern = {
            pattern: "Suspicious Link Detected",
            score: 40,
            keywords: urls,
            explanation: "Message contains clickable links. Scammers often use shortened or fake URLs to trick users into visiting malicious websites.",
            safetyTips: [
                "Never click on links in unsolicited messages",
                "Hover over links to see the actual URL before clicking",
                "Use URL scanners like VirusTotal to check suspicious links",
                "Type website addresses directly into your browser instead of clicking links"
            ],
            severity: "high"
        };
        
        matches.push(linkPattern);
        console.log(`🔗 Detected suspicious URLs: ${urls}`);
    }
    
    // Check for phone number requests (common in Indian scams)
    const phoneRegex = /(\+91[\-\s]?)?[789]\d{9}/g;
    const phoneNumbers = message.match(phoneRegex);
    if (phoneNumbers) {
        totalScore += 25;
        matches.push({
            pattern: "Phone Number Request",
            score: 25,
            keywords: phoneNumbers,
            explanation: "Message contains phone numbers. Scammers often ask you to call a number to share personal information or make payments.",
            safetyTips: [
                "Never call numbers provided in unsolicited messages",
                "Verify any contact information through official websites",
                "Use official customer service numbers from bank websites"
            ],
            severity: "medium"
        });
    }
    
    // Determine verdict based on total score
    let verdict, verdictText, badgeClass;
    
    console.log(`📊 Total Score: ${totalScore}, Matches: ${matches.length}`);
    
    if (totalScore >= 40) {
        verdict = "HIGH RISK SCAM";
        verdictText = "⚠️ DANGER! This message shows multiple signs of being a dangerous financial scam";
        badgeClass = "danger";
    } else if (totalScore >= 25) {
        verdict = "SUSPICIOUS";
        verdictText = "⚠️ This message contains several warning signs of potential fraud";
        badgeClass = "warning";
    } else if (totalScore >= 15) {
        verdict = "CAUTION ADVISED";
        verdictText = "⚠️ This message shows some scam indicators - proceed with caution";
        badgeClass = "caution";
    } else if (totalScore >= 5) {
        verdict = "LOW RISK";
        verdictText = "This message has minor risk indicators";
        badgeClass = "safe";
    } else {
        verdict = "POSSIBLY SAFE";
        verdictText = "No obvious scam patterns detected, but remain vigilant";
        badgeClass = "safe";
    }
    
    return {
        verdict: verdict,
        verdictText: verdictText,
        badgeClass: badgeClass,
        totalScore: totalScore,
        matches: matches,
        detectedPatterns: detectedPatterns,
        explanation: generateExplanation(matches),
        safetyTips: generateSafetyTips(matches)
    };
}

// ==============================================
// IMPROVED MOCK RESPONSES FOR SCAM PATTERNS
// ==============================================

// Update your scamPatterns object with more specific Indian scam patterns
const scamPatterns = {
    // Bank-related scams
    "fake_loan_offer": {
        name: "Fake Loan Offer",
        keywords: [
            "instant loan", "pre-approved", "pre approved", "click here", 
            "limited time", "guaranteed approval", "no documents", 
            "0% interest", "low interest", "quick loan", "personal loan",
            "loan approved", "loan offer", "loan amount", "immediate loan"
        ],
        explanation: "🚨 FAKE LOAN ALERT! Scammers send fake loan approval messages to trick people into paying 'processing fees' or sharing personal information. Real banks NEVER approve loans via SMS without proper verification.",
        safetyTips: [
            "Never pay any 'processing fees' for loan approvals via SMS",
            "Real banks require proper documentation and in-person verification",
            "Check loan offers by visiting the bank's official website directly",
            "Verify by calling the bank's official customer service number",
            "Never share Aadhaar, PAN, or banking details via SMS links"
        ],
        severity: "high"
    },
    
    "bank_account_suspended": {
        name: "Fake Account Suspension",
        keywords: [
            "account suspended", "account blocked", "account deactivated",
            "urgent", "verify now", "click to restore", "security alert",
            "temporarily locked", "reactivate account", "last warning",
            "immediate action", "within 24 hours", "final notice"
        ],
        explanation: "⚠️ ACCOUNT SUSPENSION SCAM! Banks never suspend accounts via SMS without prior notice. These messages create fake urgency to trick you into clicking malicious links.",
        safetyTips: [
            "Never click 'verify account' or 'reactivate' links in SMS",
            "Check your account status by logging into official banking app/website",
            "Call your bank's official customer service number (from their website)",
            "Enable transaction alerts in your banking app for real notifications"
        ],
        severity: "high"
    },
    
    // Add more patterns as needed...
};