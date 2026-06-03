const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', openai_key_set: !!process.env.OPENAI_API_KEY });
});

app.post('/api/analyze', async (req, res) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });
  }

  const { systemPrompt, userText, images } = req.body;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        ...(images || []).map(img => ({
          type: 'image_url',
          image_url: { url: img.data, detail: 'low' }
        }))
      ]
    }
  ];

  try {
    // AbortController для timeout 120 секунд
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 8000,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI API error' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text });

  } catch (err) {
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'Request timeout — спробуй з коротшим сценарієм або меншою кількістю зображень' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Cartoon Pipeline running on port ${PORT}`);
  console.log(`OPENAI_API_KEY set: ${!!process.env.OPENAI_API_KEY}`);
});
