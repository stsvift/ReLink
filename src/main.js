const { invoke } = window.__TAURI__.core;

// Добавьте эту функцию в начало файла
function disableContextMenu() {
  document.addEventListener('contextmenu', event => event.preventDefault());
}

let statusMsgEl;
let statusMsgTimeout;

function showStatusMessage(message, isError = false, errorDetails = '', isUpdate = false) {
  clearTimeout(statusMsgTimeout);
  
  statusMsgEl.innerHTML = `
    <div class="message-header">
      <span class="icon">${isError ? '⚠️' : '✅'}</span>
      <span class="message">${message}</span>
      ${isError || isUpdate ? '<button class="close-btn">✖</button>' : ''}
    </div>
    ${errorDetails ? `<button class="details-btn">Подробнее</button>` : ''}
    ${errorDetails ? `<pre id="error-details" style="display: none;">${errorDetails}</pre>` : ''}
    ${isUpdate ? `
      <button class="install-btn">Установить обновление</button>
      <p class="update-warning">🦺 Внимание: После установки обновления компьютер может перезагрузиться.</p>
    ` : ''}
  `;
  statusMsgEl.className = 'status-msg';
  statusMsgEl.classList.remove('hide');
  statusMsgEl.classList.add('show');

  if (isError || isUpdate) {
    const closeBtn = statusMsgEl.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
      statusMsgEl.classList.add('hide');
      statusMsgEl.addEventListener('animationend', function hideStatusMsg() {
        statusMsgEl.classList.remove('show', 'hide');
        statusMsgEl.removeEventListener('animationend', hideStatusMsg);
      });
    });
  }

  if (errorDetails) {
    const detailsBtn = statusMsgEl.querySelector('.details-btn');
    const errorDetailsEl = statusMsgEl.querySelector('#error-details');
    
    detailsBtn.addEventListener('click', () => {
      errorDetailsEl.style.display = errorDetailsEl.style.display === 'none' ? 'block' : 'none';
      if (errorDetailsEl.style.display === 'block') {
        clearTimeout(statusMsgTimeout);
      } else {
        setAutoHideTimeout();
      }
    });
  }

  if (isUpdate) {
    const installBtn = statusMsgEl.querySelector('.install-btn');
    installBtn.addEventListener('click', installUpdate);
  }

  setAutoHideTimeout();
}

function setAutoHideTimeout() {
  statusMsgTimeout = setTimeout(() => {
    statusMsgEl.classList.add('hide');
    statusMsgEl.addEventListener('animationend', function hideStatusMsg() {
      statusMsgEl.classList.remove('show', 'hide');
      statusMsgEl.removeEventListener('animationend', hideStatusMsg);
    });
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
    showStatusMessage(result, false, '', true);
  } catch (error) {
    showStatusMessage(
      "Ошибка при проверке обновлений. Нажмите 'Подробнее' для деталей.",
      true,
      error.toString()
    );
  }
}

async function installUpdate() {
  try {
    await invoke("install_update");
    showStatusMessage("Обновление успешно установлено. Приложение будет перезапущено.");
    setTimeout(() => {
      window.__TAURI__.process.relaunch();
    }, 3000);
  } catch (error) {
    showStatusMessage(
      "Ошибка при установке обновления. Нажмите 'Подробнее' для деталей.",
      true,
      error.toString()
    );
  }
}

// Вызовите эту функцию после загрузки DOM
document.addEventListener('DOMContentLoaded', (event) => {
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

  // Добавьте периодическую проверку обновлений, например, каждый час
  setInterval(checkForUpdates, 3600000);
});
