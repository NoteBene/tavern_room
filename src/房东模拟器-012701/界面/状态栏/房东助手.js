/**
 * 房东模拟器 - 悬浮手机系统
 * 通过悬浮球打开手机页面，展示房东助手
 */

// ============ 配置参数 ============
const PHONE_CONFIG = {
  id: 'landlord-phone-system',
  phoneWidth: 408,
  phoneHeight: 880,
  frameImage: 'https://cdn.jsdelivr.net/gh/yyk9137/st-phone-ui@main/Asset/phone-frame.png',
  defaultWallpaper: 'https://c4.wallpaperflare.com/wallpaper/297/22/531/anime-scenery-landscape-sky-clouds-wallpaper-preview.jpg',
  storageKey: 'landlordPhoneSettings',
};

// ============ 获取父页面document ============
const parentDocument = window.parent.document;

// ============ 工具函数 ============
function getStorageKey(suffix) {
  let characterName = 'default';
  try {
    if (typeof getCharacterName === 'function') {
      characterName = getCharacterName() || 'default';
    }
  } catch (e) { }
  return PHONE_CONFIG.storageKey + '_' + characterName + (suffix ? '_' + suffix : '');
}

// ============ 全局状态管理 ============
window.parent.LandlordPhoneSystem = window.parent.LandlordPhoneSystem || {
  isOpen: false,
  settings: null,
  eventListeners: new Map(),
  iframeWindow: null,

  getSettings: function () {
    if (!this.settings) this.loadSettings();
    return this.settings;
  },

  loadSettings: function () {
    try {
      const saved = localStorage.getItem(getStorageKey());
      this.settings = saved ? JSON.parse(saved) : this.getDefaultSettings();
    } catch (e) {
      this.settings = this.getDefaultSettings();
    }
    return this.settings;
  },

  saveSettings: function (newSettings) {
    this.settings = Object.assign({}, this.settings, newSettings);
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(this.settings));
      this.emit('settings-changed', this.settings);
    } catch (e) { }
  },

  getDefaultSettings: function () {
    return {
      wallpaper: PHONE_CONFIG.defaultWallpaper,
    };
  },

  on: function (event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  },

  off: function (event, callback) {
    if (!this.eventListeners.has(event)) return;
    const listeners = this.eventListeners.get(event);
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  },

  emit: function (event, data) {
    if (!this.eventListeners.has(event)) return;
    this.eventListeners.get(event).forEach(function (cb) {
      try { cb(data); } catch (e) { console.error('[LandlordPhoneSystem] 事件处理错误:', e); }
    });
  },

  getVariables: function () {
    try {
      var Mvu = window.parent.Mvu;
      if (Mvu && typeof Mvu.getMvuData === 'function') {
        var targetMessageId = 'latest';
        if (typeof window.parent.getLastMessageId === 'function') {
          targetMessageId = window.parent.getLastMessageId();
        } else if (window.parent.$) {
          var lastMes = window.parent.$('#chat .mes').last();
          if (lastMes.length) {
            targetMessageId = lastMes.attr('mesid') || 'latest';
          }
        }
        var result = Mvu.getMvuData({ type: 'message', message_id: targetMessageId });
        if (result && result.stat_data) {
          return result.stat_data;
        }
      }
    } catch (e) {
      console.error('[LandlordPhoneSystem] 获取变量失败:', e);
    }
    return {};
  },
};

// ============ 清理旧实例 ============
$('#' + PHONE_CONFIG.id + '-fab').remove();
$('#' + PHONE_CONFIG.id + '-overlay').remove();
$('#' + PHONE_CONFIG.id + '-container').remove();
$('#' + PHONE_CONFIG.id + '-styles').remove();

// ============ 移动端检测 ============
function isMobile() {
  return window.parent.innerWidth <= 1024 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// ============ 智能计算缩放比例 ============
function calculateOptimalScale() {
  var vw = window.parent.innerWidth;
  var vh = window.parent.innerHeight;
  if (isMobile()) {
    var marginW = 40;
    var marginH = 80;
    var availableWidth = vw - marginW;
    var availableHeight = vh - marginH;
    var scaleByWidth = availableWidth / PHONE_CONFIG.phoneWidth;
    var scaleByHeight = availableHeight / PHONE_CONFIG.phoneHeight;
    var optimalScale = Math.min(scaleByWidth, scaleByHeight);
    optimalScale = Math.max(0.6, Math.min(0.85, optimalScale));
    return optimalScale;
  } else {
    return 0.85;
  }
}

// ============ 创建样式 ============
var styleId = PHONE_CONFIG.id + '-styles';
var styles = '#' + PHONE_CONFIG.id + '-fab {\
    position: fixed;\
    width: 56px;\
    height: 56px;\
    background: linear-gradient(135deg, #8b4513 0%, #d4af37 100%);\
    border-radius: 50%;\
    display: flex;\
    align-items: center;\
    justify-content: center;\
    cursor: grab;\
    z-index: 1000;\
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);\
    user-select: none;\
    transition: transform 0.2s ease, box-shadow 0.2s ease;\
    font-size: 28px;\
    touch-action: none;\
}\
#' + PHONE_CONFIG.id + '-fab:hover {\
    transform: scale(1.1);\
}\
#' + PHONE_CONFIG.id + '-fab.dragging {\
    cursor: grabbing;\
    transition: none;\
}\
#' + PHONE_CONFIG.id + '-overlay {\
    position: fixed;\
    top: 0;\
    left: 0;\
    width: 100vw;\
    height: 100vh;\
    background: rgba(0,0,0,0.5);\
    backdrop-filter: blur(5px);\
    z-index: 998;\
    opacity: 0;\
    visibility: hidden;\
    pointer-events: none;\
    transition: opacity 0.3s, visibility 0.3s;\
}\
#' + PHONE_CONFIG.id + '-overlay.show {\
    opacity: 1;\
    visibility: visible;\
    pointer-events: auto;\
}\
#' + PHONE_CONFIG.id + '-container {\
    position: fixed;\
    z-index: 999;\
    background: transparent;\
    opacity: 0;\
    visibility: hidden;\
    pointer-events: none;\
    transition: opacity 0.3s, visibility 0.3s;\
}\
#' + PHONE_CONFIG.id + '-container.show {\
    opacity: 1;\
    visibility: visible;\
    pointer-events: auto;\
}\
#' + PHONE_CONFIG.id + '-wrapper {\
    width: ' + PHONE_CONFIG.phoneWidth + 'px;\
    height: ' + PHONE_CONFIG.phoneHeight + 'px;\
    position: relative;\
    background: #000;\
    border-radius: 50px;\
    box-shadow: 0 0 0 12px #222, 0 30px 60px rgba(0,0,0,0.6);\
    overflow: hidden;\
}\
#' + PHONE_CONFIG.id + '-iframe {\
    width: 100%;\
    height: 100%;\
    border: none;\
    background: transparent;\
    border-radius: 0;\
    overflow: hidden;\
    touch-action: auto;\
    pointer-events: auto;\
}';

$('<style>').attr('id', styleId).text(styles).appendTo('head');

// ============ 获取设置 ============
var settings = window.parent.LandlordPhoneSystem.getSettings();
var currentWallpaper = settings.wallpaper || PHONE_CONFIG.defaultWallpaper;

// ============ 状态栏SVG ============
var statusIconsSVG = '<svg width="88" height="14" viewBox="0 0 88 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<g><path opacity="0.2" d="M19.511 14.4102H21.512C22.035 14.4102 22.383 14.0449 22.383 13.5054V11.7783C22.383 11.2388 22.035 10.8818 21.512 10.8818H19.511C18.988 10.8818 18.64 11.2388 18.64 11.7783V13.5054C18.64 14.0449 18.988 14.4102 19.511 14.4102Z" fill="currentColor"/>' +
  '<path d="M19.515 14.4102H21.532C22.047 14.4102 22.395 14.0449 22.395 13.5054V0.9048C22.395 0.3652 22.047 0 21.532 0H19.515C19 0 18.644 0.3652 18.644 0.9048V13.5054C18.644 14.0449 19 14.4102 19.515 14.4102Z" fill="currentColor"/>' +
  '<path opacity="0.2" d="M13.301 14.4102H15.302C15.825 14.4102 16.173 14.0449 16.173 13.5054V11.7783C16.173 11.2388 15.825 10.8818 15.302 10.8818H13.301C12.778 10.8818 12.43 11.2388 12.43 11.7783V13.5054C12.43 14.0449 12.778 14.4102 13.301 14.4102Z" fill="currentColor"/>' +
  '<path d="M13.306 14.4107H15.307C15.821 14.4107 16.178 14.0454 16.178 13.5059V4.1841C16.178 3.6445 15.821 3.2793 15.307 3.2793H13.306C12.783 3.2793 12.435 3.6445 12.435 4.1841V13.5059C12.435 14.0454 12.783 14.4107 13.306 14.4107Z" fill="currentColor"/>' +
  '<path opacity="0.2" d="M7.091 14.4102H9.092C9.615 14.4102 9.963 14.0449 9.963 13.5054V11.7783C9.963 11.2388 9.615 10.8818 9.092 10.8818H7.091C6.568 10.8818 6.22 11.2388 6.22 11.7783V13.5054C6.22 14.0449 6.568 14.4102 7.091 14.4102Z" fill="currentColor"/>' +
  '<path d="M7.089 14.4097H9.09C9.613 14.4097 9.961 14.0444 9.961 13.5049V7.188C9.961 6.6484 9.613 6.2832 9.09 6.2832H7.089C6.566 6.2832 6.218 6.6484 6.218 7.188V13.5049C6.218 14.0444 6.566 14.4097 7.089 14.4097Z" fill="currentColor"/>' +
  '<path opacity="0.2" d="M0.872 14.4102H2.872C3.395 14.4102 3.744 14.0449 3.744 13.5054V11.7783C3.744 11.2388 3.395 10.8818 2.872 10.8818H0.872C0.349 10.8818 0 11.2388 0 11.7783V13.5054C0 14.0449 0.349 14.4102 0.872 14.4102Z" fill="currentColor"/>' +
  '<path d="M0.872 14.4102H2.872C3.395 14.4102 3.744 14.0449 3.744 13.5054V9.7783C3.744 9.2388 3.395 8.8818 2.872 8.8818H0.872C0.349 8.8818 0 9.2388 0 9.7783V13.5054C0 14.0449 0.349 14.4102 0.872 14.4102Z" fill="currentColor"/></g>' +
  '<g transform="translate(30, 0)"><path d="M11.5555 13.8037C11.7381 13.8037 11.8958 13.7207 12.2195 13.4053L14.2449 11.4629C14.3694 11.3384 14.4026 11.1557 14.2864 11.0063C13.7469 10.3091 12.7259 9.7031 11.5555 9.7031C10.3519 9.7031 9.33085 10.334 8.7913 11.0561C8.7083 11.189 8.7415 11.3384 8.87431 11.4629L10.8914 13.4053C11.2151 13.7124 11.3729 13.8037 11.5555 13.8037ZM6.69951 9.2881C6.88212 9.4624 7.10624 9.4375 7.27226 9.2549C8.26835 8.1509 9.89531 7.3457 11.5555 7.354C13.2322 7.3457 14.8592 8.1758 15.8719 9.2798C16.0213 9.4541 16.2288 9.4458 16.4114 9.2798L17.698 8.0015C17.8309 7.8687 17.8475 7.686 17.7229 7.5366C16.4695 6.001 14.1453 4.8472 11.5555 4.8472C8.96562 4.8472 6.6414 6.001 5.38798 7.5366C5.26347 7.686 5.27177 7.8521 5.41288 8.0015L6.69951 9.2881ZM3.25468 5.8184C3.4207 5.9761 3.65312 5.9761 3.81083 5.8101C5.85283 3.6436 8.54228 2.4981 11.5555 2.4981C14.5852 2.4981 17.2913 3.6519 19.3167 5.8184C19.4661 5.9678 19.6902 5.9595 19.8562 5.8018L21.0018 4.6563C21.1512 4.5068 21.1429 4.3242 21.0267 4.1831C19.076 1.7759 15.407 0.0078 11.5555 0.0078C7.7122 0.0078 4.02665 1.7759 2.08427 4.1831C1.96806 4.3242 1.96806 4.5068 2.10917 4.6563L3.25468 5.8184Z" fill="currentColor"/></g>' +
  '<g transform="translate(57, 0)"><path opacity="0.4" d="M5.522 13.9548H22.203C24.149 13.9548 25.54 13.7363 26.532 12.7438C27.528 11.7513 27.733 10.3858 27.733 8.4323V5.5391C27.733 3.5856 27.528 2.2134 26.532 1.2242C25.537 0.2318 24.149 0.0166 22.203 0.0166H5.461C3.59 0.0166 2.196 0.2351 1.204 1.2309C0.208 2.2234 0 3.5997 0 5.4702V8.4323C0 10.3858 0.204 11.7546 1.197 12.7438C2.196 13.7363 3.58 13.9548 5.522 13.9548ZM5.239 12.6249C3.973 12.6249 2.833 12.4245 2.171 11.77C1.519 11.1081 1.33 9.9852 1.33 8.7156V5.3138C1.33 3.9927 1.519 2.8566 2.167 2.1947C2.829 1.5294 3.987 1.3432 5.305 1.3432H22.493C23.76 1.3432 24.9 1.5468 25.551 2.198C26.213 2.86 26.403 3.9753 26.403 5.2449V8.7156C26.403 9.9852 26.21 11.1081 25.551 11.77C24.9 12.4279 23.76 12.6249 22.493 12.6249H5.239ZM28.977 9.601C29.772 9.5506 30.848 8.5256 30.848 6.9819C30.848 5.4424 29.772 4.4174 28.977 4.367V9.601Z" fill="currentColor"/>' +
  '<path d="M4.863 11.5222H22.881C23.844 11.5222 24.417 11.3715 24.781 11.0074C25.145 10.64 25.303 10.0638 25.303 9.0995V4.869C25.303 3.898 25.145 3.3284 24.785 2.961C24.417 2.6003 23.838 2.4463 22.881 2.4463H4.932C3.903 2.4463 3.309 2.597 2.959 2.9577C2.599 3.3251 2.44 3.9187 2.44 4.9304V9.0995C2.44 10.0738 2.599 10.64 2.959 11.0074C3.327 11.3681 3.906 11.5222 4.863 11.5222Z" fill="currentColor"/></g>' +
  '</svg>';

// ============ 获取房东助手APP的HTML内容 ============
function getLandlordAppHTML() {
  return '<div id="app" class="card">\
    <div class="top">\
      <div class="top-stats">\
        <div class="stat">\
          <span>资金: <strong>{{ stat[\'主角资金\'] ?? \'—\' }}</strong></span>\
          <span>公寓知名度: <strong>{{ stat[\'公寓知名度\'] ?? \'—\' }}</strong></span>\
          <span>酒吧知名度: <strong>{{ stat[\'酒吧知名度\'] ?? \'—\' }}</strong></span>\
        </div>\
      </div>\
    </div>\
\
    <div class="tabs" role="tablist">\
      <button :class="{active:tab===\'房客\'}" @click="tab=\'房客\'">\
        <span class="tab-icon">👥</span>\
      </button>\
      <button :class="{active:tab===\'道具\'}" @click="tab=\'道具\'">\
        <span class="tab-icon">🎮</span>\
      </button>\
      <button :class="{active:tab===\'监控\'}" @click="tab=\'监控\'">\
        <span class="tab-icon">📱</span>\
      </button>\
      <button :class="{active:tab===\'事务\'}" @click="tab=\'事务\'">\
        <span class="tab-icon">📅</span>\
      </button>\
    </div>\
\
    <div v-if="tab===\'房客\'">\
      <div class="room-tabs">\
        <button v-for="r in rooms" :key="r" :class="{active:activeRoom===r}" @click="setRoom(r)">{{ r }}</button>\
      </div>\
\
      <div id="room-content">\
        <div v-if="guest" class="guest-panel">\
          <div class="guest-header">\
            <div class="char-portrait">\
              <img v-if="portraitSrc" :src="portraitSrc" :alt="guestName" />\
            </div>\
            <div class="guest-info-vertical">\
              <div class="guest-name">{{ guestName }}</div>\
              <div class="progress-item">\
                <div>好感度: <strong>{{ guest.好感度 ?? 0 }}</strong></div>\
                <div class="bar-container"><div class="bar" :style="{width: (guest.好感度||0) + \'%\'}"></div></div>\
              </div>\
              <div class="progress-item">\
                <div>堕落度: <strong>{{ guest.堕落度 ?? 0 }}</strong></div>\
                <div class="bar-container">\
                  <div class="bar warn" :style="{width: (guest.堕落度||0) + \'%\'}"></div>\
                </div>\
              </div>\
            </div>\
          </div>\
\
          <div class="cards">\
            <div class="card-block">\
              <h4 :class="{collapsed: isOutfitCollapsed}" @click="toggleCollapse(\'outfit\')">\
                <span class="collapsible-header">\
                  <span class="collapse-icon">▼</span>\
                  着装\
                </span>\
              </h4>\
              <div class="card-content" :style="{maxHeight: isOutfitCollapsed ? \'0px\' : \'500px\'}">\
                <div class="card-grid">\
                  <div class="card-item" v-for="k in outfitKeys" :key="k">\
                    <strong>{{ k }}</strong>\
                    <div>{{ (guest[\'着装\'] && guest[\'着装\'][k]) ?? \'—\' }}</div>\
                  </div>\
                </div>\
              </div>\
            </div>\
          </div>\
\
          <div class="guest-info">\
            <div>正在干嘛: <strong>{{ guest[\'正在干嘛\'] ?? \'—\' }}</strong></div>\
            <div>当前计划: <strong>{{ guest[\'当前计划\'] ?? \'—\' }}</strong></div>\
          </div>\
        </div>\
        <div v-else class="empty-room">房间暂无房客</div>\
      </div>\
    </div>\
\
    <div v-if="tab===\'道具\'">\
      <div v-if="Object.keys(items).length === 0" class="empty-state" data-type="props">背包空空如也</div>\
      <div v-else class="list-cards">\
        <div class="card-block" v-for="(it,k) in items" :key="k">\
          <h4>{{ k }}</h4>\
          <div>{{ it[\'描述\'] ?? it[\'description\'] ?? \'—\' }}</div>\
          <div>数量: {{ it[\'数量\'] ?? it[\'count\'] ?? \'—\' }}</div>\
        </div>\
      </div>\
    </div>\
\
    <div v-if="tab===\'监控\'">\
      <div v-if="Object.keys(monitors).length === 0" class="empty-state" data-type="monitor">暂无监控设备</div>\
      <div v-else class="list-cards">\
        <div class="card-block" v-for="(v,k) in monitors" :key="k">\
          <h4>{{ k }}</h4>\
          <div>{{ v }}</div>\
        </div>\
      </div>\
    </div>\
\
    <div v-if="tab===\'事务\'">\
      <div v-if="tasks.length === 0" class="empty-state" data-type="tasks">暂无待处理事务</div>\
      <div v-else class="list-cards">\
        <div class="guest-info" v-for="(t,idx) in tasks" :key="idx">\
          <div>{{ t }}</div>\
        </div>\
      </div>\
    </div>\
  </div>\
\
  <style>\
    :root {\
      --primary-yellow: #ffd700;\
      --primary-brown: #8b4513;\
      --light-yellow: #fff8dc;\
      --cream-bg: #faf3e0;\
      --cream-dark: #f5e6ca;\
      --cream-darker: #e8d9b5;\
      --text-dark: #5d4037;\
      --accent-gold: #d4af37;\
      --border-light: #d7ccc8;\
    }\
    body {\
      font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif;\
      background: var(--cream-bg);\
      color: var(--text-dark);\
      margin: 0;\
      padding: 8px;\
      min-height: 50vh;\
      font-size: 14px;\
    }\
    .card {\
      max-width: 980px;\
      margin: 0 auto;\
      background: white;\
      border-radius: 12px;\
      padding: 12px;\
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);\
      border: 1px solid var(--border-light);\
    }\
    .top {\
      display: flex;\
      justify-content: center;\
      align-items: center;\
      gap: 6px;\
      padding: 6px 0;\
      border-bottom: 1px solid var(--border-light);\
      margin-bottom: 8px;\
    }\
    .top-stats {\
      display: flex;\
      gap: 6px;\
    }\
    .stat {\
      background: var(--cream-dark);\
      border: 1px solid var(--border-light);\
      padding: 6px 12px;\
      border-radius: 6px;\
      font-size: 13px;\
      color: var(--text-dark);\
      text-align: center;\
      display: flex;\
      gap: 12px;\
    }\
    .stat strong {\
      color: var(--primary-brown);\
      font-size: 14px;\
    }\
    .tabs {\
      display: flex;\
      gap: 8px;\
      margin: 10px 0;\
      padding-bottom: 2px;\
      border-bottom: 1px solid var(--border-light);\
    }\
    .tabs button {\
      padding: 8px 16px;\
      border-radius: 6px;\
      border: 2px solid transparent;\
      background: var(--cream-dark);\
      color: var(--text-dark);\
      cursor: pointer;\
      font-size: 14px;\
      font-weight: 500;\
      display: flex;\
      align-items: center;\
      gap: 4px;\
      transition: all 0.2s;\
    }\
    .tabs button:hover {\
      transform: translateY(-1px);\
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\
    }\
    .tabs button.active {\
      color: white;\
      border-color: var(--accent-gold);\
      box-shadow: 0 2px 4px rgba(212, 175, 55, 0.2);\
    }\
    .tabs button:nth-child(1).active {\
      background: var(--primary-yellow);\
      color: #5d4037;\
    }\
    .tabs button:nth-child(2).active {\
      background: #8b4513;\
    }\
    .tabs button:nth-child(3).active {\
      background: #2e7d32;\
    }\
    .tabs button:nth-child(4).active {\
      background: #1565c0;\
    }\
    .room-tabs {\
      display: flex;\
      gap: 6px;\
      margin-bottom: 8px;\
      flex-wrap: wrap;\
    }\
    .room-tabs button {\
      padding: 6px 10px;\
      border-radius: 4px;\
      border: 1px solid var(--border-light);\
      background: var(--light-yellow);\
      color: var(--text-dark);\
      cursor: pointer;\
      font-size: 13px;\
      transition: all 0.2s;\
      min-width: 40px;\
      text-align: center;\
    }\
    .room-tabs button:hover {\
      background: #ffecb3;\
    }\
    .room-tabs button.active {\
      background: var(--primary-yellow);\
      border-color: var(--accent-gold);\
      font-weight: 600;\
      box-shadow: 0 1px 3px rgba(255, 215, 0, 0.3);\
    }\
    .guest-panel {\
      display: flex;\
      flex-direction: column;\
      gap: 10px;\
    }\
    .guest-header {\
      display: flex;\
      align-items: center;\
      gap: 16px;\
      margin-bottom: 10px;\
    }\
    .char-portrait {\
      width: 180px;\
      height: 260px;\
      flex: 0 0 auto;\
      display: flex;\
      align-items: center;\
      justify-content: center;\
      overflow: hidden;\
      border-radius: 8px;\
      border: 1px solid var(--border-light);\
      background: white;\
    }\
    .char-portrait img {\
      width: 100%;\
      height: 100%;\
      object-fit: cover;\
      display: block;\
    }\
    .guest-info-vertical {\
      gap: 12px;\
      flex: 1;\
    }\
    .guest-name {\
      font-size: 20px;\
      font-weight: 200;\
      color: var(--text-dark);\
      margin-bottom: 10px;\
    }\
    .progress-item {\
      font-size: 15px;\
      line-height: 1.3;\
      margin-bottom: 10px;\
    }\
    .progress-item strong {\
      font-size: 16px;\
      font-weight: 200;\
    }\
    .bar-container {\
      height: 10px;\
      background: var(--cream-dark);\
      border-radius: 5px;\
      overflow: hidden;\
      margin-top: 6px;\
    }\
    .bar {\
      height: 100%;\
      background: linear-gradient(to right, #4caf50, #8bc34a);\
      transition: width 0.5s ease;\
    }\
    .bar.warn {\
      background: linear-gradient(to right, #f44336, #ff9800);\
    }\
    .cards {\
      display: flex;\
      gap: 10px;\
      flex-wrap: wrap;\
    }\
    .card-block {\
      flex: 1;\
      min-width: 200px;\
      background: var(--cream-dark);\
      padding: 12px;\
      border-radius: 8px;\
      border: 1px solid var(--border-light);\
    }\
    .card-block h4 {\
      margin: 0 0 8px 0;\
      padding: 6px 0;\
      color: var(--text-dark);\
      font-size: 15px;\
      display: flex;\
      align-items: center;\
      justify-content: space-between;\
      cursor: pointer;\
    }\
    .collapsible-header {\
      display: flex;\
      align-items: center;\
      gap: 8px;\
    }\
    .collapse-icon {\
      transition: transform 0.3s;\
      font-size: 12px;\
      color: #795548;\
    }\
    .collapsed .collapse-icon {\
      transform: rotate(-90deg);\
    }\
    .card-content {\
      overflow: hidden;\
      transition: max-height 0.3s ease;\
    }\
    .card-grid {\
      display: grid;\
      grid-template-columns: repeat(3, 1fr);\
      gap: 8px;\
      margin-top: 8px;\
    }\
    .card-item {\
      background: white;\
      padding: 10px;\
      border-radius: 6px;\
      border: 1px solid var(--border-light);\
      font-size: 13px;\
    }\
    .card-item strong {\
      color: var(--primary-brown);\
      display: block;\
      font-size: 12px;\
      margin-bottom: 4px;\
    }\
    .list-cards {\
      display: flex;\
      flex-wrap: wrap;\
      gap: 10px;\
    }\
    .list-cards .card-block {\
      width: 200px;\
      font-size: 14px;\
    }\
    .empty-room,\
    .empty-state {\
      text-align: center;\
      padding: 50px 20px;\
      color: #795548;\
      font-size: 15px;\
      background: var(--cream-dark);\
      border-radius: 8px;\
      border: 1px dashed var(--border-light);\
      margin: 15px 0;\
    }\
    .empty-room::before,\
    .empty-state::before {\
      display: block;\
      font-size: 40px;\
      margin-bottom: 15px;\
      opacity: 0.6;\
    }\
    .empty-room::before {\
      content: \'🏠\';\
    }\
    .tab-icon {\
      font-size: 16px;\
    }\
    .empty-state[data-type=\'props\']::before {\
      content: \'🎒\';\
    }\
    .empty-state[data-type=\'monitor\']::before {\
      content: \'📹\';\
    }\
    .empty-state[data-type=\'tasks\']::before {\
      content: \'📋\';\
    }\
    .guest-info {\
      display: grid;\
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));\
      gap: 10px;\
      margin-top: 10px;\
      font-size: 14px;\
    }\
    .guest-info > div {\
      background: var(--cream-dark);\
      padding: 10px 14px;\
      border-radius: 6px;\
      border: 1px solid var(--border-light);\
    }\
    .guest-info strong {\
      color: var(--primary-brown);\
    }\
    @media (max-width: 640px) {\
      .card {\
        padding: 10px;\
      }\
      .card-grid {\
        grid-template-columns: repeat(2, 1fr);\
      }\
      .cards {\
        flex-direction: column;\
      }\
      .card-block {\
        min-width: 100%;\
      }\
      .list-cards .card-block {\
        width: 100%;\
      }\
      .guest-name {\
        font-size: 18px;\
      }\
    }\
  </style>';
}

// ============ 生成Iframe内容 ============
var iframeHTML = '<!DOCTYPE html>' +
  '<html lang="zh-CN">' +
  '<head>' +
  '<meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
  '<title>房东模拟器</title>' +
  '<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"><\/script>' +
  '<style>' +
  '*{box-sizing:border-box}' +
  'html,body{background:#000!important;margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important}' +
  '.phone-frame{width:100%!important;height:100%!important;background:#000!important;position:relative!important;display:flex!important;flex-direction:column!important;font-family:-apple-system,sans-serif!important}' +
  '.notch{width:180px!important;height:30px!important;background:#000!important;border-radius:0 0 20px 20px!important;position:absolute!important;top:0!important;left:50%!important;transform:translateX(-50%)!important;z-index:100!important}' +
  '.screen{flex:1!important;background:#faf3e0!important;position:relative!important;overflow-y:auto!important}' +
  '.status-bar{height:clamp(32px,6vh,44px)!important;width:100%;display:flex!important;justify-content:space-between!important;align-items:center!important;padding:0 clamp(16px,4vw,28px) 0 clamp(20px,5vw,32px)!important;z-index:500;position:absolute;top:0;left:0;right:0;pointer-events:none;color:#000;font-size:clamp(12px,2vw,14px);-webkit-font-smoothing:antialiased}' +
  '.status-bar #clock{color:#000;text-shadow:none;font-weight:600}' +
  '.status-bar .status-icons{filter:none;color:#000}' +
  '#clock{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;font-weight:600;cursor:pointer}' +
  '.status-icons{display:flex;gap:6px;color:#000}' +
  '.status-icons svg{height:12px;width:auto;display:block;opacity:1}' +
  '.app-content{width:100%!important;height:100%!important;background:#faf3e0!important;padding-top:44px!important;padding-bottom:40px!important;overflow-y:auto!important}' +
  '@media (max-width: 640px){.phone-frame{width:100vw!important;height:100vh!important}.screen{width:100%!important;height:100%!important}.notch{display:none!important}}' +
  '</style>' +
  '</head>' +
  '<body>' +
  '<div class="phone-frame">' +
  '<div class="notch"></div>' +
  '<div class="screen">' +
  '<div class="status-bar" id="status-bar">' +
  '<span id="clock"></span>' +
  '<div></div>' +
  '<div class="status-icons" id="status-icons-container">' + statusIconsSVG + '</div>' +
  '</div>' +
  '<div class="app-content" id="app-content">' +
  '</div>' +
  '</div>' +
  '</div>' +
  '<script>' +
  'window.parent.console.log("[房东手机iframe] 脚本开始执行");' +
  'function updateClock(){try{var Mvu=window.parent.Mvu;if(Mvu&&typeof Mvu.getMvuData==="function"){var result=Mvu.getMvuData({type:"message",message_id:"latest"});if(result&&result.stat_data&&result.stat_data.当前时间){document.getElementById("clock").textContent=result.stat_data.当前时间;return}}var now=new Date();var h=String(now.getHours()).padStart(2,"0");var m=String(now.getMinutes()).padStart(2,"0");document.getElementById("clock").textContent=h+":"+m}catch(e){var now=new Date();var h=String(now.getHours()).padStart(2,"0");var m=String(now.getMinutes()).padStart(2,"0");document.getElementById("clock").textContent=h+":"+m}}updateClock();setInterval(updateClock,3000);' +
  '(function initApp(){' +
  'window.parent.console.log("[房东手机iframe] 初始化房东助手");' +
  'var appContent=document.getElementById("app-content");' +
  'var htmlContent=' + JSON.stringify(getLandlordAppHTML()) + ';' +
  'appContent.innerHTML=htmlContent;' +
  'initVueApp(appContent);' +
  'window.parent.postMessage({type:"iframe-ready"},"*");' +
  '})();' +
  'function initVueApp(container){' +
  'try{' +
  'var appDiv=container.querySelector("#app");' +
  'if(!appDiv||!window.Vue)return;' +
  'var getAllVariables=function(){' +
  'try{' +
  'var Mvu=window.parent.Mvu;' +
  'if(Mvu&&typeof Mvu.getMvuData==="function"){' +
  'var result=Mvu.getMvuData({type:"message",message_id:"latest"});' +
  'if(result&&result.stat_data){' +
  'return result.stat_data;' +
  '}' +
  '}' +
  '}catch(e){}' +
  'return{};' +
  '};' +
  'var waitInit=function(){' +
  'return new Promise(function(resolve){' +
  'var check=function(){' +
  'try{' +
  'var Mvu=window.parent.Mvu;' +
  'if(Mvu&&typeof Mvu.getMvuData==="function"){' +
  'var result=Mvu.getMvuData({type:"message",message_id:"latest"});' +
  'if(result&&result.stat_data){' +
  'resolve();' +
  'return;' +
  '}' +
  '}' +
  '}catch(e){}' +
  'setTimeout(check,500);' +
  '};' +
  'check();' +
  '});' +
  '};' +
  'var Vue=window.Vue;' +
  'var createApp=Vue.createApp,ref=Vue.ref,computed=Vue.computed,onMounted=Vue.onMounted;' +
  'createApp({' +
  'setup:function(){' +
  'var tab=ref("房客");' +
  'var rooms=["201","202","203","204","205"];' +
  'var activeRoom=ref(rooms[0]);' +
  'var vars=ref(getAllVariables());' +
  'var stat=computed(function(){return vars.value.stat_data||vars.value||{}});' +
  'var isOutfitCollapsed=ref(false);' +
  'function setRoom(r){activeRoom.value=r;}' +
  'function toggleCollapse(type){' +
  'if(type==="outfit"){isOutfitCollapsed.value=!isOutfitCollapsed.value;}' +
  '}' +
  'var guestNames=computed(function(){return Object.keys(stat.value["房客"]||{});});' +
  'var guestIndex=computed(function(){return rooms.indexOf(activeRoom.value);});' +
  'var guestName=computed(function(){return guestNames.value[guestIndex.value]||null;});' +
  'var guest=computed(function(){return guestName.value?(stat.value["房客"]||{})[guestName.value]:null;});' +
  'var portraitSrc=computed(function(){' +
  'if(!guest.value)return null;' +
  'var g=guest.value;' +
  'var cand=g["立绘"]||g["portrait"]||g["头像"]||g["avatar"]||g["avatarUrl"]||g["image"];' +
  'var name=guestName.value||"";' +
  'var repoRawBase="https://i.postimg.cc";' +
  'if(Array.isArray(cand))cand=cand[0];' +
  'if(!cand){' +
  'return "https://cdn.jsdelivr.net/gh/NoteBene/tavern_room@main/img/默认角色1.jpg";' +
  '}' +
  'cand=String(cand).trim();' +
  'if(/^https?:\\/\\//.test(cand))return cand;' +
  'if(name!=="虞汐"&&name!=="玥玥"&&name!=="伊莉雅"){' +
  'return "https://cdn.jsdelivr.net/gh/NoteBene/tavern_room@main/img/默认角色1.jpg";' +
  '}' +
  'var filename=cand;' +
  'if(!/\\.[a-zA-Z0-9]+$/.test(filename))filename+=".jpg";' +
  'return repoRawBase+"/"+encodeURIComponent(filename);' +
  '});' +
  'var outfitKeys=["上装","下装","内衣","袜子","鞋子","饰品"];' +
  'var items=computed(function(){return stat.value["物品栏"]||{};});' +
  'var monitors=computed(function(){return stat.value["可监控区域"]||{};});' +
  'var tasks=computed(function(){return stat.value["近期事务"]||[];});' +
  'onMounted(function(){' +
  'waitInit().then(function(){' +
  'function tick(){vars.value=getAllVariables();}' +
  'tick();' +
  'setInterval(tick,2000);' +
  '});' +
  '});' +
  'return{' +
  'tab:tab,rooms:rooms,activeRoom:activeRoom,setRoom:setRoom,stat:stat,' +
  'guest:guest,guestName:guestName,portraitSrc:portraitSrc,' +
  'outfitKeys:outfitKeys,items:items,monitors:monitors,tasks:tasks,' +
  'isOutfitCollapsed:isOutfitCollapsed,toggleCollapse:toggleCollapse' +
  '};' +
  '}' +
  '}).mount("#app");' +
  '}catch(e){' +
  'console.error("[房东手机] Vue初始化失败:",e);' +
  '}' +
  '}' +
  '<\/script>' +
  '</body>' +
  '</html>';

// ============ 创建悬浮球 ============
var savedPos = { top: 100, left: 20 };
try {
  var saved = localStorage.getItem(getStorageKey('fabPos'));
  if (saved) savedPos = JSON.parse(saved);
} catch (e) { }

var $fab = $('<div>')
  .attr('id', PHONE_CONFIG.id + '-fab')
  .html('🏠')
  .css({ top: savedPos.top + 'px', left: savedPos.left + 'px' })
  .appendTo('body');

console.log('[房东手机] 悬浮球已创建');

// ============ 悬浮球拖拽 ============
var isDragging = false;
var hasMoved = false;
var startX, startY, initialX, initialY;
var fabRafId = null;

$fab.on('mousedown touchstart', function (e) {
  isDragging = true;
  hasMoved = false;
  var touch = e.touches ? e.touches[0] : e;
  startX = touch.clientX;
  startY = touch.clientY;
  var rect = $fab[0].getBoundingClientRect();
  initialX = rect.left;
  initialY = rect.top;
  $fab.addClass('dragging');
  e.preventDefault();
});

function updateFabPosition(deltaX, deltaY) {
  if (fabRafId) cancelAnimationFrame(fabRafId);
  fabRafId = requestAnimationFrame(function () {
    var newX = Math.max(0, Math.min(initialX + deltaX, window.parent.innerWidth - 56));
    var newY = Math.max(0, Math.min(initialY + deltaY, window.parent.innerHeight - 56));
    $fab.css({ left: newX + 'px', top: newY + 'px' });
    fabRafId = null;
  });
}

parentDocument.addEventListener('mousemove', function (e) {
  if (!isDragging) return;
  var deltaX = e.clientX - startX;
  var deltaY = e.clientY - startY;
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) hasMoved = true;
  updateFabPosition(deltaX, deltaY);
  e.preventDefault();
});

parentDocument.addEventListener('touchmove', function (e) {
  if (!isDragging) return;
  var touch = e.touches[0];
  var deltaX = touch.clientX - startX;
  var deltaY = touch.clientY - startY;
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) hasMoved = true;
  updateFabPosition(deltaX, deltaY);
  e.preventDefault();
}, { passive: false });

var fabTouched = false;

$fab.on('touchstart', function () {
  fabTouched = true;
});

$(parentDocument).on('mouseup touchend', function () {
  if (!isDragging) return;
  isDragging = false;
  $fab.removeClass('dragging');

  var rect = $fab[0].getBoundingClientRect();
  localStorage.setItem(getStorageKey('fabPos'), JSON.stringify({ top: rect.top, left: rect.left }));

  if (fabTouched && !hasMoved) {
    togglePhone();
  }
  hasMoved = false;
  fabTouched = false;
});

$fab.on('click', function () {
  if (hasMoved) {
    hasMoved = false;
    return;
  }
  togglePhone();
});

// ============ 创建遮罩层 ============
var $overlay = $('<div>')
  .attr('id', PHONE_CONFIG.id + '-overlay')
  .appendTo('body');

$overlay.on('click', function () {
  closePhone();
});

// ============ 创建手机容器 ============
var $container = $('<div>')
  .attr('id', PHONE_CONFIG.id + '-container')
  .appendTo('body');

var $wrapper = $('<div>')
  .attr('id', PHONE_CONFIG.id + '-wrapper')
  .appendTo($container);

var $iframe = $('<iframe>')
  .attr('id', PHONE_CONFIG.id + '-iframe')
  .appendTo($wrapper);

// ============ 应用样式函数 ============
function applyContainerStyles() {
  var scale = calculateOptimalScale();
  var vw = window.parent.innerWidth;
  var vh = window.parent.innerHeight;

  if (isMobile()) {
    var scaledWidth = PHONE_CONFIG.phoneWidth * scale;
    var scaledHeight = PHONE_CONFIG.phoneHeight * scale;
    var scrollTop = window.parent.pageYOffset || parentDocument.documentElement.scrollTop;
    var scrollLeft = window.parent.pageXOffset || parentDocument.documentElement.scrollLeft;
    var topPosition = Math.max(20, (vh - scaledHeight) / 2) + scrollTop;
    var leftPosition = Math.max(20, (vw - scaledWidth) / 2) + scrollLeft;

    $container.css({
      position: 'absolute',
      top: topPosition + 'px',
      left: leftPosition + 'px',
      transform: 'none'
    });
    $wrapper.css({
      transform: 'scale(' + scale + ')',
      transformOrigin: 'top left',
      borderRadius: '40px',
      boxShadow: '0 0 0 8px #222, 0 20px 40px rgba(0,0,0,0.5)'
    });
  } else {
    $container.css({
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)'
    });
    $wrapper.css({
      transform: 'scale(' + scale + ')',
      transformOrigin: 'center center',
      borderRadius: '50px',
      boxShadow: '0 0 0 12px #222, 0 30px 60px rgba(0,0,0,0.6)'
    });
  }
}

applyContainerStyles();
$(window.parent).on('resize', applyContainerStyles);

// ============ 写入iframe内容 ============
$iframe.on('load', function () {
  window.parent.LandlordPhoneSystem.iframeWindow = this.contentWindow;
});

$iframe[0].srcdoc = iframeHTML;

// ============ 监听iframe消息 ============
window.parent.addEventListener('message', function (event) {
  console.log('[房东手机] 收到消息:', event.data?.type);

  var data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'iframe-ready':
      console.log('[房东手机] iframe就绪');
      break;
  }
});

// ============ 打开/关闭手机 ============
function togglePhone() {
  if (window.parent.LandlordPhoneSystem.isOpen) {
    closePhone();
  } else {
    openPhone();
  }
}

function openPhone() {
  applyContainerStyles();
  $overlay.addClass('show');
  $container.addClass('show');
  window.parent.LandlordPhoneSystem.isOpen = true;
  window.parent.LandlordPhoneSystem.emit('phone-opened');
}

function closePhone() {
  $overlay.removeClass('show');
  $container.removeClass('show');
  window.parent.LandlordPhoneSystem.isOpen = false;
  window.parent.LandlordPhoneSystem.emit('phone-closed');
}

// ============ 清理函数 ============
function cleanupPhone() {
  console.log('[房东手机] 正在清理悬浮窗...');
  $('#' + PHONE_CONFIG.id + '-fab').remove();
  $('#' + PHONE_CONFIG.id + '-overlay').remove();
  $('#' + PHONE_CONFIG.id + '-container').remove();
  $('#' + PHONE_CONFIG.id + '-styles').remove();

  if (window.parent.LandlordPhoneSystem) {
    window.parent.LandlordPhoneSystem.isOpen = false;
    window.parent.LandlordPhoneSystem.iframeWindow = null;
    window.parent.LandlordPhoneSystem.eventListeners.clear();
  }
}

// ============ 监听脚本卸载事件 ============
$(window).on('pagehide', function () {
  console.log('[房东手机] 脚本正在卸载，清理悬浮窗...');
  cleanupPhone();
});

// ============ 监听聊天切换 ============
if (typeof eventOn === 'function') {
  eventOn('chat_id_changed', function (chatFileName) {
    console.log('[房东手机] 检测到聊天切换:', chatFileName);
    if (!chatFileName) {
      console.log('[房东手机] 返回首页，清理悬浮窗');
      cleanupPhone();
    }
  });
  console.log('[房东手机] 已注册chat_id_changed事件监听');
}

window.parent.LandlordPhoneSystem.emit('main-ready');
console.log('[房东手机] 初始化完成');
