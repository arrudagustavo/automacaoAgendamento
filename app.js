document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", currentEventId = null;
    let currentEventsList = []; // Nova variável global para checar conflitos

    let currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    const btnAuth = document.getElementById('btn-auth-manual');
    const weekHeader = document.getElementById('week-header');
    const daysWrapper = document.getElementById('days-wrapper');
    const timeColumn = document.getElementById('time-column');
    const modalForm = document.getElementById('modal-form');
    const timeInput = document.getElementById('schedule-time');
    const calendarViewport = document.querySelector('.calendar-viewport');

    const formatPhoneForInput = (phoneRaw) => {
        if (!phoneRaw) return "";
        let cleaned = phoneRaw.replace(/\D/g, '');
        if (cleaned.startsWith('55') && cleaned.length >= 12) {
            cleaned = cleaned.substring(2);
        }
        return cleaned;
    };

    const initApp = () => {
        if (typeof google !== 'undefined' && typeof GoogleAPI !== 'undefined') {
            GoogleAPI.init();
        } else {
            setTimeout(initApp, 200);
        }
    };
    initApp();

    if (btnAuth) {
        btnAuth.addEventListener('click', (e) => {
            e.preventDefault();
            if (GoogleAPI.client) GoogleAPI.requestToken();
            else alert("Aguarde, conectando ao Google...");
        });
    }

    // SWIPE PARA IPHONE
    let touchStartX = 0;
    let touchEndX = 0;
    if (calendarViewport) {
        calendarViewport.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, { passive: true });
        calendarViewport.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            else currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            renderWeek();
        }
    }

    // GERA HORÁRIOS DA GRADE
    for (let i = 6; i <= 23; i++) {
        const div = document.createElement('div');
        div.className = 'time-marker';
        div.textContent = i.toString().padStart(2, '0') + ':00';
        timeColumn.appendChild(div);
    }

    const renderWeek = async () => {
        if (!GoogleAPI.accessToken) return;

        const now = new Date();
        const start = new Date(currentWeekStart);

        const monthStr = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const monthEl = document.getElementById('current-month');
        if (monthEl) monthEl.textContent = monthStr;

        let headHTML = "<div></div>";
        const weekDates = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(start); d.setDate(start.getDate() + i);
            weekDates.push(d);
            const isToday = d.toDateString() === now.toDateString();
            headHTML += `<div class="day-label ${isToday ? 'today' : ''}">
                            ${d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}
                            <span class="day-num">${d.getDate()}</span>
                         </div>`;
        }
        weekHeader.innerHTML = headHTML;

        try {
            const timeMin = start.toISOString();
            const timeMax = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const events = await GoogleAPI.listEventsRange(timeMin, timeMax);

            // Salva na memória para validar conflitos mais tarde
            currentEventsList = events;

            let gridHTML = "";
            weekDates.forEach(date => {
                const dateISO = date.toISOString().split('T')[0];
                gridHTML += `<div class="day-strip">`;

                for (let h = 6; h <= 23; h++) {
                    const t = h.toString().padStart(2, '0') + ':00';
                    gridHTML += `<div class="slot-trigger" onclick="window.openBookingForm('${dateISO}','${t}')"></div>`;
                }

                events.filter(e => (e.start.dateTime || e.start.date).startsWith(dateISO)).forEach(ev => {
                    const s = new Date(ev.start.dateTime);
                    const e = new Date(ev.end.dateTime);
                    const top = (s.getHours() + s.getMinutes() / 60 - 6) * 60;
                    const height = (e.getHours() + e.getMinutes() / 60 - s.getHours() - s.getMinutes() / 60) * 60;

                    let displayName = ev.summary;
                    if (displayName.startsWith("Corte: ")) {
                        displayName = displayName.replace("Corte: ", "");
                    } else if (displayName.includes(" - ")) {
                        displayName = displayName.split(" - ")[0];
                    }

                    // Formatação do tempo para exibição
                    const startTimeStr = s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const endTimeStr = e.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    gridHTML += `<div class="event-card" style="top:${top}px; height:${height}px; background:rgba(3,155,229,0.3); border-left:3px solid #039BE5; position:absolute; left:2px; right:2px; border-radius:4px; color:#fff; overflow:hidden; z-index:2; pointer-events:auto; padding:4px; line-height:1.2; box-sizing:border-box;" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${ev.summary}','${ev.description || ''}', '${dateISO}', '${startTimeStr}')">
                                     <span style="font-weight:800; font-size:10px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
                                     <span style="font-size:8px; opacity:0.9;">${startTimeStr} - ${endTimeStr}</span>
                                 </div>`;
                });
                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) { console.error("Erro na agenda:", e); }
    };

    window.openBookingForm = (date, time) => {
        // VALIDAÇÃO: Impede criar agendamento no passado
        const slotDateTime = new Date(Utils.toISOWithOffset(date, time));
        if (slotDateTime < new Date()) {
            alert("Não é permitido agendar em um horário que já passou.");
            return;
        }

        selectedDate = date; currentEventId = null;
        timeInput.value = time;
        document.getElementById('client-name').value = "";
        document.getElementById('client-phone').value = "";
        document.getElementById('client-search').value = "";

        const autocompleteList = document.getElementById('autocomplete-list');
        if (autocompleteList) {
            autocompleteList.innerHTML = "";
            autocompleteList.classList.add('hidden');
        }

        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = "Novo Agendamento";
        document.getElementById('btn-delete-event').classList.add('hidden');
        modalForm.classList.remove('hidden');
    };

    window.editBooking = (id, title, desc, date, time) => {
        // VALIDAÇÃO: Impede editar agendamento que já passou
        const slotDateTime = new Date(Utils.toISOWithOffset(date, time));
        if (slotDateTime < new Date()) {
            alert("Este agendamento já passou e não pode ser alterado.");
            return;
        }

        currentEventId = id; selectedDate = date;
        timeInput.value = time;

        let name = title;
        if (title.startsWith("Corte: ")) {
            name = title.replace("Corte: ", "");
        } else if (title.includes(" - ")) {
            name = title.split(" - ")[0];
        }

        document.getElementById('client-name').value = name;

        const rawPhone = desc.replace("Tel: ", "");
        document.getElementById('client-phone').value = formatPhoneForInput(rawPhone);

        document.getElementById('client-search').value = name;

        const autocompleteList = document.getElementById('autocomplete-list');
        if (autocompleteList) {
            autocompleteList.innerHTML = "";
            autocompleteList.classList.add('hidden');
        }

        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = "Editar Agendamento";
        document.getElementById('btn-delete-event').classList.remove('hidden');
        modalForm.classList.remove('hidden');
    };

    document.getElementById('btn-schedule').onclick = async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const timeVal = timeInput.value;
        const duration = document.getElementById('schedule-duration').value;
        if (!name || !timeVal) return;

        // Calcula as datas de início e fim do novo agendamento
        const startISO = Utils.toISOWithOffset(selectedDate, timeVal);
        const endISO = Utils.toISOWithOffset(selectedDate, Utils.calculateEndTime(timeVal, duration));

        const startDateTime = new Date(startISO);
        const endDateTime = new Date(endISO);

        // VALIDAÇÃO EXTRA: Proteção caso a pessoa mude o horário dentro da modal para o passado
        if (startDateTime < new Date()) {
            alert("O horário selecionado já passou.");
            return;
        }

        // SISTEMA ANTI-CONFLITO: Varre a lista de eventos atual
        const hasConflict = currentEventsList.find(ev => {
            if (ev.id === currentEventId) return false; // Ignora se for o evento que ele está editando

            const evStart = new Date(ev.start.dateTime || ev.start.date);
            const evEnd = new Date(ev.end.dateTime || ev.end.date);

            // Lógica de sobreposição de horário
            return (startDateTime < evEnd && endDateTime > evStart);
        });

        if (hasConflict) {
            let conflictName = hasConflict.summary;
            if (conflictName.startsWith("Corte: ")) conflictName = conflictName.replace("Corte: ", "");
            else if (conflictName.includes(" - ")) conflictName = conflictName.split(" - ")[0];

            alert(`Conflito de horário!\nJá existe um agendamento para ${conflictName} neste momento.`);
            return;
        }

        try {
            if (currentEventId) await GoogleAPI.deleteEvent(currentEventId);
            await GoogleAPI.createEvent({
                summary: `${name} - ${phone}`,
                description: `Tel: ${phone}`,
                start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: endISO, timeZone: 'America/Sao_Paulo' }
            });
            urlWhatsAppFinal = `https://wa.me/55${Utils.normalizePhone(phone)}?text=${encodeURIComponent(`Fala ${name}! Seu horário está confirmado para o dia ${selectedDate.split('-').reverse().join('/')} às ${timeVal}. Tamo junto!`)}`;
            modalForm.classList.add('hidden');
            document.getElementById('modal-success').classList.remove('hidden');
        } catch (e) { alert("Erro ao salvar."); }
    };

    // ==========================================
    // AUTO-COMPLETE PODEROSO
    // ==========================================
    const clientSearch = document.getElementById('client-search');
    const autocompleteList = document.getElementById('autocomplete-list');

    document.addEventListener('click', (e) => {
        if (e.target.id !== 'client-search') {
            autocompleteList.classList.add('hidden');
            autocompleteList.innerHTML = "";
        }
    });

    clientSearch.addEventListener('input', async (e) => {
        const q = e.target.value.toLowerCase();
        if (q.length < 2) {
            autocompleteList.classList.add('hidden');
            autocompleteList.innerHTML = "";
            return;
        }

        if (GoogleAPI.contacts.length === 0 && GoogleAPI.accessToken) {
            await GoogleAPI.fetchContacts();
        }

        const results = [];
        if (GoogleAPI.contacts.length > 0) {
            GoogleAPI.contacts.forEach(c => {
                const nameMatch = c.name && c.name.toLowerCase().includes(q);

                const qNum = q.replace(/\D/g, '');
                const phoneMatch = c.phones && c.phones.some(p => {
                    if (!p) return false;
                    const pNum = p.replace(/\D/g, '');
                    return qNum.length > 2 && pNum.includes(qNum);
                });

                if (nameMatch || phoneMatch) {
                    if (c.phones && c.phones.length > 0) {
                        c.phones.forEach(p => results.push({ name: c.name, phone: p }));
                    } else {
                        results.push({ name: c.name, phone: '' });
                    }
                }
            });
        }

        if (results.length > 0) {
            autocompleteList.innerHTML = results.slice(0, 5).map(r => `<li onclick="window.selectClient('${r.name}', '${r.phone}')"><strong>${r.name}</strong><br>${r.phone || 'Sem número'}</li>`).join('');
            autocompleteList.classList.remove('hidden');
        } else {
            autocompleteList.innerHTML = `<li style="padding: 15px; color: #888; font-size: 13px; text-align: center;">Nenhum contato encontrado</li>`;
            autocompleteList.classList.remove('hidden');
        }
    });

    window.selectClient = (name, phone) => {
        document.getElementById('client-name').value = name;
        document.getElementById('client-phone').value = formatPhoneForInput(phone);
        clientSearch.value = name;
        autocompleteList.classList.add('hidden');
        autocompleteList.innerHTML = "";
    };

    // ==========================================
    // LOGIN E PERSISTÊNCIA
    // ==========================================
    document.addEventListener('google-auth-success', async () => {
        try {
            const user = await GoogleAPI.getProfile();
            localStorage.setItem('vitao_user', JSON.stringify(user));

            document.getElementById('user-name').textContent = user.name;
            document.getElementById('login-section').classList.remove('active');
            document.getElementById('scheduling-section').classList.add('active');

            await GoogleAPI.fetchContacts();
            renderWeek();
        } catch (e) {
            console.error("Erro no pós-login", e);
        }
    });

    const saved = localStorage.getItem('vitao_user');
    if (saved && saved !== "undefined") {
        document.getElementById('user-name').textContent = JSON.parse(saved).name;
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('scheduling-section').classList.add('active');

        if (GoogleAPI.accessToken) {
            renderWeek();
            GoogleAPI.fetchContacts();
        }
    }

    document.getElementById('btn-cancel-form').onclick = () => {
        modalForm.classList.add('hidden');
        if (autocompleteList) autocompleteList.innerHTML = "";
    };
    document.getElementById('btn-logout').onclick = () => { localStorage.removeItem('vitao_user'); location.reload(); };
    document.getElementById('btn-success-close').onclick = () => { document.getElementById('modal-success').classList.add('hidden'); renderWeek(); };

    document.getElementById('btn-open-whatsapp').onclick = () => {
        document.getElementById('modal-success').classList.add('hidden');
        renderWeek();
        window.location.href = urlWhatsAppFinal;
    };

    document.getElementById('btn-delete-event').onclick = async () => { if (confirm("Excluir agendamento?")) { await GoogleAPI.deleteEvent(currentEventId); modalForm.classList.add('hidden'); renderWeek(); } };
});