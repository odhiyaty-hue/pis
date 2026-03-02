export const AI = {
    async analyzeResult(p1Name, p2Name, s1, s2) {
        // First try to get from a secure source or inject via a build process/env
        // In this specific SPA setup, we'll check if it's available in the environment 
        // or a global config.
        const apiKey = 'AIzaSyAaIPa6Ubl5kEmgUK1uzK0d-SHBXANZiNU'; 
        
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