/* Exportação sem navegar para fora do PWA (Safari/iOS e desktop). */
window.ceebDownload = async function(url, filename, options={}) {
  const status = options.status || null;
  const oldText = status?.textContent;
  if(status) status.textContent='Preparando arquivo para salvar...';
  try {
    const response = await fetch(url, {credentials:'same-origin', ...(options.fetchOptions||{})});
    if(!response.ok) {
      const type=response.headers.get('content-type')||'';
      const detail=type.includes('json') ? (await response.json().catch(()=>({}))).error : null;
      throw new Error(detail||`Falha ao exportar (HTTP ${response.status}).`);
    }
    const blob=await response.blob();
    if(!blob.size) throw new Error('O arquivo recebido está vazio.');
    const ext=(filename.split('.').pop()||'pdf').toLowerCase();
    const file=new File([blob],filename,{type:blob.type||(ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')});
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    // Em PWA iOS, a folha de compartilhamento permite "Salvar em Arquivos" sem sair do app.
    if(isiOS && navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
      try { await navigator.share({files:[file],title:filename}); if(status) status.textContent='Escolha “Salvar em Arquivos” para guardar o documento.'; return; }
      catch(error) { if(error.name==='AbortError') {if(status)status.textContent=oldText||'Exportação cancelada.';return;} }
    }
    const objectUrl=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=filename;anchor.style.display='none';document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
    if(status)status.textContent='Arquivo preparado. No iPhone, use Compartilhar → Salvar em Arquivos se aparecer uma prévia.';
  } catch(error) {if(status)status.textContent=error.message;else alert(error.message);}
};

window.ceebSaveBlob=async function(blob,filename,status){
 const file=new File([blob],filename,{type:blob.type});
 const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(isiOS&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){try{await navigator.share({files:[file],title:filename});return}catch(e){if(e.name==='AbortError')return}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};
