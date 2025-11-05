const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsY6vr4eJbOZ_lzggaYQSlapWkjXk1Z7SPGs3mtYYT-Nii5v15_xvXg0ZnMGJYpXNV/exec"; // !! VERIFIQUE SE ESTA URL ESTÁ ATUALIZADA !!

// --- Referências aos Elementos ---
const storeSelect = document.getElementById('store-select-manager');
const controlsDiv = document.getElementById('controls');
const currentStatusText = document.getElementById('current-status-text');
const actionButton = document.getElementById('action-button');
let storeData = [];

// --- FUNÇÕES PRINCIPAIS ---

// Busca os dados das lojas e preenche o seletor (Não mudou)
function initializePanel() {
    const currentSelection = storeSelect.value;
    storeSelect.innerHTML = '<option value="">Carregando...</option>';
    if (!currentSelection) {
        controlsDiv.classList.add('hidden');
    }
    const fetchUrl = `${GOOGLE_SCRIPT_URL}?action=getStoreStatuses`;
    fetch(fetchUrl)
        .then(response => response.json())
        .then(data => {
            storeData = data;
            storeSelect.innerHTML = '<option value="">Selecione uma loja</option>';
            data.forEach(store => {
                const option = document.createElement('option');
                option.value = store.name;
                option.textContent = store.name;
                storeSelect.appendChild(option);
            });
            if (currentSelection) {
                storeSelect.value = currentSelection;
                storeSelect.dispatchEvent(new Event('change'));
            }
        }).catch(error => {
            console.error("Erro ao buscar status das lojas:", error);
            alert("Não foi possível carregar os dados das lojas.");
        });
}

// Atualiza a UI do botão com base no status da loja (Não mudou)
function updateButtonUI(status) {
    actionButton.className = "";
    actionButton.disabled = true;
    actionButton.onclick = null; // Limpa o clique anterior
    switch (status) {
        case "Aberto":
            actionButton.innerText = "Iniciar Inventário";
            actionButton.classList.add("btn-start");
            actionButton.disabled = false;
            actionButton.onclick = () => handleStatusUpdate("Em Andamento");
            break;
        case "Em Andamento":
            actionButton.innerText = "Gerar Recontagem 1";
            actionButton.classList.add("btn-recount");
            actionButton.disabled = false;
            actionButton.onclick = () => handleGenerateRecount(); 
            break;
        case "Em Recontagem":
            actionButton.innerText = "Finalizar Inventário (Etapa 1)";
            actionButton.classList.add("btn-finalize");
            actionButton.disabled = false;
            actionButton.onclick = () => handleStatusUpdate("Finalizado");
            break;
        case "Em Recontagem 2":
            actionButton.innerText = "Finalizar Inventário (Etapa 2)";
            actionButton.classList.add("btn-finalize");
            actionButton.disabled = false;
            actionButton.onclick = () => handleStatusUpdate("Concluído");
            break;
        default:
            actionButton.innerText = `Status Atual: ${status}`;
            actionButton.disabled = true;
            break;
    }
}

//
// --- FUNÇÕES ATUALIZADAS ---
//

// Lida com cliques que apenas mudam o status (Atualizado para POST)
function handleStatusUpdate(newStatus) {
    const storeToUpdate = storeSelect.value;
    
    // 1. Criamos um objeto de dados em vez de uma URL
    const data = {
      action: "updateStatus",
      store: storeToUpdate,
      newStatus: newStatus
    };
    
    // 2. Enviamos o objeto para a função fetch
    fetchAndUpdate(data, `O novo status da loja ${storeToUpdate} é "${newStatus}".`);
}

// Lida com o clique para gerar a Recontagem 1 (Atualizado para POST)
function handleGenerateRecount() {
    const storeToUpdate = storeSelect.value;
    const confirmRecount = confirm(`ATENÇÃO!\n\nIsso irá processar todos os dados contados para a loja ${storeToUpdate} e gerar a lista de recontagem.\n\nEsta ação não pode ser desfeita. Deseja continuar?`);
    if (confirmRecount) {
      
        // 1. Criamos um objeto de dados em vez de uma URL
        const data = {
          action: "triggerRecount",
          store: storeToUpdate
        };

        // 2. Enviamos o objeto para a função fetch
        fetchAndUpdate(data, `A recontagem para a loja ${storeToUpdate} foi gerada com sucesso!`);
    }
}

// Função genérica de comunicação com o Google Script (Atualizado para POST)
function fetchAndUpdate(data, successMessage) { // <--- Recebe 'data' (objeto), não 'url'
    actionButton.disabled = true;
    actionButton.innerText = "Processando...";
    console.log("Enviando requisição POST para:", data.action); // Log atualizado

    // Configurações da requisição POST
    const fetchOptions = {
      method: 'POST',
      body: JSON.stringify(data), // Converte o objeto em texto JSON
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // A URL é sempre a URL base, sem parâmetros
    fetch(GOOGLE_SCRIPT_URL, fetchOptions) // <--- Envia a URL base + as opções
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erro de rede: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.result !== "Success") {
            throw new Error(data.message || 'Erro desconheido retornado pelo script.');
        }
        alert(successMessage);
        initializePanel(); // Recarrega os status para refletir a mudança
    })
    .catch(error => {
        console.error("Erro ao executar a ação:", error);
        alert(`Ocorreu um erro: ${error.message}`);
        initializePanel(); // Recarrega os status em caso de erro
    });
}

// --- EVENT LISTENERS ---
storeSelect.addEventListener('change', () => {
    const selectedStoreName = storeSelect.value;
    if (!selectedStoreName) {
        controlsDiv.classList.add('hidden');
        return;
    }
    const selectedStoreData = storeData.find(store => store.name === selectedStoreName);
    if (selectedStoreData) {
        currentStatusText.textContent = selectedStoreData.status;
        updateButtonUI(selectedStoreData.status);
        controlsDiv.classList.remove('hidden');
    }
});

// --- INICIALIZAÇÃO ---
initializePanel();