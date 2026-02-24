document.addEventListener('DOMContentLoaded', () => {
    const sections = { login: document.getElementById('login-section'), scheduling: document.getElementById('scheduling-section') };
    const inputs = { clientSearch: document.getElementById('client-search'), clientName: document.getElementById('client-name'), clientPhone: document.getElementById('client-phone'), date: document.getElementById('schedule-date'), time: document.getElementById('schedule-time'), duration: document.getElementById('schedule-duration') };
    const buttons = { authManual: document.getElementById('btn-auth-manual'), logout: document.getElementById('btn-logout'), schedule: document.getElementById('btn-schedule'), conflictCancel: document.getElementById('btn-conflict-cancel'), conflictConfirm: document.getElementById('btn-conflict-confirm') };
    const autocompleteList = document.getElementById('autocomplete-list');

    GoogleAPI.init();
    inputs.date.value = Utils.getTodayDate();
    inputs.time.value = Utils.getCurrentTime();

    // Login
    buttons.authManual.addEventListener('click', () => GoogleAPI.requestToken());

    document.addEventListener('google-auth-success', async () => {
        const user = await GoogleAPI.getProfile();
        if (user) {
            document.getElementById('user-name').textContent = user.name;
            const avatar = document.getElementById('user-avatar');
            if (user.picture) { avatar.src = user.picture; avatar.classList.remove('hidden'); }
            sections.login.classList.remove('active');
            sections.scheduling.classList.add('active');
            await GoogleAPI.fetchContacts();
        }
    });

    buttons.logout.addEventListener('click', () => location.reload());

    // Autocomplete
    inputs.clientSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        if (q.length < 2) { autocompleteList.classList.add('hidden'); return; }
        const res = [];
        GoogleAPI.contacts.forEach(c => {
            c.phones.forEach(p => { if (c.name.toLowerCase().includes(q) || p.replace(/\D/g, '').includes(q)) res.push({ name: c.name, phone: p }); });
        });
        if (res.length > 0) {
            autocompleteList.innerHTML = res.slice(0, 5).map(c => `<li data-name="${c.name}" data-phone="${c.phone}"><b>${c.name}</b><br>${c.phone}</li>`).join('');
            autocompleteList.classList.remove('hidden');
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

    // Agendamento
    async function handleScheduling() {
        const start = Utils.toISOWithOffset(inputs.date.value, inputs.time.value);
        const end = Utils.toISOWithOffset(inputs.date.value, Utils.calculateEndTime(inputs.time.value, inputs.duration.value));
        const conflict = await GoogleAPI.checkConflicts(new Date(start).toISOString(), new Date(end).toISOString());
        if (conflict) { document.getElementById('modal-conflict').classList.remove('hidden'); return; }
        saveEvent(start, end);
    }

    async function saveEvent(start, end) {
        const name = inputs.clientName.value;
        const phone = Utils.normalizePhone(inputs.clientPhone.value);
        const event = { summary: `Corte - ${name} - ${phone}`, start: { dateTime: start, timeZone: 'America/Sao_Paulo' }, end: { dateTime: end, timeZone: 'America/Sao_Paulo' } };

        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast('Agendado! Abrindo WhatsApp...');
            // Mensagem de confirmação imediata
            const msg = encodeURIComponent(`Olá ${name}, confirmo seu horário dia ${new Date(start).toLocaleDateString('pt-BR')} às ${new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Até lá!`);
            setTimeout(() => { window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank'); }, 1200);
            inputs.clientName.value = ''; inputs.clientPhone.value = ''; inputs.clientSearch.value = '';
        } catch (e) { Utils.showToast('Erro ao agendar.'); }
    }

    buttons.schedule.addEventListener('click', handleScheduling);
    buttons.conflictConfirm.addEventListener('click', () => {
        document.getElementById('modal-conflict').classList.add('hidden');
        saveEvent(Utils.toISOWithOffset(inputs.date.value, inputs.time.value), Utils.toISOWithOffset(inputs.date.value, Utils.calculateEndTime(inputs.time.value, inputs.duration.value)));
    });
    buttons.conflictCancel.addEventListener('click', () => document.getElementById('modal-conflict').classList.add('hidden'));
});