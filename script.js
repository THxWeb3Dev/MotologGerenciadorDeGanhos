const DB = "motolog_v1";
document.addEventListener('DOMContentLoaded', () => atualizar());

function toggleParada() { document.getElementById('detalhe-parada').classList.toggle('hidden', !document.getElementById('tem-parada').checked); }

document.getElementById('btn-salvar').onclick = () => {
    const corrida = {
        id: Date.now(),
        mod: document.querySelector('input[name="mod"]:checked').value,
        origem: document.getElementById('origem').value,
        destino: document.getElementById('destino').value,
        km: parseFloat(document.getElementById('km').value) || 0,
        valor: parseFloat(document.getElementById('valor').value) || 0,
        parada: document.getElementById('tem-parada').checked,
        desc: document.getElementById('detalhe-parada').value,
        data: new Date().toISOString()
    };
    if(!corrida.origem || corrida.valor <= 0) return alert("Preencha os campos!");
    const db = JSON.parse(localStorage.getItem(DB) || "[]");
    db.push(corrida);
    localStorage.setItem(DB, JSON.stringify(db));
    limpar(); atualizar();
};

function atualizar() {
    const db = JSON.parse(localStorage.getItem(DB) || "[]");
    const agora = new Date();
    const hoje = db.filter(c => new Date(c.data).toDateString() === agora.toDateString());
    const mes = db.filter(c => new Date(c.data).getMonth() === agora.getMonth());
    
    document.getElementById('ganho-total').innerText = fmt(db.reduce((a,b)=>a+b.valor,0));
    document.getElementById('ganho-hoje').innerText = fmt(hoje.reduce((a,b)=>a+b.valor,0));
    document.getElementById('ganho-mes').innerText = fmt(mes.reduce((a,b)=>a+b.valor,0));
    
    renderGrafico(db);
    renderLista(db);
}

function renderGrafico(db) {
    const container = document.getElementById('grafico-real');
    container.innerHTML = "";
    const hoje = new Date();
    let totalSemana = 0;

    for(let i=0; i<7; i++) {
        const diaDados = db.filter(c => {
            const d = new Date(c.data);
            return d.getDay() === i && (hoje - d) / 864e5 < 7;
        });
        const total = diaDados.reduce((a,b)=>a+b.valor, 0);
        totalSemana += total;
        const bar = document.createElement('div');
        bar.className = `bar ${hoje.getDay() === i ? 'active' : ''}`;
        bar.style.height = `${Math.max((total/300)*100, 5)}%`;
        bar.onclick = () => abrirModal(diaDados, i);
        container.appendChild(bar);
    }
    document.getElementById('99-ganho-semana').innerText = fmt(totalSemana);
    document.getElementById('99-qtd-corridas').innerText = db.filter(c => (hoje - new Date(c.data))/864e5 < 7).length;
}

function abrirModal(dados, idx) {
    if(!dados.length) return;
    const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];
    document.getElementById('modal-titulo').innerText = dias[idx];
    const v99 = dados.filter(c=>c.mod==="99").reduce((a,b)=>a+b.valor,0);
    const vPart = dados.filter(c=>c.mod==="Particular").reduce((a,b)=>a+b.valor,0);
    const kms = dados.reduce((a,b)=>a+b.km,0);
    const t = dados.map(c=>new Date(c.data).getTime());
    const horas = ((Math.max(...t) - Math.min(...t))/36e5).toFixed(1);

    document.getElementById('modal-corpo').innerHTML = `
        <div class="detail-row"><span>App 99</span><b>${fmt(v99)}</b></div>
        <div class="detail-row"><span>Particular</span><b>${fmt(vPart)}</b></div>
        <div class="detail-row"><span>KM Total</span><b>${kms.toFixed(1)} km</b></div>
        <div class="detail-row"><span>Tempo Rota</span><b>${horas}h</b></div>
    `;
    document.getElementById('modal-detalhes').style.display = "flex";
}

function fecharModal() { document.getElementById('modal-detalhes').style.display="none"; }
function fmt(v) { return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function limpar() { ["origem","destino","km","valor","detalhe-parada"].forEach(id=>document.getElementById(id).value=""); document.getElementById('tem-parada').checked=false; toggleParada(); }

function renderLista(db) {
    const busca = document.getElementById('busca').value.toLowerCase();
    document.getElementById('lista-corridas').innerHTML = db.filter(c=>c.origem.toLowerCase().includes(busca)).slice().reverse().map(c=>`
        <div class="item-corrida" style="border-left-color:${c.mod==='99'?'#ffcc00':'#00ff88'}">
            <div><p style="font-size:0.6rem;color:#666">${c.mod}</p><p><b>${c.origem} ⮕ ${c.destino}</b></p></div>
            <div style="text-align:right"><b>R$ ${c.valor.toFixed(2)}</b></div>
        </div>`).join('');
}
