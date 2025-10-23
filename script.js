//
// ======== SCRIPT.JS COMPLETO E CORRIGIDO ========
//
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyAEFhacJ2S6Stb38BVG3y9N7LAUsKj1PD6gjPS8R5B9_v6IqgYuC9BZ_QgxLw_ziaj/exec";

let currentStore = '', currentOperator = '', webcamStream = null, currentScannedBarcode = null, currentRecountBarcode = null, currentLotsData = [], isValidationRequired = false, lastScannedData = null, scanHistory = [];
let itemBeingEdited = null; // Guarda os dados do item que está sendo corrigido
let currentRecountPhase = 1;
let currentRecountLote = null;
let fullRecountList = [];

// --- Referências aos elementos do HTML ---
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

// --- FUNÇÃO PRINCIPAL DE PROCESSAMENTO DE IMAGEM ---
async function processImage(imageSource) {
  showLoading(true);
  const tempImage = document.createElement('img');
  tempImage.id = 'temp-scan-image';
  
  // --- INÍCIO DAS LINHAS DE DIAGNÓSTICO ---
  // Torna a imagem visível para debug
  tempImage.style.display = 'block'; 
  tempImage.style.maxWidth = '80%'; // Limita o tamanho para caber na tela
  tempImage.style.margin = '20px auto'; // Centraliza
  tempImage.style.border = '2px solid red'; // Borda para destacar
  document.body.insertBefore(tempImage, document.body.firstChild); // Adiciona no topo do body
  alert("Imagem capturada. Verifique se ela aparece claramente abaixo antes de clicar OK para processar.");
  // --- FIM DAS LINHAS DE DIAGNÓSTICO ---

  try {
      await new Promise((resolve, reject) => {
          tempImage.onload = resolve;
          tempImage.onerror = (err) => { 
            // Erro específico se a imagem nem carregar
            alert("ERRO CRÍTICO: O navegador não conseguiu carregar a imagem capturada. Problema de formato ou corrupção.\nDetalhe: " + JSON.stringify(err));
            showLoading(false);
            reject(err); 
          };
          tempImage.src = URL.createObjectURL(imageSource);
      });
      
      // ... (resto do código que tenta ler o barcode) ...
      // Você pode comentar temporariamente a parte que chama o ZXing se quiser apenas testar a exibição da imagem

      // Exemplo comentando a leitura para focar na exibição:
       let barcodeValue = null; 
       /* DESCOMENTE AS LINHAS ABAIXO DEPOIS DE VERIFICAR A IMAGEM
       if ('BarcodeDetector' in window) { ... } 
       else { ... } 
       if (barcodeValue) { ... } 
       else { ... }
       */
       alert("Simulação de processamento concluída (leitura comentada)."); // Mensagem temporária
       showLoading(false); // Para o spinner
      
  } catch (err) {
      // ... (código do catch) ...
  } finally {
      cameraInput.value = '';
      // Remove a imagem de debug após o processamento (ou erro)
      if (document.getElementById('temp-scan-image')) {
        document.body.removeChild(tempImage);
      }
  }
}

// --- FUNÇÕES DE CONTROLE DA INTERFACE ---
function onStart() {
    const selectedStore = storeSelect.value;
    const operatorName = operatorNameInput.value.trim();
    if (!selectedStore || !operatorName) { alert('Por favor, preencha todos os campos.'); return; }
    startBtn.disabled = true;
    startBtn.innerText = "Verificando...";
    const checkUrl = `${GOOGLE_SCRIPT_URL}?action=checkStatus&store=${encodeURIComponent(selectedStore)}`;
    fetch(checkUrl).then(response => response.json()).then(data => {
        currentStore = selectedStore;
        currentOperator = operatorName;

        if (data.status === "Em Andamento" || data.status === "Aberto") {
            const wantsToJoin = window.confirm(`Já existe um inventário "Em Andamento" para a ${selectedStore}.\n\nDeseja participar da contagem?`);
            if (wantsToJoin) { showScreen('scanner'); } else { resetLoginButton(); }
        } else if (data.status === "Em Recontagem") {
            const wantsToJoin = window.confirm(`A loja ${selectedStore} está em fase de RECONTAGEM 1.\n\nDeseja participar?`);
            if (wantsToJoin) {
                currentRecountPhase = 1; // Define a fase
                showScreen('recount');
                fetchRecountList(selectedStore, 1); // Carrega a lista da fase 1
            } else {
                resetLoginButton();
            }
        } else if (data.status === "Em Recontagem 2") { // <<< NOVO BLOCO LÓGICO
            const wantsToJoin = window.confirm(`A loja ${selectedStore} está na RECONTAGEM 2 (final).\n\nDeseja participar?`);
            if (wantsToJoin) {
                currentRecountPhase = 2; // Define a fase
                showScreen('recount');
                fetchRecountList(selectedStore, 2); // Carrega a lista da fase 2
            } else {
                resetLoginButton();
            }
        } else {
            alert(`Não há inventário ativo para a ${selectedStore}. Status atual: ${data.status || 'Fechado'}.`);
            resetLoginButton();
        }
    }).catch(error => { console.error("Erro ao verificar status:", error); alert("Não foi possível verificar o status do inventário."); resetLoginButton(); });
}
function resetLoginButton() { startBtn.disabled = false; startBtn.innerText = "Iniciar Contagem"; }

function showScreen(screenName) {
    loginScreen.classList.add('hidden');
    scannerScreen.classList.add('hidden');
    recountScreen.classList.add('hidden');
    if (screenName === 'scanner') {
        scannerScreen.classList.remove('hidden');
        if (isMobileDevice()) {
            mobileCameraBtn.classList.remove('hidden');
        } else {
            desktopWebcamBtn.classList.remove('hidden');
        }
        // LINHA ADICIONADA: Carrega o inventário da loja ao entrar na tela
        loadStoreInventory(); 
    } else if (screenName === 'recount') {
        recountScreen.classList.remove('hidden');
    } else {
        loginScreen.classList.remove('hidden');
    }
}

function fetchProductData(barcode) {
    currentScannedBarcode = barcode;
    showLoading(true);
    const fetchUrl = `${GOOGLE_SCRIPT_URL}?action=getProductData&barcode=${barcode}&store=${encodeURIComponent(currentStore)}`;
    fetch(fetchUrl).then(response => response.json()).then(data => {
        showLoading(false);
        lastScannedData = data;
        openItemModal(data);
    }).catch(error => {
        console.error("Erro ao buscar dados do produto:", error);
        alert("Não foi possível buscar os dados do produto. Tente novamente.");
        showLoading(false);
    });
}

// FUNÇÃO ATUALIZADA
function openItemModal(data) {
  productNameDisplay.textContent = data.productName || 'Produto Desconhecido';
  barcodeDisplay.textContent = `${currentScannedBarcode} (em ${data.uom || 'UN'})`;
  quantityLabel.textContent = `Quantidade (${data.uom || 'UN'}):`;
  
  // MUDANÇA CRUCIAL: Se data.lots não existir, usa uma lista vazia [].
  currentLotsData = data.lots || []; 
  isValidationRequired = (data.validationRequired === "Sim");

  lotSelect.innerHTML = '<option value="">Selecione um lote...</option>';
  
  // Agora o forEach é seguro, pois currentLotsData nunca será undefined.
  currentLotsData.forEach(lot => {
    const option = document.createElement('option');
    option.value = lot.lotNumber;
    option.textContent = lot.lotNumber; 
    lotSelect.appendChild(option);
  });
  lotSelect.innerHTML += '<option value="NOT_FOUND">--- Lote não encontrado ---</option>';

  // Limpa e reseta os campos
  quantityInput.value = '';
  manualLotInput.value = '';
  manualExpDateInput.value = '';
  manualLotFields.classList.add('hidden');
  expDateDisplayGroup.classList.add('hidden'); 
  
  if (itemBeingEdited) {
    if (String(itemBeingEdited.lot).startsWith('(MANUAL)')) {
      lotSelect.value = 'NOT_FOUND';
      const manualData = itemBeingEdited.lot.replace('(MANUAL) ', '').split(' | Val: ');
      manualLotInput.value = manualData[0] || '';
      manualExpDateInput.value = manualData[1] || '';
    } else {
      lotSelect.value = String(itemBeingEdited.lot);
    }
    quantityInput.value = itemBeingEdited.quantity;
    lotSelect.dispatchEvent(new Event('change'));
    itemBeingEdited = null; 
  }
  
  itemModal.classList.remove('hidden');
}

function saveData(dataPayload) {
    // Desabilita AMBOS os botões de salvar para evitar cliques duplos
    saveItemBtn.disabled = true;
    saveItemBtn.innerText = "Salvando...";
    saveManualEntryBtn.disabled = true; // <<< NOVO

    const postPayload = { ...dataPayload, action: 'saveCount' };
    
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(postPayload)
    }).then(response => response.json()).then(data => {
        if (data.result === 'Success') {
            // Fecha ambos os modais (apenas um estará aberto, mas isso garante o fechamento)
            itemModal.classList.add('hidden');
            manualEntryModal.classList.add('hidden'); // <<< NOVO
            
            // ATUALIZADO: Mantém a sua lógica correta de recarregar o inventário global
            loadStoreInventory(); 
            
        } else {
            throw new Error(data.message || 'Erro desconhecido ao salvar.');
        }
    }).catch(err => {
        console.error("Erro ao enviar os dados:", err);
        alert("Houve um erro ao salvar. Tente novamente.");
    }).finally(() => {
        // Reabilita AMBOS os botões, não importa o que aconteça
        saveItemBtn.disabled = false;
        saveItemBtn.innerText = "Salvar";
        saveManualEntryBtn.disabled = false; // <<< NOVO
    });
}

// FUNÇÃO ATUALIZADA
function renderScanHistory(itemsToRender) {
    // Recebe uma lista para exibir, ou usa o histórico global como padrão
    const list = itemsToRender || scanHistory;

    if (scanHistory.length > 0) { // O contêiner aparece se houver *qualquer* item no histórico
        scanHistoryContainer.classList.remove('hidden');
    } else {
        scanHistoryContainer.classList.add('hidden');
        return;
    }

    scanHistoryList.innerHTML = '';

    if (list.length === 0) {
        scanHistoryList.innerHTML = '<li>Nenhum item corresponde à sua busca.</li>';
        return;
    }

    // A lógica de renderização agora usa a 'list'
    list.slice().reverse().forEach(item => {
        // Encontra o índice original do item no array principal 'scanHistory'
        const originalIndex = scanHistory.findIndex(historyItem => historyItem.rowNumber === item.rowNumber);
        
        const li = document.createElement('li');
        const itemDetails = document.createElement('span');
        itemDetails.className = 'item-details';
        itemDetails.innerHTML = `<b>${item.productName}</b> | Lote: ${item.lot} | Qtd: ${item.quantity}`;
        
        const itemActions = document.createElement('div');
        itemActions.className = 'item-actions';
        itemActions.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/></svg>`;
        
        const editIcon = itemActions.querySelector('svg');
        editIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            editHistoryItem(originalIndex);
        });

        li.appendChild(itemDetails);
        li.appendChild(itemActions);
        scanHistoryList.appendChild(li);
    });
}

// NOVA FUNÇÃO
function editHistoryItem(index) {
    if (index < 0 || index >= scanHistory.length) return;

    const itemToEdit = scanHistory[index];
    const wantsToEdit = confirm(`Deseja corrigir a contagem de "${itemToEdit.productName}" (Lote: ${itemToEdit.lot})?\n\nA contagem atual (${itemToEdit.quantity}) será removida.`);

    if (wantsToEdit) {
        const payload = {
            action: 'deleteEntry',
            row: itemToEdit.rowNumber // Envia o número da linha para o script
        };

        // Mostra um feedback visual
        scanHistoryList.innerHTML = '<li>Removendo contagem antiga...</li>';

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(response => response.json()).then(data => {
            if (data.result === 'Success') {
                // Remove o item localmente
                scanHistory.splice(index, 1);
                // Guarda os dados para reabrir o modal
                itemBeingEdited = itemToEdit;
                // Busca os dados do produto para reabrir o modal com todas as opções
                fetchProductData(itemToEdit.barcode);
            } else {
                throw new Error(data.message || 'Erro ao deletar.');
            }
        }).catch(err => {
            alert("Não foi possível remover a contagem antiga. Tente novamente.");
            console.error(err);
            renderScanHistory(); // Redesenha a lista se der erro
        });
    }
}

function fetchRecountList(storeName, phase) {
  recountList.innerHTML = '<li>Carregando lista...</li>';
  const action = (phase === 2) ? 'getRecountList2' : 'getRecountList';
  const fetchUrl = `${GOOGLE_SCRIPT_URL}?action=${action}&store=${encodeURIComponent(storeName)}`;

  fetch(fetchUrl).then(response => response.json()).then(items => {
    fullRecountList = items; // Armazena a lista completa na variável global
    renderRecountList(fullRecountList); // Desenha a lista completa pela primeira vez
  }).catch(error => {
    console.error("Erro ao carregar lista de recontagem:", error);
    recountList.innerHTML = '<li>Erro ao carregar a lista.</li>';
  });
}

// NOVA FUNÇÃO 2: Apenas desenha a lista que recebe como parâmetro
function renderRecountList(itemsToRender) {
  recountList.innerHTML = '';
  if (itemsToRender.length === 0) {
    recountList.innerHTML = '<li>Nenhum item encontrado.</li>';
    return;
  }
  itemsToRender.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${item.productName}</b><br><small>Lote: ${item.lote}</small>`;
    li.dataset.barcode = item.barcode;
    li.dataset.lote = item.lote;
    li.addEventListener('click', () => {
      openRecountModal(item.barcode, item.lote, item.productName);
    });
    recountList.appendChild(li);
  });
}

function openRecountModal(barcode, lote, productName) { // <<< NOVO: Recebe lote e productName
    currentRecountBarcode = barcode;
    currentRecountLote = lote; // <<< NOVO: Guarda o lote atual
    recountModalTitle.textContent = productName; // Mostra o nome do produto
    recountModalSubtitle.textContent = `Recontagem do Lote: ${lote}`; // Mostra o lote
    newCountInput.value = '';
    justificationInput.value = '';
    recountModal.classList.remove('hidden');
    newCountInput.focus();
}

function saveRecountData() {
    const newCount = newCountInput.value;
    const justification = justificationInput.value.trim();
    if (newCount === '' || newCount < 0) { /* ... (validação) ... */ }
    if (justification === '') { /* ... (validação) ... */ }
    
    saveRecountBtn.disabled = true;
    saveRecountBtn.innerText = "Salvando...";
    const action = (currentRecountPhase === 2) ? 'submitRecount2' : 'submitRecount';
    
    const payload = {
        action: action,
        store: currentStore,
        barcode: currentRecountBarcode,
        lote: currentRecountLote, // <<< NOVO: Envia o lote no payload
        newCount: newCount,
        justification: justification
    };
    
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(response => response.json())
        .then(data => {
            if (data.result === 'Success') {
                alert('Recontagem salva com sucesso!');
                recountModal.classList.add('hidden');
                // Marca o item como concluído
                const li = document.querySelector(`#recount-list li[data-barcode="${currentRecountBarcode}"][data-lote="${currentRecountLote}"]`);
                if (li) { li.classList.add('completed'); li.onclick = null; }
            } else { throw new Error(data.message || 'Erro desconhecido'); }
        })
        .catch(error => { /* ... (código de erro) ... */ })
        .finally(() => { /* ... (reset do botão) ... */ });
}

async function populateCameraList() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        cameraSelect.innerHTML = '';
        if (videoDevices.length > 1) {
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Câmera ${cameraSelect.length + 1}`;
                cameraSelect.appendChild(option);
            });
            cameraSelect.classList.remove('hidden');
        } else {
            cameraSelect.classList.add('hidden');
        }
    } catch (err) {
        console.error("Erro ao listar câmeras:", err);
    }
}

async function startWebcam(deviceId = null) {
    stopWebcam();
    const constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    if (deviceId) { constraints.video.deviceId = { exact: deviceId }; }
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamVideo.srcObject = webcamStream;
        webcamModal.classList.remove('hidden');
        webcamModal.style.display = 'flex';
    } catch (err) {
        console.error("Erro ao acessar a webcam:", err);
        alert("Não foi possível acessar a webcam selecionada.");
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
    }
    webcamModal.classList.add('hidden');
    webcamModal.style.display = 'none';
}

function showLoading(isLoading) {
    if (isLoading) {
        desktopWebcamBtn.classList.add('hidden');
        mobileCameraBtn.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
        if (isMobileDevice()) {
            mobileCameraBtn.classList.remove('hidden');
        } else {
            desktopWebcamBtn.classList.remove('hidden');
        }
    }
}

function fetchStoreList() {
    fetch(GOOGLE_SCRIPT_URL)
        .then(response => response.json())
        .then(storeList => {
            storeSelect.innerHTML = '<option value="">Selecione uma loja</option>';
            storeList.forEach(storeName => {
                const option = document.createElement('option');
                option.value = storeName;
                option.textContent = storeName;
                storeSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Erro ao buscar lista de lojas:", error);
            storeSelect.innerHTML = '<option value="">Erro ao carregar lojas</option>';
        });
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
function loadStoreInventory() {
    scanHistoryList.innerHTML = '<li>Carregando contagens...</li>';
    const fetchUrl = `${GOOGLE_SCRIPT_URL}?action=getStoreInventory&store=${encodeURIComponent(currentStore)}`;
    
    fetch(fetchUrl)
        .then(response => response.json())
        .then(data => {
            scanHistory = data; // Substitui o histórico local pelo global
            renderScanHistory();
        })
        .catch(error => {
            console.error("Erro ao buscar o inventário da loja:", error);
            scanHistoryList.innerHTML = '<li>Erro ao carregar contagens.</li>';
        });
}

// --- EVENTOS DE BOTÕES ---
startBtn.addEventListener('click', onStart);
cameraInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        processImage(file);
    }
});
desktopWebcamBtn.addEventListener('click', async () => {
    await populateCameraList();
    const selectedCameraId = cameraSelect.value;
    startWebcam(selectedCameraId);
});
takePhotoBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;
    canvas.getContext('2d').drawImage(webcamVideo, 0, 0);
    stopWebcam();
    canvas.toBlob(blob => {
        processImage(blob);
    });
});
closeWebcamBtn.addEventListener('click', stopWebcam);
cameraSelect.addEventListener('change', () => {
    const selectedCameraId = cameraSelect.value;
    startWebcam(selectedCameraId);
});
lotSelect.addEventListener('change', () => {
    const selectedLotNumber = lotSelect.value;
    manualLotFields.classList.add('hidden');
    expDateDisplayGroup.classList.add('hidden');
    if (selectedLotNumber === 'NOT_FOUND') {
        manualLotFields.classList.remove('hidden');
    } else if (selectedLotNumber) {
        const selectedLotData = currentLotsData.find(lot => String(lot.lotNumber) === selectedLotNumber);
        if (selectedLotData && selectedLotData.expDate) {
            const date = new Date(selectedLotData.expDate);
            const formattedDate = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            expDateDisplayInput.value = formattedDate;
            expDateDisplayGroup.classList.remove('hidden');
        }
    }
});
cancelItemBtn.addEventListener('click', () => {
    itemModal.classList.add('hidden');
});
saveItemBtn.addEventListener('click', () => {
    const quantity = quantityInput.value;
    let lot = lotSelect.value;
    if (!quantity || parseFloat(quantity) <= 0) {
        alert("Por favor, insira uma quantidade válida.");
        return;
    }
    if (!lot) {
        alert("Por favor, selecione um lote.");
        return;
    }
    let dataToSend;
    if (lot === 'NOT_FOUND') {
        const manualLot = manualLotInput.value.trim();
        const manualExpDate = manualExpDateInput.value;
        if (!manualLot) {
            alert("Por favor, insira o número do lote manual.");
            return;
        }
        if (isValidationRequired && !manualExpDate) {
            alert("Este produto exige o preenchimento da Data de Validade. Por favor, preencha o campo.");
            return;
        }
        let lotString = `(MANUAL) ${manualLot}`;
        if (manualExpDate) {
            lotString += ` | Val: ${manualExpDate}`;
        }
        dataToSend = {
            barcode: currentScannedBarcode,
            store: currentStore,
            operator: currentOperator,
            lot: lotString,
            quantity: quantity
        };
    } else {
        dataToSend = {
            barcode: currentScannedBarcode,
            store: currentStore,
            operator: currentOperator,
            lot: lot,
            quantity: quantity
        };
    }
    saveData(dataToSend);
});
cancelRecountBtn.addEventListener('click', () => recountModal.classList.add('hidden'));
saveRecountBtn.addEventListener('click', saveRecountData);
recoverLastItemBtn.addEventListener('click', () => {
    if (lastScannedData) {
        openItemModal(lastScannedData);
    } else {
        alert('Nenhum item foi escaneado nesta sessão ainda.');
    }
});
searchHistoryInput.addEventListener('keyup', () => {
    const searchTerm = searchHistoryInput.value.toLowerCase();

    // Filtra o array principal 'scanHistory'
    const filteredHistory = scanHistory.filter(item => {
        // Busca no nome do produto (case-insensitive)
        return item.productName.toLowerCase().includes(searchTerm);
    });

    // Chama a função de renderização passando apenas a lista filtrada
    renderScanHistory(filteredHistory);
});
manualEntryBtn.addEventListener('click', () => {
    // Limpa os campos antes de abrir
    manualBarcode.value = '';
    manualProductName.value = '';
    manualModalLot.value = '';
    manualModalExpDate.value = '';
    manualModalQuantity.value = '';
    manualEntryModal.classList.remove('hidden');
    manualBarcode.focus(); // Foca no primeiro campo
});

// Fecha o modal
cancelManualEntryBtn.addEventListener('click', () => {
    manualEntryModal.classList.add('hidden');
});

// Salva os dados inseridos manualmente
saveManualEntryBtn.addEventListener('click', () => {
    const barcode = manualBarcode.value.trim();
    const productName = manualProductName.value.trim();
    const lot = manualModalLot.value.trim();
    const expDate = manualModalExpDate.value;
    const quantity = manualModalQuantity.value;

    // Validação simples
    if (!barcode || !productName || !quantity) {
        alert('Por favor, preencha pelo menos o Código de Barras, Nome do Produto e Quantidade.');
        return;
    }

    // Formata o lote e a validade em uma única string, como já fazemos
    let lotString = lot;
    if (expDate) {
        lotString += ` | Val: ${expDate}`;
    }
    
    // Cria o payload para enviar
    const dataToSend = { 
        barcode: barcode,
        store: currentStore, 
        operator: currentOperator, 
        lot: lotString,
        quantity: quantity,
        entryType: 'Manual' // <<< NOVO: Informa ao backend que a entrada é manual
    };
    
    // Reutiliza a nossa função de salvar, que agora é inteligente
    saveData(dataToSend);
    
    // Fecha o modal após o salvamento (a função saveData já lida com o feedback)
    manualEntryModal.classList.add('hidden');
});
searchRecountInput.addEventListener('keyup', () => {
  const searchTerm = searchRecountInput.value.toLowerCase();

  // Filtra a lista principal de recontagem
  const filteredList = fullRecountList.filter(item => {
    return item.productName.toLowerCase().includes(searchTerm);
  });

  // Chama a função de renderização passando apenas a lista filtrada
  renderRecountList(filteredList);
});
// --- INICIA O APLICATIVO ---
fetchStoreList();