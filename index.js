const express = require('express');
const axios = require('axios');
const path = require('path');
const { PassThrough } = require('stream');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const API_URL = process.env.API_URL || 'https://api.openai.com/v1/chat/completions';
const model = process.env.MODEL || "gpt-4-turbo";
const name = process.env.NAME || "Smestra";
const prompt = process.env.PROMPT || "";

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index', {name, prompt});
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        const response = await axios.post(
            API_URL,
            { model, messages, stream: true, temperature: 0.7, max_tokens: 1024 },
            {
                headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
                responseType: 'stream'
            }
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = new PassThrough();
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split("\n");
            for (let line of lines) {
                if (line.startsWith("data:")) {
                    let json;
                    try {
                        json = JSON.parse(line.replace(/^data: /, ""));
                    } catch (err) {
                        continue;
                    }

                    if (json.choices && json.choices[0].delta.content) {
                        res.write(json.choices[0].delta.content);
                    }
                }
            }
        });

        response.data.on('end', () => res.end());
        response.data.on('error', (err) => {
            console.error('Streaming error:', err);
            res.end();
        });

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Smestra running on http://localhost:${PORT}`);
});
