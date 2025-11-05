const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsY6vr4eJbOZ_lzggaYQSlapWkjXk1Z7SPGs3mtYYT-Nii5v15_xvXg0ZnMGJYpXNV/exec";

let currentStore = '', currentOperator = '', webcamStream = null, currentScannedBarcode = null, currentRecountBarcode = null, currentLotsData = [], isValidationRequired = false, lastScannedData = null, scanHistory = [];
let itemBeingEdited = null;
let currentRecountPhase = 1;
let currentRecountLote = null;
let fullRecountList = [];

const loginScreen = document.getElementById('login-screen');
const scannerScreen = document.getElementById('scanner-screen');
const recountScreen = document.getElementById('recount-screen');
const storeSelect = document.getElementById('store-select');
const operatorNameInput = document.getElementById('operator-name');
const startBtn = document.getElementById('start-btn');
const cameraInput = document.getElementById('camera-input');
const mobileCameraBtn = document.getElementById('mobile-camera-btn');
const desktopWebcamBtn = document.getElementById('desktop-webcam-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const itemModal = document.getElementById('item-modal');
const productNameDisplay = document.getElementById('product-name-display');
const barcodeDisplay = document.getElementById('item-barcode-display');
const lotSelect = document.getElementById('lot-select');
const manualLotFields = document.getElementById('manual-lot-fields');
const manualLotInput = document.getElementById('manual-lot-input');
const manualExpDateInput = document.getElementById('manual-exp-date-input');
const quantityLabel = document.getElementById('quantity-label');
const quantityInput = document.getElementById('quantity-input');
const saveItemBtn = document.getElementById('save-item-btn');
const cancelItemBtn = document.getElementById('cancel-item-btn');
const recountList = document.getElementById('recount-list');
const recountModal = document.getElementById('recount-modal');
const recountBarcodeDisplay = document.getElementById('recount-barcode-display');
const newCountInput = document.getElementById('new-count-input');
const justificationInput = document.getElementById('justification-input');
const saveRecountBtn = document.getElementById('save-recount-btn');
const cancelRecountBtn = document.getElementById('cancel-recount-btn');
const webcamModal = document.getElementById('webcam-modal');
const webcamVideo = document.getElementById('webcam-video');
const takePhotoBtn = document.getElementById('take-photo-btn');
const closeWebcamBtn = document.getElementById('close-webcam-btn');
const cameraSelect = document.getElementById('camera-select');
const expDateDisplayGroup = document.getElementById('exp-date-display-group');
const expDateDisplayInput = document.getElementById('exp-date-display-input');
const recoverLastItemBtn = document.getElementById('recover-last-item-btn');
const scanHistoryContainer = document.getElementById('scan-history-container');
const scanHistoryList = document.getElementById('scan-history-list');
const searchHistoryInput = document.getElementById('search-history-input');
const manualEntryBtn = document.getElementById('manual-entry-btn');
const manualEntryModal = document.getElementById('manual-entry-modal');
const manualBarcode = document.getElementById('manual-barcode-input');
const manualProductName = document.getElementById('manual-product-name-input');
const manualModalLot = document.getElementById('manual-modal-lot-input');
const manualModalExpDate = document.getElementById('manual-modal-exp-date-input');
const manualModalQuantity = document.getElementById('manual-modal-quantity-input');
const saveManualEntryBtn = document.getElementById('save-manual-entry-btn');
const cancelManualEntryBtn = document.getElementById('cancel-manual-entry-btn');
const recountModalTitle = document.getElementById('recountModalTitle');
const recountModalSubtitle = document.getElementById('recountModalSubtitle');
const searchRecountInput = document.getElementById('search-recount-input');
const refreshRecountListBtn = document.getElementById('refresh-recount-list-btn');

async function processImage(imageSource) {
  showLoading(true);
  let imageToProcess = imageSource;
  if (imageSource && (imageSource.type.startsWith('image/heic') || imageSource.type.startsWith('image/heif'))) {
      console.log("Formato HEIC/HEIF detectado. Iniciando conversão para JPEG...");
      try {
          const convertedBlob = await heic2any({ blob: imageSource, toType: "image/jpeg", quality: 0.8 });
          console.log("Conversão HEIC para JPEG bem-sucedida.");
          imageToProcess = convertedBlob;
      } catch (conversionError) {
          console.error("Falha na conversão HEIC:", conversionError);
          alert("Ocorreu um erro ao converter a imagem HEIC capturada. Tente novamente ou use o formato 'Mais Compatível' na câmera.");
          showLoading(false); return;
      }
  }
  const tempImage = document.createElement('img');
  tempImage.id = 'temp-scan-image';
  tempImage.style.display = 'none';
  document.body.appendChild(tempImage);
  try {
      const imageUrl = URL.createObjectURL(imageToProcess);
      await new Promise((resolve, reject) => {
          tempImage.onload = resolve;
          tempImage.onerror = (err) => { console.error("Erro ao carregar imagem para processamento:", err); alert("ERRO: O navegador não conseguiu carregar a imagem para processamento."); showLoading(false); reject(err); };
          tempImage.src = imageUrl;
      });
      URL.revokeObjectURL(imageUrl);
      let barcodeValue = null;
      if ('BarcodeDetector' in window) {
          const barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'code_128'] });
          try { const barcodes = await barcodeDetector.detect(tempImage); if (barcodes.length > 0) { barcodeValue = barcodes[0].rawValue; } else { console.log("BarcodeDetector ran but found no barcodes. Falling back to ZXing."); } } catch (detectorError) { console.error("BarcodeDetector failed:", detectorError); console.log("Falling back to ZXing..."); }
      }
      if (barcodeValue === null) {
          console.log("Attempting fallback with ZXing..."); const hints = new Map(); const formats = [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.CODE_128]; hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats); hints.set(ZXing.DecodeHintType.TRY_HARDER, true); const codeReader = new ZXing.BrowserMultiFormatReader(hints); try { const result = await codeReader.decodeFromImage(tempImage.id); barcodeValue = result.getText(); } catch(zxingError) { console.error("ZXing failed:", zxingError); }
      }
      if (barcodeValue) { fetchProductData(barcodeValue); } else { alert('Nenhum código de barras foi encontrado na imagem. Verifique a iluminação, foco e enquadramento.'); showLoading(false); }
  } catch (err) { console.error("Erro geral no processamento da imagem:", err); alert('Ocorreu um erro inesperado ao processar a imagem.\nDetalhe: ' + err.message); showLoading(false); } finally { cameraInput.value = ''; if (document.getElementById('temp-scan-image')) { document.body.removeChild(tempImage); } }
}

function onStart() {
    const selectedStore = storeSelect.value;
    const operatorName = operatorNameInput.value.trim();
    if (!selectedStore || !operatorName) { alert('Por favor, preencha todos os campos.'); return; }
    startBtn.disabled = true; startBtn.innerText = "Verificando...";
    const checkUrl = `${GOOGLE_SCRIPT_URL}?action=checkStatus&store=${encodeURIComponent(selectedStore)}`;
    fetch(checkUrl).then(response => response.json()).then(data => {
        currentStore = selectedStore; currentOperator = operatorName;
        if (data.status === "Em Andamento" || data.status === "Aberto") { const wantsToJoin = window.confirm(`Já existe um inventário "Em Andamento" para a ${selectedStore}.\n\nDeseja participar da contagem?`); if (wantsToJoin) { showScreen('scanner'); } else { resetLoginButton(); } } else if (data.status === "Em Recontagem") { const wantsToJoin = window.confirm(`A loja ${selectedStore} está em fase de RECONTAGEM 1.\n\nDeseja participar?`); if (wantsToJoin) { currentRecountPhase = 1; showScreen('recount'); fetchRecountList(selectedStore, 1); } else { resetLoginButton(); } } else if (data.status === "Em Recontagem 2") { const wantsToJoin = window.confirm(`A loja ${selectedStore} está na RECONTAGEM 2 (final).\n\nDeseja participar?`); if (wantsToJoin) { currentRecountPhase = 2; showScreen('recount'); fetchRecountList(selectedStore, 2); } else { resetLoginButton(); } } else { alert(`Não há inventário ativo para a ${selectedStore}. Status atual: ${data.status || 'Fechado'}.`); resetLoginButton(); }
    }).catch(error => { console.error("Erro ao verificar status:", error); alert("Não foi possível verificar o status do inventário."); resetLoginButton(); });
}
function resetLoginButton() { startBtn.disabled = false; startBtn.innerText = "Iniciar Contagem"; }

function showScreen(screenName) {
    loginScreen.classList.add('hidden'); scannerScreen.classList.add('hidden'); recountScreen.classList.add('hidden');
    if (screenName === 'scanner') { scannerScreen.classList.remove('hidden'); if (isMobileDevice()) { mobileCameraBtn.classList.remove('hidden'); } else { desktopWebcamBtn.classList.remove('hidden'); } loadStoreInventory(); } else if (screenName === 'recount') { recountScreen.classList.remove('hidden'); } else { loginScreen.classList.remove('hidden'); }
}

function fetchProductData(barcode) {
  currentScannedBarcode = barcode; showLoading(true);
  const fetchUrl = `${GOOGLE_SCRIPT_URL}?action=getProductData&barcode=${barcode}&store=${encodeURIComponent(currentStore)}`;
  fetch(fetchUrl).then(response => response.json()).then(data => {
      showLoading(false);
      if (data.productName === "Produto não encontrado") { openManualEntryForNotFound(barcode); } else { lastScannedData = data; openItemModal(data); }
  }).catch(error => { console.error("Erro ao buscar dados do produto:", error); alert("Não foi possível buscar os dados do produto. Verifique a conexão e tente novamente."); showLoading(false); });
}

function openItemModal(data) {
  productNameDisplay.textContent = data.productName || 'Produto Desconhecido'; barcodeDisplay.textContent = `${currentScannedBarcode} (em ${data.uom || 'UN'})`; quantityLabel.textContent = `Quantidade (${data.uom || 'UN'}):`;
  currentLotsData = data.lots || []; isValidationRequired = (data.validationRequired === "Sim");
  lotSelect.innerHTML = '<option value="">Selecione um lote...</option>';
  currentLotsData.forEach(lot => { const option = document.createElement('option'); option.value = lot.lotNumber; option.textContent = lot.lotNumber; lotSelect.appendChild(option); });
  lotSelect.innerHTML += '<option value="NOT_FOUND">--- Lote não encontrado ---</option>';
  quantityInput.value = ''; manualLotInput.value = ''; manualExpDateInput.value = ''; manualLotFields.classList.add('hidden'); expDateDisplayGroup.classList.add('hidden');
  if (itemBeingEdited) { if (String(itemBeingEdited.lot).startsWith('(MANUAL)')) { lotSelect.value = 'NOT_FOUND'; const manualData = itemBeingEdited.lot.replace('(MANUAL) ', '').split(' | Val: '); manualLotInput.value = manualData[0] || ''; manualExpDateInput.value = manualData[1] || ''; } else { lotSelect.value = String(itemBeingEdited.lot); } quantityInput.value = itemBeingEdited.quantity; lotSelect.dispatchEvent(new Event('change')); itemBeingEdited = null; }
  itemModal.classList.remove('hidden');
}

function saveData(dataPayload) {
    saveItemBtn.disabled = true; saveItemBtn.innerText = "Salvando..."; saveManualEntryBtn.disabled = true;
    const postPayload = { ...dataPayload, action: 'saveCount' };
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(postPayload) }).then(response => response.json()).then(data => {
        if (data.result === 'Success') { itemModal.classList.add('hidden'); manualEntryModal.classList.add('hidden'); loadStoreInventory(); } else { throw new Error(data.message || 'Erro desconhecido ao salvar.'); }
    }).catch(err => { console.error("Erro ao enviar os dados:", err); alert("Houve um erro ao salvar. Tente novamente."); }).finally(() => { saveItemBtn.disabled = false; saveItemBtn.innerText = "Salvar"; saveManualEntryBtn.disabled = false; });
}

function renderScanHistory(itemsToRender) {
    const list = itemsToRender || scanHistory;
    if (scanHistory.length > 0) { scanHistoryContainer.classList.remove('hidden'); } else { scanHistoryContainer.classList.add('hidden'); return; }
    scanHistoryList.innerHTML = '';
    if (list.length === 0) { scanHistoryList.innerHTML = '<li>Nenhum item corresponde à sua busca.</li>'; return; }
    list.slice().reverse().forEach(item => {
        const originalIndex = scanHistory.findIndex(historyItem => historyItem.rowNumber === item.rowNumber);
        const li = document.createElement('li'); const itemDetails = document.createElement('span'); itemDetails.className = 'item-details'; itemDetails.innerHTML = `<b>${item.productName}</b> | Lote: ${item.lot} | Qtd: ${item.quantity}`;
        const itemActions = document.createElement('div'); itemActions.className = 'item-actions'; itemActions.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/></svg>`;
        const editIcon = itemActions.querySelector('svg'); editIcon.addEventListener('click', (e) => { e.stopPropagation(); editHistoryItem(originalIndex); });
        li.appendChild(itemDetails); li.appendChild(itemActions); scanHistoryList.appendChild(li);
    });
}

function editHistoryItem(index) {
    if (index < 0 || index >= scanHistory.length) return;
    const itemToEdit = scanHistory[index];
    const wantsToEdit = confirm(`Deseja corrigir a contagem de "${itemToEdit.productName}" (Lote: ${itemToEdit.lot})?\n\nA contagem atual (${itemToEdit.quantity}) será removida.`);
    if (wantsToEdit) {
        const payload = { action: 'deleteEntry', row: itemToEdit.rowNumber };
        scanHistoryList.innerHTML = '<li>Removendo contagem antiga...</li>';
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) }).then(response => response.json()).then(data => {
            if (data.result === 'Success') { scanHistory.splice(index, 1); itemBeingEdited = itemToEdit; fetchProductData(itemToEdit.barcode); } else { throw new Error(data.message || 'Erro ao deletar.'); }
        }).catch(err => { alert("Não foi possível remover a contagem antiga. Tente novamente."); console.error(err); renderScanHistory(); });
    }
}

function fetchRecountList(storeName, phase) {
  recountList.innerHTML = '<li>Carregando lista...</li>';
  const action = (phase === 2) ? 'getRecountList2' : 'getRecountList';
  const fetchUrl = `${GOOGLE_SCRIPT_URL}?action=${action}&store=${encodeURIComponent(storeName)}`;
  fetch(fetchUrl).then(response => response.json()).then(items => {
    fullRecountList = items; renderRecountList(fullRecountList);
  }).catch(error => { console.error("Erro ao carregar lista de recontagem:", error); recountList.innerHTML = '<li>Erro ao carregar a lista.</li>'; });
}

function renderRecountList(itemsToRender) {
  recountList.innerHTML = '';
  if (itemsToRender.length === 0) { recountList.innerHTML = '<li>Nenhum item encontrado.</li>'; return; }
  itemsToRender.forEach(item => {
    const li = document.createElement('li'); li.innerHTML = `<b>${item.productName}</b><br><small>Lote: ${item.lote}</small>`; li.dataset.barcode = item.barcode; li.dataset.lote = item.lote;
    li.addEventListener('click', () => { openRecountModal(item.barcode, item.lote, item.productName); });
    recountList.appendChild(li);
  });
}

function openRecountModal(barcode, lote, productName) {
    currentRecountBarcode = barcode; currentRecountLote = lote;
    recountModalTitle.textContent = productName; recountModalSubtitle.textContent = `Recontagem do Lote: ${lote}`;
    newCountInput.value = ''; justificationInput.value = '';
    recountModal.classList.remove('hidden'); newCountInput.focus();
}

function saveRecountData() {
  const newCount = newCountInput.value; const justification = justificationInput.value.trim();
  if (newCount === '' || newCount < 0) { alert("Por favor, insira uma nova quantidade válida (maior ou igual a zero)."); return; }
  saveRecountBtn.disabled = true; saveRecountBtn.innerText = "Salvando...";
  const action = (currentRecountPhase === 2) ? 'submitRecount2' : 'submitRecount';
  const payload = { action: action, store: currentStore, barcode: currentRecountBarcode, lote: currentRecountLote, newCount: newCount, justification: justification };

  // --- ALTERAÇÃO AQUI: Linha 'headers' removida ---
  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload) // Envia o JSON como string
    // Sem o header 'Content-Type: application/json'
  })
    .then(response => { if (!response.ok) { throw new Error(`Erro de rede ou servidor: ${response.statusText} (${response.status})`); } return response.json(); })
    .then(data => { if (data.result === 'Success') { recountModal.classList.add('hidden'); const li = document.querySelector(`#recount-list li[data-barcode="${currentRecountBarcode}"][data-lote="${currentRecountLote}"]`); if (li) { li.classList.add('completed'); li.onclick = null; } } else { throw new Error(data.message || 'Erro desconhecido retornado pelo script.'); } })
    .catch(error => { console.error("Erro ao salvar recontagem:", error); alert(`Falha ao salvar a recontagem: ${error.message}\n\nTente novamente.`); })
    .finally(() => { saveRecountBtn.disabled = false; saveRecountBtn.innerText = "Salvar Recontagem"; newCountInput.value = ''; justificationInput.value = ''; });
}

async function populateCameraList() {
    try { const devices = await navigator.mediaDevices.enumerateDevices(); const videoDevices = devices.filter(device => device.kind === 'videoinput'); cameraSelect.innerHTML = ''; if (videoDevices.length > 1) { videoDevices.forEach(device => { const option = document.createElement('option'); option.value = device.deviceId; option.text = device.label || `Câmera ${cameraSelect.length + 1}`; cameraSelect.appendChild(option); }); cameraSelect.classList.remove('hidden'); } else { cameraSelect.classList.add('hidden'); } } catch (err) { console.error("Erro ao listar câmeras:", err); }
}

async function startWebcam(deviceId = null) {
    stopWebcam(); const constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } } }; if (deviceId) { constraints.video.deviceId = { exact: deviceId }; } try { webcamStream = await navigator.mediaDevices.getUserMedia(constraints); webcamVideo.srcObject = webcamStream; webcamModal.classList.remove('hidden'); webcamModal.style.display = 'flex'; } catch (err) { console.error("Erro ao acessar a webcam:", err); alert("Não foi possível acessar a webcam selecionada."); }
}

function stopWebcam() {
    if (webcamStream) { webcamStream.getTracks().forEach(track => track.stop()); } webcamModal.classList.add('hidden'); webcamModal.style.display = 'none';
}

function showLoading(isLoading) {
    if (isLoading) { desktopWebcamBtn.classList.add('hidden'); mobileCameraBtn.classList.add('hidden'); loadingSpinner.classList.remove('hidden'); } else { loadingSpinner.classList.add('hidden'); if (isMobileDevice()) { mobileCameraBtn.classList.remove('hidden'); } else { desktopWebcamBtn.classList.remove('hidden'); } }
}

function fetchStoreList() {
    fetch(GOOGLE_SCRIPT_URL).then(response => response.json()).then(storeList => {
        storeSelect.innerHTML = '<option value="">Selecione uma loja</option>'; storeList.forEach(storeName => { const option = document.createElement('option'); option.value = storeName; option.textContent = storeName; storeSelect.appendChild(option); });
    }).catch(error => { console.error("Erro ao buscar lista de lojas:", error); storeSelect.innerHTML = '<option value="">Erro ao carregar lojas</option>'; });
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
function loadStoreInventory() {
    scanHistoryList.innerHTML = '<li>Carregando contagens...</li>';
    const fetchUrl = `${GOOGLE_SCRIPT_URL}?action=getStoreInventory&store=${encodeURIComponent(currentStore)}`;
    fetch(fetchUrl).then(response => response.json()).then(data => { scanHistory = data; renderScanHistory(); }).catch(error => { console.error("Erro ao buscar o inventário da loja:", error); scanHistoryList.innerHTML = '<li>Erro ao carregar contagens.</li>'; });
}

function openManualEntryForNotFound(scannedBarcode) {
  manualBarcode.value = scannedBarcode || ''; manualProductName.value = ''; manualModalLot.value = ''; manualModalExpDate.value = ''; manualModalQuantity.value = '';
  manualEntryModal.classList.remove('hidden'); manualProductName.focus();
}

fetchStoreList();

document.addEventListener('DOMContentLoaded', function() {
    startBtn.addEventListener('click', onStart);
    cameraInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (file) { processImage(file); } });
    desktopWebcamBtn.addEventListener('click', async () => { await populateCameraList(); const selectedCameraId = cameraSelect.value; startWebcam(selectedCameraId); });
    takePhotoBtn.addEventListener('click', () => { const canvas = document.createElement('canvas'); canvas.width = webcamVideo.videoWidth; canvas.height = webcamVideo.videoHeight; canvas.getContext('2d').drawImage(webcamVideo, 0, 0); stopWebcam(); canvas.toBlob(blob => { processImage(blob); }); });
    closeWebcamBtn.addEventListener('click', stopWebcam);
    cameraSelect.addEventListener('change', () => { const selectedCameraId = cameraSelect.value; startWebcam(selectedCameraId); });
    lotSelect.addEventListener('change', () => { const selectedLotNumber = lotSelect.value; manualLotFields.classList.add('hidden'); expDateDisplayGroup.classList.add('hidden'); if (selectedLotNumber === 'NOT_FOUND') { manualLotFields.classList.remove('hidden'); } else if (selectedLotNumber) { const selectedLotData = currentLotsData.find(lot => String(lot.lotNumber) === selectedLotNumber); if (selectedLotData && selectedLotData.expDate) { const date = new Date(selectedLotData.expDate); const formattedDate = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); expDateDisplayInput.value = formattedDate; expDateDisplayGroup.classList.remove('hidden'); } } });
    cancelItemBtn.addEventListener('click', () => { itemModal.classList.add('hidden'); });
    saveItemBtn.addEventListener('click', () => { const quantity = quantityInput.value; let lot = lotSelect.value; if (!quantity || parseFloat(quantity) <= 0) { alert("Por favor, insira uma quantidade válida."); return; } if (!lot) { alert("Por favor, selecione um lote."); return; } let dataToSend; if (lot === 'NOT_FOUND') { const manualLot = manualLotInput.value.trim(); const manualExpDate = manualExpDateInput.value; if (!manualLot) { alert("Por favor, insira o número do lote manual."); return; } if (isValidationRequired && !manualExpDate) { alert("Este produto exige o preenchimento da Data de Validade. Por favor, preencha o campo."); return; } let lotString = `(MANUAL) ${manualLot}`; if (manualExpDate) { lotString += ` | Val: ${manualExpDate}`; } dataToSend = { barcode: currentScannedBarcode, store: currentStore, operator: currentOperator, lot: lotString, quantity: quantity }; } else { dataToSend = { barcode: currentScannedBarcode, store: currentStore, operator: currentOperator, lot: lot, quantity: quantity }; } saveData(dataToSend); });
    cancelRecountBtn.addEventListener('click', () => recountModal.classList.add('hidden'));
    saveRecountBtn.addEventListener('click', saveRecountData);
    recoverLastItemBtn.addEventListener('click', () => { if (lastScannedData) { openItemModal(lastScannedData); } else { alert('Nenhum item foi escaneado nesta sessão ainda.'); } });
    searchHistoryInput.addEventListener('keyup', () => { const searchTerm = searchHistoryInput.value.toLowerCase(); const filteredHistory = scanHistory.filter(item => { return item.productName.toLowerCase().includes(searchTerm); }); renderScanHistory(filteredHistory); });
    manualBarcode.addEventListener('keydown', function(event) {
        // Verifica se a tecla pressionada foi 'Enter'
        if (event.key === 'Enter') {
            event.preventDefault(); // Impede o comportamento padrão de "submit"
            
            const barcode = manualBarcode.value.trim();

            if (barcode) {
                // 1. Fecha o modal de entrada manual
                manualEntryModal.classList.add('hidden');
                
                // 2. Chama a MESMA função que o scanner da câmera usa
                //    Esta função já sabe exatamente o que fazer:
                //    - Se achar, abre o modal de lotes (openItemModal)
                //    - Se não achar, abre este modal de novo (openManualEntryForNotFound)
                fetchProductData(barcode);
            }
        }
    });
    manualEntryBtn.addEventListener('click', () => { manualBarcode.value = ''; manualProductName.value = ''; manualModalLot.value = ''; manualModalExpDate.value = ''; manualModalQuantity.value = ''; manualEntryModal.classList.remove('hidden'); manualBarcode.focus(); });
    cancelManualEntryBtn.addEventListener('click', () => { manualEntryModal.classList.add('hidden'); });
    saveManualEntryBtn.addEventListener('click', () => { const barcode = manualBarcode.value.trim(); const productName = manualProductName.value.trim(); const lot = manualModalLot.value.trim(); const expDate = manualModalExpDate.value; const quantity = manualModalQuantity.value; if (!barcode || !productName || !quantity) { alert('Por favor, preencha pelo menos o Código de Barras, Nome do Produto e Quantidade.'); return; } let lotString = lot; if (expDate) { lotString += ` | Val: ${expDate}`; } const dataToSend = { barcode: barcode, store: currentStore, operator: currentOperator, lot: lotString, quantity: quantity, entryType: 'Manual' }; saveData(dataToSend); manualEntryModal.classList.add('hidden'); });
    searchRecountInput.addEventListener('keyup', () => { const searchTerm = searchRecountInput.value.toLowerCase(); const filteredList = fullRecountList.filter(item => { return item.productName.toLowerCase().includes(searchTerm); }); renderRecountList(filteredList); });
    refreshRecountListBtn.addEventListener('click', () => { fetchRecountList(currentStore, currentRecountPhase); searchRecountInput.value = ''; });
});