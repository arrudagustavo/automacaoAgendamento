const GoogleAPI = {
    client: null,
    accessToken: null,
    contacts: [],

    init() {
        this.client = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com', // MANTENHA O SEU CLIENT ID AQUI
            scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/contacts.readonly',
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error("Erro na autenticação:", response);
                    return;
                }
                this.accessToken = response.access_token;
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        this.client.requestAccessToken({ prompt: '' });
    },

    async getProfile() {
        if (!this.accessToken) return null;
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        return await resp.json();
    },

    async fetchContacts() {
        if (!this.accessToken) return;
        try {
            const resp = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            const data = await resp.json();
            if (data.connections) {
                this.contacts = data.connections.map(c => ({
                    // Proteção caso o contato não tenha nome
                    name: c.names && c.names.length > 0 ? c.names[0].displayName : 'Sem Nome',
                    // Proteção caso o contato não tenha número
                    phones: c.phoneNumbers ? c.phoneNumbers.map(p => p.value) : []
                }));
            }
        } catch (err) {
            console.error("Erro ao buscar contatos do Google:", err);
        }
    },

    async createEvent(event) {
        const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        return await resp.json();
    },

    async deleteEvent(eventId) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
    },

    async listEventsRange(timeMin, timeMax) {
        if (!this.accessToken) return [];
        const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        const data = await resp.json();
        return data.items || [];
    }
};