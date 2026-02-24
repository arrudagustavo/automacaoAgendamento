document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "";
    const loginSection = document.getElementById('login-section');
    const schedulingSection = document.getElementById('scheduling-section');
    const btnAuth = document.getElementById('btn-auth-manual');
    const modalSuccess = document.getElementById('modal-success');

    GoogleAPI.init();

    const resetForm = () => {
        document.getElementById('client-name').value = "";
        document.getElementById('client-phone').value = "";
        document.getElementById('client-search').value = "";
        const agora = new Date();
        document.getElementById('schedule-date').value = agora.toISOString().split('T')[0];
        document.getElementById('schedule-time').value = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
    };

    // PERSISTÊNCIA: Mantém logado ao voltar do Zap ou fechar app
    const savedUser = localStorage.getItem('vitao_user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        document.getElementById('user-name').textContent = user.name;
        loginSection.classList.remove('active');
        schedulingSection.classList.add('active');
        resetForm();
        GoogleAPI.fetchContacts();
    }

    btnAuth.addEventListener('click', () => GoogleAPI.requestToken());

    document.addEventListener('google-auth-success', async () => {
        const user = await GoogleAPI.getProfile();
        if (user) {
            localStorage.setItem('vitao_user', JSON.stringify(user));
            document.getElementById('user-name').textContent = user.name;
        }
        loginSection.classList.remove('active');
        schedulingSection.classList.add('active');
        resetForm();
        await GoogleAPI.fetchContacts();
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('vitao_user');
        location.reload();
    });

    // AUTOCOMPLETE
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

    // AGENDAR
    document.getElementById('btn-schedule').addEventListener('click', async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const date = document.getElementById('schedule-date').value;
        const time = document.getElementById('schedule-time').value;

        if (!name || !date || !time) { Utils.showToast("Preencha tudo!"); return; }

        try {
            await GoogleAPI.createEvent({
                summary: `Corte: ${name}`,
                description: `Tel: ${phone}`,
                start: { dateTime: Utils.toISOWithOffset(date, time), timeZone: 'America/Sao_Paulo' },
                end: { dateTime: Utils.toISOWithOffset(date, Utils.calculateEndTime(time, document.getElementById('schedule-duration').value)), timeZone: 'America/Sao_Paulo' }
            });

            const dataF = date.split('-').reverse().join('/');
            const msg = `Fala ${name}! Seu horário está confirmado para o dia ${dataF} às ${time}. Tamo junto!`;
            urlWhatsAppFinal = `https://wa.me/55${Utils.normalizePhone(phone)}?text=${encodeURIComponent(msg)}`;
            modalSuccess.classList.remove('hidden');
        } catch (err) { Utils.showToast("Erro ao agendar."); }
    });

    document.getElementById('btn-open-whatsapp').addEventListener('click', () => {
        window.location.href = urlWhatsAppFinal;
    });

    document.getElementById('btn-success-close').addEventListener('click', () => {
        modalSuccess.classList.add('hidden');
        resetForm(); // Limpa dados sem deslogar
    });
});