document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const schedulingSection = document.getElementById('scheduling-section');
    const btnAuth = document.getElementById('btn-auth-manual');
    const btnLogout = document.getElementById('btn-logout');

    GoogleAPI.init();

    btnAuth.addEventListener('click', () => {
        GoogleAPI.requestToken();
    });

    document.addEventListener('google-auth-success', async () => {
        const user = await GoogleAPI.getProfile();
        if (user) {
            document.getElementById('user-name').textContent = user.name;
            loginSection.classList.remove('active');
            schedulingSection.classList.add('active');

            const agora = new Date();
            const dataHoje = agora.toISOString().split('T')[0];
            const horaAgora = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
            document.getElementById('schedule-date').value = dataHoje;
            document.getElementById('schedule-time').value = horaAgora;

            await GoogleAPI.fetchContacts();
        }
    });

    btnLogout.addEventListener('click', () => location.reload());

    const clientSearch = document.getElementById('client-search');
    const autocompleteList = document.getElementById('autocomplete-list');

    clientSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        if (q.length < 2) { autocompleteList.classList.add('hidden'); return; }
        const results = [];
        GoogleAPI.contacts.forEach(c => {
            const match = c.name.toLowerCase().includes(q) || c.phones.some(p => p.includes(q));
            if (match) c.phones.forEach(p => results.push({ name: c.name, phone: p }));
        });
        if (results.length > 0) {
            autocompleteList.innerHTML = results.slice(0, 5).map(r => `
                <li data-name="${r.name}" data-phone="${r.phone}"><strong>${r.name}</strong><br>${r.phone}</li>
            `).join('');
            autocompleteList.classList.remove('hidden');
        } else { autocompleteList.classList.add('hidden'); }
    });

    autocompleteList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (li) {
            document.getElementById('client-name').value = li.dataset.name;
            document.getElementById('client-phone').value = li.dataset.phone;
            clientSearch.value = li.dataset.name;
            autocompleteList.classList.add('hidden');
        }
    });

    document.getElementById('btn-schedule').addEventListener('click', async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const date = document.getElementById('schedule-date').value;
        const time = document.getElementById('schedule-time').value;
        const duration = document.getElementById('schedule-duration').value;

        if (!name || !date || !time) { Utils.showToast("Preencha tudo!"); return; }

        const start = Utils.toISOWithOffset(date, time);
        const end = Utils.toISOWithOffset(date, Utils.calculateEndTime(time, duration));

        const event = {
            summary: `Corte: ${name}`,
            description: `Tel: ${phone}`,
            start: { dateTime: start, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: end, timeZone: 'America/Sao_Paulo' }
        };

        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast("Agendado!");
            setTimeout(() => {
                const dataFormatada = date.split('-').reverse().join('/');
                const msg = encodeURIComponent(`Fala ${name}! Seu horário está confirmado para o dia ${dataFormatada} às ${time}. Tamo junto!`);
                window.open(`https://wa.me/55${Utils.normalizePhone(phone)}?text=${msg}`, '_blank');
            }, 1500);
        } catch (err) { Utils.showToast("Erro na agenda."); }
    });
});