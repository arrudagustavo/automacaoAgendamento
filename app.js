document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", selectedTime = "", currentEventId = null;
    const btnAuth = document.getElementById('btn-auth-manual');
    const weekHeader = document.getElementById('week-header');
    const daysWrapper = document.getElementById('days-wrapper');
    const timeColumn = document.getElementById('time-column');

    GoogleAPI.init();

    // Inicia Horários
    const hours = [];
    for (let i = 8; i <= 21; i++) {
        const h = i.toString().padStart(2, '0') + ':00';
        hours.push(h);
        const div = document.createElement('div');
        div.className = 'time-marker';
        div.textContent = h;
        timeColumn.appendChild(div);
    }

    // FIX LOGIN: Atribuição direta para evitar conflitos de eventos
    if (btnAuth) {
        btnAuth.onclick = (e) => {
            e.preventDefault();
            console.log("Clique no Login detectado!");
            GoogleAPI.requestToken();
        };
    }

    const renderWeek = async () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());

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
            const timeMin = start.toISOString();
            const timeMax = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const events = await GoogleAPI.listEventsRange(timeMin, timeMax);

            let gridHTML = "";
            weekDates.forEach(date => {
                const dateISO = date.toISOString().split('T')[0];
                gridHTML += `<div class="day-strip">`;
                hours.forEach(h => gridHTML += `<div class="slot-trigger" onclick="window.openBookingForm('${dateISO}','${h}')"></div>`);

                events.filter(e => (e.start.dateTime || e.start.date).startsWith(dateISO)).forEach(ev => {
                    const s = new Date(ev.start.dateTime), e = new Date(ev.end.dateTime);
                    const top = (s.getHours() + s.getMinutes() / 60 - 8) * 60;
                    const height = (e.getHours() + e.getMinutes() / 60 - s.getHours() - s.getMinutes() / 60) * 60;
                    gridHTML += `<div class="event-card" style="top:${top}px; height:${height}px" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${ev.summary}','${ev.description || ''}')">
                                     ${ev.summary.replace("Corte: ", "")}
                                 </div>`;
                });
                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) { daysWrapper.innerHTML = "<p>Erro ao carregar agenda.</p>"; }
    };

    document.addEventListener('google-auth-success', async () => {
        const user = await GoogleAPI.getProfile();
        localStorage.setItem('vitao_user', JSON.stringify(user));
        location.reload();
    });

    // Funções Globais
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

    const saved = localStorage.getItem('vitao_user');
    if (saved) {
        document.getElementById('user-name').textContent = JSON.parse(saved).name;
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('scheduling-section').classList.add('active');
        renderWeek();
        GoogleAPI.fetchContacts();
    }

    document.getElementById('btn-cancel-form').onclick = () => document.getElementById('modal-form').classList.add('hidden');
    document.getElementById('btn-logout').onclick = () => { localStorage.removeItem('vitao_user'); location.reload(); };
});