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

    // Inicializa a API
    GoogleAPI.init();

    // Configura valores padrão de data/hora
    inputs.date.value = Utils.getTodayDate();
    inputs.time.value = Utils.getCurrentTime();

    // FUNÇÃO PRINCIPAL: Faz a troca de tela
    async function loginSuccessFlow() {
        console.log("Iniciando fluxo de transição de tela...");
        currentUser = await GoogleAPI.getProfile();

        if (currentUser) {
            console.log("Usuário identificado:", currentUser.name);
            document.getElementById('user-name').textContent = currentUser.name;
            const avatar = document.getElementById('user-avatar');
            if (currentUser.picture) {
                avatar.src = currentUser.picture;
                avatar.classList.remove('hidden');
            }

            // A MUDANÇA DE TELA ACONTECE AQUI
            sections.login.classList.remove('active');
            sections.scheduling.classList.add('active');
            console.log("Tela alterada para Agendamento.");

            Utils.showToast(`Bem-vindo, ${currentUser.given_name}!`);
            await GoogleAPI.fetchContacts();
        } else {
            console.error("Falha ao obter perfil do usuário após login.");
            Utils.showToast("Erro ao carregar perfil.");
        }
    }

    // Escuta o evento vindo do google-api.js
    document.addEventListener('google-auth-success', () => {
        console.log("Evento 'google-auth-success' recebido.");
        loginSuccessFlow();
    });

    // Botão de entrar
    buttons.authManual.addEventListener('click', () => {
        console.log("Botão de login clicado.");
        GoogleAPI.requestToken();
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
            summary: `Corte - ${name} - ${cleanedPhone}`,
            start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endISO, timeZone: 'America/Sao_Paulo' }
        };

        try {
            await GoogleAPI.createEvent(event);
            Utils.showToast('Agendado! Abrindo WhatsApp...');

            const dataFmt = new Date(startISO).toLocaleDateString('pt-BR');
            const horaFmt = new Date(startISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const mensagem = encodeURIComponent(`Olá ${name}, confirmo seu horário dia ${dataFmt} às ${horaFmt}. Até lá! ✂️`);

            setTimeout(() => {
                window.open(`https://wa.me/55${cleanedPhone}?text=${mensagem}`, '_blank');
            }, 1500);

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
        const startISO = Utils.toISOWithOffset(inputs.date.value, inputs.time.value);
        const endTime = Utils.calculateEndTime(inputs.time.value, inputs.duration.value);
        const endISO = Utils.toISOWithOffset(inputs.date.value, endTime);
        createEvent(inputs.clientName.value, inputs.clientPhone.value, startISO, endISO);
    });

    buttons.conflictCancel.addEventListener('click', () => modalConflict.classList.add('hidden'));

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            autocompleteList.classList.add('hidden');
        }
    });
});