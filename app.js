document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;

    const sections = {
        login: document.getElementById('login-section'),
        scheduling: document.getElementById('scheduling-section')
    };

    const inputs = {
        clientSearch: document.getElementById('client-search'),
        clientName: document.getElementById('client-name'),
        clientPhone: document.getElementById('client-phone'),
        date: document.getElementById('schedule-date'),
        time: document.getElementById('schedule-time'),
        duration: document.getElementById('schedule-duration')
    };

    const buttons = {
        authManual: document.getElementById('btn-auth-manual'),
        logout: document.getElementById('btn-logout'),
        schedule: document.getElementById('btn-schedule'),
        conflictCancel: document.getElementById('btn-conflict-cancel'),
        conflictConfirm: document.getElementById('btn-conflict-confirm')
    };

    const autocompleteList = document.getElementById('autocomplete-list');
    const modalConflict = document.getElementById('modal-conflict');

    GoogleAPI.init();
    inputs.date.value = Utils.getTodayDate();
    inputs.time.value = Utils.getCurrentTime();

    buttons.authManual.addEventListener('click', () => GoogleAPI.requestToken());

    document.addEventListener('google-auth-success', async () => {
        currentUser = await GoogleAPI.getProfile();
        if (currentUser) {
            document.getElementById('user-name').textContent = currentUser.name;
            const avatar = document.getElementById('user-avatar');
            avatar.src = currentUser.picture;
            avatar.classList.remove('hidden');
            sections.login.classList.remove('active');
            sections.scheduling.classList.add('active');
            Utils.showToast(`Bem-vindo, ${currentUser.given_name}!`);
            await GoogleAPI.fetchContacts();
        }
    });

    buttons.logout.addEventListener('click', () => { location.reload(); });

    // Lógica de busca de contatos
    inputs.clientSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) { autocompleteList.classList.add('hidden'); return; }

        const results = [];
        GoogleAPI.contacts.forEach(c => {
            c.phones.forEach(phone => {
                if (c.name.toLowerCase().includes(query) || phone.replace(/\D/g, '').includes(query)) {
                    results.push({ name: c.name, phone });
                }
            });
        });

        const displayed = results.slice(0, 10);
        if (displayed.length > 0) {
            autocompleteList.innerHTML = displayed.map(c => `
                <li data-name="${c.name}" data-phone="${c.phone}">
                    <span class="name">${c.name}</span>
                    <span class="phone">${c.phone}</span>
                </li>
            `).join('');
            autocompleteList.classList.remove('hidden');
        } else {
            autocompleteList.classList.add('hidden');
        }
    });

    autocompleteList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (li) {
            inputs.clientName.value = li.dataset.name;
            inputs.clientPhone.value = li.dataset.phone;
            inputs.clientSearch.value = li.dataset.name;
            autocompleteList.classList.add('hidden');
        }
    });

    async function handleScheduling() {
        const date = inputs.date.value;
        const time = inputs.time.value;
        const name = inputs.clientName.value;
        const phone = inputs.clientPhone.value;

        if (!name || !phone || !date || !time) {
            Utils.showToast('Preencha todos os campos.');
            return;
        }

        const startISO = Utils.toISOWithOffset(date, time);
        const endISO = Utils.toISOWithOffset(date, Utils.calculateEndTime(time, inputs.duration.value));

        const hasConflict = await GoogleAPI.checkConflicts(new Date(startISO).toISOString(), new Date(endISO).toISOString());
        if (hasConflict) {
            modalConflict.classList.remove('hidden');
            return;
        }
        await createEvent(name, phone, startISO, endISO);
    }

    async function createEvent(name, phone, startISO, endISO) {
        const cleanedPhone = Utils.normalizePhone(phone);

        const event = {
            // Título formatado para o seu Apps Script
            summary: `Corte - ${name} - ${cleanedPhone}`,
            start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endISO, timeZone: 'America/Sao_Paulo' }
        };

        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast('Agendado! Abrindo confirmação...');

            // --- Lógica Complementar: Confirmação Imediata ---
            const dataFormatada = new Date(startISO).toLocaleDateString('pt-BR');
            const horaFormatada = new Date(startISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const msg = encodeURIComponent(`Olá ${name}, confirmo seu horário dia ${dataFormatada} às ${horaFormatada}. Até lá! ✂️`);

            setTimeout(() => {
                window.open(`https://wa.me/55${cleanedPhone}?text=${msg}`, '_blank');
            }, 1500);

            inputs.clientName.value = '';
            inputs.clientPhone.value = '';
            inputs.clientSearch.value = '';
        } catch (error) {
            Utils.showToast('Erro ao agendar.');
        }
    }

    buttons.schedule.addEventListener('click', handleScheduling);
    buttons.conflictConfirm.addEventListener('click', () => {
        modalConflict.classList.add('hidden');
        handleScheduling();
    });
    buttons.conflictCancel.addEventListener('click', () => modalConflict.classList.add('hidden'));
});