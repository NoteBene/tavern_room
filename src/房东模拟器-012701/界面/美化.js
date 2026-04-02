/**
 * 正文美化脚本 - 酒馆助手版
 *
 * 功能：
 * 1. 支持自定义思维链结束标签（如 </think>, </thinking>）
 * 2. 只美化思维链之后的正文内容
 * 3. 支持多种自定义标签渲染
 *
 * 使用方法：
 * 1. 在酒馆助手 -> 脚本库 中导入此脚本
 * 2. 点击脚本按钮"美化设置"打开配置面板
 * 3. 填入你的预设使用的思维链结束标签（如 </think>）
 */

// ============ 配置存储（使用IndexedDB） ============
const DEFAULT_CONFIG = {
    enabled: true,
    thinkingEndTag: '</think>',
    renderDepth: 10,  // 渲染深度：只渲染最近N条消息，0=全部渲染
};

const DB_NAME = 'BeautifyConfigDB';
const DB_VERSION = 1;
const STORE_NAME = 'config';

// 全局标志：是否正在重新渲染（防止事件监听器干扰）
let isRerendering = false;

// 打开IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function getConfig() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('beautifyConfig');
            request.onsuccess = () => {
                const result = request.result;
                console.log('[正文美化] 读取配置:', result);
                if (result && result.data) {
                    resolve({ ...DEFAULT_CONFIG, ...result.data });
                } else {
                    resolve(DEFAULT_CONFIG);
                }
            };
            request.onerror = () => {
                console.log('[正文美化] 读取失败:', request.error);
                resolve(DEFAULT_CONFIG);
            };
        });
    } catch (e) {
        console.log('[正文美化] 打开数据库失败:', e);
        return DEFAULT_CONFIG;
    }
}

async function saveConfigToStorage(config) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put({ id: 'beautifyConfig', data: config });
            request.onsuccess = () => {
                console.log('[正文美化] 保存配置成功:', config);
                resolve(true);
            };
            request.onerror = () => {
                console.log('[正文美化] 保存失败:', request.error);
                resolve(false);
            };
        });
    } catch (e) {
        console.log('[正文美化] 保存配置失败:', e);
        return false;
    }
}

// ============ 配置面板 ============
async function showConfigPanel() {
    const config = await getConfig();

    // 用于存储用户输入的值（在popup关闭前获取）
    let capturedConfig = null;

    const popupHtml = `<div style="padding: 10px;" id="beautify-config-panel">
        <h3 style="margin-top:0; color:#be185d;">🎨 正文美化设置</h3>

        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="beautify-enabled" ${config.enabled ? 'checked' : ''}>
                <span>启用正文美化</span>
            </label>
        </div>

        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px;">
                思维链结束标签 <small style="color: #999;">(留空则美化全文)</small>
            </label>
            <input type="text" id="beautify-thinking-tag"
                value="${config.thinkingEndTag || ''}"
                placeholder="例如: </think> 或 </thinking>"
                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace;">
            <div style="font-size: 11px; color: #666; margin-top: 4px;">
                💡 常见标签: &lt;/think&gt;, &lt;/thinking&gt;, &lt;/reasoning&gt;
            </div>
        </div>

        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px;">
                渲染深度 <small style="color: #999;">(只渲染最近N条消息，0=全部)</small>
            </label>
            <input type="number" id="beautify-render-depth"
                value="${config.renderDepth || 10}"
                min="0" max="100"
                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <div style="font-size: 11px; color: #666; margin-top: 4px;">
                ⚠️ 设置过大可能影响性能，建议10-20
            </div>
        </div>
    </div>`;

    // 持续监听输入值变化，确保关闭前能获取到最新值
    const intervalId = setInterval(() => {
        const $panel = $('#beautify-config-panel');
        if ($panel.length) {
            capturedConfig = {
                enabled: $panel.find('#beautify-enabled').is(':checked'),
                thinkingEndTag: ($panel.find('#beautify-thinking-tag').val() || '').trim(),
                renderDepth: parseInt($panel.find('#beautify-render-depth').val()) || 10,
            };
        }
    }, 50);

    const result = await SillyTavern.getContext().callGenericPopup(
        popupHtml,
        SillyTavern.getContext().POPUP_TYPE.CONFIRM
    );

    // 停止监听
    clearInterval(intervalId);

    console.log('[正文美化] popup结果:', result, '捕获配置:', capturedConfig);

    if (result === SillyTavern.getContext().POPUP_RESULT.AFFIRMATIVE && capturedConfig) {
        console.log('[正文美化] 准备保存配置:', capturedConfig);
        const saved = await saveConfigToStorage(capturedConfig);
        if (!saved) {
            alert('❌ 保存失败，请查看控制台');
            return;
        }
        alert('✅ 设置已保存！正在重新渲染消息...');

        // 保存后立即重新渲染所有消息（应用渲染深度）
        setTimeout(async () => {
            try {
                isRerendering = true; // 设置标志，阻止事件监听器干扰
                console.log('[正文美化] 开始重新渲染，已锁定事件监听');

                const newConfig = await getConfig();
                const lastId = getLastMessageId();
                if (lastId >= 0) {
                    const allMessages = getChatMessages(`0-${lastId}`, { role: 'assistant' });
                    console.log('[正文美化] 配置保存后，总消息:', allMessages.length, '渲染深度:', newConfig.renderDepth);

                    // 计算需要美化的消息ID集合
                    let messagesToRender = allMessages;
                    if (newConfig.renderDepth > 0 && allMessages.length > newConfig.renderDepth) {
                        messagesToRender = allMessages.slice(-newConfig.renderDepth);
                    }
                    const renderIds = new Set(messagesToRender.map(m => m.message_id));
                    console.log('[正文美化] 将美化的消息ID:', [...renderIds]);

                    // 遍历所有消息：超出范围的还原，范围内的重新美化
                    for (const msg of allMessages) {
                        const $mes = retrieveDisplayedMessage(msg.message_id);
                        if (!$mes) continue;

                        if (renderIds.has(msg.message_id)) {
                            // 在范围内：清除标记，刷新，重新美化
                            $mes.data('beautified', false);
                            await refreshOneMessage(msg.message_id);
                            await new Promise(r => setTimeout(r, 50));
                            await beautifyMessage(msg.message_id, true);
                        } else {
                            // 超出范围：只还原，不美化
                            console.log('[正文美化] 还原超出范围的消息:', msg.message_id);
                            $mes.data('beautified', false);
                            await refreshOneMessage(msg.message_id);
                            await new Promise(r => setTimeout(r, 50));
                        }
                    }
                    console.log('[正文美化] 重新渲染完成!');
                }
            } catch (e) {
                console.error('[正文美化] 重新渲染出错:', e);
            } finally {
                isRerendering = false; // 解除锁定
                console.log('[正文美化] 已解锁事件监听');
            }
        }, 100);
    }
}


// ============ CSS 样式 ============
const BEAUTIFY_CSS = `
.beautify-mac-window {
    position: relative;
    background: rgba(30, 30, 35, 0.98);
    border: 2px solid #3d3d45;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    margin: 10px 0;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
}
.beautify-mac-header {
    background: #2a2a30;
    padding: 5px 12px;
    display: flex;
    align-items: center;
    border-bottom: 2px solid #3d3d45;
    height: 28px;
}
.beautify-mac-controls { display: flex; gap: 5px; }
.beautify-mac-body {
    padding: 12px 18px;
    background: #1e1e22;
    color: #c0c0c8;
    line-height: 1.7;
    font-size: 1em;
    white-space: normal;
    word-wrap: break-word;
}
/* Markdown标题样式 */
.beautify-mac-body h1 { font-size: 1.6em; font-weight: 700; color: #ffffff; margin: 16px 0 10px; border-bottom: 2px solid #4c4c55; padding-bottom: 6px; }
.beautify-mac-body h2 { font-size: 1.4em; font-weight: 700; color: #ffffff; margin: 14px 0 8px; border-bottom: 1px solid #4c4c55; padding-bottom: 4px; }
.beautify-mac-body h3 { font-size: 1.2em; font-weight: 600; color: #ffffff; margin: 12px 0 6px; }
.beautify-mac-body h4 { font-size: 1.1em; font-weight: 600; color: #ffffff; margin: 10px 0 5px; }
/* 列表样式 */
.beautify-mac-body ul { margin: 8px 0; padding-left: 20px; }
.beautify-mac-body ol { margin: 8px 0; padding-left: 20px; }
.beautify-mac-body li { margin: 4px 0; color: #c0c0c8; }
.beautify-mac-body li::marker { color: #ffffff; }
/* 引用块样式 */
.beautify-mac-body blockquote { margin: 10px 0; padding: 10px 15px; background: #2a2a30; border-left: 4px solid #ffffff; border-radius: 0 8px 8px 0; color: #a0a0a8; font-style: italic; }
/* 对话引号高亮 */
.beautify-dialogue { color: #ffa805ff; font-weight: 500; }
.beautify-dialogue::before, .beautify-dialogue::after { color: #c0c0c8; }
/* 单引号内心独白 */
.beautify-thought { color: #a0a0a8; font-style: italic; opacity: 0.9; }
/* 代码样式 */
.beautify-mac-body code { background: #2a2a30; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 0.9em; }
.beautify-mac-body pre { background: #1a1a1e; color: #d4d4d8; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 10px 0; }
.beautify-mac-body pre code { background: transparent; color: inherit; padding: 0; }
/* 分隔线 */
.beautify-mac-body hr { border: none; height: 2px; background: linear-gradient(to right, transparent, #4c4c55, #ffffff, #4c4c55, transparent); margin: 15px 0; }
/* 强调和粗体 */
.beautify-mac-body strong { color: #ffffff; font-weight: 700; }
.beautify-mac-body em { color: #c0c0c8; font-style: italic; }

.beautify-sub-window {
    width: 100%; max-width: 500px; margin: 8px auto;
    background: #1e1e22;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    border: 4px solid #2a2a30;
    overflow: hidden;
    font-size: 14px;
    line-height: normal;
    white-space: normal;
}
.beautify-sub-title-bar {
    height: 32px;
    background: #2a2a30;
    border-bottom: 2px solid #3d3d45;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
}
.beautify-sub-controls { display: flex; gap: 6px; }
.beautify-sub-title {
    flex: 1; text-align: center;
    font-size: 13px; font-weight: 600;
    color: #ffffff; opacity: 0.9;
    margin-right: 40px;
}
.beautify-sub-content { padding: 15px; display: flex; flex-direction: column; gap: 15px; }

/* 按钮样式 */
.beautify-btn {
    flex: 1; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 13px;
    border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}
.beautify-btn:hover:not(.disabled) { transform: translateY(-2px); filter: brightness(1.05); }
.beautify-btn-primary { background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: white; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3); }
.beautify-btn-success { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: #064e3b; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); }
.beautify-btn.disabled { background: #3d3d45; color: #6b6b75; cursor: not-allowed; box-shadow: none; pointer-events: none; }
.beautify-action-buttons { display: flex; gap: 10px; margin-top: 5px; }
.beautify-hint-text { font-size: 12px; color: #6b6b75; margin-top: 8px; }
`;

// ============ 标签渲染器 ============
const tagRenderers = {

    live_stream: (data) => {
        const lines = data.trim().split('\n');
        let screen = '', comments = '';
        if (lines[0].includes('[直播画面]')) {
            screen = lines[0].trim();
            comments = lines.slice(1).join('\n').trim();
        } else {
            comments = data.trim();
        }
        return `<div style="width:100%!important;max-width:420px!important;margin:8px auto!important;background-color:#181818!important;border-radius:12px!important;box-shadow:0 10px 25px rgba(0,0,0,0.3)!important;border-width:4px!important;border-style:solid!important;border-color:#333333!important;overflow:hidden!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif!important;font-size:14px!important;line-height:normal!important;white-space:normal!important;">
            <div style="height:32px!important;background-color:#2a2a2a!important;border-bottom-width:2px!important;border-bottom-style:solid!important;border-bottom-color:#333333!important;display:flex!important;align-items:center!important;padding:0 12px!important;gap:8px!important;">
                <div style="display:flex!important;gap:6px!important;">
                    <div style="width:10px!important;height:10px!important;border-radius:50%!important;background-color:#ff5f57!important;display:inline-block!important;"></div>
                    <div style="width:10px!important;height:10px!important;border-radius:50%!important;background-color:#febc2e!important;display:inline-block!important;"></div>
                    <div style="width:10px!important;height:10px!important;border-radius:50%!important;background-color:#28c840!important;display:inline-block!important;"></div>
                </div>
                <div style="flex:1!important;text-align:center!important;font-size:13px!important;font-weight:600!important;color:#ffffff!important;opacity:0.8!important;margin-right:40px!important;">🔴 直播中</div>
            </div>
            ${screen ? `<div style="background-color:#000000!important;padding:15px!important;color:#e0e0e0!important;font-size:14px!important;white-space:pre-wrap!important;line-height:1.6!important;">${screen}</div>` : ''}
            <div style="background-color:#2a2a2a!important;padding:6px!important;text-align:center!important;font-size:12px!important;color:#888888!important;">- 实时评论 -</div>
            <div style="background-color:#181818!important;padding:12px!important;color:#ffffff!important;font-size:13px!important;line-height:1.8!important;max-height:150px!important;overflow-y:auto!important;white-space:pre-wrap!important;">${comments}</div>
        </div>`;
    },


    store: (data) => {
        // 使用提取函数解析YAML格式的数据
        const extract = (k) => { const m = data.match(new RegExp(k + ':\s*([^\n]+)')); return m ? m[1].trim() : ''; };

        // 解析服务员信息
        const waitressName = extract('姓名') || '白翩翩';
        const waitressStatus = extract('状态') || '正常接待ing';
        const waitressAvatarPath = extract('立绘');
        const waitressAvatar = waitressAvatarPath ? 'https://i.postimg.cc/' + waitressAvatarPath + '.jpg' : 'https://i.postimg.cc/zGXKKXM3/baipianpian-2.jpg';

        // 解析售卖道具 - 按道具名分割
        const itemsArray = [];
        const itemsSection = data.split('售卖道具:')[1];
        if (itemsSection) {
            const lines = itemsSection.split('\n');
            const itemNames = [];

            lines.forEach(line => {
                // 匹配一级缩进的道具名（2个空格开头，后跟名称和冒号）
                const match = line.match(/^ {2}([^\s:]+):/);
                if (match && !line.includes('配图') && !line.includes('价格')) {
                    itemNames.push(match[1].trim());
                }
            });

            // 为每个道具提取信息
            itemNames.forEach(itemName => {
                // 构建该道具的正则匹配模式
                const itemPattern = new RegExp('  ' + itemName + ':[\\s\\S]*?(?=\\n  [^\\s:]|\\n$|$)', 'i');
                const itemMatch = itemsSection.match(itemPattern);

                if (itemMatch) {
                    const itemBlock = itemMatch[0];
                    const imgPath = itemBlock.match(/配图:\s*([^\n]+)/);
                    const price = itemBlock.match(/价格:\s*([^\n]+)/);

                    if (imgPath && price) {
                        itemsArray.push({
                            name: itemName,
                            img: 'https://i.postimg.cc/' + imgPath[1].trim() + '.jpg',
                            price: price[1].trim()
                        });
                    }
                }
            });
        }

        // 生成道具HTML（支持翻页）
        const itemsPerPage = 3;
        const totalPages = Math.ceil(itemsArray.length / itemsPerPage);
        let itemsHTML = '';

        if (itemsArray.length === 0) {
            itemsHTML = '<p style="text-align:center!important;color:#6b6b75!important;padding:20px!important;font-size:13px!important;">暂无商品</p>';
        } else if (itemsArray.length <= itemsPerPage) {
            // 3个及以下直接显示
            itemsArray.forEach(item => {
                itemsHTML += `<div class="beautify-store-item" data-item-name="${item.name}" style="background:#252529!important;border-radius:8px!important;padding:10px!important;border:1px solid #3d3d45!important;box-shadow:0 2px 8px rgba(0,0,0,0.3)!important;display:flex!important;align-items:center!important;gap:10px!important;margin-bottom:8px!important;transition:all 0.2s!important;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 5px 15px rgba(167,139,250,0.15)';this.style.borderColor='#a78bfa';" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.3)';this.style.borderColor='#3d3d45';">
                    <img src="${item.img}" alt="${item.name}" style="width:50px!important;height:50px!important;border-radius:6px!important;object-fit:cover!important;border:1px solid #4c4c55!important;flex-shrink:0!important;">
                    <div style="flex:1!important;min-width:0!important;">
                        <div style="font-size:13px!important;font-weight:600!important;color:#ffffff!important;margin-bottom:3px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">${item.name}</div>
                        <div style="font-size:12px!important;color:#c0c0c8!important;font-weight:500!important;">${item.price}</div>
                    </div>
                    <button class="beautify-buy-btn" style="padding:5px 10px!important;border-radius:5px!important;font-weight:600!important;font-size:11px!important;border:none!important;cursor:pointer!important;background:linear-gradient(135deg,#8b5cf6 0%,#a78bfa 100%)!important;color:white!important;box-shadow:0 2px 5px rgba(139,92,246,0.3)!important;transition:all 0.2s!important;flex-shrink:0!important;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''">购买</button>
                </div>`;
            });
        } else {
            // 超过3个，使用翻页
            for (let page = 0; page < totalPages; page++) {
                const pageItems = itemsArray.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
                let pageHTML = `<div class="beautify-store-page" data-page="${page}" style="display:${page === 0 ? 'block' : 'none'}!important;">`;

                pageItems.forEach(item => {
                    pageHTML += `<div class="beautify-store-item" data-item-name="${item.name}" style="background:#252529!important;border-radius:8px!important;padding:10px!important;border:1px solid #3d3d45!important;box-shadow:0 2px 8px rgba(0,0,0,0.3)!important;display:flex!important;align-items:center!important;gap:10px!important;margin-bottom:8px!important;transition:all 0.2s!important;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 5px 15px rgba(167,139,250,0.15)';this.style.borderColor='#a78bfa';" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.3)';this.style.borderColor='#3d3d45';">
                        <img src="${item.img}" alt="${item.name}" style="width:50px!important;height:50px!important;border-radius:6px!important;object-fit:cover!important;border:1px solid #4c4c55!important;flex-shrink:0!important;">
                        <div style="flex:1!important;min-width:0!important;">
                            <div style="font-size:13px!important;font-weight:600!important;color:#ffffff!important;margin-bottom:3px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">${item.name}</div>
                            <div style="font-size:12px!important;color:#c0c0c8!important;font-weight:500!important;">${item.price}</div>
                        </div>
                        <button class="beautify-buy-btn" style="padding:5px 10px!important;border-radius:5px!important;font-weight:600!important;font-size:11px!important;border:none!important;cursor:pointer!important;background:linear-gradient(135deg,#8b5cf6 0%,#a78bfa 100%)!important;color:white!important;box-shadow:0 2px 5px rgba(139,92,246,0.3)!important;transition:all 0.2s!important;flex-shrink:0!important;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''">购买</button>
                    </div>`;
                });

                pageHTML += '</div>';
                itemsHTML += pageHTML;
            }

            // 添加翻页控制
            itemsHTML += `<div class="beautify-store-pagination" style="display:flex!important;justify-content:center!important;align-items:center!important;gap:10px!important;margin-top:10px!important;padding-top:10px!important;border-top:1px dashed #4c4c55!important;">
                <button class="beautify-store-prev" style="padding:5px 12px!important;border-radius:5px!important;font-size:12px!important;border:none!important;cursor:pointer!important;background:#2a2a30!important;color:#ffffff!important;disabled:opacity:0.5!important;" disabled>上一页</button>
                <span class="beautify-store-page-info" style="font-size:12px!important;color:#ffffff!important;">1 / ${totalPages}</span>
                <button class="beautify-store-next" style="padding:5px 12px!important;border-radius:5px!important;font-size:12px!important;border:none!important;cursor:pointer!important;background:#2a2a30!important;color:#ffffff!important;">下一页</button>
            </div>`;
        }

        return `<div class="beautify-store-container" style="width:100%!important;max-width:600px!important;margin:8px auto!important;background-color:#1e1e22!important;border-radius:12px!important;box-shadow:0 10px 25px rgba(0,0,0,0.4)!important;border-width:4px!important;border-style:solid!important;border-color:#2a2a30!important;overflow:hidden!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif!important;font-size:14px!important;line-height:normal!important;white-space:normal!important;">
            <div style="height:32px!important;background-color:#2a2a30!important;border-bottom-width:2px!important;border-bottom-style:solid!important;border-bottom-color:#3d3d45!important;display:flex!important;align-items:center!important;padding:12px!important;gap:8px!important;">
                <div style="flex:1!important;text-align:center!important;font-size:13px!important;font-weight:600!important;color:#ffffff!important;opacity:0.9!important;">✨ 百货商店</div>
            </div>
            <div style="padding:12px!important;display:flex!important;flex-direction:column!important;gap:12px!important;">
                <!-- 服务员信息 -->
                <div style="display:flex!important;align-items:center!important;gap:12px!important;padding:10px!important;background:#252529!important;border-radius:10px!important;border:1px solid #3d3d45!important;">
                    <img src="${waitressAvatar}" alt="服务员立绘" style="width:120px!important;height:200px!important;border-radius:8px!important;object-fit:cover!important;box-shadow:0 2px 8px rgba(0,0,0,0.3)!important;border:1px solid #3d3d45!important;flex-shrink:0!important;">
                    <div style="flex:1!important;min-width:0!important;">
                        <div style="font-size:15px!important;font-weight:700!important;color:#ffffff!important;margin-bottom:4px!important;">${waitressName}</div>
                        <div style="font-size:12px!important;color:#c0c0c8!important;background:#2a2a30!important;padding:3px 8px!important;border-radius:10px!important;border:1px solid #4c4c55!important;display:inline-block!important;max-width:100%!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">${waitressStatus}</div>
                    </div>
                </div>
                <!-- 售卖道具 -->
                <div>
                    <div style="font-size:14px!important;font-weight:600!important;color:#ffffff!important;margin-bottom:8px!important;border-bottom:1px dashed #4c4c55!important;padding-bottom:5px!important;">售卖道具</div>
                    <div class="beautify-store-items-wrapper">
                        ${itemsHTML}
                    </div>
                </div>
            </div>
        </div>`;
    }
};

function defaultRenderer(tagName, data) {
    const title = tagName.charAt(0).toUpperCase() + tagName.slice(1);
    return `<div style="width:100%!important;max-width:500px!important;margin:8px auto!important;background-color:#1e1e22!important;border-radius:12px!important;box-shadow:0 10px 25px rgba(0,0,0,0.4)!important;border-width:4px!important;border-style:solid!important;border-color:#2a2a30!important;overflow:hidden!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif!important;font-size:14px!important;line-height:normal!important;white-space:normal!important;">
        <div style="height:32px!important;background-color:#2a2a30!important;border-bottom-width:2px!important;border-bottom-style:solid!important;border-bottom-color:#3d3d45!important;display:flex!important;align-items:center!important;padding:0 12px!important;gap:8px!important;">
            <div style="display:flex!important;gap:6px!important;">
                <div style="width:10px!important;height:10px!important;border-radius:50%!important;background-color:#ff5f57!important;display:inline-block!important;"></div>
                <div style="width:10px!important;height:10px!important;border-radius:50%!important;background-color:#febc2e!important;display:inline-block!important;"></div>
                <div style="width:10px!important;height:10px!important;border-radius:50%!important;background-color:#28c840!important;display:inline-block!important;"></div>
            </div>
            <div style="flex:1!important;text-align:center!important;font-size:13px!important;font-weight:600!important;color:#ffffff!important;opacity:0.9!important;margin-right:40px!important;">📋 ${title}</div>
        </div>
        <div style="padding:15px!important;color:#c0c0c8!important;white-space:pre-wrap!important;">${data}</div>
    </div>`;
}

// ============ 事件绑定函数 ============
function bindTagEvents($container) {


    // ========== store 百货商店购买按钮事件 ==========
    $container.find('.beautify-buy-btn').on('click', function(e) {
        e.stopPropagation(); // 防止冒泡
        const $btn = $(this);
        const $item = $btn.closest('.beautify-store-item');
        const itemName = $item.data('item-name');

        if (!itemName) return;

        // 购买确认对话框
        const confirmBuy = confirm(`确定要购买「${itemName}」吗？`);
        if (!confirmBuy) return;

        const message = `我要购买1件${itemName}`;

        if (typeof triggerSlash === 'function') {
            triggerSlash(`/send ${message}|/trigger`);
        } else {
            console.log('[正文美化] 模拟发送:', message);
            alert(`购买请求: ${message}`);
        }

        $btn.text('✅ 已购买').addClass('disabled').css({
            'background': '#3d3d45',
            'color': '#6b6b75',
            'cursor': 'not-allowed',
            'pointer-events': 'none'
        });
    });

    // ========== store 百货商店翻页事件 ==========
    const $storeContainer = $container.find('.beautify-store-container');
    if ($storeContainer.length) {
        let currentPage = 0;
        const $pages = $storeContainer.find('.beautify-store-page');
        const totalPages = $pages.length;

        if (totalPages > 1) {
            const $prevBtn = $storeContainer.find('.beautify-store-prev');
            const $nextBtn = $storeContainer.find('.beautify-store-next');
            const $pageInfo = $storeContainer.find('.beautify-store-page-info');

            const updatePagination = () => {
                $pages.each(function(index) {
                    $(this).css('display', index === currentPage ? 'block' : 'none');
                });
                $pageInfo.text(`${currentPage + 1} / ${totalPages}`);
                $prevBtn.prop('disabled', currentPage === 0).css('opacity', currentPage === 0 ? '0.5' : '1');
                $nextBtn.prop('disabled', currentPage === totalPages - 1).css('opacity', currentPage === totalPages - 1 ? '0.5' : '1');
            };

            $prevBtn.on('click', function() {
                if (currentPage > 0) {
                    currentPage--;
                    updatePagination();
                }
            });

            $nextBtn.on('click', function() {
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    updatePagination();
                }
            });
        }
    }

    console.log('[正文美化] 事件绑定完成');
}

// ============ 核心美化函数 ============

// 使用正则表达式匹配自定义标签（避免DOM解析问题）
function processCustomTags(html) {
    // 标准HTML标签 + MVU/酒馆系统标签（需要排除）
    const standardTags = [
        // 标准HTML标签
        'div','span','p','a','b','i','u','s','br','hr','h1','h2','h3','h4','h5','h6',
        'ul','ol','li','table','tr','td','th','thead','tbody','tfoot','img','input','button','form',
        'label','select','option','textarea','style','script','link','meta','head','body','html',
        'header','footer','nav','main','section','article','aside','strong','em','code','pre','blockquote',
        'details','summary','figure','figcaption','mark','time','small','sub','sup','del','ins','abbr',
        'audio','video','source','canvas','svg','path','rect','circle','line','polygon','g','defs','use',
        // MVU系统标签
        'updatevariable','analysis','jsonpatch','statusplaceholderimpl',
        'think','thinking','reasoning','thought',
        'status','variable','update','link','result','output','response',
        // 酒馆系统标签
        'at','char','user','comment','hide','hidden','inst','note'
    ];

    let result = html;

    console.log('[正文美化] processCustomTags 输入长度:', html.length);
    console.log('[正文美化] 输入前300字:', html.substring(0, 300));

    // 匹配自定义标签 - 分别处理每种标签避免反向引用问题
    const customTags = ['live_stream', 'store'];
    const replacements = [];

    for (const tagName of customTags) {
        // 创建不区分大小写的正则
        const tagRegex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
        let match;

        while ((match = tagRegex.exec(html)) !== null) {
            const fullMatch = match[0];
            const innerContent = match[1] || '';

            console.log('[正文美化] 找到标签:', tagName, '内容长度:', innerContent.length);

            // 获取渲染器
            const renderer = tagRenderers[tagName];
            if (renderer) {
                const rendered = renderer(innerContent);
                replacements.push({ original: fullMatch, replacement: rendered });
                console.log('[正文美化] 使用专用渲染器渲染:', tagName);
            } else {
                // 使用默认渲染器
                const rendered = defaultRenderer(tagName, innerContent);
                replacements.push({ original: fullMatch, replacement: rendered });
                console.log('[正文美化] 使用默认渲染器渲染:', tagName);
            }
        }
    }

    console.log('[正文美化] 找到', replacements.length, '个自定义标签需要渲染');

    // 执行替换
    for (const r of replacements) {
        result = result.replace(r.original, r.replacement);
    }

    return result;
}

async function beautifyMessage(messageId, forceRerender = false) {
    const config = await getConfig();
    if (!config.enabled) {
        console.log('[正文美化] 功能已禁用');
        return;
    }

    // 获取显示元素
    let $mes = retrieveDisplayedMessage(messageId);
    if (!$mes || $mes.length === 0) return;

    // 检查是否已美化（除非强制重新渲染）
    if ($mes.data('beautified') && !forceRerender) return;

    // 强制重新渲染时，清除标记并重新获取
    if (forceRerender) {
        console.log('[正文美化] 强制重新渲染消息:', messageId);
        console.log('[正文美化] 当前beautified状态:', $mes.data('beautified'));
        $mes.data('beautified', false);
        // 重新获取最新的显示元素
        $mes = retrieveDisplayedMessage(messageId);
        if (!$mes || $mes.length === 0) {
            console.log('[正文美化] 重新获取元素失败');
            return;
        }
        console.log('[正文美化] 重新获取元素成功，HTML长度:', $mes.html()?.length);
    }

    // 获取原始消息
    const messages = getChatMessages(messageId);
    if (!messages || messages.length === 0) {
        console.log('[正文美化] 无法获取消息');
        return;
    }
    const rawMessage = messages[0].message || '';

    console.log('[正文美化] ========== 开始处理 ==========');
    console.log('[正文美化] 消息ID:', messageId);
    console.log('[正文美化] 原始消息长度:', rawMessage.length);
    console.log('[正文美化] 原始消息前300字:', rawMessage.substring(0, 300));

    // ========== 基于原始消息处理，避免酒馆渲染干扰 ==========

    // 分离三部分：think部分 | 正文部分 | UpdateVariable部分
    let thinkContent = '';   // 思维链原始内容
    let mainContent = rawMessage;  // 正文
    let tailContent = '';    // 尾部系统标签

    // 1. 从原始消息提取思维链部分（支持多种标签）
    // 支持的思维链标签: <think>, <thinking>, <reasoning>, <thought>
    const thinkingTags = ['think', 'thinking', 'reasoning', 'thought'];
    let foundThinkTag = null;

    for (const tag of thinkingTags) {
        const regex = new RegExp(`^(<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>)`, 'i');
        const match = rawMessage.match(regex);
        if (match) {
            thinkContent = match[1];
            mainContent = rawMessage.substring(match[1].length);
            foundThinkTag = tag;
            console.log('[正文美化] ✓ 提取思维链<' + tag + '>，长度:', thinkContent.length);
            break;
        }
    }

    // 如果没找到标准标签，尝试使用用户配置的结束标签
    if (!foundThinkTag && config.thinkingEndTag) {
        const endTag = config.thinkingEndTag.trim();
        const endIdx = rawMessage.indexOf(endTag);
        if (endIdx !== -1) {
            thinkContent = rawMessage.substring(0, endIdx + endTag.length);
            mainContent = rawMessage.substring(endIdx + endTag.length);
            console.log('[正文美化] ✓ 使用配置结束标签' + endTag + '提取思维链，长度:', thinkContent.length);
            foundThinkTag = 'custom';
        }
    }

    if (!foundThinkTag) {
        console.log('[正文美化] ✗ 原始消息无思维链标签');
    }

    // 2. 从正文末尾提取UpdateVariable部分
    const uvMatch = mainContent.match(/(<UpdateVariable\b[\s\S]*$)/i);
    const statusMatch = mainContent.match(/(<StatusPlaceHolderImpl\b[\s\S]*$)/i);

    if (uvMatch) {
        tailContent = uvMatch[1];
        mainContent = mainContent.substring(0, mainContent.length - uvMatch[1].length);
        console.log('[正文美化] ✓ 提取UpdateVariable，长度:', tailContent.length);
    } else if (statusMatch) {
        tailContent = statusMatch[1];
        mainContent = mainContent.substring(0, mainContent.length - statusMatch[1].length);
        console.log('[正文美化] ✓ 提取StatusPlaceHolderImpl，长度:', tailContent.length);
    } else {
        console.log('[正文美化] ✗ 无UpdateVariable标签');
    }

    console.log('[正文美化] 正文部分长度:', mainContent.length);
    console.log('[正文美化] 正文前300字:', mainContent.substring(0, 300));

    // 3. 先提取自定义标签，用占位符保护
    let processedMain = mainContent;
    const customTags = ['live_stream','store'];
    const renderedBlocks = [];

    for (const tagName of customTags) {
        const tagRegex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
        processedMain = processedMain.replace(tagRegex, (fullMatch, innerContent) => {
            const renderer = tagRenderers[tagName.toLowerCase()];
            const rendered = renderer ? renderer(innerContent) : defaultRenderer(tagName, innerContent);
            const idx = renderedBlocks.length;
            renderedBlocks.push(rendered);
            console.log('[正文美化] 渲染标签:', tagName, '占位符索引:', idx);
            // 用特殊占位符替换（纯文本，不会被格式化影响）
            return `___BEAUTIFY_BLOCK_${idx}___`;
        });
    }

    // 4. 对剩余文本做Markdown格式化
    // 先处理代码块（防止内部被其他格式化影响）
    const codeBlocks = [];
    processedMain = processedMain.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`);
        return `___CODE_BLOCK_${idx}___`;
    });

    // 处理标题（必须在段落处理之前，支持#直接跟文字或空格后跟文字）
    processedMain = processedMain
        .replace(/^####\s*(.+)$/gm, '<h4>$1</h4>')
        .replace(/^###\s*(.+)$/gm, '<h3>$1</h3>')
        .replace(/^##\s*(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#\s*(.+)$/gm, '<h1>$1</h1>');

    // 处理引用块
    processedMain = processedMain.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // 处理分隔线
    processedMain = processedMain.replace(/^[-*_]{3,}$/gm, '<hr>');

    // 处理无序列表
    processedMain = processedMain.replace(/(?:^|\n)((?:[-*+] .+\n?)+)/g, (m, list) => {
        const items = list.trim().split(/\n/).map(line => {
            const content = line.replace(/^[-*+] /, '');
            return `<li>${content}</li>`;
        }).join('');
        return `<ul>${items}</ul>`;
    });

    // 处理有序列表
    processedMain = processedMain.replace(/(?:^|\n)((?:\d+\. .+\n?)+)/g, (m, list) => {
        const items = list.trim().split(/\n/).map(line => {
            const content = line.replace(/^\d+\. /, '');
            return `<li>${content}</li>`;
        }).join('');
        return `<ol>${items}</ol>`;
    });

    // 处理换行：双换行变段落，单换行变<br>
    processedMain = processedMain
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // 处理基本Markdown格式
    processedMain = processedMain
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // 粗体
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')              // 斜体
        .replace(/`([^`]+)`/g, '<code>$1</code>');           // 行内代码

    // 先保护已有的HTML标签，避免引号处理误匹配HTML属性
    const htmlTags = [];
    processedMain = processedMain.replace(/<[^>]+>/g, (tag) => {
        const idx = htmlTags.length;
        htmlTags.push(tag);
        return `___HTML_TAG_${idx}___`;
    });

    // 处理对话引号高亮（中英文双引号）
    processedMain = processedMain.replace(/"([^"]+)"/g, '___DIALOGUE_START___$1___DIALOGUE_END___');       // 英文双引号
    processedMain = processedMain.replace(/\u201c([^\u201d]+)\u201d/g, '___DIALOGUE_START_CN___$1___DIALOGUE_END_CN___'); // 中文双引号 ""
    processedMain = processedMain.replace(/「([^」]+)」/g, '___DIALOGUE_START_JP1___$1___DIALOGUE_END_JP1___');  // 日式引号
    processedMain = processedMain.replace(/『([^』]+)』/g, '___DIALOGUE_START_JP2___$1___DIALOGUE_END_JP2___');  // 日式双引号

    // 处理内心独白（中英文单引号）
    processedMain = processedMain.replace(/'([^']+)'/g, '___THOUGHT_START___$1___THOUGHT_END___');         // 英文单引号
    processedMain = processedMain.replace(/\u2018([^\u2019]+)\u2019/g, '___THOUGHT_START_CN___$1___THOUGHT_END_CN___');   // 中文单引号 ''

    // 还原HTML标签
    processedMain = processedMain.replace(/___HTML_TAG_(\d+)___/g, (m, idx) => htmlTags[parseInt(idx)]);

    // 还原引号为带样式的span
    processedMain = processedMain
        .replace(/___DIALOGUE_START___(.+?)___DIALOGUE_END___/g, '<span class="beautify-dialogue">"$1"</span>')
        .replace(/___DIALOGUE_START_CN___(.+?)___DIALOGUE_END_CN___/g, '<span class="beautify-dialogue">\u201c$1\u201d</span>')
        .replace(/___DIALOGUE_START_JP1___(.+?)___DIALOGUE_END_JP1___/g, '<span class="beautify-dialogue">「$1」</span>')
        .replace(/___DIALOGUE_START_JP2___(.+?)___DIALOGUE_END_JP2___/g, '<span class="beautify-dialogue">『$1』</span>')
        .replace(/___THOUGHT_START___(.+?)___THOUGHT_END___/g, "<span class=\"beautify-thought\">'$1'</span>")
        .replace(/___THOUGHT_START_CN___(.+?)___THOUGHT_END_CN___/g, '<span class="beautify-thought">\u2018$1\u2019</span>');

    // 还原代码块
    processedMain = processedMain.replace(/___CODE_BLOCK_(\d+)___/g, (m, idx) => codeBlocks[parseInt(idx)]);

    // 包裹段落
    if (!processedMain.startsWith('<') && !processedMain.startsWith('___BEAUTIFY')) {
        processedMain = '<p>' + processedMain + '</p>';
    }

    // 5. 还原渲染好的标签块
    processedMain = processedMain.replace(/___BEAUTIFY_BLOCK_(\d+)___/g, (m, idx) => {
        return renderedBlocks[parseInt(idx)];
    });

    console.log('[正文美化] 处理完成，长度:', processedMain.length);

    // 5. 包装Mac窗口（只包正文部分）
    const macWindow = `<div class="beautify-mac-window">
        <div class="beautify-mac-body">${processedMain}</div>
    </div>`;

    // 6. 自己渲染think和tail部分（避免formatAsDisplayedMessage产生代码块）
    let thinkHtml = '';
    let tailHtml = '';

    if (thinkContent) {
        // 提取思维链标签内的内容（兼容多种标签）
        let thinkInner = thinkContent;
        for (const tag of ['think', 'thinking', 'reasoning', 'thought']) {
            const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = thinkContent.match(regex);
            if (match) {
                thinkInner = match[1].trim();
                break;
            }
        }
        // 如果是自定义结束标签，直接使用内容
        if (thinkInner === thinkContent) {
            thinkInner = thinkContent.trim();
        }

        // 渲染为深蓝色按钮样式折叠块（照抄正则美化样式）
        thinkHtml = `
<link href="https://fonts.loli.net/css2?family=Fira+Code:wght@400&family=Kosugi+Maru&display=swap" rel="stylesheet">
<div class="think-wrapper" style="width:98%;margin:15px auto;position:relative;z-index:5;font-family:'Kosugi Maru',sans-serif;">
    <div style="padding:5px;transition:all 0.3s ease;border:none;">
        <details class="think-details" style="background:transparent;">
            <summary class="think-summary" style="list-style:none;cursor:pointer;padding:0;display:block;position:relative;">
                <div class="think-header-bar" style="background:#4A6FA5;border:4px solid #FFFFFF;border-radius:15px;padding:10px 25px;box-shadow:0 6px 0px #3A5A8A;display:flex;align-items:center;justify-content:flex-start;transition:all 0.1s cubic-bezier(0.34,1.56,0.64,1);position:relative;z-index:10;width:100%;box-sizing:border-box;">
                    <div class="think-title" style="font-family:'Leckerli One',cursive;font-weight:400;font-style:normal;line-height:1.1;color:#FFFFFF;text-shadow:3px 3px 0px #3A5A8A;text-align:left;width:100%;padding-left:10px;display:flex;align-items:center;gap:10px;"> Chain of Thought</div>
                </div>
            </summary>

            <div class="think-content-area" style="margin-top:20px;animation:slideOpen 0.3s ease-out;">
                <div class="think-code-window" style="background:#1a1a2e;border:4px solid #6B8DC9;border-radius:15px;box-shadow:8px 8px 0 rgba(107,141,201,0.3);overflow:hidden;font-family:'Fira Code',monospace;">
                    <div class="think-window-header" style="background:#6B8DC9;padding:10px 15px;display:flex;align-items:center;border-bottom:3px solid #5A7CB8;position:relative;height:35px;">
                        <div style="display:flex;gap:8px;">
                            <span style="width:12px;height:12px;border-radius:50%;box-shadow:0 2px 0 rgba(0,0,0,0.1);background:#FF5F56;display:inline-block;"></span>
                            <span style="width:12px;height:12px;border-radius:50%;box-shadow:0 2px 0 rgba(0,0,0,0.1);background:#FFBD2E;display:inline-block;"></span>
                            <span style="width:12px;height:12px;border-radius:50%;box-shadow:0 2px 0 rgba(0,0,0,0.1);background:#27C93F;display:inline-block;"></span>
                        </div>
                        <div style="position:absolute;left:50%;transform:translateX(-50%);color:#fff;font-family:'Leckerli One',cursive;font-weight:400;font-style:normal;font-size:clamp(0.7rem,3.5vw,1.3em);letter-spacing:1px;text-shadow:2px 2px 0 rgba(90,124,184,1);z-index:2;white-space:nowrap;width:auto;max-width:70%;overflow:visible;text-align:center;">✨ thinking_process.txt ✨</div>
                    </div>
                    <div style="background:#1a1a2e;position:relative;padding:0;">
                        <pre style="margin:0;padding:20px;color:#c0c0d0;font-size:0.95em;line-height:1.6;overflow-x:auto;white-space:pre-wrap;max-height:400px;scrollbar-width:thin;scrollbar-color:#4b5263 #1a1a2e;font-family:'Fira Code',monospace;">${thinkInner}</pre>
                    </div>
                </div>
            </div>
        </details>
    </div>
</div>
<style>
    .think-summary::-webkit-details-marker { display: none; }
    .think-details[open] .think-header-bar,
    .think-summary:active .think-header-bar {
        transform: translateY(4px);
        box-shadow: 0 2px 0px #3A5A8A !important;
        background: #5A7CB8 !important;
    }
</style>`;
        console.log('[正文美化] think自定义渲染完成');
    }

    if (tailContent) {
        // tail部分（UpdateVariable等）用formatAsDisplayedMessage渲染，让酒馆正则处理
        tailHtml = formatAsDisplayedMessage(tailContent, { message_id: messageId });
        console.log('[正文美化] tail已渲染，长度:', tailHtml.length);
    }

    // 7. 组装：think + Mac窗口 + 尾部标签
    const finalHtml = thinkHtml + macWindow + tailHtml;
    console.log('[正文美化] 最终组装: think长度=', thinkHtml.length, 'mac窗口长度=', macWindow.length, 'tail长度=', tailHtml.length);

    $mes.html(finalHtml);
    $mes.data('beautified', true);

    // 8. 绑定交互事件（候选人选择、租客档案按钮等）
    bindTagEvents($mes);

    console.log('[正文美化] ========== 美化完成 ==========');
}

// ============ 注入样式 ============
function injectStyles() {
    if ($('#beautify-styles').length === 0) {
        $('head').append(`<style id="beautify-styles">${BEAUTIFY_CSS}</style>`);
    }
}

// ============ 初始化 ============
console.log('[正文美化] ★★★ 脚本文件已加载 ★★★');

$(() => {
    console.log('[正文美化] DOM就绪，开始初始化...');

    // 注入样式
    injectStyles();
    console.log('[正文美化] 样式已注入');

    // 监听角色消息渲染事件
    eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, async (messageId) => {
        console.log('[正文美化] ★ 收到消息渲染事件, ID:', messageId);
        // 如果正在重新渲染，跳过事件处理
        if (isRerendering) {
            console.log('[正文美化] 正在重新渲染中，跳过此事件');
            return;
        }
        try {
            await beautifyMessage(messageId, false);
        } catch (e) {
            console.error('[正文美化] 美化出错:', e);
        }
    });

    // 监听消息编辑事件（重新渲染）
    eventOn(tavern_events.MESSAGE_EDITED, async (messageId) => {
        console.log('[正文美化] ★★★ 收到消息编辑事件 ★★★');
        console.log('[正文美化] 编辑的消息ID:', messageId);
        console.log('[正文美化] messageId类型:', typeof messageId);
        try {
            // 延迟一下等待酒馆更新完成
            await new Promise(r => setTimeout(r, 100));
            await beautifyMessage(messageId, true); // 强制重新渲染
        } catch (e) {
            console.error('[正文美化] 重新美化出错:', e);
        }
    });

    // 监听消息更新事件
    eventOn(tavern_events.MESSAGE_UPDATED, async (messageId) => {
        console.log('[正文美化] ★ 收到消息更新事件, ID:', messageId);
        try {
            await beautifyMessage(messageId, true);
        } catch (e) {
            console.error('[正文美化] 重新美化出错:', e);
        }
    });

    // 监听新消息接收事件（AI回复完成）
    eventOn(tavern_events.MESSAGE_RECEIVED, async (messageId) => {
        console.log('[正文美化] ★★★ 收到新消息事件, ID:', messageId, '★★★');
        // 延迟等待消息渲染完成
        setTimeout(async () => {
            try {
                await beautifyMessage(messageId, true);
            } catch (e) {
                console.error('[正文美化] 新消息美化出错:', e);
            }
        }, 300);
    });

    // 监听生成结束事件（备用）
    eventOn(tavern_events.GENERATION_ENDED, async (messageId) => {
        console.log('[正文美化] ★★★ 生成结束事件, ID:', messageId, '★★★');
        setTimeout(async () => {
            try {
                if (typeof messageId === 'number' && messageId >= 0) {
                    await beautifyMessage(messageId, true);
                }
            } catch (e) {
                console.error('[正文美化] 生成结束美化出错:', e);
            }
        }, 500);
    });

    // 重新美化所有消息的通用函数
    async function rebeautifyAllMessages() {
        try {
            const config = await getConfig();
            const lastId = getLastMessageId();
            console.log('[正文美化] 重新美化，最后消息ID:', lastId);
            if (lastId >= 0) {
                const allMessages = getChatMessages(`0-${lastId}`, { role: 'assistant' });
                let messagesToRender = allMessages;
                if (config.renderDepth > 0 && allMessages.length > config.renderDepth) {
                    messagesToRender = allMessages.slice(-config.renderDepth);
                }
                for (const msg of messagesToRender) {
                    // 先清除美化标记
                    const $mes = retrieveDisplayedMessage(msg.message_id);
                    if ($mes) $mes.data('beautified', false);
                    await beautifyMessage(msg.message_id, true);
                }
            }
        } catch (e) {
            console.error('[正文美化] 重新美化出错:', e);
        }
    }

    // 监听聊天切换事件
    eventOn(tavern_events.CHAT_CHANGED, async () => {
        console.log('[正文美化] ★★★ 聊天切换事件 ★★★');
        setTimeout(rebeautifyAllMessages, 500);
    });

    // 监听消息swipe事件（切换开场白本质上是在第0条消息上swipe）
    eventOn(tavern_events.MESSAGE_SWIPED, async (messageId) => {
        console.log('[正文美化] ★★★ 消息swipe事件, ID:', messageId, '★★★');
        // 延迟等待swipe完成
        setTimeout(async () => {
            try {
                // 清除该消息的美化标记
                const $mes = retrieveDisplayedMessage(messageId);
                if ($mes) $mes.data('beautified', false);
                await beautifyMessage(messageId, true);
            } catch (e) {
                console.error('[正文美化] swipe后美化出错:', e);
            }
        }, 200);
    });

    // 监听开场白切换事件（备用）
    eventOn(tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED, async () => {
        console.log('[正文美化] ★★★ 开场白切换事件 ★★★');
        setTimeout(rebeautifyAllMessages, 300);
    });

    console.log('[正文美化] 事件监听已设置');

    // 美化现有消息（根据渲染深度限制）
    setTimeout(async () => {
        try {
            const config = await getConfig();
            const lastId = getLastMessageId();
            console.log('[正文美化] 最后消息ID:', lastId, '渲染深度:', config.renderDepth);
            if (lastId >= 0) {
                const allMessages = getChatMessages(`0-${lastId}`, { role: 'assistant' });
                console.log('[正文美化] 获取到', allMessages.length, '条历史消息');

                // 根据渲染深度限制，只渲染最近N条
                let messagesToRender = allMessages;
                if (config.renderDepth > 0 && allMessages.length > config.renderDepth) {
                    messagesToRender = allMessages.slice(-config.renderDepth);
                    console.log('[正文美化] 根据渲染深度限制，只渲染最近', config.renderDepth, '条');
                }

                for (const msg of messagesToRender) {
                    console.log('[正文美化] 处理历史消息:', msg.message_id);
                    await beautifyMessage(msg.message_id, false);
                }
            }
        } catch (e) {
            console.error('[正文美化] 处理历史消息出错:', e);
        }
    }, 1000);

    console.log('[正文美化] 初始化完成');
});


// 创建并监听设置按钮
try {
    // 先创建按钮
    appendInexistentScriptButtons([{ name: '美化设置', visible: true }]);
    console.log('[正文美化] 设置按钮已创建');

    // 然后监听按钮点击
    eventOn(getButtonEvent('美化设置'), showConfigPanel);
    console.log('[正文美化] 设置按钮事件已绑定');
} catch (e) {
    console.error('[正文美化] 绑定设置按钮失败:', e);
}


// 脚本关闭时清理
$(window).on('pagehide', () => {
    console.log('[正文美化] 脚本关闭');
});
