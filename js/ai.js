export const AI = {
    async analyzeResult(p1Name, p2Name, s1, s2) {
        try {
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ p1Name, p2Name, s1, s2 })
            });

            if (!response.ok) {
                console.warn('AI service unavailable. Falling back to manual calculation.');
                return this.manualCalculate(s1, s2);
            }

            const result = await response.json();
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
