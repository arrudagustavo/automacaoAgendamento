const GoogleAPI = {
    client: null,
    accessToken: null,
    contacts: [],

    init() {
        // 🔹 RECUPERAÇÃO DA SESSÃO: Tenta puxar o Token salvo para sobreviver ao F5
        const savedToken = localStorage.getItem('google_access_token');
        const tokenExpiry = localStorage.getItem('google_token_expiry');

        if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
            this.accessToken = savedToken;
        }

        this.client = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com', // COLOQUE SEU ID AQUI
            scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.profile',
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error("Erro na autenticação:", response);
                    return;
                }
                this.accessToken = response.access_token;

                // 🔹 SALVA O TOKEN: Guarda a chave e a validade dela (geralmente 3600 segundos)
                const expiryTime = Date.now() + (response.expires_in * 1000);
                localStorage.setItem('google_access_token', this.accessToken);
                localStorage.setItem('google_token_expiry', expiryTime.toString());

                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        this.client.requestAccessToken({ prompt: '' });
    },

    async _fetch(endpoint, options = {}) {
        if (!this.accessToken) return null;

        const url = endpoint.startsWith('http') ? endpoint : `https://www.googleapis.com${endpoint}`;

        if (!options.headers) options.headers = {};
        options.headers['Authorization'] = `Bearer ${this.accessToken}`;

        const resp = await fetch(url, options);

        if (resp.status === 401) {
            console.warn("Token expirado. Limpando sessão...");
            localStorage.removeItem('vitao_user');
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
            location.reload();
            throw new Error("Token expirado");
        }

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(err);
        }

        if (resp.status === 204) return null;
        return await resp.json();
    },

    async getProfile() { return await this._fetch('/oauth2/v3/userinfo'); },
    async fetchContacts() {
        try {
            const data = await this._fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000');
            if (data && data.connections) {
                this.contacts = data.connections.map(c => ({
                    name: c.names && c.names.length > 0 ? c.names[0].displayName : 'Sem Nome',
                    phones: c.phoneNumbers ? c.phoneNumbers.map(p => p.value) : []
                }));
            }
        } catch (err) { console.error("Erro ao buscar contatos:", err); }
    },
    async createEvent(event) {
        return await this._fetch('/calendar/v3/calendars/primary/events', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event)
        });
    },
    async deleteEvent(eventId) { return await this._fetch(`/calendar/v3/calendars/primary/events/${eventId}`, { method: 'DELETE' }); },
    async listEventsRange(timeMin, timeMax) {
        const data = await this._fetch(`/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`);
        return data ? (data.items || []) : [];
    }
};