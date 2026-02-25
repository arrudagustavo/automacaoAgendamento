const GoogleAPI = {
    client: null,
    accessToken: null,
    contacts: [],

    init() {
        this.client = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/contacts.readonly',
            callback: (response) => {
                if (response.error !== undefined) return;
                this.accessToken = response.access_token;
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() { this.client.requestAccessToken({ prompt: '' }); },

    async getProfile() {
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        return await resp.json();
    },

    async fetchContacts() {
        const resp = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000', {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        const data = await resp.json();
        this.contacts = (data.connections || []).map(c => ({
            name: c.names ? c.names[0].displayName : 'Sem Nome',
            phones: c.phoneNumbers ? c.phoneNumbers.map(p => p.value) : []
        }));
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

    // NOVA: Busca eventos de um período (Semana)
    async listEventsRange(timeMin, timeMax) {
        const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        const data = await resp.json();
        return data.items || [];
    }
};