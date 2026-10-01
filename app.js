const hours = document.querySelector('#hours');
const hoursValue = document.querySelector('#hoursValue');
const waitValue = document.querySelector('#waitValue');
const refreshButton = document.querySelector('#refreshButton');
const simulateButton = document.querySelector('#simulateButton');

hours.addEventListener('input', () => {
  const value = Number(hours.value);
  hoursValue.textContent = `${value} ore`;
  waitValue.innerHTML = `${42 - Math.round(value * 0.85)} giorni <small>↓ ${Math.round(value * 0.85)} giorni</small>`;
});

simulateButton.addEventListener('click', () => {
  simulateButton.innerHTML = 'Scenario applicato <span>✓</span>';
  simulateButton.style.background = '#195c42';
  setTimeout(() => {
    simulateButton.innerHTML = 'Applica scenario <span>→</span>';
    simulateButton.style.background = '';
  }, 2200);
});

refreshButton.addEventListener('click', () => {
  refreshButton.innerHTML = '✓ <span>Dati aggiornati</span>';
  setTimeout(() => { refreshButton.innerHTML = '↻ <span>Aggiorna dati</span>'; }, 1800);
});