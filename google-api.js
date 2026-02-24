const GoogleAPI = {
    tokenClient: null,
    accessToken: null,
    contacts: [],

    init() {
        // Garante que a biblioteca GIS do Google está carregada
        if (typeof google === 'undefined' || !google.accounts) {
            setTimeout(() => this.init(), 500);
            return;
        }

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly',
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error("Erro na autenticação:", response);
                    return;
                }
                this.accessToken = response.access_token;
                console.log("Token de acesso obtido.");

                // Dispara o evento para o app.js trocar a tela
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        if (!this.tokenClient) {
            this.init();
            // Espera um pequeno delay para garantir o init e chama sem forçar consentimento
            setTimeout(() => this.tokenClient.requestAccessToken({ prompt: '' }), 600);
        } else {
            // prompt: '' permite que o Google pule a tela de permissões se já foram dadas antes
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    },

    async getProfile() {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("Erro ao obter perfil:", e);
            return null;
        }
    },

    async fetchContacts() {
        console.log("Iniciando busca de contatos...");
        try {
            const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            if (!res.ok) {
                const err = await res.json();
                console.error("Erro People API. Verifique se a API está ATIVADA no Console:", err);
                return;
            }

            const data = await res.json();

            // Mapeia e filtra apenas quem tem telefone
            this.contacts = (data.connections || []).map(p => {
                const name = p.names?.[0]?.displayName || 'Sem Nome';
                const phones = (p.phoneNumbers || []).map(n => n.value);
                return { name, phones };
            }).filter(c => c.phones.length > 0);

            console.log(`${this.contacts.length} contatos sincronizados.`);
        } catch (e) {
            console.error("Erro na requisição de contatos:", e);
        }
    },

    async checkConflicts(min, max) {
        try {
            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${min}&timeMax=${max}&singleEvents=true`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const data = await res.json();
            return data.items && data.items.length > 0;
        } catch (e) {
            console.error("Erro ao verificar agenda:", e);
            return false;
        }
    },

    async createEvent(eventData) {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error.message);
        }
        return await res.json();
    }
};