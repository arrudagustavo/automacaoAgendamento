const GoogleAPI = {
    tokenClient: null,
    accessToken: null,
    contacts: [],

    // Initialize the GIS Client
    init() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '602468657261-3s1loggqvqd5giljsun78lcskml0nm4s.apps.googleusercontent.com', // Replace with dynamic if needed
            scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly',
            callback: (response) => {
                if (response.error !== undefined) {
                    throw (response);
                }
                this.accessToken = response.access_token;
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            },
        });
    },

    requestToken() {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    async fetchWithRetry(url, options, retries = 3, backoff = 1000) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429 && retries > 0) {
                console.warn(`Rate limited. Retrying in ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, backoff));
                return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw error;
        }
    },

    async fetchContacts(pageToken = '') {
        try {
            const url = `https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=100&pageToken=${pageToken}`;
            const response = await this.fetchWithRetry(url, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const data = await response.json();

            const newContacts = (data.connections || []).map(person => {
                const name = person.names?.[0]?.displayName || 'Sem Nome';
                const phones = (person.phoneNumbers || []).map(p => p.value);
                return { name, phones };
            });

            this.contacts = pageToken ? [...this.contacts, ...newContacts] : newContacts;

            if (data.nextPageToken) {
                return await this.fetchContacts(data.nextPageToken);
            }
            return this.contacts;
        } catch (error) {
            console.error('Error fetching contacts:', error);
            return this.contacts;
        }
    },

    async checkConflicts(startISO, endISO) {
        try {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startISO}&timeMax=${endISO}&singleEvents=true`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const data = await response.json();
            return data.items && data.items.length > 0;
        } catch (error) {
            console.error('Error checking conflicts:', error);
            return false;
        }
    },

    async createEvent(eventData) {
        try {
            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
            return await response.json();
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    },

    async getProfile() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Error getting profile:', error);
            return null;
        }
    }
};
