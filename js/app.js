// Состояние приложения
let currentTab = 'diary';
let compressedBase64Image = null;
let currentScannedItems = [];
let html5QrcodeScanner = null;
let caloriesChartInstance = null;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
    renderDiary();
    renderCaloriesChart();
});

// Переключение вкладок
function switchTab(tabId) {
    currentTab = tabId;
    ['diary', 'ai', 'trainer', 'profile'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        document.getElementById(`nav-${t}`).className = "flex flex-col items-center space-y-1 text-slate-400 hover:text-slate-200 transition";
    });
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`nav-${tabId}`).className = "flex flex-col items-center space-y-1 text-blue-400 transition";
    
    if (tabId === 'diary') {
        renderDiary();
        renderCaloriesChart();
    }
}

// Лоадер
function showLoader(text = "Загрузка...") {
    document.getElementById('loader-text').innerText = text;
    document.getElementById('global-loader').classList.remove('hidden');
}
function hideLoader() {
    document.getElementById('global-loader').classList.add('hidden');
}

// Сжатие фото перед отправкой
function compressImage(file, maxWidth = 1024, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl.split(',')[1]);
            };
        };
    });
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    showLoader("Сжимаем фото...");
    compressedBase64Image = await compressImage(file);
    hideLoader();

    const preview = document.getElementById('ai-selected-image');
    preview.src = `data:image/jpeg;base64,${compressedBase64Image}`;
    document.getElementById('ai-preview-container').classList.remove('hidden');
}

// Запрос к Gemini API для распознавания фото
async function analyzeFoodPhoto() {
    const profile = JSON.parse(localStorage.getItem('kbju_profile') || '{}');
    const apiKey = profile.apiKey;
    if (!apiKey) {
        alert("Пожалуйста, укажи свой Gemini API ключ в разделе 'Профиль'!");
        switchTab('profile');
        return;
    }

    const notes = document.getElementById('ai-prompt-notes').value;
    showLoader("ИИ анализирует состав тарелки...");

    const promptText = `Посмотри на эту фотографию еды. Дополнительные пожелания пользователя: "${notes}". 
Верни СТРОГО валидный JSON-массив без markdown-оберток (без \`\`\`json), где каждый элемент — отдельный продукт в блюде.
Формат каждого объекта:
{
  "name": "Название продукта",
  "weight": вес в граммах (число),
  "calories": калории на этот вес (число),
  "protein": белки в граммах (число),
  "fat": жиры в граммах (число),
  "carbs": углеводы в граммах (число)
}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promptText },
                        { inline_data: { mime_type: "image/jpeg", data: compressedBase64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedItems = JSON.parse(cleanJson);

        hideLoader();
        openMealPreviewModal(parsedItems);
    } catch (e) {
        hideLoader();
        alert("Ошибка при обращении к Gemini API. Проверь правильность ключа.");
    }
}

// Предпросмотр и модалка редактирования блюда
function openMealPreviewModal(items) {
    currentScannedItems = items;
    const container = document.getElementById('modal-items-container');
    container.innerHTML = items.map((item, index) => `
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-center">
                <span class="font-medium text-sm text-white">${item.name}</span>
                <button onclick="removeScannedItem(${index})" class="text-red-400 text-xs">Удалить</button>
            </div>
            <div class="grid grid-cols-4 gap-2 text-xs">
                <div>
                    <label class="text-slate-500 text-[10px]">Грамм</label>
                    <input type="number" id="modal-item-w-${index}" value="${item.weight}" oninput="updateMealItemCalc(${index})" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white">
                </div>
                <div>
                    <label class="text-slate-500 text-[10px]">Ккал</label>
                    <input type="number" id="modal-item-c-${index}" value="${item.calories}" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white">
                </div>
                <div>
                    <label class="text-slate-500 text-[10px]">Белки</label>
                    <input type="number" id="modal-item-p-${index}" value="${item.protein}" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white">
                </div>
                <div>
                    <label class="text-slate-500 text-[10px]">Углеводы</label>
                    <input type="number" id="modal-item-carb-${index}" value="${item.carbs}" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white">
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('meal-preview-modal').classList.remove('hidden');
}

function removeScannedItem(index) {
    currentScannedItems.splice(index, 1);
    openMealPreviewModal(currentScannedItems);
}

function updateMealItemCalc(index) {
    const item = currentScannedItems[index];
    const newWeight = parseFloat(document.getElementById(`modal-item-w-${index}`).value) || 0;
    const ratio = newWeight / item.weight;

    item.weight = newWeight;
    item.calories = Math.round(item.calories * ratio);
    item.protein = +(item.protein * ratio).toFixed(1);
    item.fat = +(item.fat * ratio).toFixed(1);
    item.carbs = +(item.carbs * ratio).toFixed(1);
}

function closeMealModal() {
    document.getElementById('meal-preview-modal').classList.add('hidden');
}

function confirmAndSaveMeal() {
    // Собираем актуальные значения из инпутов модалки
    currentScannedItems.forEach((item, index) => {
        item.weight = parseFloat(document.getElementById(`modal-item-w-${index}`).value) || 0;
        item.calories = parseFloat(document.getElementById(`modal-item-c-${index}`).value) || 0;
        item.protein = parseFloat(document.getElementById(`modal-item-p-${index}`).value) || 0;
        item.carbs = parseFloat(document.getElementById(`modal-item-carb-${index}`).value) || 0;
    });

    const totalCalories = currentScannedItems.reduce((s, i) => s + i.calories, 0);
    const totalProtein = currentScannedItems.reduce((s, i) => s + i.protein, 0);
    const totalFat = currentScannedItems.reduce((s, i) => s + i.fat, 0);
    const totalCarbs = currentScannedItems.reduce((s, i) => s + i.carbs, 0);

    const mealRecord = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: currentScannedItems,
        totalCalories, totalProtein, totalFat, totalCarbs
    };

    const todayKey = new Date().toISOString().split('T')[0];
    const mealsData = JSON.parse(localStorage.getItem('kbju_meals') || '{}');
    if (!mealsData[todayKey]) mealsData[todayKey] = [];
    mealsData[todayKey].push(mealRecord);
    localStorage.setItem('kbju_meals', JSON.stringify(mealsData));

    closeMealModal();
    switchTab('diary');
}

// Рендер дневника
function renderDiary() {
    const todayKey = new Date().toISOString().split('T')[0];
    const mealsData = JSON.parse(localStorage.getItem('kbju_meals') || '{}');
    const todayMeals = mealsData[todayKey] || [];

    const totalC = todayMeals.reduce((s, m) => s + m.totalCalories, 0);
    const totalP = todayMeals.reduce((s, m) => s + m.totalProtein, 0);
    const totalF = todayMeals.reduce((s, m) => s + m.totalFat, 0);
    const totalCarb = todayMeals.reduce((s, m) => s + m.totalCarbs, 0);

    document.getElementById('total-kcal').innerText = totalC;
    document.getElementById('total-protein').innerText = totalP.toFixed(0);
    document.getElementById('total-fat').innerText = totalF.toFixed(0);
    document.getElementById('total-carbs').innerText = totalCarb.toFixed(0);

    const targetKcal = parseInt(localStorage.getItem('kbju_target_kcal') || '3400');
    document.getElementById('target-kcal').innerText = targetKcal;
    document.getElementById('target-kcal-badge').innerText = targetKcal;

    const percent = Math.min(Math.round((totalC / targetKcal) * 100), 100);
    document.getElementById('kcal-progress-bar').style.width = `${percent}%`;

    const listContainer = document.getElementById('meals-list');
    if (todayMeals.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Сегодня ещё ничего не записано. Добавь через вкладку «Фото AI»!</div>`;
        return;
    }

    listContainer.innerHTML = todayMeals.map((m, idx) => `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div class="flex justify-between items-center text-xs">
                <span class="text-slate-400 font-medium">Приём пищи #${idx + 1} (${m.time})</span>
                <button onclick="deleteMeal(${idx})" class="text-red-400 hover:text-red-300">Удалить</button>
            </div>
            <div class="space-y-1">
                ${m.items.map(i => `<div class="flex justify-between text-xs text-slate-300"><span>• ${i.name} (${i.weight}г)</span><span class="font-mono text-slate-400">${i.calories} ккал</span></div>`).join('')}
            </div>
            <div class="pt-2 border-t border-slate-800/80 flex justify-between text-xs font-semibold text-slate-200">
                <span>Итого:</span>
                <span class="text-blue-400">${m.totalCalories} ккал (Б: ${m.totalProtein}г, Ж: ${m.totalFat}г, У: ${m.totalCarbs}г)</span>
            </div>
        </div>
    `).join('');
}

function deleteMeal(index) {
    const todayKey = new Date().toISOString().split('T')[0];
    const mealsData = JSON.parse(localStorage.getItem('kbju_meals') || '{}');
    if (mealsData[todayKey]) {
        mealsData[todayKey].splice(index, 1);
        localStorage.setItem('kbju_meals', JSON.stringify(mealsData));
        renderDiary();
    }
}

// График калорий
function renderCaloriesChart() {
    const ctx = document.getElementById('caloriesChart')?.getContext('2d');
    if (!ctx) return;

    const mealsData = JSON.parse(localStorage.getItem('kbju_meals') || '{}');
    const labels = [];
    const values = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));

        const dayMeals = mealsData[dateKey] || [];
        const totalKcal = dayMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
        values.push(totalKcal);
    }

    if (caloriesChartInstance) caloriesChartInstance.destroy();

    caloriesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ккал',
                data: values,
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#1e293b' } }, x: { grid: { display: false } } }
        }
    });
}

// Сканер штрихкода
function openBarcodeModal() {
    document.getElementById('barcode-modal').classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("barcode-reader");
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
            await closeBarcodeModal();
            await fetchProductByBarcode(decodedText);
        },
        (errorMessage) => {}
    ).catch(err => alert("Ошибка камеры: " + err));
}

async function closeBarcodeModal() {
    if (html5QrcodeScanner) {
        try { await html5QrcodeScanner.stop(); } catch(e){}
    }
    document.getElementById('barcode-modal').classList.add('hidden');
}

async function fetchProductByBarcode(barcode) {
    showLoader("Ищем продукт по штрихкоду...");
    try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await res.json();
        if (data.status === 1 && data.product) {
            const p = data.product;
            const n = p.nutriments || {};
            const productItem = {
                name: p.product_name_ru || p.product_name || `Товар (${barcode})`,
                weight: 100,
                calories: Math.round(n['energy-kcal_100g'] || 0),
                protein: +(n.proteins_100g || 0).toFixed(1),
                fat: +(n.fat_100g || 0).toFixed(1),
                carbs: +(n.carbohydrates_100g || 0).toFixed(1)
            };
            hideLoader();
            openMealPreviewModal([productItem]);
        } else {
            hideLoader();
            alert("Товар не найден в базе. Попробуй сфотографировать этикетку!");
        }
    } catch (e) {
        hideLoader();
        alert("Ошибка сети при поиске штрихкода.");
    }
}

// Профиль и калькулятор
function calculateAndSaveProfile() {
    const apiKey = document.getElementById('profile-apikey').value.trim();
    const weight = parseFloat(document.getElementById('profile-weight').value) || 80;
    const height = parseFloat(document.getElementById('profile-height').value) || 186;
    const age = parseInt(document.getElementById('profile-age').value) || 18;
    const gender = document.getElementById('profile-gender').value;
    const activity = parseFloat(document.getElementById('profile-activity').value) || 1.55;
    const goal = document.getElementById('profile-goal').value;

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = (gender === 'male') ? bmr + 5 : bmr - 161;
    
    let tdee = bmr * activity;
    let targetKcal = Math.round(tdee);
    if (goal === 'bulk') targetKcal += 400;
    if (goal === 'cut') targetKcal -= 400;

    localStorage.setItem('kbju_profile', JSON.stringify({ apiKey, weight, height, age, gender, activity, goal }));
    localStorage.setItem('kbju_target_kcal', targetKcal);

    alert(`Норма успешно пересчитана: ${targetKcal} ккал/день!`);
    renderDiary();
}

function loadProfileData() {
    const profile = JSON.parse(localStorage.getItem('kbju_profile') || '{}');
    if (profile.apiKey) document.getElementById('profile-apikey').value = profile.apiKey;
    if (profile.weight) document.getElementById('profile-weight').value = profile.weight;
    if (profile.height) document.getElementById('profile-height').value = profile.height;
    if (profile.age) document.getElementById('profile-age').value = profile.age;
    if (profile.gender) document.getElementById('profile-gender').value = profile.gender;
    if (profile.activity) document.getElementById('profile-activity').value = profile.activity;
    if (profile.goal) document.getElementById('profile-goal').value = profile.goal;
}

// AI Тренер
async function getAiTrainerAdvice() {
    const profile = JSON.parse(localStorage.getItem('kbju_profile') || '{}');
    const apiKey = profile.apiKey;
    if (!apiKey) {
        alert("Укажи API ключ в профиле!");
        switchTab('profile');
        return;
    }

    const todayKey = new Date().toISOString().split('T')[0];
    const mealsData = JSON.parse(localStorage.getItem('kbju_meals') || '{}');
    const todayMeals = mealsData[todayKey] || [];
    const targetKcal = parseInt(localStorage.getItem('kbju_target_kcal') || '3400');

    showLoader("Тренер анализирует рацион...");

    const prompt = `Пользователь весит ${profile.weight}кг, рост ${profile.height}см, цель: ${profile.goal}. Его дневная норма: ${targetKcal} ккал. 
Сегодня он съел следующие приемы пищи: ${JSON.stringify(todayMeals)}.
Дай короткий, мотивирующий совет нутрициолога на русском языке: сколько калорий и белков еще нужно добрать до конца дня и какими продуктами лучше это сделать.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        const box = document.getElementById('ai-trainer-response');
        box.innerText = text;
        box.classList.remove('hidden');
    } catch (e) {
        alert("Ошибка запроса к тренеру.");
    } finally {
        hideLoader();
    }
}

// Экспорт / Импорт базы
function exportBackup() {
    const backup = {
        meals: localStorage.getItem('kbju_meals'),
        profile: localStorage.getItem('kbju_profile'),
        target: localStorage.getItem('kbju_target_kcal')
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kbju_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.meals) localStorage.setItem('kbju_meals', data.meals);
            if (data.profile) localStorage.setItem('kbju_profile', data.profile);
            if (data.target) localStorage.setItem('kbju_target_kcal', data.target);
            alert("Данные успешно импортированы!");
            location.reload();
        } catch (err) {
            alert("Ошибка чтения файла резервной копии.");
        }
    };
    reader.readAsText(file);
}