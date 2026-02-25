document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", currentEventId = null;

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

    // ==========================================
    // FUNÇÃO AUXILIAR: LIMPA O CELULAR (TIRA O +55 E FORMATOS)
    // ==========================================
    const formatPhoneForInput = (phoneRaw) => {
        if (!phoneRaw) return "";
        let cleaned = phoneRaw.replace(/\D/g, ''); // Remove tudo que não é número
        // Se começar com 55 e tiver tamanho de DDD + Número (ex: 5511999998888)
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
    for (let i = 7; i <= 22; i++) {
        const div = document.createElement('div');
        div.className = 'time-marker';
        div.textContent = i.toString().padStart(2, '0') + ':00';
        timeColumn.appendChild(div);
    }

    const renderWeek = async () => {
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

            let gridHTML = "";
            weekDates.forEach(date => {
                const dateISO = date.toISOString().split('T')[0];
                gridHTML += `<div class="day-strip">`;
                for (let h = 7; h <= 22; h++) {
                    const t = h.toString().padStart(2, '0') + ':00';
                    gridHTML += `<div class="slot-trigger" onclick="window.openBookingForm('${dateISO}','${t}')"></div>`;
                }

                events.filter(e => (e.start.dateTime || e.start.date).startsWith(dateISO)).forEach(ev => {
                    const s = new Date(ev.start.dateTime), e = new Date(ev.end.dateTime);
                    const top = (s.getHours() + s.getMinutes() / 60 - 7) * 60;
                    const height = (e.getHours() + e.getMinutes() / 60 - s.getHours() - s.getMinutes() / 60) * 60;
                    gridHTML += `<div class="event-card" style="top:${top}px; height:${height}px; background:rgba(3,155,229,0.3); border-left:3px solid #039BE5; position:absolute; left:2px; right:2px; border-radius:4px; font-size:9px; color:#fff; font-weight:600; overflow:hidden; z-index:2; pointer-events:auto;" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${ev.summary}','${ev.description || ''}', '${dateISO}', '${s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}')">
                                     ${ev.summary.replace("Corte: ", "")}
                                 </div>`;
                });
                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) { console.error("Erro na agenda:", e); }
    };

    window.openBookingForm = (date, time) => {
        selectedDate = date; currentEventId = null;
        timeInput.value = time;
        document.getElementById('client-name').value = "";
        document.getElementById('client-phone').value = "";
        document.getElementById('client-search').value = "";
        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = "Novo Agendamento";
        document.getElementById('btn-delete-event').classList.add('hidden');
        modalForm.classList.remove('hidden');
    };

    window.editBooking = (id, title, desc, date, time) => {
        currentEventId = id; selectedDate = date;
        timeInput.value = time;
        const name = title.replace("Corte: ", "");
        document.getElementById('client-name').value = name;

        // Aplica a formatação limpa no telefone que veio da descrição
        const rawPhone = desc.replace("Tel: ", "");
        document.getElementById('client-phone').value = formatPhoneForInput(rawPhone);

        document.getElementById('client-search').value = name;
        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = "Editar Agendamento";
        document.getElementById('btn-delete-event').classList.remove('hidden');
        modalForm.classList.remove('hidden');
    };

    document.getElementById('btn-schedule').onclick = async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const timeVal = timeInput.value;
        if (!name || !timeVal) return;
        try {
            if (currentEventId) await GoogleAPI.deleteEvent(currentEventId);
            await GoogleAPI.createEvent({
                summary: `Corte: ${name}`,
                description: `Tel: ${phone}`,
                start: { dateTime: Utils.toISOWithOffset(selectedDate, timeVal), timeZone: 'America/Sao_Paulo' },
                end: { dateTime: Utils.toISOWithOffset(selectedDate, Utils.calculateEndTime(timeVal, document.getElementById('schedule-duration').value)), timeZone: 'America/Sao_Paulo' }
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
        if (e.target.id !== 'client-search') autocompleteList.classList.add('hidden');
    });

    clientSearch.addEventListener('input', async (e) => {
        const q = e.target.value.toLowerCase();
        if (q.length < 2) {
            autocompleteList.classList.add('hidden');
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

        // Aplica a formatação limpa no telefone vindo do Google Contacts
        document.getElementById('client-phone').value = formatPhoneForInput(phone);

        clientSearch.value = name;
        autocompleteList.classList.add('hidden');
    };

    // ==========================================
    // LOGIN SEM RELOAD (MANTÉM O TOKEN SALVO)
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

    document.getElementById('btn-cancel-form').onclick = () => modalForm.classList.add('hidden');
    document.getElementById('btn-logout').onclick = () => { localStorage.removeItem('vitao_user'); location.reload(); };
    document.getElementById('btn-success-close').onclick = () => { document.getElementById('modal-success').classList.add('hidden'); renderWeek(); };

    // ==========================================
    // ABRIR WHATSAPP (CORRIGIDO PARA PWA NO IPHONE)
    // ==========================================
    document.getElementById('btn-open-whatsapp').onclick = () => {
        document.getElementById('modal-success').classList.add('hidden');
        renderWeek();
        // Substitui o window.open problemático por location.href
        window.location.href = urlWhatsAppFinal;
    };

    document.getElementById('btn-delete-event').onclick = async () => { if (confirm("Excluir agendamento?")) { await GoogleAPI.deleteEvent(currentEventId); modalForm.classList.add('hidden'); renderWeek(); } };
});