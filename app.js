document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", selectedTime = "", currentEventId = null;
    const weekHeader = document.getElementById('week-header');
    const daysWrapper = document.getElementById('days-wrapper');
    const timeColumn = document.getElementById('time-column');

    GoogleAPI.init();

    // 1. Gera as horas (08h às 21h)
    const hours = [];
    for (let i = 8; i <= 21; i++) hours.push(`${i.toString().padStart(2, '0')}:00`);
    timeColumn.innerHTML = hours.map(h => `<div class="time-cell">${h}</div>`).join('');

    // 2. Renderiza a semana
    const renderWeek = async () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Inicia no Domingo

        let headHTML = '<div style="width:45px"></div>';
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
                gridHTML += `<div class="day-col">`;
                hours.forEach(h => gridHTML += `<div class="slot-cell" onclick="window.openBookingForm('${dateISO}','${h}')"></div>`);

                // Filtra e posiciona eventos
                events.filter(e => (e.start.dateTime || e.start.date).startsWith(dateISO)).forEach(ev => {
                    const s = new Date(ev.start.dateTime), e = new Date(ev.end.dateTime);
                    const top = (s.getHours() + s.getMinutes() / 60 - 8) * 60;
                    const height = (e.getHours() + e.getMinutes() / 60 - s.getHours() - s.getMinutes() / 60) * 60;
                    gridHTML += `<div class="event-block" style="top:${top}px; height:${height}px" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${ev.summary}','${ev.description || ''}')">
                                     ${ev.summary.replace("Corte: ", "")}
                                 </div>`;
                });
                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) { daysWrapper.innerHTML = "Erro ao carregar."; }
    };

    window.openBookingForm = (date, time) => {
        selectedDate = date; selectedTime = time; currentEventId = null;
        document.getElementById('selected-full-date').textContent = date.split('-').reverse().join('/');
        document.getElementById('selected-slot-title').textContent = `Agendar ${time}`;
        document.getElementById('modal-form').classList.remove('hidden');
    };

    window.editBooking = (id, title, desc) => {
        currentEventId = id;
        document.getElementById('client-name').value = title.replace("Corte: ", "");
        document.getElementById('client-phone').value = desc.replace("Tel: ", "");
        document.getElementById('btn-delete-event').classList.remove('hidden');
        document.getElementById('modal-form').classList.remove('hidden');
    };

    // BOTÃO SALVAR
    document.getElementById('btn-schedule').onclick = async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        if (!name) return;
        if (currentEventId) await GoogleAPI.deleteEvent(currentEventId);
        await GoogleAPI.createEvent({
            summary: `Corte: ${name}`,
            description: `Tel: ${phone}`,
            start: { dateTime: Utils.toISOWithOffset(selectedDate, selectedTime), timeZone: 'America/Sao_Paulo' },
            end: { dateTime: Utils.toISOWithOffset(selectedDate, Utils.calculateEndTime(selectedTime, document.getElementById('schedule-duration').value)), timeZone: 'America/Sao_Paulo' }
        });
        location.reload();
    };

    // Sessão
    const saved = localStorage.getItem('vitao_user');
    if (saved) {
        document.getElementById('user-name').textContent = JSON.parse(saved).name;
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('scheduling-section').classList.add('active');
        renderWeek(); GoogleAPI.fetchContacts();
    }
    document.getElementById('btn-auth-manual').onclick = () => GoogleAPI.requestToken();
    document.addEventListener('google-auth-success', () => location.reload());
    document.getElementById('btn-logout').onclick = () => { localStorage.removeItem('vitao_user'); location.reload(); };
    document.getElementById('btn-cancel-form').onclick = () => document.getElementById('modal-form').classList.add('hidden');
    document.getElementById('btn-delete-event').onclick = async () => { if (confirm("Excluir?")) { await GoogleAPI.deleteEvent(currentEventId); location.reload(); } };
});