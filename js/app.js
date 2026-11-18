        // ==========================================
        // 1. КОНФИГУРАЦИЯ И СОСТОЯНИЕ ПРИЛОЖЕНИЯ
        // ==========================================
        const defaultApiKey = ""; // Ключ подставляется средой выполнения автоматически или берётся из настроек профиля
        const GEMINI_MODEL = "gemini-3.5-flash-lite"; // основная (быстрая)
        const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"]; // по порядку: если первая не ответила, пробуем следующую
        // Вставь сюда URL и anon/public key своего проекта Supabase (не service_role key!).
        const SUPABASE_URL = "https://yyehwrqhecqcejfdgafy.supabase.co";
        const SUPABASE_ANON_KEY = "sb_publishable_SwA5oaF3hSMHsF3xr6AwXA_VZNbG9Up";
        let supabaseClient = null;
        let cloudUser = null;
        let cloudSyncTimer = null;
        let isApplyingCloudData = false;
        let cloudReady = false; // true только после успешной загрузки облачных данных (защита от перезаписи)
        let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        let deferredInstallPrompt = null;

        function getActiveApiKey() {
            const customKey = localStorage.getItem('ai_kbju_custom_api_key');
            return (customKey && customKey.trim().length > 0) ? customKey.trim() : defaultApiKey;
        }

        // ==========================================
        // 1.1 ИНИЦИАЛИЗАЦИЯ PWA (MANIFEST + SERVICE WORKER В ОДНОМ ФАЙЛЕ)
        // ==========================================
        function initPWA() {
            try {
                // Генерируем иконку приложения программно через Canvas в PNG (совместимо с Android Chrome и iOS Safari)
                const iconCanvas = document.createElement('canvas');
                iconCanvas.width = 512;
                iconCanvas.height = 512;
                const ctx = iconCanvas.getContext('2d');

                // Градиентный фон иконки
                const grad = ctx.createLinearGradient(0, 0, 512, 512);
                grad.addColorStop(0, '#10b981');
                grad.addColorStop(1, '#84cc16');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect(0, 0, 512, 512, 112);
                ctx.fill();

                // Символ пламени / калорий в центре
                ctx.fillStyle = '#09090b';
                ctx.font = 'bold 210px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔥', 256, 225);

                ctx.font = '800 64px Inter, sans-serif';
                ctx.fillText('КБЖУ', 256, 395);

                const iconDataUrl = localStorage.getItem('ai_kbju_app_icon') || iconCanvas.toDataURL('image/png');
                applyPwaIcon(iconDataUrl);

                // Регистрация лёгкого Service Worker для соответствия критериям PWA (если поддерживается протоколом)
                if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
                    const swCode = `
                        self.addEventListener('install', (e) => self.skipWaiting());
                        self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
                        self.addEventListener('fetch', (e) => {
                            e.respondWith(fetch(e.request).catch(() => new Response('Offline')));
                        });
                    `;
                    const swBlob = new Blob([swCode], { type: 'application/javascript' });
                    const swUrl = URL.createObjectURL(swBlob);
                    navigator.serviceWorker.register(swUrl).catch(() => {});
                }
            } catch (err) {
                console.warn("PWA init info:", err);
            }
        }

        // Перехват системного события установки PWA на Android / Chrome
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            const nativeBox = document.getElementById('native-install-box');
            if (nativeBox) nativeBox.classList.remove('hidden');
        });

        window.addEventListener('appinstalled', () => {
            deferredInstallPrompt = null;
            closeInstallModal();
            showToast("Приложение успешно установлено на телефон!", "check-circle-2");
        });

        function triggerPwaInstall() {
            const modal = document.getElementById('install-modal');
            const nativeBox = document.getElementById('native-install-box');
            if (deferredInstallPrompt && nativeBox) {
                nativeBox.classList.remove('hidden');
            }
            modal.classList.remove('hidden');
            lucide.createIcons();
        }

        function closeInstallModal() {
            document.getElementById('install-modal').classList.add('hidden');
        }

        async function executeNativeInstall() {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                deferredInstallPrompt = null;
                closeInstallModal();
            }
        }

        // Состояние по умолчанию
        let state = {
            selectedDate: getTodayDateString(),
            targets: {
                kcal: 3400,
                p: 180,
                f: 95,
                c: 455
            },
            profile: {
                gender: 'male',
                age: 25,
                weight: 75,
                height: 180,
                activity: 'moderate',
                goal: 'bulk',
                notes: ''
            },
            // Структура logs: { "2026-11-18": [ { id, timestamp, thumbnail, note, items: [...], totals: {...} } ] }
            logs: {}
        };

        // Временные данные в модальном окне распознавания
        let currentModalMode = 'photo';
        let currentBase64Image = null;
        let currentImageMimeType = 'image/jpeg';
        let currentThumbnailDataUrl = null;
        let currentDetectedItems = [];
        let editingMealId = null;
        let lastCalculatedNorm = null;

        // ==========================================
        // 2. ИНИЦИАЛИЗАЦИЯ И ХРАНИЛИЩЕ (LOCALSTORAGE)
        // ==========================================
        function applyPwaIcon(iconDataUrl) {
            const appleIconEl = document.getElementById('apple-touch-icon');
            if (appleIconEl) appleIconEl.href = iconDataUrl;
            const manifestObj = {
                name: "AI КБЖУ Трекер", short_name: "AI КБЖУ",
                description: "Умный дневник питания с распознаванием еды по фото",
                start_url: window.location.href.split('#')[0], display: "standalone",
                orientation: "portrait", background_color: "#09090b", theme_color: "#09090b",
                icons: [{ src: iconDataUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" }]
            };
            const manifestBlob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
            const manifestUrl = URL.createObjectURL(manifestBlob);
            const manifestEl = document.getElementById('pwa-manifest');
            if (manifestEl) manifestEl.href = manifestUrl;
            const preview = document.getElementById('app-icon-preview');
            if (preview) preview.src = iconDataUrl;
        }

        function handleAppIconSelect(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { showToast('Выбери файл изображения', 'alert-circle'); return; }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 512; canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    const side = Math.min(img.width, img.height);
                    const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, 512, 512);
                    const data = canvas.toDataURL('image/png');
                    try {
                        localStorage.setItem('ai_kbju_app_icon', data);
                        applyPwaIcon(data);
                        showToast('Иконка приложения обновлена', 'check-circle-2');
                    } catch (err) { showToast('Не удалось сохранить иконку: файл слишком большой', 'alert-circle'); }
                };
                img.onerror = () => showToast('Не удалось открыть изображение', 'alert-circle');
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function resetAppIcon() {
            localStorage.removeItem('ai_kbju_app_icon');
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 512, 512);
            grad.addColorStop(0, '#10b981'); grad.addColorStop(1, '#84cc16');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(0, 0, 512, 512, 112); ctx.fill();
            ctx.fillStyle = '#09090b'; ctx.font = 'bold 210px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🔥', 256, 225); ctx.font = '800 64px Inter, sans-serif'; ctx.fillText('КБЖУ', 256, 395);
            applyPwaIcon(canvas.toDataURL('image/png'));
            showToast('Стандартная иконка восстановлена', 'check-circle-2');
        }

        function openCalendar() {
            const [y, m] = state.selectedDate.split('-').map(Number);
            calendarMonth = new Date(y, m - 1, 1);
            renderCalendar();
            document.getElementById('calendar-modal').classList.remove('hidden');
            lucide.createIcons();
        }
        function closeCalendar() { document.getElementById('calendar-modal').classList.add('hidden'); }
        function changeCalendarMonth(delta) {
            calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
            renderCalendar();
        }
        function goToCalendarToday() {
            state.selectedDate = getTodayDateString();
            closeCalendar(); updateDashboardUI();
        }
        function renderCalendar() {
            const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
            const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
            document.getElementById('calendar-month-label').textContent = `${monthNames[month]} ${year}`;
            const grid = document.getElementById('calendar-grid');
            const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
            let html = weekdays.map(d => `<div class="text-[10px] font-semibold text-zinc-500 py-1">${d}</div>`).join('');
            const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i=0; i<firstOffset; i++) html += '<div class="h-10"></div>';
            const today = getTodayDateString();
            for (let day=1; day<=daysInMonth; day++) {
                const date = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const hasEntries = Array.isArray(state.logs[date]) && state.logs[date].length > 0;
                const isSelected = date === state.selectedDate;
                const isFuture = date > today;
                const color = isSelected ? 'bg-sky-500 text-white border-sky-400' : hasEntries ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-dark-800 text-zinc-300 border-zinc-800';
                const marker = isFuture ? '' : `<span class="w-1.5 h-1.5 rounded-full ${hasEntries ? 'bg-emerald-400' : 'bg-zinc-600'}"></span>`;
                html += `<button type="button" onclick="selectCalendarDate('${date}')" class="h-10 rounded-xl border ${color} flex flex-col items-center justify-center gap-0.5 text-xs font-semibold hover:border-sky-400 transition">${day}${marker}</button>`;
            }
            grid.innerHTML = html;
            const selectedMeals = state.logs[state.selectedDate] || [];
            const status = selectedMeals.length ? `Записано приёмов пищи: ${selectedMeals.length}` : (state.selectedDate <= today ? 'В этот день записей пока нет' : 'Это будущая дата');
            document.getElementById('calendar-selected-info').textContent = `${formatHumanDate(state.selectedDate)} · ${state.selectedDate} — ${status}`;
            lucide.createIcons();
        }
        function selectCalendarDate(date) {
            state.selectedDate = date;
            closeCalendar(); updateDashboardUI();
        }

        function getTodayDateString() {
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            return new Date(now - offset).toISOString().split('T')[0];
        }

        function loadState() {
            try {
                const savedTargets = localStorage.getItem('ai_kbju_targets');
                const savedProfile = localStorage.getItem('ai_kbju_profile');
                const savedLogs = localStorage.getItem('ai_kbju_logs');
                if (savedTargets) state.targets = JSON.parse(savedTargets);
                if (savedProfile) state.profile = { ...state.profile, ...JSON.parse(savedProfile) };
                if (savedLogs) state.logs = JSON.parse(savedLogs);
                loadFavorites();
            } catch (e) {
                console.error("Ошибка загрузки из localStorage:", e);
            }
        }

        function persistState() {
            try {
                localStorage.setItem('ai_kbju_targets', JSON.stringify(state.targets));
                localStorage.setItem('ai_kbju_profile', JSON.stringify(state.profile));
                localStorage.setItem('ai_kbju_logs', JSON.stringify(state.logs));
                scheduleCloudSync();
            } catch (e) {
                // Если хранилище переполнено из-за картинок, сохраняем без миниатюр старых записей
                console.warn("Переполнение localStorage, очищаем старые превью...");
                Object.keys(state.logs).forEach(date => {
                    if (date !== state.selectedDate) {
                        state.logs[date].forEach(meal => meal.thumbnail = null);
                    }
                });
                try {
                    localStorage.setItem('ai_kbju_logs', JSON.stringify(state.logs));
                    scheduleCloudSync();
                } catch (err) {
                    showToast("Память браузера заполнена, удалите старые записи", "alert-circle");
                }
            }
        }

        // ==========================================
        // 3. НАВИГАЦИЯ И ПЕРЕКЛЮЧЕНИЕ ДАТ
        // ==========================================
        function updateCloudAuthUI(message) {
            const status = document.getElementById('cloud-auth-status');
            const signIn = document.getElementById('google-signin-btn');
            const signOut = document.getElementById('google-signout-btn');
            if (!status || !signIn || !signOut) return;
            if (message) status.textContent = message;
            if (cloudUser) {
                status.textContent = `Подключено: ${cloudUser.email || 'Google аккаунт'}. Данные синхронизируются.`;
                signIn.classList.add('hidden'); signOut.classList.remove('hidden');
            } else {
                signIn.classList.remove('hidden'); signOut.classList.add('hidden');
            }
        }

        async function initCloudAuth() {
            if (!window.supabase || SUPABASE_URL.startsWith('YOUR_') || SUPABASE_ANON_KEY.startsWith('YOUR_')) {
                updateCloudAuthUI('Облако ещё не настроено. Добавь URL и anon key проекта Supabase в начале index.html.');
                return;
            }
            try {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session?.user) { cloudUser = session.user; updateCloudAuthUI(); await loadCloudState(); }
                supabaseClient.auth.onAuthStateChange(async (_event, session) => {
                    cloudUser = session?.user || null;
                    updateCloudAuthUI();
                    if (cloudUser) await loadCloudState();
                });
            } catch (err) {
                console.error('Supabase init error:', err);
                updateCloudAuthUI('Не удалось подключить облако. Проверь настройки Supabase.');
            }
        }

        async function signInWithGoogle() {
            if (!supabaseClient) { showToast('Сначала настрой Supabase в коде', 'alert-circle'); return; }
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
            if (error) showToast(`Ошибка входа: ${error.message}`, 'alert-circle');
        }

        async function signOutFromCloud() {
            if (!supabaseClient) return;
            const { error } = await supabaseClient.auth.signOut();
            if (error) showToast(`Ошибка выхода: ${error.message}`, 'alert-circle');
            else { cloudUser = null; cloudReady = false; updateCloudAuthUI('Вышел из облачного аккаунта. Локальные данные остались на устройстве.'); }
        }

        async function loadCloudState() {
            if (!supabaseClient || !cloudUser) return;
            try {
                const { data, error } = await supabaseClient.from('kbju_user_data').select('data').eq('user_id', cloudUser.id).maybeSingle();
                if (error) throw error;
                if (data?.data) {
                    isApplyingCloudData = true;
                    state.targets = data.data.targets || state.targets;
                    state.profile = { ...state.profile, ...(data.data.profile || {}) };
                    state.logs = data.data.logs || state.logs;
                    const cloudKey = (data.data.geminiKey || '').trim();
                    if (cloudKey) {
                        localStorage.setItem('ai_kbju_custom_api_key', cloudKey);
                        const keyInput = document.getElementById('setting-api-key');
                        if (keyInput) keyInput.value = cloudKey;
                    }
                    const cloudHasFavs = Array.isArray(data.data.favorites);
                    if (cloudHasFavs) {
                        favorites = data.data.favorites;
                        try { localStorage.setItem('ai_kbju_favorites', JSON.stringify(favorites)); } catch (e) {}
                    }
                    persistState(); updateDashboardUI();
                    isApplyingCloudData = false;
                    cloudReady = true;
                    if ((!cloudKey && (localStorage.getItem('ai_kbju_custom_api_key') || '').trim()) || (!cloudHasFavs && favorites.length)) {
                        await saveCloudState(); // в облаке ключа нет, а на устройстве есть: отправляем в аккаунт
                    }
                    updateCloudAuthUI('Облачные данные загружены.');
                } else {
                    cloudReady = true;
                    await saveCloudState();
                }
            } catch (err) {
                isApplyingCloudData = false;
                cloudReady = false;
                console.error('Cloud load error:', err);
                updateCloudAuthUI('Не удалось загрузить данные. Проверь SQL-политику таблицы Supabase.');
            }
        }

        function scheduleCloudSync() {
            if (!supabaseClient || !cloudUser || isApplyingCloudData) return;
            clearTimeout(cloudSyncTimer);
            cloudSyncTimer = setTimeout(saveCloudState, 900);
        }

        async function saveCloudState() {
            if (!supabaseClient || !cloudUser || isApplyingCloudData || !cloudReady) return;
            const payload = {
                user_id: cloudUser.id,
                data: {
                    targets: state.targets,
                    profile: state.profile,
                    logs: state.logs,
                    geminiKey: (localStorage.getItem('ai_kbju_custom_api_key') || '').trim(),
                    favorites: favorites
                },
                updated_at: new Date().toISOString()
            };
            try {
                const { error } = await supabaseClient.from('kbju_user_data').upsert(payload, { onConflict: 'user_id' });
                if (error) throw error;
                updateCloudAuthUI('Все изменения сохранены в облаке.');
            } catch (err) {
                console.error('Cloud save error:', err);
                updateCloudAuthUI('Ошибка облачного сохранения. Локальная копия сохранена на устройстве.');
            }
        }

        function switchTab(tabName) {
            ['dashboard', 'coach', 'settings'].forEach(t => {
                document.getElementById(`tab-${t}`).classList.add('hidden');
                const navBtn = document.getElementById(`nav-${t}`);
                if (navBtn) {
                    navBtn.classList.remove('text-emerald-400');
                    navBtn.classList.add('text-zinc-400');
                }
            });

            document.getElementById(`tab-${tabName}`).classList.remove('hidden');
            const activeNav = document.getElementById(`nav-${tabName}`);
            if (activeNav) {
                activeNav.classList.remove('text-zinc-400');
                activeNav.classList.add('text-emerald-400');
            }

            if (tabName === 'settings') {
                document.getElementById('setting-kcal').value = state.targets.kcal;
                document.getElementById('setting-p').value = state.targets.p;
                document.getElementById('setting-f').value = state.targets.f;
                document.getElementById('setting-c').value = state.targets.c;

                selectGender(state.profile.gender || 'male');
                document.getElementById('profile-age').value = state.profile.age || 25;
                document.getElementById('profile-weight').value = state.profile.weight || 75;
                document.getElementById('profile-height').value = state.profile.height || 180;
                document.getElementById('profile-activity').value = state.profile.activity || 'moderate';
                document.getElementById('profile-goal').value = state.profile.goal || 'bulk';
                document.getElementById('profile-notes').value = state.profile.notes || '';

                const savedKey = localStorage.getItem('ai_kbju_custom_api_key') || '';
                document.getElementById('setting-api-key').value = savedKey;
            }
            if (tabName === 'coach') {
                document.getElementById('coach-target-display').textContent = `${state.targets.kcal} ккал`;
            }
            lucide.createIcons();
        }

        function saveApiKeySetting() {
            const val = document.getElementById('setting-api-key').value.trim();
            if (val) {
                localStorage.setItem('ai_kbju_custom_api_key', val);
                if (cloudUser && cloudReady) {
                    scheduleCloudSync();
                    showToast("Ключ сохранён на устройстве и в твоём аккаунте!", "check-circle-2");
                } else {
                    showToast("Ключ сохранён на этом устройстве. Войди через Google, чтобы он был на всех устройствах.", "check-circle-2");
                }
            } else {
                localStorage.removeItem('ai_kbju_custom_api_key');
                if (cloudUser && cloudReady) scheduleCloudSync();
                showToast("API ключ очищен", "info");
            }
        }

        function toggleApiKeyVisibility() {
            const input = document.getElementById('setting-api-key');
            const icon = document.getElementById('api-key-eye-icon');
            if (input.type === 'password') {
                input.type = 'text';
                icon.setAttribute('data-lucide', 'eye-off');
            } else {
                input.type = 'password';
                icon.setAttribute('data-lucide', 'eye');
            }
            lucide.createIcons();
        }

        function changeDate(offsetDays) {
            const parts = state.selectedDate.split('-');
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            dateObj.setDate(dateObj.getDate() + offsetDays);
            const offset = dateObj.getTimezoneOffset() * 60000;
            state.selectedDate = new Date(dateObj - offset).toISOString().split('T')[0];
            updateDashboardUI();
        }

        function formatHumanDate(dateStr) {
            const today = getTodayDateString();
            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            const offset = yesterdayObj.getTimezoneOffset() * 60000;
            const yesterday = new Date(yesterdayObj - offset).toISOString().split('T')[0];

            if (dateStr === today) return "Сегодня";
            if (dateStr === yesterday) return "Вчера";

            const [y, m, d] = dateStr.split('-');
            const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
            return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
        }

        // ==========================================
        // 4. ОБНОВЛЕНИЕ ДАШБОРДА И ДНЕВНИКА
        // ==========================================
        function updateDashboardUI() {
            const label = formatHumanDate(state.selectedDate);
            document.getElementById('today-btn').textContent = label;
            document.getElementById('current-date-label').textContent = `${label} (${state.selectedDate})`;

            const dayMeals = state.logs[state.selectedDate] || [];

            // Суммируем показатели за день
            let totalKcal = 0, totalP = 0, totalF = 0, totalC = 0;
            dayMeals.forEach(meal => {
                totalKcal += Number(meal.totals.kcal) || 0;
                totalP += Number(meal.totals.p) || 0;
                totalF += Number(meal.totals.f) || 0;
                totalC += Number(meal.totals.c) || 0;
            });

            totalKcal = Math.round(totalKcal);
            totalP = Math.round(totalP * 10) / 10;
            totalF = Math.round(totalF * 10) / 10;
            totalC = Math.round(totalC * 10) / 10;

            const targetKcal = state.targets.kcal;
            const remaining = Math.max(0, targetKcal - totalKcal);
            const percent = targetKcal > 0 ? Math.min(100, Math.round((totalKcal / targetKcal) * 100)) : 0;

            // Обновляем цифры
            document.getElementById('header-target-kcal').textContent = targetKcal;
            document.getElementById('ring-target-kcal').textContent = targetKcal;
            document.getElementById('consumed-kcal').textContent = totalKcal;
            document.getElementById('remaining-kcal').textContent = remaining;
            document.getElementById('meals-count').textContent = dayMeals.length;
            document.getElementById('kcal-percent').textContent = `${Math.round((totalKcal / targetKcal) * 100)}%`;

            // Цвет остатка калорий
            const remEl = document.getElementById('remaining-kcal');
            if (totalKcal > targetKcal) {
                remEl.textContent = `+${totalKcal - targetKcal}`;
                remEl.classList.remove('text-emerald-400');
                remEl.classList.add('text-amber-400');
            } else {
                remEl.classList.remove('text-amber-400');
                remEl.classList.add('text-emerald-400');
            }

            // Обновляем SVG кольцо (длина окружности r=52 -> 2 * PI * 52 = 326.72)
            const circumference = 326.72;
            const offset = circumference - (percent / 100) * circumference;
            document.getElementById('kcal-ring').style.strokeDashoffset = offset;

            // Обновляем Б/Ж/У
            document.getElementById('consumed-p').textContent = Math.round(totalP);
            document.getElementById('target-p').textContent = state.targets.p;
            document.getElementById('bar-p').style.width = `${Math.min(100, (totalP / state.targets.p) * 100)}%`;

            document.getElementById('consumed-f').textContent = Math.round(totalF);
            document.getElementById('target-f').textContent = state.targets.f;
            document.getElementById('bar-f').style.width = `${Math.min(100, (totalF / state.targets.f) * 100)}%`;

            document.getElementById('consumed-c').textContent = Math.round(totalC);
            document.getElementById('target-c').textContent = state.targets.c;
            document.getElementById('bar-c').style.width = `${Math.min(100, (totalC / state.targets.c) * 100)}%`;

            renderMealsList(dayMeals);
        }

        function renderMealsList(meals) {
            const container = document.getElementById('meals-list');
            if (!meals || meals.length === 0) {
                container.innerHTML = `
                    <div class="bg-dark-900/60 border border-dashed border-zinc-800 rounded-3xl p-8 text-center space-y-2">
                        <div class="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-500 flex items-center justify-center mx-auto">
                            <i data-lucide="utensils" class="w-6 h-6"></i>
                        </div>
                        <p class="text-sm font-semibold text-zinc-300">Пока нет записей за этот день</p>
                        <p class="text-xs text-zinc-500">Нажми «Сфоткать еду», чтобы ИИ распознал тарелку и посчитал калории</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }

            container.innerHTML = meals.slice().reverse().map(meal => {
                const itemsHtml = meal.items.map(it => `
                    <div class="flex items-center justify-between text-xs py-1 border-b border-zinc-800/60 last:border-0">
                        <span class="text-zinc-300 truncate pr-2">${escapeHtml(it.name)} <span class="text-zinc-500">(${it.weight}г)</span></span>
                        <span class="text-zinc-400 font-medium whitespace-nowrap">${Math.round(it.kcal)} ккал</span>
                    </div>
                `).join('');

                const thumbHtml = meal.thumbnail 
                    ? `<img src="${meal.thumbnail}" alt="Блюдо" class="w-14 h-14 rounded-2xl object-cover flex-shrink-0 border border-zinc-700/70">`
                    : `<div class="w-14 h-14 rounded-2xl bg-dark-800 border border-zinc-800 flex items-center justify-center flex-shrink-0 text-emerald-400"><i data-lucide="utensils-crossed" class="w-6 h-6"></i></div>`;

                return `
                    <div class="bg-dark-900 border border-zinc-800/90 rounded-3xl p-4 space-y-3 shadow-md">
                        <div class="flex items-start gap-3">
                            ${thumbHtml}
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-medium text-zinc-400 flex items-center gap-1">
                                        <i data-lucide="clock" class="w-3 h-3"></i> ${meal.time}
                                    </span>
                                    <div class="flex items-center gap-1">
                                        <button onclick="openEditMeal('${meal.id}')" class="text-zinc-500 hover:text-emerald-400 p-1 rounded-lg transition" title="Редактировать">
                                            <i data-lucide="pencil" class="w-4 h-4"></i>
                                        </button>
                                        <button onclick="deleteMeal('${meal.id}')" class="text-zinc-500 hover:text-red-400 p-1 rounded-lg transition" title="Удалить">
                                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="flex items-baseline justify-between mt-0.5">
                                    <span class="text-base font-extrabold text-white">${Math.round(meal.totals.kcal)} ккал</span>
                                    <div class="flex gap-2 text-[11px] font-semibold">
                                        <span class="text-sky-400">Б ${Math.round(meal.totals.p)}</span>
                                        <span class="text-amber-400">Ж ${Math.round(meal.totals.f)}</span>
                                        <span class="text-emerald-400">У ${Math.round(meal.totals.c)}</span>
                                    </div>
                                </div>
                                ${meal.note ? `<p class="text-[11px] text-zinc-400 italic mt-1 truncate">«${escapeHtml(meal.note)}»</p>` : ''}
                            </div>
                        </div>
                        <div class="bg-dark-800/50 rounded-2xl px-3 py-2">
                            ${itemsHtml}
                        </div>
                    </div>
                `;
            }).join('');

            lucide.createIcons();
        }

        function openEditMeal(mealId) {
            const meals = state.logs[state.selectedDate] || [];
            const meal = meals.find(item => item.id === mealId);
            if (!meal) return;

            resetModalState();
            editingMealId = mealId;
            currentDetectedItems = JSON.parse(JSON.stringify(meal.items || []));
            currentThumbnailDataUrl = meal.thumbnail || null;
            document.getElementById('food-note-input').value = meal.note || '';
            setModalMode('text');

            // В режиме редактирования оставляем только список продуктов и сохранение.
            document.getElementById('modal-title').textContent = 'Редактировать приём пищи';
            document.getElementById('analyze-btn').classList.add('hidden');
            document.getElementById('favorites-block').classList.add('hidden');
            document.getElementById('mode-photo-btn').parentElement.classList.add('hidden');
            document.getElementById('recognition-results').classList.remove('hidden');
            const saveButton = document.querySelector('#recognition-results button[onclick="saveMealToLog()"] span');
            if (saveButton) saveButton.textContent = 'Сохранить изменения';

            renderDetectedItemsEditor();
            document.getElementById('add-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function deleteMeal(mealId) {
            if (!state.logs[state.selectedDate]) return;
            state.logs[state.selectedDate] = state.logs[state.selectedDate].filter(m => m.id !== mealId);
            persistState();
            updateDashboardUI();
            showToast("Приём пищи удалён", "trash-2");
        }

        // ==========================================
        // 5. МОДАЛЬНОЕ ОКНО: ФОТО И СЖАТИЕ ИЗОБРАЖЕНИЯ
        // ==========================================
        // ==========================================
        // ИЗБРАННЫЕ БЛЮДА (без запросов к ИИ)
        // ==========================================
        let favorites = [];

        function loadFavorites() {
            try {
                const raw = JSON.parse(localStorage.getItem('ai_kbju_favorites') || '[]');
                favorites = Array.isArray(raw) ? raw : [];
            } catch (e) { favorites = []; }
        }

        function saveFavorites() {
            try { localStorage.setItem('ai_kbju_favorites', JSON.stringify(favorites)); } catch (e) { console.error(e); }
            scheduleCloudSync();
            renderFavorites();
        }

        function renderFavorites() {
            const block = document.getElementById('favorites-block');
            const list = document.getElementById('favorites-list');
            if (!block || !list) return;
            if (favorites.length === 0) { block.classList.add('hidden'); list.innerHTML = ''; return; }
            block.classList.remove('hidden');
            list.innerHTML = favorites.map(fav => `
                <div class="flex-shrink-0 flex items-center bg-dark-800 border border-zinc-700 rounded-xl">
                    <button type="button" onclick="useFavorite('${fav.id}')" class="px-3 py-2 text-left">
                        <span class="block text-xs font-semibold text-white truncate">${escapeHtml(fav.name)}</span>
                        <span class="block text-[10px] text-zinc-400">${Math.round(fav.totals.kcal)} ккал</span>
                    </button>
                    <button type="button" onclick="removeFavorite('${fav.id}')" class="px-2 text-zinc-500 hover:text-red-400" title="Удалить из избранного">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            `).join('');
            lucide.createIcons();
        }

        function addCurrentToFavorites() {
            if (currentDetectedItems.length === 0) { showToast("Сначала добавь хотя бы один продукт", "alert-circle"); return; }
            const defaultName = currentDetectedItems.map(it => it.name).join(', ').slice(0, 40);
            const input = window.prompt('Название для избранного:', defaultName);
            if (input === null) return;
            const name = input.trim().slice(0, 40);
            if (!name) return;
            let kcal = 0, p = 0, f = 0, c = 0;
            currentDetectedItems.forEach(it => { kcal += Number(it.kcal) || 0; p += Number(it.p) || 0; f += Number(it.f) || 0; c += Number(it.c) || 0; });
            const entry = {
                id: 'fav_' + Date.now(),
                name,
                items: currentDetectedItems.map(it => ({ ...it })),
                totals: { kcal: Math.round(kcal), p: Math.round(p * 10) / 10, f: Math.round(f * 10) / 10, c: Math.round(c * 10) / 10 }
            };
            favorites = favorites.filter(x => x.name.toLowerCase() !== name.toLowerCase());
            favorites.unshift(entry);
            favorites = favorites.slice(0, 30);
            saveFavorites();
            showToast("Добавлено в избранное", "star");
        }

        function useFavorite(id) {
            const fav = favorites.find(x => x.id === id);
            if (!fav) return;
            currentDetectedItems = fav.items.map(it => ({ ...it }));
            document.getElementById('recognition-results').classList.remove('hidden');
            renderDetectedItemsEditor();
        }

        function removeFavorite(id) {
            const fav = favorites.find(x => x.id === id);
            if (!fav || !window.confirm('Удалить «' + fav.name + '» из избранного?')) return;
            favorites = favorites.filter(x => x.id !== id);
            saveFavorites();
        }

        function openAddModal(mode = 'photo') {
            resetModalState();
            setModalMode(mode);
            document.getElementById('modal-title').textContent = 'Добавить приём пищи';
            document.getElementById('analyze-btn').classList.remove('hidden');
            document.getElementById('favorites-block').classList.remove('hidden');
            document.getElementById('mode-photo-btn').parentElement.classList.remove('hidden');
            const saveButton = document.querySelector('#recognition-results button[onclick="saveMealToLog()"] span');
            if (saveButton) saveButton.textContent = 'Добавить в дневник за день';
            renderFavorites();
            document.getElementById('add-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function closeAddModal() {
            stopBarcodeScanner();
            document.getElementById('add-modal').classList.add('hidden');
            editingMealId = null;
        }

        function resetModalState() {
            editingMealId = null;
            currentBase64Image = null;
            currentThumbnailDataUrl = null;
            currentDetectedItems = [];
            document.getElementById('food-photo-input').value = '';
            document.getElementById('food-note-input').value = '';
            document.getElementById('photo-placeholder').classList.remove('hidden');
            document.getElementById('photo-preview-container').classList.add('hidden');
            document.getElementById('ai-analyzing-state').classList.add('hidden');
            document.getElementById('recognition-results').classList.add('hidden');
            document.getElementById('analyze-btn').disabled = false;
            document.getElementById('analyze-btn').classList.remove('opacity-50');
        }

        function setModalMode(mode) {
            currentModalMode = mode;
            const photoBtn = document.getElementById('mode-photo-btn');
            const textBtn = document.getElementById('mode-text-btn');
            const photoSection = document.getElementById('photo-input-section');
            const noteLabel = document.getElementById('note-label');
            const noteInput = document.getElementById('food-note-input');

            if (mode === 'photo') {
                photoBtn.className = "py-2 text-xs font-bold rounded-lg bg-zinc-700 text-white transition flex items-center justify-center gap-1.5";
                textBtn.className = "py-2 text-xs font-bold rounded-lg text-zinc-400 hover:text-white transition flex items-center justify-center gap-1.5";
                photoSection.classList.remove('hidden');
                noteLabel.textContent = "Уточнение для ИИ (скрытые добавки, вес, соусы):";
                noteInput.placeholder = "Например: там в творог ещё ложка мёда, жарил на масле...";
                noteInput.rows = 2;
            } else {
                textBtn.className = "py-2 text-xs font-bold rounded-lg bg-zinc-700 text-white transition flex items-center justify-center gap-1.5";
                photoBtn.className = "py-2 text-xs font-bold rounded-lg text-zinc-400 hover:text-white transition flex items-center justify-center gap-1.5";
                photoSection.classList.add('hidden');
                noteLabel.textContent = "Опиши, что и сколько ты съел:";
                noteInput.placeholder = "Например: 200г отварной гречки, 150г куриной грудки, 1 банан и 20г мёда";
                noteInput.rows = 3;
            }
        }

        // Обработка выбора фото с ресайзом для быстрой отправки в Gemini и сохранения миниатюры
        function handlePhotoSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    // 1. Сжимаем изображение для API (макс. 1024px по большей стороне)
                    const apiCanvas = document.createElement('canvas');
                    const maxDim = 1024;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    apiCanvas.width = w;
                    apiCanvas.height = h;
                    const ctx = apiCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);

                    const dataUrl = apiCanvas.toDataURL('image/jpeg', 0.85);
                    currentBase64Image = dataUrl.split(',')[1];
                    currentImageMimeType = 'image/jpeg';

                    // 2. Создаём компактную миниатюру (160px) для хранения в localStorage
                    const thumbCanvas = document.createElement('canvas');
                    const thumbSize = 160;
                    thumbCanvas.width = thumbSize;
                    thumbCanvas.height = thumbSize;
                    const tCtx = thumbCanvas.getContext('2d');
                    const minSide = Math.min(img.width, img.height);
                    const sx = (img.width - minSide) / 2;
                    const sy = (img.height - minSide) / 2;
                    tCtx.drawImage(img, sx, sy, minSide, minSide, 0, 0, thumbSize, thumbSize);
                    currentThumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

                    // Показываем превью в UI
                    document.getElementById('photo-preview-img').src = dataUrl;
                    document.getElementById('photo-placeholder').classList.add('hidden');
                    document.getElementById('photo-preview-container').classList.remove('hidden');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        // ==========================================
        // 6. ЗАПРОС К GEMINI API ДЛЯ РАСПОЗНАВАНИЯ ЕДЫ
        // ==========================================
        async function fetchWithBackoff(url, options, maxRetries = 4, timeoutMs = 45000) {
            let delay = 1000;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const response = await fetch(url, { ...options, signal: controller.signal });
                    clearTimeout(timer);
                    if (response.ok) {
                        return await response.json();
                    }
                    if (response.status === 429 || response.status >= 500) {
                        if (attempt === maxRetries) throw new Error(`HTTP ${response.status}`);
                        await new Promise(res => setTimeout(res, delay));
                        delay *= 2;
                        continue;
                    }
                    const errText = await response.text();
                    const fatalErr = new Error(`API Error (${response.status}): ${errText}`);
                    fatalErr.fatal = true;
                    throw fatalErr;
                } catch (err) {
                    clearTimeout(timer);
                    if (err.name === 'AbortError') { const te = new Error('Timeout: Gemini не ответил за ' + Math.round(timeoutMs / 1000) + ' секунд'); te.fatal = true; throw te; }
                    if (err.fatal || attempt === maxRetries) throw err;
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2;
                }
            }
        }

        async function callGemini(payload) {
            const key = getActiveApiKey();
            let lastErr = null;
            for (const model of GEMINI_MODELS) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
                try {
                    const res = await fetchWithBackoff(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }, 1, 25000);
                    return res;
                } catch (err) {
                    err.model = model;
                    lastErr = err;
                    const msg = String(err && err.message || '');
                    if (/API key not valid|API_KEY_INVALID|API Error \((401|403)\)/i.test(msg)) throw err; // с ключом проблема, другая модель не поможет
                    console.warn('Gemini: модель ' + model + ' не сработала, пробуем следующую.', msg);
                }
            }
            throw lastErr;
        }

        function describeAiError(error) {
            const raw = String(error && error.message || error || '');
            let apiMsg = '';
            const i = raw.indexOf('{');
            if (i >= 0) {
                try { apiMsg = (JSON.parse(raw.slice(i)).error || {}).message || ''; } catch (e) { apiMsg = raw.slice(i, i + 160); }
            }
            const code = (raw.match(/\((\d{3})\)/) || raw.match(/HTTP (\d{3})/) || [])[1];
            let reason;
            if (/Timeout/i.test(raw)) reason = 'Gemini слишком долго отвечает. Попробуй ещё раз.';
            else if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) reason = 'Нет связи с Gemini (интернет, VPN или блокировщик рекламы).';
            else if (code === '429') reason = 'Закончился лимит Gemini. Подожди минуту или попробуй позже.';
            else if (/API key not valid|API_KEY_INVALID|expired/i.test(raw)) reason = 'Gemini не принял ключ. Проверь API ключ в Настройках.';
            else if (code === '404') reason = 'Модель Gemini недоступна (' + ((error && error.model) || GEMINI_MODEL) + ').';
            else if (code === '403') reason = 'Доступ запрещён. Ключ ограничен или Gemini недоступен для твоего аккаунта/региона.';
            else if (/JSON|Unexpected token|Пустой ответ/i.test(raw)) reason = 'Gemini вернул непонятный ответ. Попробуй ещё раз.';
            else reason = 'Не удалось распознать.';
            const detail = (apiMsg || raw).replace(/\s+/g, ' ').slice(0, 140);
            return reason + (code ? ' [' + code + '] ' : ' ') + detail + (error && error.model ? ' (модель: ' + error.model + ')' : '');
        }

        async function analyzeFoodWithAI() {
            const noteText = document.getElementById('food-note-input').value.trim();

            if (currentModalMode === 'photo' && !currentBase64Image && !noteText) {
                showToast("Сначала сделай фото еды или напиши описание", "alert-circle");
                return;
            }
            if (currentModalMode === 'text' && !noteText) {
                showToast("Опиши текстом, что ты съел", "alert-circle");
                return;
            }

            if (!getActiveApiKey()) {
                showToast("Сначала добавь Gemini API ключ: Настройки → Gemini API Ключ", "alert-circle");
                return;
            }

            const analyzeBtn = document.getElementById('analyze-btn');
            const loadingState = document.getElementById('ai-analyzing-state');
            const resultsBlock = document.getElementById('recognition-results');

            analyzeBtn.disabled = true;
            analyzeBtn.classList.add('opacity-50');
            loadingState.classList.remove('hidden');
            resultsBlock.classList.add('hidden');

            try {
                const systemPrompt = `Ты — профессиональный спортивный нутрициолог и эксперт по оценке калорийности блюд по фото и тексту.
Твоя задача:
1. Определить каждый отдельный продукт или блюдо на фотографии и/или из текстового описания пользователя.
2. Обязательно учесть все текстовые уточнения пользователя (например: "в твороге ещё мёд", "жарено на масле", вес в граммах и т.д.).
3. Реалистично оценить вес каждой порции в граммах (для готового блюда) и рассчитать калории (kcal), белки (p), жиры (f) и углеводы (c).
4. Названия продуктов пиши понятно и кратко на русском языке.`;

                const userPromptText = currentBase64Image
                    ? `Проанализируй это фото еды и посчитай КБЖУ каждого продукта. ${noteText ? 'Дополнительное уточнение от пользователя: ' + noteText : ''}`
                    : `Посчитай КБЖУ для следующего приёма пищи: ${noteText}`;

                const parts = [{ text: userPromptText }];
                if (currentBase64Image) {
                    parts.push({
                        inlineData: {
                            mimeType: currentImageMimeType,
                            data: currentBase64Image
                        }
                    });
                }

                const payload = {
                    contents: [{ role: "user", parts }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: {
                        thinkingConfig: { thinkingLevel: "low" },
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                items: {
                                    type: "ARRAY",
                                    description: "Список распознанных продуктов или блюд",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            name: { type: "STRING", description: "Название продукта на русском" },
                                            weight: { type: "NUMBER", description: "Примерный вес порции в граммах" },
                                            kcal: { type: "NUMBER", description: "Калорийность порции в ккал" },
                                            p: { type: "NUMBER", description: "Белки в граммах" },
                                            f: { type: "NUMBER", description: "Жиры в граммах" },
                                            c: { type: "NUMBER", description: "Углеводы в граммах" }
                                        },
                                        required: ["name", "weight", "kcal", "p", "f", "c"]
                                    }
                                }
                            },
                            required: ["items"]
                        }
                    }
                };

                const result = await callGemini(payload);

                const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!jsonText) throw new Error("Пустой ответ от модели");

                const parsed = JSON.parse(jsonText);
                currentDetectedItems = (parsed.items || []).map(item => ({
                    name: item.name || "Продукт",
                    weight: Math.round(item.weight || 100),
                    kcal: Math.round(item.kcal || 0),
                    p: Math.round((item.p || 0) * 10) / 10,
                    f: Math.round((item.f || 0) * 10) / 10,
                    c: Math.round((item.c || 0) * 10) / 10
                }));

                renderDetectedItemsEditor();
                resultsBlock.classList.remove('hidden');
                showToast("Еда успешно распознана!", "check-circle-2");
            } catch (error) {
                console.error("Ошибка распознавания:", error);
                showToast(describeAiError(error), "alert-circle", 10000);
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.classList.remove('opacity-50');
                loadingState.classList.add('hidden');
            }
        }

        // ==========================================
        // СКАНЕР ШТРИХКОДОВ И БАЗА OPEN FOOD FACTS
        // ==========================================
        let barcodeStream = null;
        let barcodeDetector = null;
        let barcodeScanFrame = null;
        let barcodeZXingControls = null;
        let barcodeLookupBusy = false;

        function setBarcodeStatus(message, isError = false) {
            const el = document.getElementById('barcode-status');
            if (!el) return;
            el.textContent = message;
            el.classList.remove('hidden', 'text-red-400', 'text-zinc-400', 'text-emerald-400');
            el.classList.add(isError ? 'text-red-400' : 'text-zinc-400');
        }

        async function startBarcodeScanner() {
            const panel = document.getElementById('barcode-camera-panel');
            const video = document.getElementById('barcode-video');
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setBarcodeStatus('Камера недоступна. Открой приложение по HTTPS или введи штрихкод вручную.', true);
                return;
            }
            try {
                panel.classList.remove('hidden');
                if (!('BarcodeDetector' in window)) {
                    if (!window.ZXingBrowser || !window.ZXingBrowser.BrowserMultiFormatReader) {
                        panel.classList.add('hidden');
                        setBarcodeStatus('Сканер не загрузился. Введи цифры штрихкода вручную.', true);
                        return;
                    }
                    const reader = new ZXingBrowser.BrowserMultiFormatReader();
                    setBarcodeStatus('Запрашиваем доступ к камере…');
                    barcodeZXingControls = await reader.decodeFromVideoDevice(undefined, video, (result, error, controls) => {
                        if (controls) barcodeZXingControls = controls;
                        if (result && result.getText()) {
                            const code = result.getText();
                            document.getElementById('barcode-manual-input').value = code;
                            stopBarcodeScanner();
                            lookupBarcodeProduct(code);
                        }
                    });
                    setBarcodeStatus('Камера включена. Наведи её на штрихкод.');
                    return;
                }
                const supported = await BarcodeDetector.getSupportedFormats();
                const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter(x => supported.includes(x));
                if (!formats.length) throw new Error('Браузер не поддерживает подходящие форматы штрихкодов.');
                barcodeDetector = new BarcodeDetector({ formats });
                barcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
                video.srcObject = barcodeStream;
                panel.classList.remove('hidden');
                await video.play();
                setBarcodeStatus('Камера включена. Наведи её на штрихкод.');
                scanBarcodeFrame();
            } catch (error) {
                stopBarcodeScanner();
                setBarcodeStatus(error.name === 'NotAllowedError' ? 'Нет доступа к камере. Разреши доступ в настройках браузера.' : (error.message || 'Не удалось запустить камеру.'), true);
            }
        }

        async function scanBarcodeFrame() {
            const video = document.getElementById('barcode-video');
            if (!barcodeDetector || !video || video.readyState < 2 || barcodeLookupBusy) {
                barcodeScanFrame = requestAnimationFrame(scanBarcodeFrame);
                return;
            }
            try {
                const codes = await barcodeDetector.detect(video);
                if (codes.length && codes[0].rawValue) {
                    document.getElementById('barcode-manual-input').value = codes[0].rawValue;
                    stopBarcodeScanner();
                    await lookupBarcodeProduct(codes[0].rawValue);
                    return;
                }
            } catch (error) { /* продолжаем сканирование следующего кадра */ }
            barcodeScanFrame = requestAnimationFrame(scanBarcodeFrame);
        }

        function stopBarcodeScanner() {
            if (barcodeScanFrame) cancelAnimationFrame(barcodeScanFrame);
            barcodeScanFrame = null;
            if (barcodeZXingControls) {
                try { barcodeZXingControls.stop(); } catch (error) { /* камера уже остановлена */ }
            }
            barcodeZXingControls = null;
            if (barcodeStream) barcodeStream.getTracks().forEach(track => track.stop());
            barcodeStream = null;
            barcodeDetector = null;
            const video = document.getElementById('barcode-video');
            if (video) { video.pause(); video.srcObject = null; }
            const panel = document.getElementById('barcode-camera-panel');
            if (panel) panel.classList.add('hidden');
        }

        async function lookupBarcodeProduct(value) {
            const input = document.getElementById('barcode-manual-input');
            const barcode = String(value || input.value || '').replace(/\s/g, '');
            if (!/^\d{8,14}$/.test(barcode)) {
                setBarcodeStatus('Введи корректный штрихкод: обычно это 8–14 цифр.', true);
                return;
            }
            if (barcodeLookupBusy) return;
            barcodeLookupBusy = true;
            setBarcodeStatus('Ищем продукт в Open Food Facts…');
            try {
                const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_ru,product_name_uk,brands,nutriments,quantity`);
                if (!response.ok) throw new Error('База продуктов временно недоступна. Попробуй ещё раз.');
                const data = await response.json();
                if (data.status !== 1 || !data.product) throw new Error('Продукт не найден. Можно добавить его вручную или попробовать другой штрихкод.');
                const product = data.product;
                const n = product.nutriments || {};
                const kcal = Number(n['energy-kcal_100g'] ?? n['energy-kcal_value'] ?? (Number(n['energy_100g']) / 4.184));
                const protein = Number(n.proteins_100g);
                const fat = Number(n.fat_100g);
                const carbs = Number(n.carbohydrates_100g);
                if (![kcal, protein, fat, carbs].every(Number.isFinite)) throw new Error('У продукта нет полного набора данных КБЖУ в базе.');
                const name = product.product_name_ru || product.product_name_uk || product.product_name || product.brands || `Продукт ${barcode}`;
                currentDetectedItems.push({
                    name: String(name).trim(), weight: 100,
                    kcal: Math.round(kcal), p: Math.round(protein * 10) / 10,
                    f: Math.round(fat * 10) / 10, c: Math.round(carbs * 10) / 10
                });
                renderDetectedItemsEditor();
                document.getElementById('recognition-results').classList.remove('hidden');
                document.getElementById('recognition-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
                setBarcodeStatus(`Добавлено: ${name}. Значения указаны на 100 г — проверь их по упаковке.`);
                input.value = '';
            } catch (error) {
                setBarcodeStatus(error.message || 'Не удалось найти продукт.', true);
            } finally {
                barcodeLookupBusy = false;
            }
        }

        // ==========================================
        // 7. РЕДАКТОР РАСПОЗНАННЫХ ПРОДУКТОВ И СОХРАНЕНИЕ
        // ==========================================
        function renderDetectedItemsEditor() {
            const listEl = document.getElementById('detected-items-list');
            listEl.innerHTML = currentDetectedItems.map((item, idx) => `
                <div class="bg-dark-800 border border-zinc-700/80 rounded-2xl p-3 space-y-2.5">
                    <div class="flex items-center gap-2">
                        <input type="text" value="${escapeHtml(item.name)}" onchange="updateDetectedItem(${idx}, 'name', this.value)" class="flex-1 bg-dark-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500">
                        <button onclick="removeDetectedItem(${idx})" class="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg bg-dark-900 border border-zinc-800" title="Удалить продукт">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="grid grid-cols-5 gap-1.5 text-center">
                        <div>
                            <span class="block text-[10px] text-zinc-400 mb-0.5">Вес (г)</span>
                            <input type="number" value="${item.weight}" onchange="handleWeightScale(${idx}, this.value)" class="w-full bg-dark-900 border border-zinc-700 rounded-lg py-1 text-xs font-bold text-center text-white focus:outline-none focus:border-emerald-500">
                        </div>
                        <div>
                            <span class="block text-[10px] text-zinc-400 mb-0.5">Ккал</span>
                            <input type="number" value="${item.kcal}" onchange="updateDetectedItem(${idx}, 'kcal', this.value)" class="w-full bg-dark-900 border border-zinc-700 rounded-lg py-1 text-xs font-bold text-center text-emerald-400 focus:outline-none focus:border-emerald-500">
                        </div>
                        <div>
                            <span class="block text-[10px] text-sky-400 mb-0.5">Б (г)</span>
                            <input type="number" step="0.1" value="${item.p}" onchange="updateDetectedItem(${idx}, 'p', this.value)" class="w-full bg-dark-900 border border-zinc-700 rounded-lg py-1 text-xs font-semibold text-center text-white focus:outline-none focus:border-sky-400">
                        </div>
                        <div>
                            <span class="block text-[10px] text-amber-400 mb-0.5">Ж (г)</span>
                            <input type="number" step="0.1" value="${item.f}" onchange="updateDetectedItem(${idx}, 'f', this.value)" class="w-full bg-dark-900 border border-zinc-700 rounded-lg py-1 text-xs font-semibold text-center text-white focus:outline-none focus:border-amber-400">
                        </div>
                        <div>
                            <span class="block text-[10px] text-emerald-400 mb-0.5">У (г)</span>
                            <input type="number" step="0.1" value="${item.c}" onchange="updateDetectedItem(${idx}, 'c', this.value)" class="w-full bg-dark-900 border border-zinc-700 rounded-lg py-1 text-xs font-semibold text-center text-white focus:outline-none focus:border-emerald-400">
                        </div>
                    </div>
                </div>
            `).join('');

            recalculateModalTotals();
            lucide.createIcons();
        }

        // Пропорциональный пересчёт КБЖУ при изменении веса в граммах!
        function handleWeightScale(idx, newWeightVal) {
            const newWeight = parseFloat(newWeightVal);
            if (isNaN(newWeight) || newWeight <= 0) return;

            const item = currentDetectedItems[idx];
            const oldWeight = item.weight > 0 ? item.weight : 100;
            const ratio = newWeight / oldWeight;

            item.weight = Math.round(newWeight);
            item.kcal = Math.round(item.kcal * ratio);
            item.p = Math.round(item.p * ratio * 10) / 10;
            item.f = Math.round(item.f * ratio * 10) / 10;
            item.c = Math.round(item.c * ratio * 10) / 10;

            renderDetectedItemsEditor();
        }

        function updateDetectedItem(idx, field, val) {
            if (field === 'name') {
                currentDetectedItems[idx].name = val;
            } else {
                currentDetectedItems[idx][field] = parseFloat(val) || 0;
            }
            recalculateModalTotals();
        }

        function removeDetectedItem(idx) {
            currentDetectedItems.splice(idx, 1);
            renderDetectedItemsEditor();
        }

        function addEmptyFoodItem() {
            currentDetectedItems.push({
                name: "Новый продукт",
                weight: 100,
                kcal: 150,
                p: 10,
                f: 5,
                c: 15
            });
            renderDetectedItemsEditor();
        }

        function recalculateModalTotals() {
            let kcal = 0, p = 0, f = 0, c = 0;
            currentDetectedItems.forEach(it => {
                kcal += Number(it.kcal) || 0;
                p += Number(it.p) || 0;
                f += Number(it.f) || 0;
                c += Number(it.c) || 0;
            });

            document.getElementById('modal-total-kcal').textContent = Math.round(kcal);
            document.getElementById('modal-total-p').textContent = Math.round(p * 10) / 10;
            document.getElementById('modal-total-f').textContent = Math.round(f * 10) / 10;
            document.getElementById('modal-total-c').textContent = Math.round(c * 10) / 10;
        }

        function saveMealToLog() {
            if (currentDetectedItems.length === 0) {
                showToast("Добавь хотя бы один продукт", "alert-circle");
                return;
            }

            let kcal = 0, p = 0, f = 0, c = 0;
            currentDetectedItems.forEach(it => {
                kcal += Number(it.kcal) || 0;
                p += Number(it.p) || 0;
                f += Number(it.f) || 0;
                c += Number(it.c) || 0;
            });

            const now = new Date();
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const noteText = document.getElementById('food-note-input').value.trim();

            const totals = {
                kcal: Math.round(kcal),
                p: Math.round(p * 10) / 10,
                f: Math.round(f * 10) / 10,
                c: Math.round(c * 10) / 10
            };

            if (!state.logs[state.selectedDate]) state.logs[state.selectedDate] = [];

            if (editingMealId) {
                const existingMeal = state.logs[state.selectedDate].find(meal => meal.id === editingMealId);
                if (!existingMeal) {
                    showToast('Запись не найдена. Возможно, она уже удалена.', 'alert-circle');
                    closeAddModal();
                    return;
                }
                existingMeal.note = noteText;
                existingMeal.items = currentDetectedItems.map(item => ({ ...item }));
                existingMeal.totals = totals;
                if (currentThumbnailDataUrl) existingMeal.thumbnail = currentThumbnailDataUrl;
                persistState();
                updateDashboardUI();
                closeAddModal();
                showToast('Изменения сохранены', 'check-circle-2');
                return;
            }

            const newMeal = {
                id: 'meal_' + Date.now(),
                time: timeStr,
                thumbnail: currentThumbnailDataUrl,
                note: noteText,
                items: currentDetectedItems.map(item => ({ ...item })),
                totals
            };
            state.logs[state.selectedDate].push(newMeal);

            persistState();
            updateDashboardUI();
            closeAddModal();
            showToast(`+${newMeal.totals.kcal} ккал записано в дневник!`, "flame");
        }

        // ==========================================
        // 8. ИИ-НУТРИЦИОЛОГ / ТРЕНЕР (AI COACH)
        // ==========================================
        async function askAICoach() {
            const btn = document.getElementById('ask-coach-btn');
            const loading = document.getElementById('coach-loading');
            const responseCard = document.getElementById('coach-response-card');
            const responseTextEl = document.getElementById('coach-response-text');
            const customQuery = document.getElementById('coach-custom-query').value.trim();

            const dayMeals = state.logs[state.selectedDate] || [];
            let eatenKcal = 0, eatenP = 0, eatenF = 0, eatenC = 0;
            const eatenDescriptions = [];

            dayMeals.forEach((m, index) => {
                eatenKcal += m.totals.kcal;
                eatenP += m.totals.p;
                eatenF += m.totals.f;
                eatenC += m.totals.c;
                const names = m.items.map(i => `${i.name} (${i.weight}г)`).join(', ');
                eatenDescriptions.push(`${index + 1}) ${m.time}: ${names} [${m.totals.kcal} ккал, Б:${m.totals.p} Ж:${m.totals.f} У:${m.totals.c}]`);
            });

            const remKcal = state.targets.kcal - Math.round(eatenKcal);
            const remP = Math.round(state.targets.p - eatenP);
            const remF = Math.round(state.targets.f - eatenF);
            const remC = Math.round(state.targets.c - eatenC);

            btn.disabled = true;
            btn.classList.add('opacity-50');
            loading.classList.remove('hidden');
            responseCard.classList.add('hidden');

            try {
                const activityLabels = {
                    sedentary: 'Сидячий образ жизни (минимум движения)',
                    light: 'Лёгкая активность (1–3 тренировки в неделю)',
                    moderate: 'Умеренная активность (3–5 тренировок в неделю)',
                    high: 'Высокая активность (6–7 тренировок / физическая работа)',
                    extreme: 'Экстремальная активность (тяжёлый спорт)'
                };
                const goalLabels = {
                    bulk: 'Набор мышечной массы (профицит)',
                    maintain: 'Поддержание веса',
                    cut: 'Похудение / сушка (дефицит)'
                };

                const prompt = `Ты — дружелюбный, мотивирующий и практичный персональный AI-нутрициолог и фитнес-тренер.
Проанализируй рацион пользователя за день (${formatHumanDate(state.selectedDate)}) и дай конкретные, понятные советы на русском языке.

АНКЕТА ПОЛЬЗОВАТЕЛЯ:
- Пол: ${state.profile.gender === 'female' ? 'Женский' : 'Мужской'}, Возраст: ${state.profile.age} лет, Вес: ${state.profile.weight} кг, Рост: ${state.profile.height} см
- Образ жизни: ${activityLabels[state.profile.activity] || state.profile.activity}
- Цель: ${goalLabels[state.profile.goal] || state.profile.goal}
${state.profile.notes ? `- Особенности: ${state.profile.notes}` : ''}

ЦЕЛИ ПОЛЬЗОВАТЕЛЯ НА ДЕНЬ:
- Калории: ${state.targets.kcal} ккал
- Белки: ${state.targets.p} г
- Жиры: ${state.targets.f} г
- Углеводы: ${state.targets.c} г

УЖЕ СЪЕДЕНО СЕГОДНЯ:
${eatenDescriptions.length > 0 ? eatenDescriptions.join('\n') : 'Пока ничего не записано за этот день.'}

ИТОГО СЪЕДЕНО: ${Math.round(eatenKcal)} ккал (Б: ${Math.round(eatenP)}г, Ж: ${Math.round(eatenF)}г, У: ${Math.round(eatenC)}г).
ОСТАЛОСЬ ДО ЦЕЛИ: ${remKcal} ккал (Б: ${remP}г, Ж: ${remF}г, У: ${remC}г).
${customQuery ? `ДОПОЛНИТЕЛЬНЫЙ ВОПРОС ПОЛЬЗОВАТЕЛЯ: "${customQuery}"` : ''}

Структура ответа (кратко, по делу, без воды, с эмодзи):
1. Краткая оценка текущего прогресса и баланса БЖУ с учётом веса (${state.profile.weight} кг) и цели.
2. На что сделать упор в оставшихся приёмах пищи (белок, сложные углеводы или полезные жиры).
3. 2–3 конкретных примера блюд/перекусов с примерной граммовкой, которые идеально закроют остаток КБЖУ.`;

                const payload = {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { thinkingConfig: { thinkingLevel: "low" } }
                };

                const result = await callGemini(payload);

                const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!reply) throw new Error("Пустой ответ от ИИ-тренера");

                // Форматируем жирный текст markdown в HTML
                const formattedReply = escapeHtml(reply)
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');

                responseTextEl.innerHTML = formattedReply;
                responseCard.classList.remove('hidden');
            } catch (err) {
                console.error("Ошибка AI Coach:", err);
                showToast("Ошибка связи с AI тренером. Попробуй позже.", "alert-circle");
            } finally {
                btn.disabled = false;
                btn.classList.remove('opacity-50');
                loading.classList.add('hidden');
            }
        }

        // ==========================================
        // 9. ПРОФИЛЬ, AI-КАЛЬКУЛЯТОР НОРМЫ И НАСТРОЙКИ
        // ==========================================
        function selectGender(gender) {
            state.profile.gender = gender;
            const maleBtn = document.getElementById('gender-male-btn');
            const femaleBtn = document.getElementById('gender-female-btn');
            if (!maleBtn || !femaleBtn) return;

            if (gender === 'male') {
                maleBtn.className = "py-2 text-xs font-bold rounded-lg bg-emerald-500 text-zinc-950 transition";
                femaleBtn.className = "py-2 text-xs font-bold rounded-lg text-zinc-400 hover:text-white transition";
            } else {
                femaleBtn.className = "py-2 text-xs font-bold rounded-lg bg-emerald-500 text-zinc-950 transition";
                maleBtn.className = "py-2 text-xs font-bold rounded-lg text-zinc-400 hover:text-white transition";
            }
        }

        function readProfileInputs() {
            state.profile.age = parseInt(document.getElementById('profile-age').value, 10) || 25;
            state.profile.weight = parseFloat(document.getElementById('profile-weight').value) || 75;
            state.profile.height = parseInt(document.getElementById('profile-height').value, 10) || 180;
            state.profile.activity = document.getElementById('profile-activity').value;
            state.profile.goal = document.getElementById('profile-goal').value;
            state.profile.notes = document.getElementById('profile-notes').value.trim();
            persistState();
        }

        async function calculateNormWithAI() {
            readProfileInputs();

            const btn = document.getElementById('calc-norm-btn');
            const loading = document.getElementById('norm-loading');
            const resultCard = document.getElementById('norm-result-card');

            const activityMap = {
                sedentary: 'Сидячий образ жизни (офис, минимум движения, коэффициент ~1.2)',
                light: 'Лёгкая активность (1–3 тренировки в неделю, коэффициент ~1.375)',
                moderate: 'Умеренная активность (3–5 тренировок в неделю, коэффициент ~1.55)',
                high: 'Высокая активность (6–7 тренировок / физическая работа, коэффициент ~1.725)',
                extreme: 'Экстремальная активность (тяжёлый спорт / 2 тренировки в день, коэффициент ~1.9)'
            };
            const goalMap = {
                bulk: 'Набор мышечной массы (профицит ~10–15% к TDEE)',
                maintain: 'Поддержание веса (равен TDEE)',
                cut: 'Похудение / сушка (дефицит ~15–20% от TDEE с повышенным белком)'
            };

            btn.disabled = true;
            btn.classList.add('opacity-50');
            loading.classList.remove('hidden');
            resultCard.classList.add('hidden');

            try {
                const systemPrompt = `Ты — сертифицированный спортивный нутрициолог.
Рассчитай базовый обмен веществ (BMR по формуле Миффлина — Сан Жеора), общий суточный расход энергии (TDEE) и оптимальную суточную норму калорий и макронутриентов (БЖУ в граммах) под цель пользователя.
Обязательно убедись, что сумма калорий из БЖУ (Б*4 + Ж*9 + У*4) соответствует итоговой калорийности.
Дай краткое, понятное обоснование на русском языке (2–3 предложения), почему выбраны именно такие цифры.`;

                const userPrompt = `Данные человека:
- Пол: ${state.profile.gender === 'female' ? 'Женский' : 'Мужской'}
- Возраст: ${state.profile.age} лет
- Вес: ${state.profile.weight} кг
- Рост: ${state.profile.height} см
- Образ жизни: ${activityMap[state.profile.activity]}
- Цель: ${goalMap[state.profile.goal]}
${state.profile.notes ? `- Дополнительные пожелания: ${state.profile.notes}` : ''}`;

                const payload = {
                    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: {
                        thinkingConfig: { thinkingLevel: "low" },
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                bmr: { type: "NUMBER", description: "Базовый обмен веществ (ккал)" },
                                tdee: { type: "NUMBER", description: "Общий суточный расход с учётом активности (ккал)" },
                                targetKcal: { type: "NUMBER", description: "Рекомендуемая суточная калорийность под цель (ккал)" },
                                protein: { type: "NUMBER", description: "Суточная норма белков в граммах" },
                                fat: { type: "NUMBER", description: "Суточная норма жиров в граммах" },
                                carbs: { type: "NUMBER", description: "Суточная норма углеводов в граммах" },
                                explanation: { type: "STRING", description: "Краткое персональное обоснование расчёта на русском" }
                            },
                            required: ["bmr", "tdee", "targetKcal", "protein", "fat", "carbs", "explanation"]
                        }
                    }
                };

                const result = await callGemini(payload);

                const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!jsonText) throw new Error("Пустой ответ от ИИ");

                const parsed = JSON.parse(jsonText);
                lastCalculatedNorm = {
                    kcal: Math.round(parsed.targetKcal),
                    p: Math.round(parsed.protein),
                    f: Math.round(parsed.fat),
                    c: Math.round(parsed.carbs)
                };

                document.getElementById('res-bmr').textContent = `${Math.round(parsed.bmr)} ккал`;
                document.getElementById('res-tdee').textContent = `${Math.round(parsed.tdee)} ккал`;
                document.getElementById('res-kcal').textContent = lastCalculatedNorm.kcal;
                document.getElementById('res-p').textContent = `${lastCalculatedNorm.p}г`;
                document.getElementById('res-f').textContent = `${lastCalculatedNorm.f}г`;
                document.getElementById('res-c').textContent = `${lastCalculatedNorm.c}г`;
                document.getElementById('res-explanation').textContent = parsed.explanation;

                resultCard.classList.remove('hidden');
                lucide.createIcons();
                showToast("AI рассчитал твою персональную норму!", "sparkles");
            } catch (err) {
                console.error("Ошибка расчёта нормы:", err);
                showToast("Не удалось выполнить расчёт. Попробуй ещё раз.", "alert-circle");
            } finally {
                btn.disabled = false;
                btn.classList.remove('opacity-50');
                loading.classList.add('hidden');
            }
        }

        function applyCalculatedNorm() {
            if (!lastCalculatedNorm) return;
            readProfileInputs();
            state.targets = { ...lastCalculatedNorm };

            document.getElementById('setting-kcal').value = state.targets.kcal;
            document.getElementById('setting-p').value = state.targets.p;
            document.getElementById('setting-f').value = state.targets.f;
            document.getElementById('setting-c').value = state.targets.c;

            persistState();
            updateDashboardUI();
            switchTab('dashboard');
            showToast(`Новая норма (${state.targets.kcal} ккал) применена!`, "check-circle-2");
        }

        function applyPreset(kcal, p, f, c) {
            document.getElementById('setting-kcal').value = kcal;
            document.getElementById('setting-p').value = p;
            document.getElementById('setting-f').value = f;
            document.getElementById('setting-c').value = c;
        }

        function saveSettings() {
            readProfileInputs();
            const kcal = parseInt(document.getElementById('setting-kcal').value, 10) || 3400;
            const p = parseInt(document.getElementById('setting-p').value, 10) || 180;
            const f = parseInt(document.getElementById('setting-f').value, 10) || 95;
            const c = parseInt(document.getElementById('setting-c').value, 10) || 455;

            state.targets = { kcal, p, f, c };
            persistState();
            updateDashboardUI();
            switchTab('dashboard');
            showToast("Цели КБЖУ обновлены!", "check-circle-2");
        }

        function clearCurrentDayMeals() {
            state.logs[state.selectedDate] = [];
            persistState();
            updateDashboardUI();
            showToast("Дневник за выбранный день очищен", "trash-2");
        }

        let toastTimeout;
        function showToast(message, iconName = "info", duration = 3000) {
            const toast = document.getElementById('toast');
            const msgEl = document.getElementById('toast-message');
            const iconEl = document.getElementById('toast-icon');

            msgEl.textContent = message;
            iconEl.setAttribute('data-lucide', iconName);
            lucide.createIcons();

            toast.classList.remove('hidden');
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.add('hidden');
            }, duration);
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // Привязка кнопок навигации по датам и старт приложения
        window.onload = function() {
            initPWA();
            loadState();
            initCloudAuth();

            document.getElementById('prev-day-btn').addEventListener('click', () => changeDate(-1));
            document.getElementById('next-day-btn').addEventListener('click', () => changeDate(1));
            updateDashboardUI();
            lucide.createIcons();
        };
    
