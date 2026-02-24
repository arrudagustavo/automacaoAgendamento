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
                if (response.error !== undefined) {
                    console.error("Erro Google:", response.error);
                    return;
                }
                this.accessToken = response.access_token;
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        if (!this.tokenClient) {
            this.init();
            setTimeout(() => this.tokenClient.requestAccessToken({ prompt: 'consent' }), 600);
        } else {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    },

    async getProfile() {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        return await res.json();
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
        } catch (e) { console.error("Erro contatos:", e); }
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