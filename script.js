// ==========================================
// ШАГ 1: БАЗОВЫЕ ДАННЫЕ И ИНИЦИАЛИЗАЦИЯ
// ==========================================

// Справочный массив всех строений на карте Резервуара (из вашего скриншота)
const buildingsData = [
    { id: "center_res", name: "Центральный резервуар", time: "через 15 минут", capture: 9000, hold: 1200, bonus: "-", maxPlayers: 8 },
    { id: "water_1", name: "Водоочистительный центр 1", time: "Сразу", capture: 6000, hold: 1200, bonus: "-", maxPlayers: 5 },
    { id: "water_2", name: "Водоочистительный центр 2", time: "Сразу", capture: 6000, hold: 1200, bonus: "-", maxPlayers: 5 },
    { id: "factory_1", name: "Водоперерабатывающий завод 1", time: "Сразу", capture: 3000, hold: 600, bonus: "-", maxPlayers: 3 },
    { id: "factory_2", name: "Водоперерабатывающий завод 2", time: "Сразу", capture: 3000, hold: 600, bonus: "-", maxPlayers: 3 },
    { id: "factory_3", name: "Водоперерабатывающий завод 3", time: "Сразу", capture: 3000, hold: 600, bonus: "-", maxPlayers: 3 },
    { id: "factory_4", name: "Водоперерабатывающий завод 4", time: "Сразу", capture: 3000, hold: 600, bonus: "-", maxPlayers: 3 },
    { id: "military", name: "Военный завод", time: "через 15 минут", capture: 1200, hold: 240, bonus: "Урон и Защита +20%", maxPlayers: 4 },
    { id: "dev_complex", name: "Комплекс разработки", time: "через 15 минут", capture: 1200, hold: 240, bonus: "Зараженные", maxPlayers: 3 },
    { id: "heliport", name: "Вертолетная площадка", time: "Сразу", capture: 1200, hold: 240, bonus: "Кд релока -50%", maxPlayers: 3 },
    { id: "solar", name: "Солнечная станция", time: "Сразу", capture: 1200, hold: 240, bonus: "Время захвата -50%", maxPlayers: 2 },
    { id: "barrels", name: "Бочки", time: "с 36 минуты", capture: 0, hold: 240, bonus: "-", maxPlayers: 10 }
];

// Загрузка списка участников союза из локальной памяти браузера (LocalStorage)
// Переменная, куда запишется список игроков после загрузки из файла
let players = [];

// Переменная для хранения последнего тактического распределения (его пока оставим в памяти браузера)
let lastDistribution = JSON.parse(localStorage.getItem('uni_distribution')) || {};

// Главный триггер: сначала скачивает файл, а потом включает всё остальное
window.onload = function() {
    // Асинхронно читаем файл players.json
    fetch('players.json')
        .then(response => {
            if (!response.ok) throw new Error('Не удалось найти файл players.json');
            return response.json();
        })
        .then(data => {
            // Записываем данные в наш массив и добавляем им базовые статусы
            players = data.map(p => ({
                name: p.name,
                power: parseFloat(p.power),
                status: 'none',  // по умолчанию никто не идет
                attended: null   // статус явки неизвестен
            }));
            
            // Сортируем по силе от большего к меньшему
            players.sort((a, b) => b.power - a.power);

            // Отрисовываем интерфейс, когда данные готовы
            renderBuildingsTable();
            renderAdminTable();
            renderDistributionGrid();
        })
        .catch(error => {
            console.error('Ошибка загрузки состава:', error);
            alert('Внимание: не удалось загрузить список игроков из файла players.json. Если вы запустили сайт локально на компьютере, это нормально (сработало ограничение браузера). На GitHub всё будет работать!');
            
            // Заглушка, чтобы сайт не ломался при локальном запуске без сервера
            renderBuildingsTable();
        });
};

// Функция переключения вкладок меню (Восстановленная и исправленная)
function switchTab(tabId) {
    // Скрываем все вкладки и убираем подсветку у всех кнопок меню
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    // Показываем нужную вкладку
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Безопасно подсвечиваем кнопку, на которую нажали
    if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    } else if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    }
}

// Вспомогательная функция сохранения
function saveData() {
    localStorage.setItem('uni_players', JSON.stringify(players));
}


// ==========================================
// ШАГ 2: ПАНЕЛЬ УПРАВЛЕНИЯ (ЛОГИКА АДМИНКИ)
// ==========================================

// Функция генерации и обновления таблицы игроков на экране управления
function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    
    // Если игроков в базе еще нет, показываем сообщение-подсказку
    if (players.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Список пуст. Добавьте первых бойцов выше.</td></tr>`;
        return;
    }

    // Проходимся по каждому игроку и формируем строку таблицы
    tbody.innerHTML = players.map((player, index) => {
        // Определяем цвет плашки и текст в зависимости от статуса участия (галок)
        let statusClass = 'status-none';
        let statusText = 'Не идет';
        if (player.status === 'main') { statusClass = 'status-main'; statusText = '🟢 Основа'; }
        if (player.status === 'reserve') { statusClass = 'status-reserve'; statusText = '🟠 Резерв'; }

        // Формируем кнопки отслеживания явки (был / пропустил)
        let attendanceHtml = `
            <button class="attendance-btn ${player.attended === true ? 'present' : ''}" onclick="toggleAttendance(${index}, true)" title="Был на битве">✅</button>
            <button class="attendance-btn ${player.attended === false ? 'absent' : ''}" onclick="toggleAttendance(${index}, false)" title="Пропустил">❌</button>
        `;

        return `
            <tr>
                <td><b>${player.name}</b></td>
                <td style="color: var(--warning-color); font-weight: bold;">${player.power}</td>
                <td><span class="status-badge ${statusClass}" onclick="togglePlayerStatus(${index})">${statusText}</span></td>
                <td>${attendanceHtml}</td>
                <td><button class="attendance-btn" style="color: var(--danger-color);" onclick="deletePlayer(${index})" title="Удалить игрока">🗑️</button></td>
            </tr>
        `;
    }).join('');
}

// Функция добавления нового бойца в систему
function addPlayer() {
    const nameInput = document.getElementById('newPlayerName');
    const powerInput = document.getElementById('newPlayerPower');
    
    // Валидация полей ввода
    if (!nameInput.value.trim() || !powerInput.value) {
        alert('Пожалуйста, введите никнейм и боевую мощь (БМ)!');
        return;
    }

    // Добавляем новый объект игрока в наш рабочий массив
    players.push({
        name: nameInput.value.trim(),
        power: parseFloat(powerInput.value),
        status: 'none', // по умолчанию игрок числится неактивным
        attended: null  // статус явки до начала боя не задан
    });

    // Сортируем союз по убыванию силы, чтобы топ-игроки всегда были сверху
    players.sort((a, b) => b.power - a.power);

    saveData();         // сохраняем в локальную память
    renderAdminTable(); // перерисовываем таблицу на экране
    
    // Очищаем поля ввода
    nameInput.value = '';
    powerInput.value = '';
}

// Функция удаления игрока из базы союза
function deletePlayer(index) {
    if (confirm(`Удалить игрока ${players[index].name} из базы данных союза?`)) {
        players.splice(index, 1);
        saveData();
        renderAdminTable();
    }
}

// Функция переключения статуса кликом: Не идет -> 🟢 Основа -> 🟠 Резерв -> Не идет
function togglePlayerStatus(index) {
    const currentStatus = players[index].status;
    
    if (currentStatus === 'none') {
        players[index].status = 'main';
    } else if (currentStatus === 'main') {
        players[index].status = 'reserve';
    } else {
        players[index].status = 'none';
    }
    
    saveData();
    renderAdminTable();
}

// Функция фиксации посещаемости после завершения события
function toggleAttendance(index, attendedValue) {
    // Если повторно нажали на ту же кнопку — сбрасываем статус явки
    if (players[index].attended === attendedValue) {
        players[index].attended = null;
    } else {
        players[index].attended = attendedValue;
    }
    saveData();
    renderAdminTable();
}


// ==========================================
// ШАГ 3: ЛОГИКА СПРАВОЧНОЙ ВКЛАДКИ И КАРТЫ
// ==========================================

// Функция автоматического заполнения таблицы характеристик зданий
function renderBuildingsTable() {
    const tbody = document.getElementById('buildingsTableBody');
    
    // Если на странице нет такой таблицы, выходим из функции
    if (!tbody) return;

    // Генерируем строки таблицы на основе данных из массива buildingsData
    tbody.innerHTML = buildingsData.map(b => `
        <tr>
            <td><b>${b.name}</b></td>
            <td>${b.time}</td>
            <td style="color: #56d364;">+${b.capture}</td>
            <td style="color: var(--accent-color);">${b.hold}</td>
            <td style="color: var(--warning-color); font-size: 13px;">${b.bonus}</td>
        </tr>
    `).join('');
}

// Функция открытия модального окна с картой на весь экран
function openModal() {
    const modal = document.getElementById('mapModal');
    if (modal) modal.style.display = 'flex';
}

// Функция закрытия модального окна с картой
function closeModal() {
    const modal = document.getElementById('mapModal');
    if (modal) modal.style.display = 'none';
}

