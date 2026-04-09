const DB = "motolog_v1";

// ==========================================
// REGISTRO PWA
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

// LÓGICA DO GRÁFICO ATUALIZADA (Escalonamento Dinâmico e Segunda como Dia 0)
function renderGrafico(db) {
    const container = document.getElementById('grafico-real');
    container.innerHTML = "";
    const hoje = new Date();
    
    // Converte o dia para que Segunda seja 0 e Domingo seja 6
    const diaSemanaAtual = (hoje.getDay() + 6) % 7; 
    
    // Descobre o início da semana atual (Segunda-feira)
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaSemanaAtual);
    inicioSemana.setHours(0,0,0,0);

    let totalSemana = 0;
    let qtdSemana = 0;
    
    const totaisPorDia = [0, 0, 0, 0, 0, 0, 0]; // Seg a Dom
    const dadosPorDia = [[], [], [], [], [], [], []];

    db.forEach(c => {
        const d = new Date(c.data);
        if (d >= inicioSemana) {
            const diaAjustado = (d.getDay() + 6) % 7; // Seg = 0, Dom = 6
            totaisPorDia[diaAjustado] += c.valor;
            dadosPorDia[diaAjustado].push(c);
            totalSemana += c.valor;
            qtdSemana++;
        }
    });

    // Impede o gráfico de "estourar" achando o valor mais alto da semana
    const maiorValorDaSemana = Math.max(...totaisPorDia, 1); 

    for(let i=0; i<7; i++) {
        const bar = document.createElement('div');
        bar.className = `bar ${diaSemanaAtual === i ? 'active' : ''}`;
        
        // A altura da barra é baseada em quem ganhou mais na semana (100%)
        let altura = (totaisPorDia[i] / maiorValorDaSemana) * 100;
        bar.style.height = `${Math.max(altura, 5)}%`; 
        
        bar.onclick = () => abrirModal(dadosPorDia[i], i);
        container.appendChild(bar);
    }
    
    document.getElementById('99-ganho-semana').innerText = fmt(totalSemana);
    document.getElementById('99-qtd-corridas').innerText = qtdSemana;
}

function renderListaAgrupada(db) {
    const busca = document.getElementById('busca').value.toLowerCase();
    const listaDiv = document.getElementById('lista-agrupada');
    listaDiv.innerHTML = "";

    let filtradas = db.filter(c => c.origem.toLowerCase().includes(busca) || c.destino.toLowerCase().includes(busca));
    filtradas.sort((a, b) => new Date(b.data) - new Date(a.data));

    const grupos = {};
    filtradas.forEach(c => {
        const dataKey = new Date(c.data).toDateString();
        if (!grupos[dataKey]) grupos[dataKey] = { total: 0, corridas: [] };
        grupos[dataKey].total += c.valor;
        grupos[dataKey].corridas.push(c);
    });

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
    const dias = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
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

// MODAL DE INSIGHTS (ZONAS E HORÁRIOS)
function abrirModalInsights() {
    const db = JSON.parse(localStorage.getItem(DB) || "[]");
    if(db.length === 0) return alert("Cadastre corridas primeiro para gerar seus insights!");

    const locais = {};
    const horarios = {};

    db.forEach(c => {
        // Mapeamento de Zonas (Bairros)
        const orig = c.origem.toUpperCase().trim();
        if(orig) locais[orig] = (locais[orig] || 0) + 1;

        // Mapeamento de Horários
        const h = new Date(c.data).getHours();
        const faixa = `${String(h).padStart(2,'0')}:00 às ${String(h+1).padStart(2,'0')}:00`;
        horarios[faixa] = (horarios[faixa] || 0) + 1;
    });

    const topLocais = Object.entries(locais).sort((a,b) => b[1] - a[1]).slice(0, 3);
    const topHorarios = Object.entries(horarios).sort((a,b) => b[1] - a[1]).slice(0, 3);

    const htmlLocais = topLocais.map((l, i) => `<div style="display:flex;justify-content:space-between;padding:5px 0;"><span><b>${i+1}º</b> ${l[0]}</span><span>${l[1]} viag.</span></div>`).join('');
    const htmlHorarios = topHorarios.map((h, i) => `<div style="display:flex;justify-content:space-between;padding:5px 0;"><span><b>${i+1}º</b> ${h[0]}</span><span>${h[1]} viag.</span></div>`).join('');

    document.getElementById('insights-locais').innerHTML = htmlLocais || "Dados insuficientes.";
    document.getElementById('insights-horarios').innerHTML = htmlHorarios || "Dados insuficientes.";
    
    document.getElementById('modal-insights').style.display = "flex";
}
function fecharModalInsights() { document.getElementById('modal-insights').style.display="none"; }

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
