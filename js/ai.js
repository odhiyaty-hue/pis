export const AI = {
    async analyzeResult(p1Name, p2Name, s1, s2) {
        // Fetch API key from server-side environment variable via a simple endpoint
        // Or if it's a static site, we might need a small backend or use Replit's specific setup.
        // Since this is a static 'serve' setup, we'll try to fetch it from a /config or similar if we set one up,
        // but for now, let's assume we can fetch it from the environment if we were using a real backend.
        // However, the user asked to use Environment Variables. In a static app, we usually inject these at build time
        // or via a small proxy. 
        
        // Let's check if we can get it from the window object which we will populate from a script
        let apiKey = window.ENV?.GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY');
        
        if (!apiKey) {
            console.warn('Gemini API Key not found. Falling back to manual calculation.');
            return this.manualCalculate(s1, s2);
        }

        try {
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

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            const result = JSON.parse(text.replace(/```json|```/g, ''));
            return result;
        } catch (e) {
            console.error('AI Analysis failed:', e);
            return this.manualCalculate(s1, s2);
        }
    },

    manualCalculate(s1, s2) {
        let p1pts = 0, p2pts = 0;
        if (s1 > s2) p1pts = 3;
        else if (s2 > s1) p2pts = 3;
        else { p1pts = 1; p2pts = 1; }
        return {
            p1Points: p1pts,
            p2Points: p2pts,
            p1GoalsFor: s1,
            p1GoalsAgainst: s2,
            p2GoalsFor: s2,
            p2GoalsAgainst: s1,
            summary: "تم الحساب يدوياً (فشل الاتصال بـ AI)"
        };
    }
};