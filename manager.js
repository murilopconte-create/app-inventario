//
// ======== MANAGER.JS - CÓDIGO 100% COMPLETO E CORRIGIDO ========
//

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJHzqR-Sh4EQj6XDCk3kWRp2KIbKt_Hsn97gjZ0MBRI_DWsLsm2x0A4J5jYFtEx22J/exechttps://script.google.com/macros/s/AKfycbzsY6vr4eJbOZ_lzggaYQSlapWkjXk1Z7SPGs3mtYYT-Nii5v15_xvXg0ZnMGJYpXNV/exec"; // !! VERIFIQUE SE ESTA URL ESTÁ ATUALIZADA !!

// --- Referências aos Elementos ---
const storeSelect = document.getElementById('store-select-manager');
const controlsDiv = document.getElementById('controls');
const currentStatusText = document.getElementById('current-status-text');
const actionButton = document.getElementById('action-button');
let storeData = [];

// --- FUNÇÕES PRINCIPAIS ---

// Busca os dados das lojas e preenche o seletor
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

// Atualiza a UI do botão com base no status da loja
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
      // CORREÇÃO CRUCIAL: Agora chama a função correta e específica
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

// Lida com cliques que apenas mudam o status
function handleStatusUpdate(newStatus) {
  const storeToUpdate = storeSelect.value;
  const url = `${GOOGLE_SCRIPT_URL}?action=updateStatus&store=${encodeURIComponent(storeToUpdate)}&newStatus=${encodeURIComponent(newStatus)}`;
  
  // Chama a função genérica de fetch
  fetchAndUpdate(url, `O novo status da loja ${storeToUpdate} é "${newStatus}".`);
}

// Lida com o clique para gerar a Recontagem 1
function handleGenerateRecount() {
  const storeToUpdate = storeSelect.value;
  const confirmRecount = confirm(`ATENÇÃO!\n\nIsso irá processar todos os dados contados para a loja ${storeToUpdate} e gerar a lista de recontagem.\n\nEsta ação não pode ser desfeita. Deseja continuar?`);
  if (confirmRecount) {
    const url = `${GOOGLE_SCRIPT_URL}?action=triggerRecount&store=${encodeURIComponent(storeToUpdate)}`;
    
    // Chama a função genérica de fetch
    fetchAndUpdate(url, `A recontagem para a loja ${storeToUpdate} foi gerada com sucesso!`);
  }
}
function fetchAndUpdate(url, successMessage) {
    actionButton.disabled = true;
    actionButton.innerText = "Processando...";
    console.log("Enviando requisição para:", url);

    fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erro de rede: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.result !== "Success") {
        throw new Error(data.message || 'Erro desconhecido retornado pelo script.');
      }
      alert(successMessage);
      initializePanel(); 
    })
    .catch(error => {
      console.error("Erro ao executar a ação:", error);
      alert(`Ocorreu um erro: ${error.message}`);
      initializePanel(); 
    });
}

// Função de comunicação com o Google Script (A VERSÃO CORRETA E COMPLETA)
function updateStatusOnSheet(store, newStatus, isRecountTrigger = false) {
  actionButton.disabled = true;
  actionButton.innerText = "Processando...";
  
  // Lógica simplificada para determinar a ação correta
  const action = isRecountTrigger ? 'triggerRecount' : 'updateStatus';
  
  // Constrói a URL corretamente para cada caso
  const url = `${GOOGLE_SCRIPT_URL}?action=${action}&store=${encodeURIComponent(store)}&newStatus=${encodeURIComponent(newStatus)}`;
  
  console.log(`Enviando requisição para: ${url}`); // Log para depuração no console do navegador

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erro de rede: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.result !== "Success") {
        throw new Error(data.message || 'Erro desconhecido retornado pelo script.');
      }
      
      let successMessage = `A ação foi executada com sucesso!`;
      if (action === 'triggerRecount') {
          successMessage += ` A recontagem para a loja ${store} foi gerada.`;
      } else {
          successMessage += ` O novo status da loja ${store} é "${newStatus}".`;
      }

      if (newStatus === "Finalizado") {
        successMessage += "\n\nUm e-mail com o relatório consolidado foi enviado.";
      }
      
      alert(successMessage);
      initializePanel(); // Recarrega os status para refletir a mudança
    })
    .catch(error => {
      console.error("Erro ao executar a ação:", error);
      alert(`Ocorreu um erro: ${error.message}`);
      // Reabilita o botão em caso de erro para que o usuário possa tentar novamente
      initializePanel(); 
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