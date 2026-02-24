const Utils = {
    normalizePhone(p) {
        let c = p.replace(/\D/g, '');
        if (c.startsWith('55')) c = c.substring(2);
        return c;
    },
    toISOWithOffset(d, t) { return `${d}T${t}:00-03:00`; },
    getTodayDate() { return new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); },
    getCurrentTime() { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); },
    calculateEndTime(t, d) {
        const [h, m] = t.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m + parseInt(d));
        return date.toTimeString().slice(0, 5);
    },
    showToast(m) {
        const t = document.getElementById('toast');
        t.textContent = m; t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 3000);
    }
};