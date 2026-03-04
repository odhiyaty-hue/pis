const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.post('/api/ai/analyze', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  const { p1Name, p2Name, s1, s2 } = req.body;
  if (
    typeof p1Name !== 'string' ||
    typeof p2Name !== 'string' ||
    typeof s1 !== 'number' ||
    typeof s2 !== 'number'
  ) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const prompt = `Analyze a football match result: ${p1Name} ${s1} - ${s2} ${p2Name}. 
Return a JSON object with:
{
  "p1Points": number (3 for win, 1 for draw, 0 for loss),
  "p2Points": number,
  "p1GoalsFor": ${s1},
  "p1GoalsAgainst": ${s2},
  "p2GoalsFor": ${s2},
  "p2GoalsAgainst": ${s1},
  "summary": "short arabic summary"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(text.replace(/```json|```/g, ''));
    return res.json(result);
  } catch (e) {
    console.error('AI proxy error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const rootDir = path.resolve(__dirname, '..');

app.use(express.static(rootDir, {
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}
