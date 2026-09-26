// ==========================================
// ШАГ 1: БАЗОВЫЕ ДАННЫЕ И СВЯЗЬ С GOOGLE SPREADSHEETS
// ==========================================

// ✅ ТЕПЕРЬ 100% ИСПРАВЛЕНО: Прямая CORS-ссылка на экспорт CSV
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTivUu_TjZphuspUCedVqZnmSLpgFTZDfVDnnvln6WapFSvekyKm-8UMukuaOfQ0VIbK_zOs5xeWEJD/pub?gid=0&single=true&output=csv";

// Ваша ссылка на Apps Script для записи галок (остается прежней)
const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxWstQD5cngpAwHF-UrbTneMB6o_g7A_eryrcF_SOhGHwIfsnc6QPettXV6zQxUIWQo/exec";

// Пароль лидера
const ADMIN_PASSWORD = "UNI_LEADER_2026";

const buildingsData = [
    { id: "center_res", name: "Центральный резервуар", time: "через 15 минут", capture: 9000, hold: 1800, bonus: "-", maxPlayers: 8 },
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

    // Трюк обхода кэша для моментальной загрузки свежих ников
    const nocacheUrl = GOOGLE_SHEET_CSV_URL + (GOOGLE_SHEET_CSV_URL.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

    fetch(nocacheUrl)
        .then(response => {
            if (!response.ok) throw new Error('Ошибка получения данных таблицы');
            return response.text();
        })
        .then(csvText => {
            parseGoogleSheetCSV(csvText);
            loadSavedAttendance();
            sortPlayers();
            calculateDistribution(); 
            
            renderBuildingsTable();
            renderAdminTable();
            updateCounters();
        })
        .catch(error => {
            console.error('Ошибка загрузки:', error);
        });
};

function parseGoogleSheetCSV(text) {
    const lines = text.split(/\r?\n/);
    players = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = lines[i].split(/[,;]/);
        if (columns && columns[0].trim()) {
            let rawStatus = columns[3] ? columns[3].trim() : '0';
            let statusValue = 'none';
            if (rawStatus === '1') statusValue = 'main';
            if (rawStatus === '2') statusValue = 'reserve';

            // Удаляем возможные пробелы из чисел (например "31 406" -> 31406)
            let cleanPoints = columns[2] ? columns[2].replace(/\s+/g, '') : '0';

            players.push({
                name: columns[0].trim(),
                power: parseFloat(columns[1]) || 0,
                points: parseInt(cleanPoints) || 0,
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

function togglePlayerStatusAndSend(index) {
    const currentStatus = players[index].status;
    let nextStatus = 'none';
    let numericStatus = '0';

    if (currentStatus === 'none') { nextStatus = 'main'; numericStatus = '1'; }
    else if (currentStatus === 'main') { nextStatus = 'reserve'; numericStatus = '2'; }

    players[index].status = nextStatus;
    renderAdminTable();
    updateCounters();
    calculateDistribution(); 

    if (!GOOGLE_SCRIPT_WEB_APP_URL || GOOGLE_SCRIPT_WEB_APP_URL.includes("СЮДА_ВСТАВЬТЕ")) return;

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
// ШАГ 2.1: ФУНКЦИЯ ОБНУЛЕНИЯ ГАЛОК ДЛЯ GOOGLE DOCS
// ==========================================

// Функция полного сброса всех галок основы и резерва в облаке Google
function resetAllStatuses() {
    if (confirm("Вы точно хотите обнулить списки основы и резерва? Это действие сбросит все галки у игроков на сайте и очистит Google Таблицу.")) {
        
        // 1. Мгновенно очищаем статусы на экране админки, чтобы лидер сразу видел результат
        players.forEach(p => { p.status = 'none'; });
        renderAdminTable();
        updateCounters();
        calculateDistribution(); // Очищаем тактическую сетку распределения

        if (!GOOGLE_SCRIPT_WEB_APP_URL || GOOGLE_SCRIPT_WEB_APP_URL.includes("СЮДА_ВСТАВЬТЕ")) return;

        // 2. Отправляем скрытую команду "reset_all" вашему роботу в Google Таблицу
        fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset_all" })
        })
        .then(() => {
            alert("Все галки успешно обнулены в Google Таблице!");
        })
        .catch(err => {
            console.error("Ошибка глобального сброса в облаке:", err);
            alert("Галки на экране сброшены, но произошла ошибка при очистке Google Таблицы. Проверьте скрипт.");
        });
    }
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

function openModal() { const m = document.getElementById('mapModal'); if(m) m.style.display = 'flex'; }
function closeModal() { const m = document.getElementById('mapModal'); if(m) m.style.display = 'none'; }
// Функции управления второй картой
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
    let reservePlayers = players.filter(p => p.status === 'reserve');

    let dist = { phase1: {}, phase2: {}, phase3: {} };
    let pool = [...activePlayers]; // Копия отсортированного списка (БМ + РР)

    let reserveGroup = { name: "🟠 РЕЗЕРВ / ЗАМЕНА", players: reservePlayers };

    // ========================================================
    // ЭТАП 1: ДО 15 МИНУТ (Змейка с лимитом по 3 человека)
    // ========================================================
    if (pool.length > 0) {
        let lineIds = ["solar", "water_1", "water_2", "heliport", "factory_1", "factory_2", "factory_3", "factory_4"];

        lineIds.forEach(id => {
            dist.phase1[id] = { name: bName(id), players: [] };
        });

        let forward = true;
        let idx = 0;

        while (pool.length > 0) {
            let targetId = lineIds[idx];
            let currentGroup = dist.phase1[targetId];

            // Проверяем лимит: если на Солнечной или Вертолетке уже 3 человека — пропускаем здание
            if ((targetId === "solar" || targetId === "heliport") && currentGroup.players.length >= 3) {
                // Двигаем индекс дальше в зависимости от текущего направления волны
                if (forward) {
                    if (idx < lineIds.length - 1) { idx++; continue; } 
                    else { forward = false; }
                } else {
                    if (idx > 0) { idx--; continue; } 
                    else { forward = true; }
                }
                continue;
            }

            // Если лимит не превышен — сажаем игрока в здание
            let currentPlayer = pool.shift();
            currentGroup.players.push(currentPlayer);

            // Стандартный разворот змейки на краях
            if (forward) {
                if (idx < lineIds.length - 1) { idx++; } 
                else { forward = false; }
            } else {
                if (idx > 0) { idx--; } 
                else { forward = true; }
            }
        }
    }

    dist.phase1["reserve_pool"] = reserveGroup;

    // ========================================================
    // ЭТАП 2: ДО 30 МИНУТ (Точечная пересадка лидеров групп)
    // ========================================================
    dist.phase2 = JSON.parse(JSON.stringify(dist.phase1));

    // Создаем пустые карточки под новые открывшиеся спецобъекты
    dist.phase2["center_res"] = { name: "Центральный резервуар", players: [] };
    dist.phase2["military"] = { name: "Военный завод", players: [] };
    dist.phase2["dev_complex"] = { name: "Комплекс разработки", players: [] };

    // 1. Топ-1 с Солнечной станции (из 1 этапа) уходит на Центральный резервуар
    if (dist.phase1["solar"] && dist.phase1["solar"].players.length > 0) {
        let leaderSolar = dist.phase2["solar"].players.shift(); // Забираем первого (самого сильного)
        if (leaderSolar) dist.phase2["center_res"].players.push(leaderSolar);
    }

    // 2. Топ-1 с Водоочистительного центра 1 уходит на Солнечную станцию
    if (dist.phase1["water_1"] && dist.phase1["water_1"].players.length > 0) {
        let leaderWater1 = dist.phase2["water_1"].players.shift();
        if (leaderWater1) dist.phase2["solar"].players.push(leaderWater1);
    }

    // 3. Топ-1 с Водоочистительного центра 2 уходит на Военный завод
    if (dist.phase1["water_2"] && dist.phase1["water_2"].players.length > 0) {
        let leaderWater2 = dist.phase2["water_2"].players.shift();
        if (leaderWater2) dist.phase2["military"].players.push(leaderWater2);
    }

    // 4. Топ-1 с Водоперерабатывающего завода 1 (ВЗ 1) уходит в Комплекс разработки
    if (dist.phase1["factory_1"] && dist.phase1["factory_1"].players.length > 0) {
        let leaderFactory1 = dist.phase2["factory_1"].players.shift();
        if (leaderFactory1) dist.phase2["dev_complex"].players.push(leaderFactory1);
    }

    // Удаляем пустые карточки, если на рейд пришло слишком мало людей и туда никто не попал
    if (dist.phase2["center_res"].players.length === 0) delete dist.phase2["center_res"];
    if (dist.phase2["military"].players.length === 0) delete dist.phase2["military"];
    if (dist.phase2["dev_complex"].players.length === 0) delete dist.phase2["dev_complex"];

    // Гарантированно спускаем блок резерва в самый низ списка 2-го этапа
    let tempReserve2 = dist.phase2["reserve_pool"];
    delete dist.phase2["reserve_pool"];
    dist.phase2["reserve_pool"] = tempReserve2;

    // ========================================================
    // ЭТАП 3: ДО КОНЦА (Временная заглушка, ждём вашу логику)
    // ========================================================
    dist.phase3 = JSON.parse(JSON.stringify(dist.phase2));
    
    if (activePlayers.length > 3) {
        // Пока оставляем черновую структуру, на следующем шаге перепишем под вашу схему
        let top2 = activePlayers[1] || null;
        let top3 = activePlayers[2] || null;
        let top4 = activePlayers[3] || null;
        
        dist.phase3["leters"] = { name: "🚀 ЛЕТУНЫ (Свободная атака)", players: [top2, top3, top4].filter(Boolean) };
        dist.phase3["solar"] = { name: "Солнечная станция", players: [{name: "— [Сбиваем захват]", power: 0, points: 0}] };
        dist.phase3["military"] = { name: "Военный завод", players: [{name: "— [Сбиваем захват]", power: 0, points: 0}] };
        dist.phase3["dev_complex"] = { name: "Комплекс разработки", players: [{name: "— [Сбиваем захват]", power: 0, points: 0}] };

        let totalAct = activePlayers.length;
        let barrelCount = Math.floor(totalAct * 0.3);
        let barrelPlayers = activePlayers.slice(totalAct - barrelCount);
        dist.phase3["barrels"] = { name: "📦 Бочки", players: barrelPlayers };
    }

    let tempReserve3 = dist.phase3["reserve_pool"];
    delete dist.phase3["reserve_pool"];
    dist.phase3["reserve_pool"] = tempReserve3;

    lastDistribution = dist;
    renderDistributionGrid();
}


function bName(id) {
    if (id === "solar") return "Солнечная станция";
    if (id === "heliport") return "Вертолетная площадка";
    if (id === "military") return "Военный завод";
    if (id === "dev_complex") return "Комплекс разработки";
    if (id.includes("water")) return "Водоочистительный центр " + id.slice(-1);
    if (id.includes("factory")) return "Водоперерабатывающий завод " + id.slice(-1);
    return id;
}

// Отрисовка тактических карточек на экране распределения
function renderDistributionGrid() {
    const grid = document.getElementById('distributionGrid');
    if (!grid) return;
    let phaseKey = `phase${currentPhase}`;
    if (!lastDistribution[phaseKey]) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Нет active-данных. Заполните Google Таблицу.</div>`;
        return;
    }

    let data = lastDistribution[phaseKey];
    grid.innerHTML = Object.keys(data).map(key => {
        const group = data[key];
        if (!group || !group.players || group.players.length === 0) return '';
        
        let totalPower = group.players.reduce((sum, p) => sum + (p.power || 0), 0);
        let playersHtml = group.players.map(p => {
            let valDisplay = p.power > 0 ? p.power : (p.points > 0 ? `(${p.points.toLocaleString()})` : '');
            return `<div class="player-row"><span>👤 ${p.name}</span><span style="color: var(--text-muted); font-size:13px;">${valDisplay}</span></div>`;
        }).join('');

        let nicks = group.players.map(p => p.name).filter(n => !n.includes('—')).join(' ');

        return `
            <div class="building-card">
                <div class="building-header">
                    <div class="building-title">${group.name}</div>
                    <div class="building-power">${totalPower > 0 ? totalPower.toFixed(1) : ''}</div>
                </div>
                <div style="margin-bottom: 15px;">${playersHtml}</div>
                ${totalPower > 0 || key === 'reserve_pool' ? `<button class="copy-btn" onclick="navigator.clipboard.writeText('\${nicks}'); alert('Ники скопированы!');">📋 Копировать состав</button>` : ''}
            </div>
        `;
    }).join('');
}


