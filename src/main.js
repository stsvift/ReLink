const { invoke } = window.__TAURI__.core;

// Добавьте эту функцию в начало файла
function disableContextMenu() {
  document.addEventListener('contextmenu', event => event.preventDefault());
}

let statusMsgEl;
let statusMsgTimeout;

function showStatusMessage(message, isError = false, errorDetails = '') {
  clearTimeout(statusMsgTimeout);
  
  statusMsgEl.innerHTML = `
    <div class="message-header">
      <span class="icon">${isError ? '⚠️' : '✅'}</span>
      <span class="message">${message}</span>
      ${isError ? '<button class="close-btn">✖</button>' : ''}
    </div>
    ${isError ? `<button class="details-btn">Подробнее</button>` : ''}
    ${isError ? `<pre id="error-details" style="display: none;">${errorDetails}</pre>` : ''}
  `;
  statusMsgEl.className = isError ? 'error' : 'success';
  statusMsgEl.classList.add('show');

  if (isError) {
    const detailsBtn = statusMsgEl.querySelector('.details-btn');
    const errorDetailsEl = statusMsgEl.querySelector('#error-details');
    const closeBtn = statusMsgEl.querySelector('.close-btn');
    
    detailsBtn.addEventListener('click', () => {
      errorDetailsEl.style.display = errorDetailsEl.style.display === 'none' ? 'block' : 'none';
      if (errorDetailsEl.style.display === 'block') {
        clearTimeout(statusMsgTimeout);
      } else {
        setAutoHideTimeout();
      }
    });

    closeBtn.addEventListener('click', () => {
      statusMsgEl.classList.remove('show');
    });
  }

  setAutoHideTimeout();
}

function setAutoHideTimeout() {
  statusMsgTimeout = setTimeout(() => {
    statusMsgEl.classList.remove('show');
  }, 5000);
}

async function runBatFile(fileName) {
  try {
    const result = await invoke("run_bat_file", { fileName });
    showStatusMessage(`Файл ${fileName} успешно запущен`);
  } catch (error) {
    showStatusMessage(`Не удалось запустить ${fileName}. Нажмите "Подробнее" для деталей.`, true, error.toString());
  }
}

async function toggleAutostart(fileName, isEnabled) {
  try {
    await invoke("toggle_autostart", { fileName, isEnabled });
    showStatusMessage(`Автозапуск для ${fileName} ${isEnabled ? "включен" : "выключен"}`);
  } catch (error) {
    showStatusMessage(`Не удалось изменить настройки автозапуска для ${fileName}. Нажмите "Подробнее" для деталей.`, true, error.toString());
  }
}

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });
}

async function getAppVersion() {
  try {
    const version = await invoke("get_app_version");
    document.getElementById("app-version").textContent = version;
  } catch (error) {
    console.error("Failed to get app version:", error);
  }
}

async function checkForUpdates() {
  try {
    const result = await invoke("check_update");
    showStatusMessage(result);
  } catch (error) {
    showStatusMessage(
      "Ошибка при проверке обновлений. Нажмите 'Подробнее' для деталей.",
      true,
      error.toString()
    );
  }
}

// Вызовите эту функцию после загрузки DOM
document.addEventListener('DOMContentLoaded', (event) => {
  disableContextMenu();
  statusMsgEl = document.querySelector("#status-msg");
  setupTabs();
  getAppVersion();
  checkForUpdates();

  document.querySelectorAll('.bat-button').forEach(button => {
    button.addEventListener('click', () => runBatFile(button.dataset.file));
  });

  document.querySelectorAll('.autostart').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => toggleAutostart(e.target.dataset.file, e.target.checked));
  });
});
