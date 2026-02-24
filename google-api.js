const GoogleAPI = {
    tokenClient: null,
    accessToken: null,
    contacts: [],

    init() {
        // Inicializa o cliente de token de forma explícita
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly',
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error("Erro no Google Auth:", response);
                    return;
                }
                this.accessToken = response.access_token;
                console.log("Token recebido com sucesso.");
                // Dispara o evento que o app.js está ouvindo
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        // Solicita o token via popup, mas de forma manual para evitar bloqueios COOP automáticos
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    async getProfile() {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        return res.json();
    },

    async fetchContacts() {
        try {
            const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=100', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const data = await res.json();
            this.contacts = (data.connections || []).map(p => ({
                name: p.names?.[0]?.displayName || 'Sem Nome',
                phones: (p.phoneNumbers || []).map(n => n.value)
            }));
        } catch (e) { console.error("Erro ao buscar contatos:", e); }
    },

    async checkConflicts(min, max) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${min}&timeMax=${max}&singleEvents=true`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        const data = await res.json();
        return data.items && data.items.length > 0;
    },

    async createEvent(event) {
        return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
    }
};