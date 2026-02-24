document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const schedulingSection = document.getElementById('scheduling-section');
    const btnAuth = document.getElementById('btn-auth-manual');
    const btnLogout = document.getElementById('btn-logout');

    // Inicializa API
    GoogleAPI.init();

    // Clique no botão de login
    btnAuth.addEventListener('click', () => {
        GoogleAPI.requestToken();
    });

    // ESCUTA O SUCESSO DO LOGIN PARA MUDAR A TELA
    document.addEventListener('google-auth-success', async () => {
        console.log("Login OK! Mudando tela...");
        const user = await GoogleAPI.getProfile();

        if (user) {
            document.getElementById('user-name').textContent = user.name;

            // ESSE BLOCO MUDA A TELA
            loginSection.classList.remove('active');
            schedulingSection.classList.add('active');

            await GoogleAPI.fetchContacts();
        }
    });

    btnLogout.addEventListener('click', () => location.reload());

    // Lógica de Busca (Autocomplete)
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
                <li data-name="${r.name}" data-phone="${r.phone}">
                    <strong>${r.name}</strong><br>${r.phone}
                </li>
            `).join('');
            autocompleteList.classList.remove('hidden');
        }
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

    // Agendamento
    document.getElementById('btn-schedule').addEventListener('click', async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        if (!name) { Utils.showToast("Selecione um cliente"); return; }

        const start = Utils.toISOWithOffset(document.getElementById('schedule-date').value, document.getElementById('schedule-time').value);
        const end = Utils.toISOWithOffset(document.getElementById('schedule-date').value, Utils.calculateEndTime(document.getElementById('schedule-time').value, document.getElementById('schedule-duration').value));

        const event = {
            summary: `Corte - ${name} - ${Utils.normalizePhone(phone)}`,
            start: { dateTime: start, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: end, timeZone: 'America/Sao_Paulo' }
        };

        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast("Agendado!");
            setTimeout(() => {
                const msg = encodeURIComponent(`Olá ${name}, seu horário foi agendado para ${document.getElementById('schedule-date').value} às ${document.getElementById('schedule-time').value}.`);
                window.open(`https://wa.me/55${Utils.normalizePhone(phone)}?text=${msg}`, '_blank');
            }, 1000);
        } catch (err) {
            Utils.showToast("Erro ao agendar.");
        }
    });
});