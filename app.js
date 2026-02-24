document.addEventListener('DOMContentLoaded', () => {
    let urlWhatsAppFinal = ""; // Variável global para guardar o link

    GoogleAPI.init();

    document.addEventListener('google-auth-success', async () => {
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('scheduling-section').classList.add('active');
        const agora = new Date();
        document.getElementById('schedule-date').value = agora.toISOString().split('T')[0];
        document.getElementById('schedule-time').value = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
        try {
            const user = await GoogleAPI.getProfile();
            document.getElementById('user-name').textContent = user ? user.name : "Barbeiro";
        } catch (e) { document.getElementById('user-name').textContent = "Barbeiro"; }
        await GoogleAPI.fetchContacts();
    });

    // BOTÃO AGENDAR
    document.getElementById('btn-schedule').addEventListener('click', async () => {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const date = document.getElementById('schedule-date').value;
        const time = document.getElementById('schedule-time').value;

        if (!name || !date || !time) { Utils.showToast("Preencha tudo!"); return; }

        try {
            const event = {
                summary: `Corte: ${name}`,
                start: { dateTime: Utils.toISOWithOffset(date, time), timeZone: 'America/Sao_Paulo' },
                end: { dateTime: Utils.toISOWithOffset(date, Utils.calculateEndTime(time, document.getElementById('schedule-duration').value)), timeZone: 'America/Sao_Paulo' }
            };
            await GoogleAPI.createEvent(event);

            // PREPARA O LINK DO WHATSAPP
            const dataF = date.split('-').reverse().join('/');
            const msg = `Fala ${name}! Seu horário está confirmado para o dia ${dataF} às ${time}. Tamo junto!`;
            urlWhatsAppFinal = `https://wa.me/55${Utils.normalizePhone(phone)}?text=${encodeURIComponent(msg)}`;

            // MOSTRA O MODAL DE SUCESSO
            document.getElementById('modal-success').classList.remove('hidden');

        } catch (err) { Utils.showToast("Erro ao agendar."); }
    });

    // BOTÃO DE ABRIR WHATSAPP NO MODAL (O Safari não bloqueia este clique direto!)
    document.getElementById('btn-open-whatsapp').addEventListener('click', () => {
        window.location.href = urlWhatsAppFinal;
    });

    document.getElementById('btn-success-close').addEventListener('click', () => {
        location.reload();
    });
});