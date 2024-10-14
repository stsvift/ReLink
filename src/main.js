const { invoke } = window.__TAURI__.core;

// Добавьте эту функцию в начало файла
function disableContextMenu() {
  document.addEventListener('contextmenu', event => event.preventDefault());
}

let statusMsgEl;
let statusMsgTimeout;

function showStatusMessage(message, isError = false, errorDetails = '', isUpdate = false) {
  if (!statusMsgEl) {
    console.error("Status message element not found");
    return;
  }

  clearTimeout(statusMsgTimeout);
  
  const hasUpdate = message.includes("Доступно обновление");
  
  statusMsgEl.innerHTML = `
    <div class="message-header">
      <span class="icon">${isError ? '⚠️' : '✅'}</span>
      <span class="message">${message}</span>
      <button class="close-btn">✖</button>
    </div>
    ${errorDetails ? `<button class="details-btn">Подробнее</button>` : ''}
    ${errorDetails ? `<pre id="error-details" style="display: none;">${errorDetails}</pre>` : ''}
    ${hasUpdate ? `
      <button class="install-btn">Установить обновление</button>
      <div class="update-warning">
        <span class="warning-icon">⚠️</span>
        <span>Внимание: После установки обновления компьютер может перезагрузиться.</span>
      </div>
    ` : ''}
  `;
  statusMsgEl.className = 'status-msg';
  statusMsgEl.classList.remove('hide');
  statusMsgEl.classList.add('show');

  const closeBtn = statusMsgEl.querySelector('.close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideStatusMessage);
  }

  if (errorDetails) {
    const detailsBtn = statusMsgEl.querySelector('.details-btn');
    const errorDetailsEl = statusMsgEl.querySelector('#error-details');
    
    if (detailsBtn && errorDetailsEl) {
      detailsBtn.addEventListener('click', () => {
        errorDetailsEl.style.display = errorDetailsEl.style.display === 'none' ? 'block' : 'none';
      });
    }
  }

  if (isUpdate) {
    const installBtn = statusMsgEl.querySelector('.install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', installUpdate);
    }
  }

  // Увеличиваем время отображения уведомления до 10 секунд
  statusMsgTimeout = setTimeout(hideStatusMessage, 10000);
}

function hideStatusMessage() {
  if (statusMsgEl) {
    statusMsgEl.classList.add('hide');
    statusMsgEl.addEventListener('animationend', function hideStatusMsg() {
      statusMsgEl.classList.remove('show', 'hide');
      statusMsgEl.removeEventListener('animationend', hideStatusMsg);
    });
  }
}

async function runBatFile(fileName) {
  try {
    const result = await invoke("run_bat_file", { fileName });
    console.log(result); // Выводим результат в консоль для отладки
    showStatusMessage(result);
  } catch (error) {
    console.error("Ошибка при запуске bat-файла:", error);
    showStatusMessage(`Не удалось запустить ${fileName}. Нажмите "Подробнее" для деталей.`, true, error.toString());
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

// Инициализация Bubbly
function initBubbly() {
  bubbly({
    colorStart: "#000000",
    colorStop: "#000000",
    bubbleFunc: () => `hsla(${Math.random() > 0.5 ? "0, 0%, 100%" : "28, 100%, 50%"}, ${Math.random() * 0.1})`,
    radiusFunc: () => 4 + Math.random() * 25,
    angleFunc: () => Math.random() > 0.5 ? 180 : 0,
    velocityFunc: () => 0.1 + Math.random() * 0.5,
    bubbles: 100,
    compose: "source-over",
    shadowColor: "rgba(255, 114, 0, 0.3)" // Цвет акцента (оранжевый) для теней
  });
}

// Вызовите эту функцию после загрузки DOM
document.addEventListener('DOMContentLoaded', (event) => {
  statusMsgEl = document.querySelector("#status-msg");
  if (!statusMsgEl) {
    console.error("Status message element not found in the DOM");
  }
  setupTabs();
  getAppVersion();
  checkForUpdates();

  document.querySelectorAll('.bat-button').forEach(button => {
    button.addEventListener('click', () => runBatFile(button.dataset.file));
  });

  initBubbly(); // Инициализация Bubbly

  // Добавьте периодическую проверку обновлений, например, каждый час
  setInterval(checkForUpdates, 3600000);
});
