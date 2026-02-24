document.addEventListener('DOMContentLoaded', () => {
    const sections = { login: document.getElementById('login-section'), scheduling: document.getElementById('scheduling-section') };
    const inputs = { clientSearch: document.getElementById('client-search'), clientName: document.getElementById('client-name'), clientPhone: document.getElementById('client-phone'), date: document.getElementById('schedule-date'), time: document.getElementById('schedule-time'), duration: document.getElementById('schedule-duration') };
    const buttons = { authManual: document.getElementById('btn-auth-manual'), logout: document.getElementById('btn-logout'), schedule: document.getElementById('btn-schedule'), conflictCancel: document.getElementById('btn-conflict-cancel'), conflictConfirm: document.getElementById('btn-conflict-confirm') };
    const autocompleteList = document.getElementById('autocomplete-list');
    const modalConflict = document.getElementById('modal-conflict');

    GoogleAPI.init();
    inputs.date.value = Utils.getTodayDate();
    inputs.time.value = Utils.getCurrentTime();

    async function loginSuccessFlow() {
        const currentUser = await GoogleAPI.getProfile();
        if (currentUser) {
            document.getElementById('user-name').textContent = currentUser.name;
            const avatar = document.getElementById('user-avatar');
            if (currentUser.picture) { avatar.src = currentUser.picture; avatar.classList.remove('hidden'); }
            sections.login.classList.remove('active');
            sections.scheduling.classList.add('active');
            await GoogleAPI.fetchContacts();
        }
    }

    document.addEventListener('google-auth-success', loginSuccessFlow);
    buttons.authManual.addEventListener('click', () => GoogleAPI.requestToken());
    buttons.logout.addEventListener('click', () => { location.reload(); });

    inputs.clientSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) { autocompleteList.classList.add('hidden'); return; }
        const results = [];
        GoogleAPI.contacts.forEach(c => {
            c.phones.forEach(p => { if (c.name.toLowerCase().includes(query) || p.replace(/\D/g, '').includes(query)) results.push({ name: c.name, phone: p }); });
        });
        if (results.length > 0) {
            autocompleteList.innerHTML = results.slice(0, 5).map(c => `<li data-name="${c.name}" data-phone="${c.phone}"><b>${c.name}</b><br>${c.phone}</li>`).join('');
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

    async function handleScheduling() {
        const startISO = Utils.toISOWithOffset(inputs.date.value, inputs.time.value);
        const endISO = Utils.toISOWithOffset(inputs.date.value, Utils.calculateEndTime(inputs.time.value, inputs.duration.value));
        const conflict = await GoogleAPI.checkConflicts(new Date(startISO).toISOString(), new Date(endISO).toISOString());
        if (conflict) { modalConflict.classList.remove('hidden'); return; }
        createEvent(inputs.clientName.value, inputs.clientPhone.value, startISO, endISO);
    }

    async function createEvent(name, phone, start, end) {
        const clean = Utils.normalizePhone(phone);
        const event = { summary: `Corte - ${name} - ${clean}`, start: { dateTime: start, timeZone: 'America/Sao_Paulo' }, end: { dateTime: end, timeZone: 'America/Sao_Paulo' } };
        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast('Agendado!');
            const msg = encodeURIComponent(`Olá ${name}, confirmo seu horário dia ${new Date(start).toLocaleDateString('pt-BR')} às ${new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Até lá!`);
            setTimeout(() => { window.open(`https://wa.me/55${clean}?text=${msg}`, '_blank'); }, 1000);
            inputs.clientName.value = ''; inputs.clientPhone.value = ''; inputs.clientSearch.value = '';
        } catch (e) { Utils.showToast('Erro ao agendar.'); }
    }

    buttons.schedule.addEventListener('click', handleScheduling);
    buttons.conflictConfirm.addEventListener('click', () => {
        modalConflict.classList.add('hidden');
        const start = Utils.toISOWithOffset(inputs.date.value, inputs.time.value);
        const end = Utils.toISOWithOffset(inputs.date.value, Utils.calculateEndTime(inputs.time.value, inputs.duration.value));
        createEvent(inputs.clientName.value, inputs.clientPhone.value, start, end);
    });
    buttons.conflictCancel.addEventListener('click', () => modalConflict.classList.add('hidden'));
});