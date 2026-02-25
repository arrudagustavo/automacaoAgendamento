document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = "", selectedDate = "", selectedTime = "", currentEventId = null;
    const btnAuth = document.getElementById('btn-auth-manual');
    const weekHeader = document.getElementById('week-header');
    const daysWrapper = document.getElementById('days-wrapper');
    const timeColumn = document.getElementById('time-column');
    const headerWrapper = document.querySelector('.header-scroll-wrapper');
    const daysScroll = document.querySelector('.days-scroll-container');

    GoogleAPI.init();

    // 1. Sincroniza o scroll lateral do cabeçalho com o da grade
    daysScroll.addEventListener('scroll', () => {
        headerWrapper.scrollLeft = daysScroll.scrollLeft;
    });

    // 2. Horários das 07:00 às 22:00
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
        start.setDate(now.getDate() - now.getDay()); // Domingo da semana vigente

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
                    // Cálculo de posição (80px por hora se 60px não for suficiente, ajustado para 60px)
                    const top = (s.getHours() + s.getMinutes() / 60 - 7) * 60;
                    const height = (e.getHours() + e.getMinutes() / 60 - s.getHours() - s.getMinutes() / 60) * 60;
                    gridHTML += `<div class="event-card" style="top:${top}px; height:${height}px" 
                                     onclick="event.stopPropagation(); window.editBooking('${ev.id}','${ev.summary}','${ev.description || ''}')">
                                     ${ev.summary.replace("Corte: ", "")}
                                 </div>`;
                });
                gridHTML += `</div>`;
            });
            daysWrapper.innerHTML = gridHTML;
        } catch (e) { console.error(e); }
    };

    if (btnAuth) {
        btnAuth.onclick = (e) => {
            e.preventDefault();
            GoogleAPI.requestToken();
        };
    }

    document.addEventListener('google-auth-success', async () => {
        const user = await GoogleAPI.getProfile();
        localStorage.setItem('vitao_user', JSON.stringify(user));
        location.reload();
    });

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
    }

    document.getElementById('btn-cancel-form').onclick = () => document.getElementById('modal-form').classList.add('hidden');
    document.getElementById('btn-logout').onclick = () => { localStorage.removeItem('vitao_user'); location.reload(); };
});