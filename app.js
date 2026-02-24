document.addEventListener('DOMContentLoaded', () => {
    // --- Estado e Elementos ---
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

    // --- Inicialização ---
    GoogleAPI.init();
    inputs.date.value = Utils.getTodayDate();
    inputs.time.value = Utils.getCurrentTime();

    // --- Fluxo de Autenticação ---
    // O botão manual chama o pedido de token do Google
    buttons.authManual.addEventListener('click', () => {
        console.log("Iniciando pedido de Token...");
        GoogleAPI.requestToken();
    });

    // Este evento é disparado pelo google-api.js quando o login tem sucesso
    document.addEventListener('google-auth-success', async () => {
        console.log("Auth Sucesso! Carregando perfil...");
        currentUser = await GoogleAPI.getProfile();

        if (currentUser) {
            document.getElementById('user-name').textContent = currentUser.name;
            const avatar = document.getElementById('user-avatar');
            if (currentUser.picture) {
                avatar.src = currentUser.picture;
                avatar.classList.remove('hidden');
            }

            // Troca de tela: Remove login e mostra agendamento
            sections.login.classList.remove('active');
            sections.scheduling.classList.add('active');

            Utils.showToast(`Bem-vindo, ${currentUser.given_name}!`);

            // Carrega contatos em segundo plano
            await GoogleAPI.fetchContacts();
        }
    });

    buttons.logout.addEventListener('click', () => {
        location.reload();
    });

    // --- Lógica de Autocomplete ---
    inputs.clientSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) {
            autocompleteList.classList.add('hidden');
            return;
        }

        const results = [];
        GoogleAPI.contacts.forEach(c => {
            c.phones.forEach(phone => {
                const clean = phone.replace(/\D/g, '');
                if (c.name.toLowerCase().includes(query) || clean.includes(query)) {
                    results.push({ name: c.name, phone: phone });
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

    // --- Lógica de Agendamento ---
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
        const endTime = Utils.calculateEndTime(time, inputs.duration.value);
        const endISO = Utils.toISOWithOffset(date, endTime);

        // Verificação de conflitos
        Utils.showToast('Verificando agenda...', 1000);
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
            // Título formatado exatamente para o seu Apps Script: Corte - Nome - Telefone
            summary: `Corte - ${name} - ${cleanedPhone}`,
            start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endISO, timeZone: 'America/Sao_Paulo' }
        };

        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast('Agendado! Abrindo WhatsApp...');

            // --- Automação WhatsApp (Confirmação Imediata) ---
            const dataFmt = new Date(startISO).toLocaleDateString('pt-BR');
            const horaFmt = new Date(startISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const mensagem = encodeURIComponent(`Olá ${name}, confirmo seu horário dia ${dataFmt} às ${horaFmt}. Até lá! ✂️`);

            // O Apps Script fará o lembrete automático depois.
            setTimeout(() => {
                window.open(`https://wa.me/55${cleanedPhone}?text=${mensagem}`, '_blank');
            }, 1500);

            // Limpa o formulário
            inputs.clientName.value = '';
            inputs.clientPhone.value = '';
            inputs.clientSearch.value = '';
        } catch (error) {
            console.error(error);
            Utils.showToast('Erro ao criar agendamento.');
        }
    }

    buttons.schedule.addEventListener('click', handleScheduling);

    buttons.conflictConfirm.addEventListener('click', () => {
        modalConflict.classList.add('hidden');
        // Força o agendamento mesmo com conflito
        const startISO = Utils.toISOWithOffset(inputs.date.value, inputs.time.value);
        const endTime = Utils.calculateEndTime(inputs.time.value, inputs.duration.value);
        const endISO = Utils.toISOWithOffset(inputs.date.value, endTime);
        createEvent(inputs.clientName.value, inputs.clientPhone.value, startISO, endISO);
    });

    buttons.conflictCancel.addEventListener('click', () => modalConflict.classList.add('hidden'));

    // Fechar autocomplete ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            autocompleteList.classList.add('hidden');
        }
    });
});