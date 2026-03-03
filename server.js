const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;

app.get('/env.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.ENV = { GEMINI_API_KEY: "${process.env.GEMINI_API_KEY || ''}" };`);
});

app.use(express.static('.'));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
