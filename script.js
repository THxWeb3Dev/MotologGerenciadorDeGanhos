const DB = "motolog_v1";

// ==========================================
// REGISTRO DO SERVICE WORKER E INSTALAÇÃO PWA
// ==========================================
let deferredPrompt;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado!', reg))
      .catch(err => console.error('Erro no SW', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('pwa-install-banner').classList.remove('hidden');
});

document.getElementById('btn-install-pwa').addEventListener('click', async () => {
  document.getElementById('pwa-install-banner').classList.add('hidden');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    definirDataPadrao();
    atualizar();
});

function definirDataPadrao() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const horas = String(agora.getHours()).padStart(2, '0');
    const mins = String(agora.getMinutes()).padStart(2, '0');
    
    document.getElementById('data-corrida').value = `${ano}-${mes}-${dia}`;
    document.getElementById('hora-corrida').value = `${horas}:${mins}`;
}

function toggleParada() { 
    document.getElementById('detalhe-parada').classList.toggle('hidden', !document.getElementById('tem-parada').checked); 
}

document.getElementById('btn-salvar').onclick = () => {
    const dataVal = document.getElementById('data-corrida').value;
    const horaVal = document.getElementById('hora-corrida').value;
    
    let dataFinal = new Date();
    if (dataVal && horaVal) {
        const [ano, mes, dia] = dataVal.split('-');
        const [h, m] = horaVal.split(':');
        dataFinal = new Date(ano, mes - 1, dia, h, m);
    }

    const corrida = {
        id: Date.now(),
        mod: document.querySelector('input[name="mod"]:checked').value,
        origem: document.getElementById('origem').value.trim(),
        destino: document.getElementById('destino').value.trim(),
        km: parseFloat(document.getElementById('km').value) || 0,
        valor: parseFloat(document.getElementById('valor').value) || 0,
        parada: document.getElementById('tem-parada').checked,
        desc: document.getElementById('detalhe-parada').value,
        data: dataFinal.toISOString()
    };

    if(!corrida.origem || corrida.valor <= 0) return alert("Preencha origem e valor!");
    
    const db = JSON.parse(localStorage.getItem(DB) || "[]");
    db.push(corrida);
    localStorage.setItem(DB, JSON.stringify(db));
    
    limpar(); 
    atualizar();
};

function atualizar() {
    const db = JSON.parse(localStorage.getItem(DB) || "[]");
    const agora = new Date();
    
    const hoje = db.filter(c => new Date(c.data).toDateString() === agora.toDateString());
    const mes = db.filter(c => {
        const d = new Date(c.data);
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    });
    
    document.getElementById('ganho-total').innerText = fmt(db.reduce((a,b)=>a+b.valor,0));
    document.getElementById('ganho-hoje').innerText = fmt(hoje.reduce((a,b)=>a+b.valor,0));
    document.getElementById('ganho-mes').innerText = fmt(mes.reduce((a,b)=>a+b.valor,0));
    
    renderGrafico(db);
    renderListaAgrupada(db);
}

function renderGrafico(db) {
    const container = document.getElementById('grafico-real');
    container.innerHTML = "";
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    
    let totalSemana = 0;

    for(let i=0; i<7; i++) {
        const diaDados = db.filter(c => {
            const d = new Date(c.data);
            const diffDias = (hoje - d) / (1000 * 60 * 60 * 24);
            return d.getDay() === i && diffDias >= 0 && diffDias < 7;
        });
        const total = diaDados.reduce((a,b)=>a+b.valor, 0);
        totalSemana += total;
        const bar = document.createElement('div');
        bar.className = `bar ${new Date().getDay() === i ? 'active' : ''}`;
        bar.style.height = `${Math.max((total/300)*100, 5)}%`;
        bar.onclick = () => abrirModal(diaDados, i);
        container.appendChild(bar);
    }
    document.getElementById('99-ganho-semana').innerText = fmt(totalSemana);
    
    const qtdSemana = db.filter(c => {
        const diff = (hoje - new Date(c.data)) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < 7;
    }).length;
    document.getElementById('99-qtd-corridas').innerText = qtdSemana;
}

// ==========================================
// RENDERIZAÇÃO DA LISTA AGRUPADA
// ==========================================
function renderListaAgrupada(db) {
    const busca = document.getElementById('busca').value.toLowerCase();
    const listaDiv = document.getElementById('lista-agrupada');
    listaDiv.innerHTML = "";

    // 1. Filtra a busca
    let filtradas = db.filter(c => c.origem.toLowerCase().includes(busca) || c.destino.toLowerCase().includes(busca));

    // 2. Ordena da corrida mais recente para a mais antiga
    filtradas.sort((a, b) => new Date(b.data) - new Date(a.data));

    // 3. Agrupa as corridas pelas datas
    const grupos = {};
    filtradas.forEach(c => {
        const dataKey = new Date(c.data).toDateString();
        if (!grupos[dataKey]) grupos[dataKey] = { total: 0, corridas: [] };
        grupos[dataKey].total += c.valor;
        grupos[dataKey].corridas.push(c);
    });

    // 4. Cria o HTML agrupado
    for (const dataKey in grupos) {
        const dataObj = new Date(dataKey);
        let dataLabel = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        const hoje = new Date().toDateString();
        const ontem = new Date(Date.now() - 864e5).toDateString();
        
        if (dataKey === hoje) dataLabel = "Hoje";
        else if (dataKey === ontem) dataLabel = "Ontem";

        const grupoHTML = `
            <div class="grupo-data">
                <div class="cabecalho-grupo">
                    <span>📅 ${dataLabel}</span>
                    <span class="total-dia">Total: ${fmt(grupos[dataKey].total)}</span>
                </div>
                <div class="corridas-do-dia">
                    ${grupos[dataKey].corridas.map(c => `
                        <div class="item-corrida" style="border-left-color:${c.mod==='99'?'#ffcc00':'#00ff88'}">
                            <div>
                                <span class="hora-item">🕒 ${new Date(c.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                <p style="font-size:0.6rem;color:#666;text-transform:uppercase">${c.mod}</p>
                                <p><b>${c.origem} ⮕ ${c.destino}</b></p>
                                <p style="font-size:0.65rem;color:#888;margin-top:2px;">${c.km > 0 ? `${c.km}km` : ''}</p>
                            </div>
                            <div style="text-align:right; display:flex; flex-direction:column; justify-content:space-between;">
                                <b>R$ ${c.valor.toFixed(2)}</b>
                                <span onclick="remover(${c.id})" style="font-size:0.6rem;color:#ff4444;cursor:pointer;">Remover</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        listaDiv.innerHTML += grupoHTML;
    }
}

// ==========================================
// SISTEMA DE MODAIS
// ==========================================
function abrirModal(dados, idx) {
    if(!dados.length) return;
    const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
    document.getElementById('modal-titulo').innerText = dias[idx];
    const v99 = dados.filter(c=>c.mod==="99").reduce((a,b)=>a+b.valor,0);
    const vPart = dados.filter(c=>c.mod==="Particular").reduce((a,b)=>a+b.valor,0);
    const kms = dados.reduce((a,b)=>a+b.km,0);
    const t = dados.map(c=>new Date(c.data).getTime());
    
    let horas = "0.0";
    if (t.length > 1) {
        horas = ((Math.max(...t) - Math.min(...t))/36e5).toFixed(1);
    }

    document.getElementById('modal-corpo').innerHTML = `
        <div class="detail-row"><span style="color:#888">App 99</span><b>${fmt(v99)}</b></div>
        <div class="detail-row"><span style="color:#888">Particular</span><b>${fmt(vPart)}</b></div>
        <div class="detail-row"><span style="color:#888">KM Total</span><b>${kms.toFixed(1)} km</b></div>
        <div class="detail-row" style="border:none"><span style="color:#888">Tempo Rota</span><b>${horas}h</b></div>
    `;
    document.getElementById('modal-detalhes').style.display = "flex";
}
function fecharModal() { document.getElementById('modal-detalhes').style.display="none"; }

function abrirModalPix() { document.getElementById('modal-pix').style.display="flex"; }
function fecharModalPix() { 
    document.getElementById('modal-pix').style.display="none"; 
    document.getElementById('btn-copy-pix').innerText = "📋 Copiar Chave PIX";
}

function abrirModalClube() { document.getElementById('modal-clube').style.display="flex"; }
function fecharModalClube() { document.getElementById('modal-clube').style.display="none"; }

function copiarPix() {
    const chave = "motologrj@gmail.com";
    navigator.clipboard.writeText(chave).then(() => {
        const btn = document.getElementById('btn-copy-pix');
        btn.innerText = "✅ Chave Copiada!";
        setTimeout(() => { btn.innerText = "📋 Copiar Chave PIX"; }, 3000);
    }).catch(err => {
        alert("Erro ao copiar. Selecione o e-mail na tela e copie manualmente.");
    });
}
// ==========================================

function fmt(v) { return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

function limpar() { 
    ["origem","destino","km","valor","detalhe-parada"].forEach(id=>document.getElementById(id).value=""); 
    document.getElementById('tem-parada').checked=false; 
    toggleParada(); 
    definirDataPadrao(); 
}

function remover(id) {
    if(!confirm("Remover corrida?")) return;
    const db = JSON.parse(localStorage.getItem(DB)).filter(c => c.id !== id);
    localStorage.setItem(DB, JSON.stringify(db));
    atualizar();
}

document.getElementById('busca').oninput = () => atualizar();
