document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", selectedTime = "", currentEventId = null;
    const btnAuth = document.getElementById('btn-auth-manual');
    const weekHeader = document.getElementById('week-header');
    const daysWrapper = document.getElementById('days-wrapper');
    const timeColumn = document.getElementById('time-column');
    const headerWrapper = document.querySelector('.header-scroll-wrapper');
    const daysScroll = document.querySelector('.days-scroll-container');
    const modalForm = document.getElementById('modal-form');
    const modalSuccess = document.getElementById('modal-success');

    GoogleAPI.init();

    // Sincroniza scroll lateral
    daysScroll.addEventListener('scroll', () => headerWrapper.scrollLeft = daysScroll.scrollLeft);

    // Horas 07:00 - 22:00
    const hours = [];
    for (let i = 7; i <= 22; i++) {
        const h = i.toString().padStart(2, '0') + ':00';
        hours.push(h);
        const div = document.createElement('div');
        div.className = 'time-marker';
        div.textContent = h;
        timeColumn.appendChild(div);
    }

    const renderWeek = async () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());

        let headHTML = "";
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
            const events = await GoogleAPI.listEventsRange(start.toISOString(), new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
            let gridHTML = "";
            weekDates.forEach(date => {
                const dateISO = date.toISOString().split('T')[0];
                gridHTML += `<div class="day-strip">`;
                hours.forEach(h => gridHTML += `<div class="slot-trigger" onclick="window.openBookingForm('${dateISO}','${h}')"></div>`);

                events.filter(e => (e.start.dateTime || e.start.date).startsWith(dateISO)).forEach(ev => {
                    const s = new Date(ev.start.dateTime), e = new Date(ev.end.dateTime);
                    const top = (s.getHours() + s.getMinutes() / 60 - 7) * 60;
                    const height = (e.getHours() + e.getMinutes() / 60 - s.getHours() - s.getMinutes() / 60) * 60;
                    gridHTML += `<div class="event-card" style="top:${top}px; height:${height}px" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${ev.summary}','${ev.description || ''}', '${dateISO}', '${s.getHours().toString().padStart(2, '0')}:00')">
                                     ${ev.summary.replace("Corte: ", "")}
                                 </div>`;
                });
                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) { console.error(e); }
    };

    window.openBookingForm = (date, time) => {
        selectedDate = date; selectedTime = time; currentEventId = null;
        document.getElementById('client-name').value = "";
        document.getElementById('client-phone').value = "";
        document.getElementById('client-search').value = "";
        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = `Agendar ${time}`;
        document.getElementById('btn-delete-event').classList.add('hidden');
        modalForm.classList.remove('hidden');
    };

    window.editBooking = (id, title, desc, date, time) => {
        currentEventId = id;
        selectedDate = date;
        selectedTime = time;
        document.getElementById('client-name').value = title.replace("Corte: ", "");
        document.getElementById('client-phone').value = desc.replace("Tel: ", "");
        document.getElementById('client-search').value = title.replace("Corte: ", "");
        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = `Editar ${time}`;
        document.getElementById('btn-delete-event').classList.remove('hidden');
        modalForm.classList.remove('hidden');
    };

    document.getElementById('btn-schedule').onclick = async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        if (!name) return;
        try {
            if (currentEventId) await GoogleAPI.deleteEvent(currentEventId);
            await GoogleAPI.createEvent({
                summary: `Corte: ${name}`,
                description: `Tel: ${phone}`,
                start: { dateTime: Utils.toISOWithOffset(selectedDate, selectedTime), timeZone: 'America/Sao_Paulo' },
                end: { dateTime: Utils.toISOWithOffset(selectedDate, Utils.calculateEndTime(selectedTime, document.getElementById('schedule-duration').value)), timeZone: 'America/Sao_Paulo' }
            });

            urlWhatsAppFinal = `https://wa.me/55${Utils.normalizePhone(phone)}?text=${encodeURIComponent(`Fala ${name}! Seu horário está confirmado para o dia ${selectedDate.split('-').reverse().join('/')} às ${selectedTime}. Tamo junto!`)}`;
            modalForm.classList.add('hidden');
            modalSuccess.classList.remove('hidden');
        } catch (e) { alert("Erro ao salvar."); }
    };

    // BOTÕES DE SUCESSO
    document.getElementById('btn-open-whatsapp').onclick = () => {
        window.open(urlWhatsAppFinal, '_blank');
        modalSuccess.classList.add('hidden');
        renderWeek(); // Recarrega para garantir que o barbeiro veja o novo corte
    };

    document.getElementById('btn-success-close').onclick = () => {
        modalSuccess.classList.add('hidden');
        renderWeek();
    };

    // LOGIN / SESSÃO
    if (btnAuth) btnAuth.onclick = (e) => { e.preventDefault(); GoogleAPI.requestToken(); };
    document.addEventListener('google-auth-success', async () => {
        const user = await GoogleAPI.getProfile();
        localStorage.setItem('vitao_user', JSON.stringify(user));
        location.reload();
    });

    const saved = localStorage.getItem('vitao_user');
    if (saved) {
        document.getElementById('user-name').textContent = JSON.parse(saved).name;
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('scheduling-section').classList.add('active');
        renderWeek();
        GoogleAPI.fetchContacts();
    }

    document.getElementById('btn-cancel-form').onclick = () => modalForm.classList.add('hidden');
    document.getElementById('btn-logout').onclick = () => { localStorage.removeItem('vitao_user'); location.reload(); };
    document.getElementById('btn-delete-event').onclick = async () => { if (confirm("Excluir agendamento?")) { await GoogleAPI.deleteEvent(currentEventId); modalForm.classList.add('hidden'); renderWeek(); } };

    // Autocomplete
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