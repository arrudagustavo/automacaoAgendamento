document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", currentEventId = null, currentRecurringId = null;
    let currentEventsList = [];

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

    // RELÓGIO DA LINHA VERMELHA 
    setInterval(() => {
        const timeLine = document.querySelector('.current-time-line');
        if (timeLine) {
            const now = new Date();
            if (now.getHours() >= 6 && now.getHours() <= 23) {
                const topPosition = (now.getHours() + now.getMinutes() / 60 - 6) * 60;
                timeLine.style.top = `${topPosition}px`;
                timeLine.style.display = 'block';
            } else {
                timeLine.style.display = 'none';
            }
        }
    }, 60000);

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

    for (let i = 6; i <= 23; i++) {
        const div = document.createElement('div');
        div.className = 'time-marker';
        div.textContent = i.toString().padStart(2, '0') + ':00';
        timeColumn.appendChild(div);
    }

    const renderWeek = async () => {
        if (!GoogleAPI.accessToken) {
            document.getElementById('login-section').classList.add('active');
            document.getElementById('scheduling-section').classList.remove('active');
            return;
        }

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

            // Aqui acontece a busca. Se a permissão não foi dada, vai estourar pro CATCH lá embaixo!
            const events = await GoogleAPI.listEventsRange(timeMin, timeMax);

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
                    const durationMins = Math.round((e - s) / 60000);

                    let displayName = ev.summary;
                    if (displayName.startsWith("Corte: ")) {
                        displayName = displayName.replace("Corte: ", "");
                    } else if (displayName.includes(" - ")) {
                        displayName = displayName.split(" - ")[0];
                    }

                    const startTimeStr = s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const endTimeStr = e.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    const masterId = ev.recurringEventId || '';

                    const safeSummary = (ev.summary || '').replace(/'/g, "\\'");
                    const safeDesc = (ev.description || '').replace(/'/g, "\\'");

                    gridHTML += `<div class="event-card" style="top:${top}px; height:${height}px; background:rgba(3,155,229,0.3); border-left:3px solid #039BE5; position:absolute; left:2px; right:2px; border-radius:4px; color:#fff; overflow:hidden; z-index:2; pointer-events:auto; padding:4px; line-height:1.2; box-sizing:border-box;" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${safeSummary}','${safeDesc}', '${dateISO}', '${startTimeStr}', '${masterId}', '${durationMins}')">
                                     <span style="font-weight:800; font-size:10px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
                                     <span style="font-size:8px; opacity:0.9;">${startTimeStr} - ${endTimeStr}</span>
                                 </div>`;
                });

                if (date.toDateString() === now.toDateString()) {
                    if (now.getHours() >= 6 && now.getHours() <= 23) {
                        const topPosition = (now.getHours() + now.getMinutes() / 60 - 6) * 60;
                        gridHTML += `<div class="current-time-line" style="top:${topPosition}px;"></div>`;
                    }
                }

                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) {
            console.error("Erro na agenda:", e);
            // 🔹 ALERTA VISUAL ADICIONADO AQUI!
            alert("⚠️ Acesso Negado à Agenda!\n\nPor favor, faça o login novamente e certifique-se de MARCAR TODAS AS CAIXINHAS (Agenda e Contatos) na tela do Google.\n\nDetalhe técnico: " + e.message);

            document.getElementById('login-section').classList.add('active');
            document.getElementById('scheduling-section').classList.remove('active');
        }
    };

    window.openBookingForm = (date, time) => {
        const slotDateTime = new Date(Utils.toISOWithOffset(date, time));
        const now = new Date();
        const slotEndDateTime = new Date(slotDateTime.getTime() + 60 * 60 * 1000);

        if (slotEndDateTime <= now) {
            alert("Não é permitido agendar para uma data e/ou horário que já passou.");
            return;
        }

        selectedDate = date;
        currentEventId = null;
        currentRecurringId = null;

        timeInput.value = time;
        document.getElementById('client-name').value = "";
        document.getElementById('client-phone').value = "";
        document.getElementById('client-search').value = "";

        document.getElementById('schedule-duration').value = "60";

        const isRecurringCheck = document.getElementById('is-recurring');
        if (isRecurringCheck) isRecurringCheck.checked = false;

        document.getElementById('recurrence-container').style.display = 'block';
        document.getElementById('edit-scope-container').style.display = 'none';

        const defaultRadio = document.querySelector('input[name="edit-scope"][value="single"]');
        if (defaultRadio) defaultRadio.checked = true;

        const autocompleteList = document.getElementById('autocomplete-list');
        if (autocompleteList) {
            autocompleteList.innerHTML = "";
            autocompleteList.classList.add('hidden');
        }

        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = "Novo Agendamento";

        document.getElementById('btn-delete-event').style.display = 'none';

        modalForm.classList.remove('hidden');
    };

    window.editBooking = (id, title, desc, date, time, masterId, durationMins) => {
        const slotDateTime = new Date(Utils.toISOWithOffset(date, time));
        const now = new Date();
        const slotEndDateTime = new Date(slotDateTime.getTime() + durationMins * 60000);

        if (slotEndDateTime <= now) {
            alert("Este agendamento já passou e não pode ser alterado.");
            return;
        }

        currentEventId = id;
        selectedDate = date;
        currentRecurringId = masterId;
        timeInput.value = time;

        const durationSelect = document.getElementById('schedule-duration');
        if ([...durationSelect.options].some(opt => opt.value === String(durationMins))) {
            durationSelect.value = durationMins;
        } else {
            durationSelect.value = "60";
        }

        document.getElementById('recurrence-container').style.display = 'none';

        if (currentRecurringId) {
            document.getElementById('edit-scope-container').style.display = 'block';
        } else {
            document.getElementById('edit-scope-container').style.display = 'none';
        }

        const defaultRadio = document.querySelector('input[name="edit-scope"][value="single"]');
        if (defaultRadio) defaultRadio.checked = true;

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

        document.getElementById('btn-delete-event').style.display = 'block';

        modalForm.classList.remove('hidden');
    };

    document.getElementById('btn-schedule').onclick = async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const timeVal = timeInput.value;
        const duration = document.getElementById('schedule-duration').value;
        if (!name || !timeVal) return;

        const startISO = Utils.toISOWithOffset(selectedDate, timeVal);
        const endISO = Utils.toISOWithOffset(selectedDate, Utils.calculateEndTime(timeVal, duration));

        const endDateTime = new Date(endISO);

        if (endDateTime <= new Date()) {
            alert("Não é permitido agendar para uma data e/ou horário que já passou.");
            return;
        }

        const isRecurring = document.getElementById('is-recurring').checked;
        const editScope = document.querySelector('input[name="edit-scope"]:checked')?.value;

        // ANTI-CONFLITO
        const hasConflict = currentEventsList.find(ev => {
            if (ev.id === currentEventId) return false;
            if (currentRecurringId && editScope === 'following' && ev.recurringEventId === currentRecurringId) return false;

            const startDateTime = new Date(startISO);
            const evStart = new Date(ev.start.dateTime || ev.start.date);
            const evEnd = new Date(ev.end.dateTime || ev.end.date);
            return (startDateTime < evEnd && endDateTime > evStart);
        });

        if (hasConflict) {
            let conflictName = hasConflict.summary;
            if (conflictName.startsWith("Corte: ")) conflictName = conflictName.replace("Corte: ", "");
            else if (conflictName.includes(" - ")) conflictName = conflictName.split(" - ")[0];

            alert(`Conflito de horário!\nJá existe um agendamento para ${conflictName} nesta mesma data e hora.`);
            return;
        }

        try {
            const eventPayload = {
                summary: `${name} - ${phone}`,
                description: `Tel: ${phone}`,
                start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: endISO, timeZone: 'America/Sao_Paulo' }
            };

            if (!currentEventId && isRecurring) {
                eventPayload.recurrence = ['RRULE:FREQ=WEEKLY'];
            } else if (currentEventId && currentRecurringId && editScope === 'following') {
                eventPayload.recurrence = ['RRULE:FREQ=WEEKLY'];
            }

            if (currentEventId) {
                if (currentRecurringId && editScope === 'following') {
                    await GoogleAPI.deleteEvent(currentRecurringId);
                } else {
                    await GoogleAPI.deleteEvent(currentEventId);
                }
            }

            await GoogleAPI.createEvent(eventPayload);

            urlWhatsAppFinal = `https://wa.me/55${Utils.normalizePhone(phone)}?text=${encodeURIComponent(`Fala ${name}! Seu horário está confirmado para o dia ${selectedDate.split('-').reverse().join('/')} às ${timeVal}. Tamo junto!`)}`;
            modalForm.classList.add('hidden');
            document.getElementById('modal-success').classList.remove('hidden');
        } catch (e) { alert("Erro ao salvar."); }
    };

    // AUTO-COMPLETE PODEROSO
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

    // LOGIN E PERSISTÊNCIA 
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
            // 🔹 ALERTA ADICIONADO AQUI TAMBÉM
            alert("Erro na autorização do Google. Verifique sua conexão e permissões.");
        }
    });

    const saved = localStorage.getItem('vitao_user');
    if (saved && saved !== "undefined") {
        document.getElementById('user-name').textContent = JSON.parse(saved).name;

        if (GoogleAPI.accessToken) {
            document.getElementById('login-section').classList.remove('active');
            document.getElementById('scheduling-section').classList.add('active');
            renderWeek();
            GoogleAPI.fetchContacts();
        } else {
            document.getElementById('login-section').classList.add('active');
            document.getElementById('scheduling-section').classList.remove('active');
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

    document.getElementById('btn-delete-event').onclick = async () => {
        if (confirm("Excluir agendamento?")) {
            const editScope = document.querySelector('input[name="edit-scope"]:checked')?.value;
            if (currentRecurringId && editScope === 'following') {
                await GoogleAPI.deleteEvent(currentRecurringId);
            } else {
                await GoogleAPI.deleteEvent(currentEventId);
            }
            modalForm.classList.add('hidden');
            renderWeek();
        }
    };
});