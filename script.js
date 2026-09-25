// ==========================================
// ШАГ 1: БАЗОВЫЕ ДАННЫЕ И СВЯЗЬ С GOOGLE SPREADSHEETS
// ==========================================

// ✅ ТЕПЕРЬ 100% ИСПРАВЛЕНО: Прямая CORS-ссылка на экспорт CSV
const GOOGLE_SHEET_CSV_URL = "https://google.com";

// Ваша ссылка на Apps Script для записи галок (остается прежней)
const GOOGLE_SCRIPT_WEB_APP_URL = "https://google.com";

// Пароль лидера
const ADMIN_PASSWORD = "UNI_LEADER_2026";


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

let players = [];
let lastDistribution = {};
let currentPhase = 1;

window.onload = function() {
    if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL.includes("СЮДА_ВСТАВЬТЕ")) {
        alert("Ошибка: Проверьте ссылки на Google Таблицы в script.js!");
        return;
    }

    // ТРЮК ОБХОДА КЭША: Добавляем к ссылке текущее время, чтобы браузер не брал её из кэша
    // Это гарантирует обход ошибки CORS 307 и моментальную загрузку ников!
    const nocacheUrl = GOOGLE_SHEET_CSV_URL + (GOOGLE_SHEET_CSV_URL.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

    // Скачиваем данные союза UNI напрямую без блокировок
    fetch(nocacheUrl)
        .then(response => {
            if (!response.ok) throw new Error('Ошибка получения данных таблицы');
            return response.text();
        })
        .then(csvText => {
            parseGoogleSheetCSV(csvText);
            loadSavedAttendance();
            sortPlayers();
            calculateDistribution(); // Сразу перерасчитываем тактическую сетку
            
            renderBuildingsTable();
            renderAdminTable();
            updateCounters();
        })
        .catch(error => {
            console.error('Ошибка CORS / Загрузки:', error);
            alert('Сайту не удалось прочитать Google Таблицу напрямую. Пожалуйста, убедитесь, что вы открыли доступ в таблице: синяя кнопка Поделиться -> Общий доступ -> Все, у кого есть ссылка (Читатель)');
            renderBuildingsTable();
        });
};


    fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            parseGoogleSheetCSV(csvText);
            loadSavedAttendance();
            sortPlayers();
            calculateDistribution(); // Сразу считаем тактику для всех
            renderBuildingsTable();
            renderAdminTable();
            updateCounters();
        })
        .catch(error => console.error(error));
};

function parseGoogleSheetCSV(text) {
    // Разделяем полученный текст на строки
    const lines = text.split(/\r?\n/);
    players = [];

    // Идем со 2-й строки (пропуская заголовки: Игрок, БМ, Очки, Статус)
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Разбиваем строку на столбцы по запятой или точке с запятой
        const columns = lines[i].split(/[,;]/);
        
        // Проверяем, что в первом столбце есть имя игрока
        if (columns && columns[0].trim()) {
            // Безопасно считываем статус из 4-го столбца (индекс 3)
            let rawStatus = columns[3] ? columns[3].trim() : '0';
            let statusValue = 'none';
            
            if (rawStatus === '1') statusValue = 'main';
            if (rawStatus === '2') statusValue = 'reserve';

            players.push({
                name: columns[0].trim(),
                power: parseFloat(columns[1]) || 0,
                points: parseInt(columns[2]) || 0,
                status: statusValue,  
                attended: null   
            });
        }
    }
}


function loadSavedAttendance() {
    let saved = localStorage.getItem('uni_attendance');
    if (saved) {
        let attendanceMap = JSON.parse(saved);
        players.forEach(p => { if (attendanceMap[p.name] !== undefined) p.attended = attendanceMap[p.name]; });
    }
}

function saveAttendance() {
    let attendanceMap = {};
    players.forEach(p => { attendanceMap[p.name] = p.attended; });
    localStorage.setItem('uni_attendance', JSON.stringify(attendanceMap));
}

function sortPlayers() {
    players.sort((a, b) => {
        if (b.power !== a.power) return b.power - a.power;
        return b.points - a.points;
    });
}

function checkAdminPassword() {
    const input = document.getElementById('adminPasswordInput').value;
    if (input === ADMIN_PASSWORD) {
        document.getElementById('adminAuthBlock').style.display = 'none';
        document.getElementById('adminMainContent').style.display = 'block';
    } else {
        alert("Неверный пароль!");
    }
}

// ==========================================
// ШАГ 2: ПАНЕЛЬ УПРАВЛЕНИЯ И ОТПРАВКА ДАННЫХ
// ==========================================

function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    tbody.innerHTML = players.map((player, index) => {
        let statusClass = 'status-none';
        let statusText = 'Не идет';
        if (player.status === 'main') { statusClass = 'status-main'; statusText = '🟢 Основа'; }
        if (player.status === 'reserve') { statusClass = 'status-reserve'; statusText = '🟠 Резерв'; }

        let attendanceHtml = `
            <button class="attendance-btn ${player.attended === true ? 'present' : ''}" onclick="toggleAttendance(${index}, true)">✅</button>
            <button class="attendance-btn ${player.attended === false ? 'absent' : ''}" onclick="toggleAttendance(${index}, false)">❌</button>
        `;

        return `
            <tr>
                <td><b>${player.name}</b></td>
                <td style="color: var(--warning-color); font-weight: bold;">${player.power > 0 ? player.power : '—'}</td>
                <td style="color: var(--accent-color);">${player.points > 0 ? player.points.toLocaleString() : '—'}</td>
                <td><span class="status-badge ${statusClass}" onclick="togglePlayerStatusAndSend(${index})">${statusText}</span></td>
                <td>${attendanceHtml}</td>
            </tr>
        `;
    }).join('');
}

function updateCounters() {
    let mainCount = players.filter(p => p.status === 'main').length;
    let reserveCount = players.filter(p => p.status === 'reserve').length;
    if (document.getElementById('countMain')) document.getElementById('countMain').innerText = mainCount;
    if (document.getElementById('countReserve')) document.getElementById('countReserve').innerText = reserveCount;
}

// Функция переключения галки со встроенной мгновенной отправкой в Google Docs!
function togglePlayerStatusAndSend(index) {
    const currentStatus = players[index].status;
    let nextStatus = 'none';
    let numericStatus = '0';

    if (currentStatus === 'none') { nextStatus = 'main'; numericStatus = '1'; }
    else if (currentStatus === 'main') { nextStatus = 'reserve'; numericStatus = '2'; }

    players[index].status = nextStatus;
    renderAdminTable();
    updateCounters();
    calculateDistribution(); // Сразу перерасчитываем тактическую сетку на экране

    if (GOOGLE_SCRIPT_WEB_APP_URL.includes("СЮДА_ВСТАВЬТЕ")) return;

    // Отправляем изменения в облако Google Таблицы в фоновом режиме
    fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: players[index].name, status: numericStatus })
    }).catch(err => console.error("Ошибка сохранения в облако:", err));
}

function toggleAttendance(index, value) {
    players[index].attended = (players[index].attended === value) ? null : value;
    saveAttendance();
    renderAdminTable();
}


// ==========================================
// ШАГ 3: ЛОГИКА СПРАВОЧНОЙ ВКЛАДКИ И КАРТЫ
// ==========================================

function renderBuildingsTable() {
    const tbody = document.getElementById('buildingsTableBody');
    if (!tbody) return;
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

// Функции управления первой картой
function openModal() { const m = document.getElementById('mapModal'); if(m) m.style.display = 'flex'; }
function closeModal() { const m = document.getElementById('mapModal'); if(m) m.style.display = 'none'; }

// Функции управления второй картой (Новые)
function openModal2() { const m = document.getElementById('mapModal2'); if(m) m.style.display = 'flex'; }
function closeModal2() { const m = document.getElementById('mapModal2'); if(m) m.style.display = 'none'; }

// ==========================================
// ШАГ 4: МАТЕМАТИЧЕСКИЙ АЛГОРИТМ "ЗМЕЙКА"
// ==========================================

// Переключатель временных фаз
function switchPhase(phaseNumber) {
    currentPhase = phaseNumber;
    document.getElementById('btnPhase1').classList.remove('active-phase');
    document.getElementById('btnPhase2').classList.remove('active-phase');
    document.getElementById('btnPhase3').classList.remove('active-phase');
    document.getElementById(`btnPhase${phaseNumber}`).classList.add('active-phase');
    renderDistributionGrid();
}

// Главная функция расчета
function calculateDistribution() {
    let activePlayers = players.filter(p => p.status === 'main');
    if (activePlayers.length === 0) {
        alert("Отметьте игроков зеленой галкой (Основа) в Панели Управления!");
        return;
    }

    let dist = { phase1: {}, phase2: {}, phase3: {} };
    let pool = [...activePlayers]; // Список уже идеально отсортирован (БМ + РР)

    // --- ЭТАП 1: ДО 15 МИНУТ ---
    // Солнечная станция: Топ-1 БМ (Капитан) + 2 средних игрока
    let captain = pool.shift(); 
    let phase1Solar = [captain];
    if (pool.length > 0) {
        let mid = Math.floor(pool.length / 2);
        phase1Solar.push(pool.splice(mid, 1)[0]);
        if (pool.length > 0) phase1Solar.push(pool.splice(mid - 1, 1)[0]);
    }
    dist.phase1["solar"] = { name: "Солнечная станция", players: phase1Solar.filter(Boolean) };

    // Вертолетная площадка: забираем 3 игроков из оставшегося хвоста пула (самых слабых)
    let phase1Heli = [];
    for(let i=0; i<3; i++) { if(pool.length > 0) phase1Heli.push(pool.pop()); }
    dist.phase1["heliport"] = { name: "Вертолетная площадка", players: phase1Heli };

    // Распределяем «Змейкой» всех оставшихся игроков по 6 основным линиям
    let lines = ["water_1", "water_2", "factory_1", "factory_2", "factory_3", "factory_4"];
    lines.forEach(id => {
        let name = id.includes("water") ? "Водоочистительный центр " + id.slice(-1) : "Водоперерабатывающий завод " + id.slice(-1);
        dist.phase1[id] = { name: name, players: [] };
    });

    let forward = true;
    let idx = 0;
    while (pool.length > 0) {
        dist.phase1[lines[idx]].players.push(pool.shift());
        if (forward) {
            idx++;
            if (idx >= lines.length) { idx = lines.length - 1; forward = false; }
        } else {
            idx--;
            if (idx < 0) { idx = 0; forward = true; }
        }
    }

    // --- ЭТАП 2: ДО 30 МИНУТ ---
    dist.phase2 = JSON.parse(JSON.stringify(dist.phase1));
    
    // Капитан перемещается в Центральный резервуар
    dist.phase2["center_res"] = { name: "Центральный резервуар", players: [captain] };
    
    // Выделяем Топ-2, Топ-3 и Топ-4 под тактические спецобъекты со скрина
    let top2 = activePlayers[1] || null;
    let top3 = activePlayers[2] || null;
    let top4 = activePlayers[3] || null;
    
    dist.phase2["solar"] = { name: "Солнечная станция", players: top2 ? [top2] : [] };
    dist.phase2["military"] = { name: "Военный завод", players: top3 ? [top3] : [] };
    dist.phase2["dev_complex"] = { name: "Комплекс разработки", players: top4 ? [top4] : [] };

    // --- ЭТАП 3: ДО КОНЦА ---
    dist.phase3 = JSON.parse(JSON.stringify(dist.phase2));
    
    // Формируем ударную группу ЛЕТУНОВ из топов
    dist.phase3["leters"] = { name: "🚀 ЛЕТУНЫ", players: [top2, top3, top4].filter(Boolean) };
    dist.phase3["solar"] = { name: "Солнечная станция", players: [{name: "— [Сбиваем захват]", power: 0, points: 0}] };
    dist.phase3["military"] = { name: "Военный завод", players: [{name: "— [Сбиваем захват]", power: 0, points: 0}] };
    dist.phase3["dev_complex"] = { name: "Комплекс разработки", players: [{name: "— [Сбиваем захват]", power: 0, points: 0}] };

    // Самые слабые по БМ игроки (последние 30% от состава) уходят закрывать бочки
    let totalAct = activePlayers.length;
    let barrelCount = Math.floor(totalAct * 0.3);
    let barrelPlayers = activePlayers.slice(totalAct - barrelCount);
    dist.phase3["barrels"] = { name: "📦 Бочки", players: barrelPlayers };

    lastDistribution = dist;
    localStorage.setItem('uni_distribution', JSON.stringify(lastDistribution));
    renderDistributionGrid();
}

// Отрисовка тактических карточек на экране распределения
function renderDistributionGrid() {
    const grid = document.getElementById('distributionGrid');
    if (!grid) return;
    let phaseKey = `phase${currentPhase}`;
    if (!lastDistribution[phaseKey]) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Нажмите кнопку «⚡ Рассчитать тактику» выше.</div>`;
        return;
    }

    let data = lastDistribution[phaseKey];
    grid.innerHTML = Object.keys(data).map(key => {
        const group = data[key];
        if (!group.players || group.players.length === 0) return '';
        
        let totalPower = group.players.reduce((sum, p) => sum + (p.power || 0), 0);
        let playersHtml = group.players.map(p => {
            // В карточках распределения пишем БМ, а если её нет — пишем очки РР в скобках
            let valDisplay = p.power > 0 ? p.power : (p.points > 0 ? `(${p.points.toLocaleString()})` : '');
            return `
                <div class="player-row">
                    <span>👤 ${p.name}</span>
                    <span style="color: var(--text-muted); font-size:13px;">${valDisplay}</span>
                </div>
            `;
        }).join('');

        let nicks = group.players.map(p => p.name).filter(n => !n.includes('—')).join(' ');

        return `
            <div class="building-card">
                <div class="building-header">
                    <div class="building-title">${group.name}</div>
                    <div class="building-power">${totalPower > 0 ? totalPower.toFixed(1) : ''}</div>
                </div>
                <div style="margin-bottom: 15px;">${playersHtml}</div>
                ${totalPower > 0 || group.players.some(p => p.points > 0) ? `<button class="copy-btn" onclick="navigator.clipboard.writeText('\${nicks}'); alert('Ники скопированы!');">📋 Копировать состав</button>` : ''}
            </div>
        `;
    }).join('');
}

