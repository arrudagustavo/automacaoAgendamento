document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "";
    const loginSection = document.getElementById('login-section');
    const schedulingSection = document.getElementById('scheduling-section');
    const btnAuth = document.getElementById('btn-auth-manual');
    const btnSchedule = document.getElementById('btn-schedule');
    const modalSuccess = document.getElementById('modal-success');

    if (typeof GoogleAPI !== 'undefined') {
        GoogleAPI.init();
    }

    // Clique blindado para Safari
    btnAuth.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Iniciando login...");
        GoogleAPI.requestToken();
    });

    document.addEventListener('google-auth-success', async () => {
        console.log("Login Detectado!");
        loginSection.classList.remove('active');
        schedulingSection.classList.add('active');

        const agora = new Date();
        document.getElementById('schedule-date').value = agora.toISOString().split('T')[0];
        document.getElementById('schedule-time').value = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

        try {
            const user = await GoogleAPI.getProfile();
            document.getElementById('user-name').textContent = user ? user.name : "Barbeiro";
        } catch (e) {
            document.getElementById('user-name').textContent = "Barbeiro";
        }
        await GoogleAPI.fetchContacts();
    });

    document.getElementById('btn-logout').addEventListener('click', () => location.reload());

    // Autocomplete
    const clientSearch = document.getElementById('client-search');
    const autocompleteList = document.getElementById('autocomplete-list');

    clientSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        if (q.length < 2) { autocompleteList.classList.add('hidden'); return; }
        const results = [];
        if (GoogleAPI.contacts) {
            GoogleAPI.contacts.forEach(c => {
                const match = c.name.toLowerCase().includes(q) || (c.phones && c.phones.some(p => p.includes(q)));
                if (match) c.phones.forEach(p => results.push({ name: c.name, phone: p }));
            });
        }
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

    // Agendar
    btnSchedule.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const date = document.getElementById('schedule-date').value;
        const time = document.getElementById('schedule-time').value;

        if (!name || !date || !time) {
            Utils.showToast("Preencha todos os campos!");
            return;
        }

        try {
            const start = Utils.toISOWithOffset(date, time);
            const end = Utils.toISOWithOffset(date, Utils.calculateEndTime(time, document.getElementById('schedule-duration').value));

            await GoogleAPI.createEvent({
                summary: `Corte: ${name}`,
                description: `Tel: ${phone}`,
                start: { dateTime: start, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: end, timeZone: 'America/Sao_Paulo' }
            });

            const dataF = date.split('-').reverse().join('/');
            const msg = `Fala ${name}! Seu horário está confirmado para o dia ${dataF} às ${time}. Tamo junto!`;
            urlWhatsAppFinal = `https://wa.me/55${Utils.normalizePhone(phone)}?text=${encodeURIComponent(msg)}`;

            modalSuccess.classList.remove('hidden');

        } catch (err) {
            Utils.showToast("Erro ao agendar.");
        }
    });

    document.getElementById('btn-open-whatsapp').addEventListener('click', () => {
        window.location.href = urlWhatsAppFinal;
    });

    document.getElementById('btn-success-close').addEventListener('click', () => {
        location.reload();
    });
});