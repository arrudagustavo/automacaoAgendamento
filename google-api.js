const GoogleAPI = {
    tokenClient: null,
    accessToken: null,
    contacts: [],

    init() {
        if (typeof google === 'undefined') {
            setTimeout(() => this.init(), 500);
            return;
        }
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly',
            callback: (response) => {
                if (response.error !== undefined) return;
                this.accessToken = response.access_token;
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    async getProfile() {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        return await res.json();
    },

    async fetchContacts() {
        console.log("Buscando contatos...");
        try {
            // Buscamos nome e número de telefone de até 1000 conexões
            const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const data = await res.json();

            this.contacts = (data.connections || []).map(p => {
                const name = p.names?.[0]?.displayName || 'Sem Nome';
                const phones = (p.phoneNumbers || []).map(n => n.value);
                return { name, phones };
            }).filter(c => c.phones.length > 0); // Só salva quem tem telefone

            console.log(`${this.contacts.length} contatos carregados.`);
        } catch (e) {
            console.error("Erro ao carregar contatos:", e);
        }
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