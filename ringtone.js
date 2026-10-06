/**
 * 传讯来电铃声自定义模块（原生网页版）
 * 作用：为网站增加来电铃声、静默时段、悬浮按钮
 * 使用：在 index.html 的 </body> 前引入此文件
 */

(function() {
    'use strict';

    // ==================== 默认设置 ====================
    const DEFAULT_SETTINGS = {
        ringtoneUrl: '',           // 铃声地址（URL 或 Base64）
        ringtoneName: '未设置',
        silentStart: '22:00',      // 静默开始时间（24小时制）
        silentEnd: '07:00',        // 静默结束时间（24小时制）
        enabled: true              // 总开关
    };

    // 使用原生 localStorage 替代 GM_getValue
    function getSettings() {
        try {
            const saved = localStorage.getItem('ringtone_settings');
            return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
        } catch (e) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    // 使用原生 localStorage 替代 GM_setValue
    function saveSettings(settings) {
        try {
            localStorage.setItem('ringtone_settings', JSON.stringify(settings));
        } catch (e) {
            console.warn('保存设置失败，可能是存储空间不足', e);
        }
    }

    // ==================== 静默时段判断 ====================
    function isSilentTime() {
        const settings = getSettings();
        if (!settings.silentStart || !settings.silentEnd) return false;
        
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        const [startH, startM] = settings.silentStart.split(':').map(Number);
        const [endH, endM] = settings.silentEnd.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (startMinutes > endMinutes) {
            return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        } else {
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        }
    }

    // ==================== 音频播放管理 ====================
    let audioUnlocked = false;
    let ringtoneAudio = null;

    function createAudio() {
        const settings = getSettings();
        if (settings.ringtoneUrl) {
            if (ringtoneAudio) ringtoneAudio.pause();
            ringtoneAudio = new Audio(settings.ringtoneUrl);
            ringtoneAudio.preload = 'auto';
        }
    }

    // 解锁音频（浏览器强制要求，必须由用户手势触发）
    function unlockAudio() {
        if (audioUnlocked) return;
        try {
            const settings = getSettings();
            const unlockAudioObj = new Audio(settings.ringtoneUrl || 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
            unlockAudioObj.volume = 0;
            unlockAudioObj.play().then(() => {
                unlockAudioObj.pause();
                audioUnlocked = true;
                console.log('[传讯铃声] 音频已解锁');
            }).catch(() => {});
        } catch (e) {}
    }

    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    function playRingtone() {
        const settings = getSettings();
        if (!settings.enabled || isSilentTime() || !audioUnlocked) return;

        createAudio();
        if (ringtoneAudio) {
            ringtoneAudio.currentTime = 0;
            ringtoneAudio.loop = true;
            ringtoneAudio.play().catch(err => console.warn('[传讯铃声] 播放失败:', err));
        }
    }

    function stopRingtone() {
        if (ringtoneAudio) {
            ringtoneAudio.pause();
            ringtoneAudio.currentTime = 0;
        }
    }

    // ==================== 来电弹窗检测 ====================
    // 注意：这部分需要根据你实际网页的弹窗 class 名进行调整
    const INCOMING_CALL_SELECTORS = [
        '.incoming-call', '.call-modal', '.incoming-call-modal',
        '[class*="incoming"]', '[class*="call"]'
    ];

    let isCallDetected = false;

    function checkForIncomingCall() {
        for (const selector of INCOMING_CALL_SELECTORS) {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) {
                if (!isCallDetected) {
                    isCallDetected = true;
                    console.log('[传讯铃声] 检测到来电弹窗');
                    playRingtone();
                }
                return;
            }
        }
        if (isCallDetected) {
            isCallDetected = false;
            stopRingtone();
        }
    }

    const observer = new MutationObserver(() => checkForIncomingCall());
    function startObserver() {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        } else {
            setTimeout(startObserver, 500);
        }
    }

    // ==================== 注入 CSS 样式 ====================
    function injectStyles() {
        const cssText = `
            #ringtone-settings-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 92%; max-width: 420px; background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.25); z-index: 999999; font-family: -apple-system, sans-serif; overflow: hidden; }
            #ringtone-settings-panel .rsp-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; font-size: 17px; font-weight: 600; }
            #ringtone-settings-panel .rsp-close { background: none; border: none; font-size: 26px; cursor: pointer; color: #999; padding: 0 4px; line-height: 1; }
            #ringtone-settings-panel .rsp-body { padding: 16px 20px; max-height: 70vh; overflow-y: auto; }
            #ringtone-settings-panel .rsp-row { margin-bottom: 18px; }
            #ringtone-settings-panel .rsp-label { display: block; font-size: 14px; color: #333; margin-bottom: 8px; font-weight: 500; }
            #ringtone-settings-panel .rsp-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; box-sizing: border-box; background: #fafafa; }
            #ringtone-settings-panel .rsp-input:focus { outline: none; border-color: #007aff; background: #fff; }
            #ringtone-settings-panel .rsp-file-btn { width: 100%; padding: 12px; background: #f0f0f5; border: 1px dashed #ccc; border-radius: 8px; text-align: center; cursor: pointer; font-size: 14px; color: #007aff; box-sizing: border-box; }
            #ringtone-settings-panel .rsp-file-name { font-size: 13px; color: #666; margin-top: 6px; word-break: break-all; }
            #ringtone-settings-panel .rsp-time-row { display: flex; gap: 12px; align-items: center; }
            #ringtone-settings-panel .rsp-time-row .rsp-input { flex: 1; }
            #ringtone-settings-panel .rsp-toggle-row { display: flex; justify-content: space-between; align-items: center; }
            #ringtone-settings-panel .rsp-toggle { position: relative; width: 50px; height: 28px; background: #ddd; border-radius: 14px; cursor: pointer; transition: background 0.2s; }
            #ringtone-settings-panel .rsp-toggle.active { background: #34c759; }
            #ringtone-settings-panel .rsp-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; background: #fff; border-radius: 50%; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
            #ringtone-settings-panel .rsp-toggle.active::after { transform: translateX(22px); }
            #ringtone-settings-panel .rsp-footer { padding: 12px 20px; border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: flex-end; }
            #ringtone-settings-panel .rsp-btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; font-weight: 500; }
            #ringtone-settings-panel .rsp-btn-primary { background: #007aff; color: #fff; }
            #ringtone-settings-panel .rsp-btn-secondary { background: #f0f0f5; color: #333; }
            #ringtone-settings-panel .rsp-hint { font-size: 12px; color: #999; margin-top: 6px; line-height: 1.5; }
            #ringtone-settings-panel .rsp-test-btn { padding: 8px 16px; font-size: 13px; background: #007aff; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
            #ringtone-settings-panel .rsp-url-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; box-sizing: border-box; background: #fafafa; margin-top: 6px; }
            #ringtone-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 999998; }
            
            /* 悬浮按钮样式 */
            #ringtone-float-btn { position: fixed; right: 16px; bottom: 80px; width: 52px; height: 52px; border-radius: 50%; background: #007aff; color: #fff; font-size: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0,122,255,0.4); cursor: pointer; z-index: 999990; transition: transform 0.2s, box-shadow 0.2s; user-select: none; -webkit-tap-highlight-color: transparent; }
            #ringtone-float-btn:active { transform: scale(0.9); box-shadow: 0 2px 8px rgba(0,122,255,0.3); }
            #ringtone-float-btn .rfb-badge { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; background: #ff3b30; border-radius: 50%; border: 2px solid #fff; display: none; }
            #ringtone-float-btn.silent .rfb-badge { display: block; }
        `;
        const style = document.createElement('style');
        style.textContent = cssText;
        document.head.appendChild(style);
    }

    // ==================== 设置面板 UI ====================
    function createSettingsPanel() {
        const existing = document.getElementById('ringtone-settings-panel');
        if (existing) existing.remove();

        const settings = getSettings();

        const overlay = document.createElement('div');
        overlay.id = 'ringtone-overlay';
        overlay.addEventListener('click', () => { overlay.remove(); panel.remove(); });

        const panel = document.createElement('div');
        panel.id = 'ringtone-settings-panel';
        panel.innerHTML = `
            <div class="rsp-header">
                <span>通话铃声设置</span>
                <button class="rsp-close">&times;</button>
            </div>
            <div class="rsp-body">
                <div class="rsp-row">
                    <div class="rsp-toggle-row">
                        <span class="rsp-label" style="margin:0">启用铃声提示</span>
                        <div class="rsp-toggle ${settings.enabled ? 'active' : ''}" id="rsp-enabled-toggle"></div>
                    </div>
                </div>

                <div class="rsp-row">
                    <label class="rsp-label">方式一：填写音频直链 (推荐)</label>
                    <input type="url" class="rsp-url-input" id="rsp-url-input" placeholder="https://example.com/ringtone.mp3" value="${settings.ringtoneUrl.startsWith('data:') ? '' : settings.ringtoneUrl}">
                    <div class="rsp-hint">支持 MP3、WAV 等直链。如果链接失效，铃声将无法播放。</div>
                </div>

                <div class="rsp-row">
                    <label class="rsp-label">方式二：本地上传音频 (受 iOS 限制)</label>
                    <div class="rsp-file-btn" id="rsp-upload-btn">📁 选择本地音频文件</div>
                    <input type="file" id="rsp-file-input" style="display:none">
                    <div class="rsp-file-name" id="rsp-file-name">当前：${settings.ringtoneName || '未设置'}</div>
                    <div class="rsp-hint">如果点击无反应或文件呈灰色，请改用上方 URL 方式。</div>
                </div>

                <div class="rsp-row">
                    <label class="rsp-label">静默时段（24小时制）</label>
                    <div class="rsp-time-row">
                        <input type="time" class="rsp-input" id="rsp-silent-start" value="${settings.silentStart}">
                        <span style="color:#999">至</span>
                        <input type="time" class="rsp-input" id="rsp-silent-end" value="${settings.silentEnd}">
                    </div>
                    <div class="rsp-hint">此时间段内不播放铃声。跨天（如 22:00 至 07:00）会自动识别。</div>
                </div>

                <div class="rsp-row" style="text-align:center; margin-top:24px;">
                    <button class="rsp-test-btn" id="rsp-test-btn">▶ 试听当前铃声</button>
                </div>
            </div>
            <div class="rsp-footer">
                <button class="rsp-btn rsp-btn-secondary" id="rsp-cancel">取消</button>
                <button class="rsp-btn rsp-btn-primary" id="rsp-save">保存设置</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // 事件绑定
        panel.querySelector('.rsp-close').addEventListener('click', () => { overlay.remove(); panel.remove(); });
        document.getElementById('rsp-cancel').addEventListener('click', () => { overlay.remove(); panel.remove(); });

        let enabledState = settings.enabled;
        const enabledToggle = document.getElementById('rsp-enabled-toggle');
        enabledToggle.addEventListener('click', () => {
            enabledState = !enabledState;
            enabledToggle.classList.toggle('active', enabledState);
        });

        const uploadBtn = document.getElementById('rsp-upload-btn');
        const fileInput = document.getElementById('rsp-file-input');
        const fileNameEl = document.getElementById('rsp-file-name');
        const urlInput = document.getElementById('rsp-url-input');

        uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 3 * 1024 * 1024) {
                alert('为了稳定性，本地音频建议不要超过 3MB。推荐使用 URL 方式。');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                panel._pendingRingtone = ev.target.result;
                panel._pendingRingtoneName = file.name;
                fileNameEl.textContent = '当前：' + file.name;
                urlInput.value = '';
                panel._pendingAudio = new Audio(ev.target.result);
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('rsp-test-btn').addEventListener('click', () => {
            let audioToTest = null;
            const urlValue = urlInput.value.trim();
            if (urlValue) {
                audioToTest = new Audio(urlValue);
            } else if (panel._pendingAudio) {
                audioToTest = panel._pendingAudio;
            } else if (settings.ringtoneUrl) {
                audioToTest = new Audio(settings.ringtoneUrl);
            }
            if (!audioToTest) {
                alert('请先填写音频 URL 或选择本地文件');
                return;
            }
            audioToTest.currentTime = 0;
            audioToTest.volume = 1;
            audioToTest.play().catch(() => alert('播放失败，请检查 URL 是否有效，或先点击页面任意位置解锁音频。'));
        });

        document.getElementById('rsp-save').addEventListener('click', () => {
            const urlValue = urlInput.value.trim();
            let finalUrl = settings.ringtoneUrl;
            let finalName = settings.ringtoneName;

            if (urlValue) {
                finalUrl = urlValue;
                finalName = '网络音频';
            } else if (panel._pendingRingtone) {
                finalUrl = panel._pendingRingtone;
                finalName = panel._pendingRingtoneName;
            }

            const newSettings = {
                ringtoneUrl: finalUrl,
                ringtoneName: finalName,
                silentStart: document.getElementById('rsp-silent-start').value || '22:00',
                silentEnd: document.getElementById('rsp-silent-end').value || '07:00',
                enabled: enabledState
            };

            saveSettings(newSettings);
            createAudio();

            overlay.remove();
            panel.remove();

            const toast = document.createElement('div');
            toast.style.cssText = `position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 24px; border-radius: 20px; font-size: 14px; z-index: 999999;`;
            toast.textContent = '✅ 设置已保存';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        });
    }

    // ==================== 创建网页悬浮按钮 ====================
    function createFloatingButton() {
        if (document.getElementById('ringtone-float-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'ringtone-float-btn';
        btn.innerHTML = '🔔<div class="rfb-badge"></div>';
        btn.title = '铃声设置';
        document.body.appendChild(btn);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            createSettingsPanel();
        });

        function updateButtonState() {
            if (isSilentTime()) {
                btn.classList.add('silent');
                btn.innerHTML = '🔕<div class="rfb-badge"></div>';
            } else {
                btn.classList.remove('silent');
                btn.innerHTML = '🔔<div class="rfb-badge"></div>';
            }
        }

        updateButtonState();
        setInterval(updateButtonState, 60000);

        // 拖动逻辑
        let isDragging = false, startX, startY, startLeft, startTop;
        btn.addEventListener('touchstart', (e) => {
            isDragging = false;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            const rect = btn.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
        }, { passive: true });

        btn.addEventListener('touchmove', (e) => {
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
            if (isDragging) {
                btn.style.right = 'auto';
                btn.style.bottom = 'auto';
                btn.style.left = (startLeft + dx) + 'px';
                btn.style.top = (startTop + dy) + 'px';
            }
        }, { passive: true });

        btn.addEventListener('touchend', () => {
            if (isDragging) {
                const rect = btn.getBoundingClientRect();
                if (rect.left < window.innerWidth / 2) {
                    btn.style.left = '16px';
                    btn.style.right = 'auto';
                } else {
                    btn.style.left = 'auto';
                    btn.style.right = '16px';
                }
            }
        });
    }

    // ==================== 初始化 ====================
    function init() {
        console.log('[传讯铃声] 原生模块已加载');
        injectStyles();
        createAudio();
        createFloatingButton();
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
