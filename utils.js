const Utils = {
    normalizePhone(phone) {
        if (!phone) return '';
        // Remove tudo que não é número. 
        // Remove o '55' caso o contato já tenha, para não duplicar com o script.
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('55')) {
            cleaned = cleaned.substring(2);
        }
        return cleaned;
    },

    toISOWithOffset(dateStr, timeStr) {
        return `${dateStr}T${timeStr}:00-03:00`;
    },

    getTodayDate() {
        return new Intl.DateTimeFormat('fr-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());
    },

    getCurrentTime() {
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date());
    },

    calculateEndTime(startTimeStr, durationMinutes) {
        const [hours, minutes] = startTimeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes + parseInt(durationMinutes));
        return date.toTimeString().slice(0, 5);
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
};