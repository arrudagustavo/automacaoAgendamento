const GoogleAPI = {
    client: null,
    accessToken: null,
    contacts: [],

    init() {
        // Inicializa o cliente de Token
        this.client = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com', // Verifique se este ID está correto
            scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/contacts.readonly',
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error("Erro no Google Auth:", response);
                    return;
                }

                // GUARDA O TOKEN
                this.accessToken = response.access_token;

                // AQUI ESTÁ A CHAVE: Dispara o evento IMEDIATAMENTE
                console.log("Token recebido, disparando evento de sucesso...");
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        // Solicita o token sem forçar o prompt de conta se já estiver logado
        this.client.requestAccessToken({ prompt: '' });
    },

    async getProfile() {
        try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            return await resp.json();
        } catch (err) {
            console.error("Falha ao carregar perfil:", err);
            return null;
        }
    },

    async fetchContacts() {
        try {
            const resp = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            const data = await resp.json();
            this.contacts = (data.connections || []).map(c => ({
                name: c.names ? c.names[0].displayName : 'Sem Nome',
                phones: c.phoneNumbers ? c.phoneNumbers.map(p => p.value) : []
            }));
            console.log("Contatos carregados:", this.contacts.length);
        } catch (err) {
            console.error("Erro ao buscar contatos:", err);
            this.contacts = [];
        }
    },

    async createEvent(event) {
        const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });
        if (!resp.ok) throw new Error('Erro ao criar evento');
        return await resp.json();
    },

    // --- NOVA FUNÇÃO: LISTAR EVENTOS DO DIA ---
    async listEvents(date) {
        const timeMin = new Date(date + 'T00:00:00Z').toISOString();
        const timeMax = new Date(date + 'T23:59:59Z').toISOString();

        try {
            const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            const data = await resp.json();
            return data.items || [];
        } catch (err) {
            console.error("Erro ao listar eventos:", err);
            return [];
        }
    },

    // --- NOVA FUNÇÃO: DELETAR EVENTO ---
    async deleteEvent(eventId) {
        try {
            const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            if (!resp.ok) throw new Error('Erro ao deletar evento');
            return true;
        } catch (err) {
            console.error("Erro ao deletar agendamento:", err);
            throw err;
        }
    }
};