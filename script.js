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

// Главный триггер: теперь он сначала скачивает файл, а потом включает всё остальное
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
    
    // Если на странице нет такой таблицы (например, вкладка еще не загрузилась), выходим из функции
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
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Функция закрытия модального окна с картой
function closeModal() {
    const modal = document.getElementById('mapModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ==========================================
// ШАГ 4: АЛГОРИТМ РАСПРЕДЕЛЕНИЯ И ТАКТИКА
// ==========================================

// Текущий выбранный пользователем этап (1 - до 15 мин, 2 - до 30 мин, 3 - до конца)
let currentPhase = 1;

// Переключение отображения этапов кнопками
function switchPhase(phaseNumber) {
    currentPhase = phaseNumber;
    
    // Подсвечиваем активную кнопку временного интервала
    document.getElementById('btnPhase1').classList.remove('active-phase');
    document.getElementById('btnPhase2').classList.remove('active-phase');
    document.getElementById('btnPhase3').classList.remove('active-phase');
    document.getElementById(`btnPhase${phaseNumber}`).classList.add('active-phase');
    
    // Перерисовываем карточки под выбранный этап
    renderDistributionGrid();
}

// ГЛАВНЫЙ АЛГОРИТМ БАЛАНСИРОВКИ
function calculateDistribution() {
    // Отбираем только тех игроков, у кого стоит зеленая галка (Основа)
    // Массив игроков у нас уже отсортирован от самого сильного к самому слабому в Шаге 1
    let activePlayers = players.filter(p => p.status === 'main');
    
    if (activePlayers.length === 0) {
        alert("Ошибка: Сначала зайдите в Панель Управления и отметьте игроков зеленой галкой (Основа)!");
        return;
    }

    // Создаем структуру для хранения всех трех этапов
    let distributionResult = {
        phase1: {},
        phase2: {},
        phase3: {}
    };

    // Создаем копию списка игроков для безопасных манипуляций
    let pool = [...activePlayers];

    // ========================================================
    // ЭТАП 1: ДО 15 МИНУТ (Логика из вашего сообщения)
    // ========================================================
    
    // 1. Солнечная станция: забираем 1 самого сильного (Капитана)
    let captain = pool.shift(); 
    
    // Нам нужны еще 2 среднячка к нему. Находим середину оставшегося пула
    let midIndex = Math.floor(pool.length / 2);
    let mid1 = pool.splice(midIndex, 1)[0];
    let mid2 = pool.splice(midIndex - 1, 1)[0]; // берем еще одного рядом

    distributionResult.phase1["solar"] = { name: "Солнечная станция", players: [captain, mid1, mid2].filter(Boolean) };
    
    // Вертолетная площадка (фиксировано по скрину, например, 3 игрока снизу пула или свободные)
    // Для черновой версии выделим фиксированные группы под Вертолетку
    let heliPlayers = [];
    if(pool.length > 0) heliPlayers.push(pool.pop());
    if(pool.length > 0) heliPlayers.push(pool.pop());
    if(pool.length > 0) heliPlayers.push(pool.pop());
    distributionResult.phase1["heliport"] = { name: "Вертолетная площадка", players: heliPlayers };

    // 2. Балансировка «Змейкой» остальных групп
    // Список боевых групп на 1 этап (всего 6 боевых линий: Водоочистители 1-2 и Заводы 1-4)
    let lineIds = ["water_1", "water_2", "factory_1", "factory_2", "factory_3", "factory_4"];
    lineIds.forEach(id => {
        let name = id.includes("water") ? "Водоочистительный центр " + id.split("_")[1] : "Водоперерабатывающий завод " + id.split("_")[1];
        distributionResult.phase1[id] = { name: name, players: [] };
    });

    // Распределяем оставшихся сильных игроков "Змейкой" вперед-назад
    let forward = true;
    let lineIndex = 0;

    while (pool.length > 0) {
        let p = pool.shift(); // Берем самого сильного из оставшихся
        distributionResult.phase1[lineIds[lineIndex]].players.push(p);

        // Двигаем указатель группы дальше
        if (forward) {
            lineIndex++;
            if (lineIndex >= lineIds.length) { lineIndex = lineIds.length - 1; forward = false; } // разворот змейки
        } else {
            lineIndex--;
            if (lineIndex < 0) { lineIndex = 0; forward = true; } // разворот змейки
        }
    }

    // ========================================================
    // ЭТАП 2: ДО 30 МИНУТ (Корректировка позиций)
    // ========================================================
    // На основе этапа 1 перестраиваем роли по вашему скриншоту
    distributionResult.phase2 = JSON.parse(JSON.stringify(distributionResult.phase1)); // копируем структуру
    
    // На 30 минуте Капитан спускается в Центральный резервуар
    distributionResult.phase2["center_res"] = { name: "Центральный резервуар", players: [captain] };
    // Радистка Кет уходит на Военный Завод, Айси на Комплекс разработки, Мисти на Солнечную станцию
    // В черновой версии для наглядности перенесем топ-3 игроков в эти строения:
    let topPlayers = activePlayers.slice(0, 4); // [Топ-1(Капитан), Топ-2, Топ-3, Топ-4]
    
    distributionResult.phase2["solar"] = { name: "Солнечная станция", players: topPlayers[1] ? [topPlayers[1]] : [] };
    distributionResult.phase2["military"] = { name: "Военный завод", players: topPlayers[2] ? [topPlayers[2]] : [] };
    distributionResult.phase2["dev_complex"] = { name: "Комплекс разработки", players: topPlayers[3] ? [topPlayers[3]] : [] };

    // ========================================================
    // ЭТАП 3: ДО КОНЦА (Финальный штурм)
    // ========================================================
    distributionResult.phase3 = JSON.parse(JSON.stringify(distributionResult.phase2));
    
    // Появляется группа "Летуны" (Топ-2, Топ-3, Топ-4)
    distributionResult.phase3["leters"] = { name: "🟢 ЛЕТУНЫ", players: topPlayers.slice(1, 4) };
    
    // Солнечная, Военный и Комплекс переходят в режим "Сбиваем захват" (-)
    distributionResult.phase3["solar"] = { name: "Солнечная станция", players: [{name: "— [Сбиваем захват]", power: 0}] };
    distributionResult.phase3["military"] = { name: "Военный завод", players: [{name: "— [Сбиваем захват]", power: 0}] };
    distributionResult.phase3["dev_complex"] = { name: "Комплекс разработки", players: [{name: "— [Сбиваем захват]", power: 0}] };

    // Часть игроков спускается на Бочки
    let lowerPlayers = activePlayers.slice(Math.floor(activePlayers.length * 0.6)); // последние 40% по силе
    distributionResult.phase3["barrels"] = { name: "📦 Бочки (Свободный захват)", players: lowerPlayers };

    // Сохраняем и фиксируем результаты расчетов в браузер
    lastDistribution = distributionResult;
    localStorage.setItem('uni_distribution', JSON.stringify(lastDistribution));
    
    renderDistributionGrid();
}

// ФУНКЦИЯ ОТРИСОВКИ КАРТОЧЕК НА ЭКРАНЕ
function renderDistributionGrid() {
    const grid = document.getElementById('distributionGrid');
    
    // Проверяем, есть ли рассчитанные данные для текущего этапа
    let phaseKey = `phase${currentPhase}`;
    if (!lastDistribution[phaseKey]) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Нажмите кнопку «Рассчитать тактику» выше, чтобы запустить алгоритм змейки.</div>`;
        return;
    }

    let currentPhaseData = lastDistribution[phaseKey];

    // Выводим карточки точек
    grid.innerHTML = Object.keys(currentPhaseData).map(key => {
        const group = currentPhaseData[key];
        if (!group.players || group.players.length === 0) return '';

        // Считаем общую боевую мощь группы на этой точке
        let totalPower = group.players.reduce((sum, p) => sum + (p.power || 0), 0);

        let playersHtml = group.players.map(p => `
            <div class="player-row">
                <span>👤 ${p.name}</span>
                <span style="color: var(--text-muted); font-size:13px;">${p.power > 0 ? p.power : ''}</span>
            </div>
        `).join('');

        let nicksText = group.players.map(p => p.name).join(' ');

        return `
            <div class="building-card">
                <div class="building-header">
                    <div class="building-title">${group.name}</div>
                    <div class="building-power" title="Общая БМ группы">${totalPower > 0 ? totalPower.toFixed(1) : ''}</div>
                </div>
                <div style="margin-bottom: 15px;">
                    ${playersHtml}
                </div>
                ${totalPower > 0 ? `<button class="copy-btn" onclick="copyToClipboard('\${nicksText}')">📋 Скопировать состав</button>` : ''}
            </div>
        `;
    }).join('');
}

// Функция быстрого копирования имен в буфер обмена для Discord/чата игры
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Список ников скопирован! Можете вставить в чат союза.');
    }).catch(err => {
        alert('Не удалось скопировать автоматически, выделите текст на экране.');
    });
}
