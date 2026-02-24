document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção de Elementos ---
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

    // --- Inicialização ---
    GoogleAPI.init();
    inputs.date.value = Utils.getTodayDate();
    inputs.time.value = Utils.getCurrentTime();

    // --- Fluxo de Autenticação ---
    buttons.authManual.addEventListener('click', () => {
        console.log("Solicitando permissões ao Google...");
        GoogleAPI.requestToken();
    });

    document.addEventListener('google-auth-success', async () => {
        console.log("Login realizado com sucesso. Carregando dados...");
        const user = await GoogleAPI.getProfile();

        if (user) {
            document.getElementById('user-name').textContent = user.name;
            const avatar = document.getElementById('user-avatar');
            if (user.picture) {
                avatar.src = user.picture;
                avatar.classList.remove('hidden');
            }

            // Troca de tela
            sections.login.classList.remove('active');
            sections.scheduling.classList.add('active');

            // CARREGA OS CONTATOS ASSIM QUE ENTRA
            Utils.showToast("Sincronizando contatos...");
            await GoogleAPI.fetchContacts();
        }
    });

    buttons.logout.addEventListener('click', () => location.reload());

    // --- Lógica de Autocomplete (Busca de Clientes) ---
    inputs.clientSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();

        if (q.length < 2) {
            autocompleteList.classList.add('hidden');
            return;
        }

        // Filtra contatos por nome ou qualquer um dos telefones
        const results = [];
        GoogleAPI.contacts.forEach(c => {
            const matchName = c.name.toLowerCase().includes(q);
            const matchPhone = c.phones.some(p => p.replace(/\D/g, '').includes(q));

            if (matchName || matchPhone) {
                // Adiciona cada telefone do contato como uma opção na lista
                c.phones.forEach(p => results.push({ name: c.name, phone: p }));
            }
        });

        if (results.length > 0) {
            autocompleteList.innerHTML = results.slice(0, 8).map(c => `
                <li data-name="${c.name}" data-phone="${c.phone}" style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; list-style: none;">
                    <div style="font-weight: 600; color: #1a1a1a;">${c.name}</div>
                    <div style="font-size: 13px; color: #666;">${c.phone}</div>
                </li>
            `).join('');
            autocompleteList.classList.remove('hidden');
        } else {
            autocompleteList.innerHTML = '<li style="padding: 12px; color: #999; list-style: none;">Nenhum contato encontrado</li>';
            autocompleteList.classList.remove('hidden');
        }
    });

    // Seleção de contato na lista
    autocompleteList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (li && li.dataset.name) {
            inputs.clientName.value = li.dataset.name;
            inputs.clientPhone.value = li.dataset.phone;
            inputs.clientSearch.value = li.dataset.name;
            autocompleteList.classList.add('hidden');
        }
    });

    // Fechar lista se clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            autocompleteList.classList.add('hidden');
        }
    });

    // --- Lógica de Agendamento ---
    async function handleScheduling() {
        const name = inputs.clientName.value;
        const phone = inputs.clientPhone.value;
        const date = inputs.date.value;
        const time = inputs.time.value;

        if (!name || !phone || !date || !time) {
            Utils.showToast('Preencha os dados do cliente.');
            return;
        }

        const start = Utils.toISOWithOffset(date, time);
        const end = Utils.toISOWithOffset(date, Utils.calculateEndTime(time, inputs.duration.value));

        Utils.showToast('Verificando conflitos...');
        const hasConflict = await GoogleAPI.checkConflicts(new Date(start).toISOString(), new Date(end).toISOString());

        if (hasConflict) {
            modalConflict.classList.remove('hidden');
            return;
        }

        await finalizeBooking(name, phone, start, end);
    }

    async function finalizeBooking(name, phone, start, end) {
        const cleanPhone = Utils.normalizePhone(phone);

        // Título formatado para o seu Apps Script (Wassenger)
        const event = {
            summary: `Corte - ${name} - ${cleanPhone}`,
            start: { dateTime: start, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: end, timeZone: 'America/Sao_Paulo' }
        };

        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast('Agendado com sucesso!');

            // --- WhatsApp: Confirmação Imediata ---
            const dataFmt = new Date(start).toLocaleDateString('pt-BR');
            const horaFmt = new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const msg = encodeURIComponent(`Olá ${name}, confirmo seu horário dia ${dataFmt} às ${horaFmt}. Até lá! ✂️`);

            setTimeout(() => {
                window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank');
            }, 1000);

            // Limpa campos
            inputs.clientName.value = '';
            inputs.clientPhone.value = '';
            inputs.clientSearch.value = '';
        } catch (e) {
            Utils.showToast('Erro ao criar na agenda.');
        }
    }

    buttons.schedule.addEventListener('click', handleScheduling);

    buttons.conflictConfirm.addEventListener('click', () => {
        modalConflict.classList.add('hidden');
        const start = Utils.toISOWithOffset(inputs.date.value, inputs.time.value);
        const end = Utils.toISOWithOffset(inputs.date.value, Utils.calculateEndTime(inputs.time.value, inputs.duration.value));
        finalizeBooking(inputs.clientName.value, inputs.clientPhone.value, start, end);
    });

    buttons.conflictCancel.addEventListener('click', () => modalConflict.classList.add('hidden'));
});