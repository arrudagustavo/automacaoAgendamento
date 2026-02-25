document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "";
    let selectedTime = "";
    let currentEventId = null;

    const loginSection = document.getElementById('login-section');
    const schedulingSection = document.getElementById('scheduling-section');
    const agendaGrid = document.getElementById('agenda-grid');
    const dateInput = document.getElementById('schedule-date');
    const modalForm = document.getElementById('modal-form');
    const btnAuth = document.getElementById('btn-auth-manual');

    // 1. INICIALIZAÇÃO DA API
    const initApp = () => {
        if (typeof google !== 'undefined' && typeof GoogleAPI !== 'undefined') {
            GoogleAPI.init();
            console.log("Google API Pronta.");
        } else {
            setTimeout(initApp, 300);
        }
    };
    initApp();

    // 2. FUNÇÃO DE LOGIN (BLINDADA)
    if (btnAuth) {
        btnAuth.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Solicitando login...");
            if (GoogleAPI.accessToken) {
                // Se já tem token, apenas pula para a agenda
                document.dispatchEvent(new CustomEvent('google-auth-success'));
            } else {
                GoogleAPI.requestToken();
            }
        });
    }

    // 3. PERSISTÊNCIA DE SESSÃO
    const savedUser = localStorage.getItem('vitao_user');
    if (savedUser) {
        document.getElementById('user-name').textContent = JSON.parse(savedUser).name;
        loginSection.classList.remove('active');
        schedulingSection.classList.add('active');
        dateInput.value = new Date().toISOString().split('T')[0];
        renderTimeline();
        // Carrega contatos em segundo plano
        setTimeout(() => GoogleAPI.fetchContacts(), 1000);
    }

    document.addEventListener('google-auth-success', async () => {
        const user = await GoogleAPI.getProfile();
        if (user) localStorage.setItem('vitao_user', JSON.stringify(user));
        loginSection.classList.remove('active');
        schedulingSection.classList.add('active');
        dateInput.value = new Date().toISOString().split('T')[0];
        renderTimeline();
        await GoogleAPI.fetchContacts();
    });

    // 4. LÓGICA DA GRADE DE HORÁRIOS (REVISADA)
    async function renderTimeline() {
        if (!dateInput.value) return;
        agendaGrid.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">Buscando horários...</p>';

        try {
            const occupiedEvents = await GoogleAPI.listEvents(dateInput.value);
            const slots = [];
            for (let h = 8; h <= 20; h++) {
                slots.push(`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`);
            }

            agendaGrid.innerHTML = slots.map(slotTime => {
                const event = occupiedEvents.find(ev => {
                    const start = new Date(ev.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const end = new Date(ev.end.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return slotTime >= start && slotTime < end;
                });

                if (event) {
                    const clientName = event.summary.replace("Corte: ", "");
                    return `<div class="slot ocupado" onclick="window.editBooking('${slotTime}', '${event.id}', '${clientName}', '${event.description || ""}')">
                                <div class="time">${slotTime}</div>
                                <div class="info">${event.summary}</div>
                            </div>`;
                }
                return `<div class="slot vago" onclick="window.openBookingForm('${slotTime}')">
                            <div class="time">${slotTime}</div>
                            <div class="info">Disponível</div>
                        </div>`;
            }).join('');
        } catch (e) {
            agendaGrid.innerHTML = '<p>Erro ao sincronizar. Faça login novamente.</p>';
        }
    }

    // 5. FUNÇÕES DE AGENDAMENTO (EXPOSTAS AO WINDOW PARA O ONCLICK FUNCIONAR)
    window.openBookingForm = (time) => {
        currentEventId = null;
        selectedTime = time;
        document.getElementById('btn-delete-event').classList.add('hidden');
        document.getElementById('selected-slot-title').textContent = `Agendar às ${time}`;
        document.getElementById('client-name').value = "";
        document.getElementById('client-phone').value = "";
        document.getElementById('client-search').value = "";
        modalForm.classList.remove('hidden');
    };

    window.editBooking = (time, id, name, desc) => {
        currentEventId = id;
        selectedTime = time;
        document.getElementById('btn-delete-event').classList.remove('hidden');
        document.getElementById('selected-slot-title').textContent = `Editar: ${time}`;
        document.getElementById('client-name').value = name;
        document.getElementById('client-search').value = name;
        document.getElementById('client-phone').value = desc.replace("Tel: ", "");
        modalForm.classList.remove('hidden');
    };

    // 6. EVENTOS DE BOTÕES
    document.getElementById('btn-delete-event').addEventListener('click', async () => {
        if (confirm("Excluir este agendamento?")) {
            await GoogleAPI.deleteEvent(currentEventId);
            modalForm.classList.add('hidden');
            renderTimeline();
        }
    });

    document.getElementById('btn-schedule').addEventListener('click', async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        if (!name) return;
        try {
            if (currentEventId) await GoogleAPI.deleteEvent(currentEventId);
            await GoogleAPI.createEvent({
                summary: `Corte: ${name}`,
                description: `Tel: ${phone}`,
                start: { dateTime: Utils.toISOWithOffset(dateInput.value, selectedTime), timeZone: 'America/Sao_Paulo' },
                end: { dateTime: Utils.toISOWithOffset(dateInput.value, Utils.calculateEndTime(selectedTime, document.getElementById('schedule-duration').value)), timeZone: 'America/Sao_Paulo' }
            });
            modalForm.classList.add('hidden');
            renderTimeline();
            urlWhatsAppFinal = `https://wa.me/55${Utils.normalizePhone(phone)}?text=${encodeURIComponent(`Fala ${name}! Seu horário está confirmado para o dia ${dateInput.value.split('-').reverse().join('/')} às ${selectedTime}. Tamo junto!`)}`;
            document.getElementById('modal-success').classList.remove('hidden');
        } catch (e) { alert("Erro ao salvar."); }
    });

    dateInput.addEventListener('change', renderTimeline);
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('vitao_user');
        location.reload();
    });
    document.getElementById('btn-cancel-form').addEventListener('click', () => modalForm.classList.add('hidden'));
    document.getElementById('btn-open-whatsapp').addEventListener('click', () => window.location.href = urlWhatsAppFinal);
    document.getElementById('btn-success-close').addEventListener('click', () => document.getElementById('modal-success').classList.add('hidden'));

    // 7. AUTOCOMPLETE
    const clientSearch = document.getElementById('client-search');
    const autocompleteList = document.getElementById('autocomplete-list');
    clientSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        if (q.length < 2) { autocompleteList.classList.add('hidden'); return; }
        const results = [];
        GoogleAPI.contacts.forEach(c => {
            if (c.name.toLowerCase().includes(q)) c.phones.forEach(p => results.push({ name: c.name, phone: p }));
        });
        autocompleteList.innerHTML = results.slice(0, 5).map(r => `<li onclick="window.selectClient('${r.name}', '${r.phone}')"><strong>${r.name}</strong><br>${r.phone}</li>`).join('');
        autocompleteList.classList.remove('hidden');
    });

    window.selectClient = (name, phone) => {
        document.getElementById('client-name').value = name;
        document.getElementById('client-phone').value = phone;
        clientSearch.value = name;
        autocompleteList.classList.add('hidden');
    };
});