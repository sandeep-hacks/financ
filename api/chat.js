import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are FinSafe AI, a financial safety assistant for Indian students and first-time earners. Provide clear, practical financial advice focusing on safety, budgeting, and scam prevention. Keep responses under 200 words."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    return res.status(200).json({
      reply: completion.data.choices[0].message.content,
      mode: "chatgpt"
    });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ 
      error: 'Failed to get response',
      reply: "I'm currently unavailable. Here's general advice: Always verify financial offers through official channels, never share OTPs or passwords, and be wary of 'too good to be true' offers."
    });
  }
}