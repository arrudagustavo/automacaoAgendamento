document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", currentEventId = null;
    const btnAuth = document.getElementById('btn-auth-manual');
    const weekHeader = document.getElementById('week-header');
    const daysWrapper = document.getElementById('days-wrapper');
    const timeColumn = document.getElementById('time-column');
    const modalForm = document.getElementById('modal-form');
    const timeInput = document.getElementById('schedule-time');

    GoogleAPI.init();

    // Inicia 07:00 - 22:00
    for (let i = 7; i <= 22; i++) {
        const div = document.createElement('div');
        div.className = 'time-marker';
        div.textContent = i.toString().padStart(2, '0') + ':00';
        timeColumn.appendChild(div);
    }

    const renderWeek = async () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Inicia no Domingo da semana vigente

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
                for (let h = 7; h <= 22; h++) {
                    const time = h.toString().padStart(2, '0') + ':00';
                    gridHTML += `<div class="slot-trigger" onclick="window.openBookingForm('${dateISO}','${time}')"></div>`;
                }

                events.filter(e => (e.start.dateTime || e.start.date).startsWith(dateISO)).forEach(ev => {
                    const s = new Date(ev.start.dateTime), e = new Date(ev.end.dateTime);
                    const top = (s.getHours() + s.getMinutes() / 60 - 7) * 60;
                    const height = (e.getHours() + e.getMinutes() / 60 - s.getHours() - s.getMinutes() / 60) * 60;
                    gridHTML += `<div class="event-card" style="top:${top}px; height:${height}px; background:rgba(3,155,229,0.3); border-left:3px solid #039BE5; position:absolute; left:2px; right:2px; border-radius:4px; font-size:8px; color:#fff; font-weight:600; overflow:hidden; z-index:2;" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${ev.summary}','${ev.description || ''}', '${dateISO}', '${s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}')">
                                     ${ev.summary.replace("Corte: ", "")}
                                 </div>`;
                });
                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) { console.error(e); }
    };

    window.openBookingForm = (date, time) => {
        selectedDate = date; currentEventId = null;
        timeInput.value = time;
        document.getElementById('client-name').value = "";
        document.getElementById('client-phone').value = "";
        document.getElementById('client-search').value = "";
        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = "Novo Agendamento";
        document.getElementById('btn-delete-event').classList.add('hidden'); // ESCONDE EM HORÁRIO VAGO
        modalForm.classList.remove('hidden');
    };

    window.editBooking = (id, title, desc, date, time) => {
        currentEventId = id; selectedDate = date;
        timeInput.value = time;
        document.getElementById('client-name').value = title.replace("Corte: ", "");
        document.getElementById('client-phone').value = desc.replace("Tel: ", "");
        document.getElementById('client-search').value = title.replace("Corte: ", "");
        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = "Editar Agendamento";
        document.getElementById('btn-delete-event').classList.remove('hidden'); // MOSTRA EM OCUPADO
        modalForm.classList.remove('hidden');
    };

    // Sessão e Login
    const saved = localStorage.getItem('vitao_user');
    if (saved && saved !== "undefined") {
        document.getElementById('user-name').textContent = JSON.parse(saved).name;
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('scheduling-section').classList.add('active');
        renderWeek();
    }

    if (btnAuth) btnAuth.onclick = (e) => { e.preventDefault(); GoogleAPI.requestToken(); };
    document.addEventListener('google-auth-success', () => location.reload());
    document.getElementById('btn-cancel-form').onclick = () => modalForm.classList.add('hidden');
    document.getElementById('btn-logout').onclick = () => { localStorage.removeItem('vitao_user'); location.reload(); };
    document.getElementById('btn-success-close').onclick = () => { document.getElementById('modal-success').classList.add('hidden'); renderWeek(); };
    document.getElementById('btn-open-whatsapp').onclick = () => { window.open(urlWhatsAppFinal, '_blank'); document.getElementById('modal-success').classList.add('hidden'); renderWeek(); };
});