// Firebase V2: exclusivo do projeto sao-lucas-2. Requer hospedagem HTTP(S).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const config={apiKey:'AIzaSyAiC45XJXvzPdurxvnCnX4LNX5fCRaS77s',authDomain:'sao-lucas-2.firebaseapp.com',projectId:'sao-lucas-2',storageBucket:'sao-lucas-2.firebasestorage.app',messagingSenderId:'373980199047',appId:'1:373980199047:web:4ec3b6379c300f329da022'};
const ADMIN_UID='69BNCYuzDwfTnxCWiDL3Efy1iK13';
const app=initializeApp(config);const auth=getAuth(app);const db=getFirestore(app);
const el=id=>document.getElementById(id);
const status=message=>el('adminStatus').textContent=message;
const setSync=message=>el('syncStatus').textContent=message;
let isAdmin=false;
// O catálogo é mantido exclusivamente no Firestore.
const initialCatalog=[];
el('adminClose').onclick=()=>el('adminModal').hidden=true;
el('adminModal').onclick=e=>{if(e.target===el('adminModal'))el('adminModal').hidden=true};
el('adminLogin').onclick=async()=>{
  const button=el('adminLogin');
  const email=el('adminEmail').value.trim();
  const password=el('adminPassword').value;
  if(!email||!password){status('Preencha e-mail e senha.');return}
  button.disabled=true;
  status('Conectando ao Firebase...');
  try{
    const result=await signInWithEmailAndPassword(auth,email,password);
    if(result.user.uid!==ADMIN_UID){
      status('Conta autenticada, mas sem permissão de administrador neste projeto.');
    }else{
      status('Login realizado. Abrindo painel...');
      el('loginArea').hidden=true;
      el('adminArea').hidden=false;
    }
  }catch(e){
    console.error('Falha no login Firebase',e);
    const messages={
      'auth/invalid-credential':'E-mail ou senha não conferem com o cadastro do Firebase São Lucas 2.',
      'auth/invalid-email':'E-mail inválido.',
      'auth/operation-not-allowed':'Login por e-mail e senha não está habilitado no Firebase.',
      'auth/unauthorized-domain':'O domínio do GitHub Pages precisa ser autorizado em Firebase Authentication > Settings > Authorized domains.',
      'auth/network-request-failed':'Falha de rede ao conectar ao Firebase.',
      'auth/too-many-requests':'Muitas tentativas. Aguarde antes de tentar novamente.'
    };
    status(messages[e.code]||('Erro ao entrar: '+(e.code||e.message)));
  }finally{button.disabled=false}
};
el('adminLogout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{isAdmin=!!user&&user.uid===ADMIN_UID;el('loginArea').hidden=isAdmin;el('adminArea').hidden=!isAdmin;status(isAdmin?'Administrador autenticado.':'Entre com a conta administrativa autorizada.');if(user&&!isAdmin)status('Esta conta não tem permissão administrativa.');});
// A prévia local funciona sem Firebase; em hospedagem HTTPS o catálogo recebe os dados do Firestore.
async function refreshCatalog(){
  try{
    const snap=await getDocs(collection(db,'products'));
    const saved=new Map(snap.docs.map(d=>[d.id,{...d.data(),id:d.id}]));
    const merged=initialCatalog.map(p=>saved.get(p.id)||p).filter(p=>!p.deleted);
    const initialIds=new Set(initialCatalog.map(p=>p.id));
    for(const p of saved.values())if(!initialIds.has(p.id)&&!p.deleted)merged.push(p);
    window.v2Catalog.PRODUCTS.splice(0,window.v2Catalog.PRODUCTS.length,...merged);
    window.v2Catalog.CATS.splice(0,window.v2Catalog.CATS.length,...new Set(merged.map(p=>p.category).filter(Boolean)));
    window.v2Catalog.render();
  }catch(e){console.warn('Firestore indisponível; catálogo não carregado',e);window.v2Catalog.PRODUCTS.splice(0);window.v2Catalog.CATS.splice(0);window.v2Catalog.render()}
}
// PRODUCTs e CATS estão declarados em script clássico, e portanto acessíveis globalmente.
refreshCatalog();
el('importCatalog').disabled=true;el('importCatalog').hidden=true;
el('importCatalog').onclick=async()=>{if(!isAdmin)return;const source=initialCatalog;if(!confirm(`Importar até ${source.length} produtos para o Firebase São Lucas 2? Produtos já existentes não serão substituídos.`))return;el('importCatalog').disabled=true;try{const existing=await getDocs(collection(db,'products'));const ids=new Set(existing.docs.map(d=>d.id));const pending=source.filter(p=>!ids.has(p.id));let done=0;for(let i=0;i<pending.length;i+=350){const batch=writeBatch(db);for(const p of pending.slice(i,i+350))batch.set(doc(db,'products',p.id),p);await batch.commit();done+=Math.min(350,pending.length-i);setSync(`${done} de ${pending.length} produtos importados.`)}setSync(`Concluído: ${done} novos produtos. ${source.length-done} já existiam.`);await refreshCatalog();await loadManagedProducts()}catch(e){setSync('Falha na importação: '+(e.message||e))}finally{el('importCatalog').disabled=false}};
// Gerenciamento: lista apenas os documentos efetivamente salvos no Firestore.
let managedProducts=[];
const safeText=value=>String(value??'');
function clearEditor(){
  el('editingProductId').value='';
  for(const id of ['newName','newBrand','newCategory','newPrice','newImage'])el(id).value='';
  el('newUnavailable').checked=false;
  el('newPhoto').value='';el('newPhotoPreview').hidden=true;el('newPhotoPreview').removeAttribute('src');
  el('productFormTitle').textContent='Adicionar produto';
  el('saveNewProduct').textContent='Salvar produto';
  el('cancelEdit').hidden=true;
}
el('cancelEdit').onclick=clearEditor;
function drawManagedProducts(){
  const q=el('adminProductSearch').value.trim().toLocaleLowerCase('pt-BR');
  const matches=managedProducts.filter(p=>!p.deleted&&[p.name,p.brand,p.category].some(v=>safeText(v).toLocaleLowerCase('pt-BR').includes(q)));
  const list=el('adminProductList');
  list.replaceChildren();
  if(!matches.length){list.textContent='Nenhum produto cadastrado encontrado no Firebase.';return}
  const count=document.createElement('small');count.textContent=matches.length+' produto(s) encontrado(s)';list.append(count);
  for(const p of matches){
    const row=document.createElement('div');row.className='adminproduct';
    const info=document.createElement('div');
    const name=document.createElement('strong');name.textContent=safeText(p.name);
    const sub=document.createElement('small');sub.textContent=[p.brand,p.category,p.unavailable?'Indisponível':'Disponível',p._inFirebase?'Firebase':'Catálogo inicial'].filter(Boolean).join(' • ');
    info.append(name,sub);
    const actions=document.createElement('div');actions.className='actions';
    const edit=document.createElement('button');edit.textContent='Editar';
    edit.onclick=()=>{
      el('editingProductId').value=p.id;
      for(const [id,key] of [['newName','name'],['newBrand','brand'],['newCategory','category'],['newPrice','price'],['newImage','image']])el(id).value=p[key]??'';
      el('newUnavailable').checked=!!p.unavailable;
      el('newPhoto').value='';el('newPhotoPreview').hidden=!p.image;if(p.image)el('newPhotoPreview').src=p.image;
      el('productFormTitle').textContent='Editando: '+p.name;
      el('saveNewProduct').textContent='Salvar alterações';
      el('cancelEdit').hidden=false;
      el('productFormTitle').scrollIntoView({behavior:'smooth',block:'center'});
    };
    const toggle=document.createElement('button');toggle.textContent=p.unavailable?'Disponibilizar':'Indisponível';
    toggle.onclick=async()=>{
      if(!isAdmin)return;
      toggle.disabled=true;
      try{
        const { _inFirebase,...productData}=p;await setDoc(doc(db,'products',p.id),{...productData,unavailable:!p.unavailable},{merge:true});
        setSync('Disponibilidade atualizada.');
        await loadManagedProducts();await refreshCatalog();
      }catch(e){setSync('Erro ao atualizar: '+(e.message||e))}
      finally{toggle.disabled=false}
    };
    const del=document.createElement('button');del.textContent='Excluir';del.className='danger';
    del.onclick=async()=>{
      if(!isAdmin)return;
      if(!confirm('Remover "'+p.name+'" da loja? Esta ação ficará registrada no Firebase.'))return;
      del.disabled=true;
      try{
        await deleteDoc(doc(db,'products',p.id));
        if(el('editingProductId').value===p.id)clearEditor();
        setSync('Produto excluído do Firebase.');
        await loadManagedProducts();await refreshCatalog();
      }catch(e){setSync('Erro ao excluir: '+(e.message||e))}
      finally{del.disabled=false}
    };
    actions.append(edit,toggle,del);row.append(info,actions);list.append(row);
  }
}
let managedLoadSequence=0;
function sortManaged(list){return list.filter(p=>!p.deleted).sort((a,b)=>safeText(a.name).localeCompare(safeText(b.name),'pt-BR'))}
async function loadManagedProducts(){
  if(!isAdmin)return;
  const seq=++managedLoadSequence;
  // Exibe o catálogo inicial imediatamente, sem depender da rede.
  const previouslySaved=new Map(managedProducts.filter(p=>p._inFirebase).map(p=>[p.id,p]));
  const initialIds=new Set(initialCatalog.map(p=>p.id));
  managedProducts=sortManaged([...initialCatalog.map(p=>previouslySaved.get(p.id)||{...p,_inFirebase:false}),...managedProducts.filter(p=>p._inFirebase&&!initialIds.has(p.id))]);
  drawManagedProducts();
  setSync('Catálogo exibido. Sincronizando alterações do Firebase...');
  try{
    const snap=await getDocs(collection(db,'products'));
    if(seq!==managedLoadSequence||!isAdmin)return;
    const saved=new Map(snap.docs.map(d=>[d.id,{...d.data(),id:d.id,_inFirebase:true}]));
    managedProducts=sortManaged([...initialCatalog.map(p=>saved.get(p.id)||{...p,_inFirebase:false}),...[...saved.values()].filter(p=>!initialIds.has(p.id))]);
    drawManagedProducts();
    setSync('Catálogo sincronizado: '+managedProducts.length+' produtos.');
  }catch(e){
    if(seq!==managedLoadSequence)return;
    setSync('Não foi possível carregar o catálogo do Firebase: '+(e.code||e.message||e));
  }
}
el('adminProductSearch').oninput=drawManagedProducts;
el('reloadProducts').onclick=loadManagedProducts;
// Exportação somente leitura: catálogo efetivo, documentos Firestore e configurações.
el('exportCatalogBackup').onclick=async()=>{
  if(!isAdmin){setSync('Entre como administrador para exportar.');return}
  const button=el('exportCatalogBackup');button.disabled=true;
  setSync('Preparando backup do Firebase...');
  try{
    const [productsSnap,settingsSnap]=await Promise.all([getDocs(collection(db,'products')),getDocs(collection(db,'settings'))]);
    const firestoreProducts=productsSnap.docs.map(d=>({id:d.id,...d.data()}));
    const saved=new Map(firestoreProducts.map(p=>[p.id,p]));
    const merged=initialCatalog.map(p=>saved.get(p.id)||p).filter(p=>!p.deleted);
    const initialIds=new Set(initialCatalog.map(p=>p.id));
    for(const p of firestoreProducts)if(!initialIds.has(p.id)&&!p.deleted)merged.push(p);
    const settings=Object.fromEntries(settingsSnap.docs.map(d=>[d.id,d.data()]));
    const backup={
      format:'sao-lucas-v2-backup',version:1,exportedAt:new Date().toISOString(),
      summary:{initialCatalog:initialCatalog.length,firestoreDocuments:firestoreProducts.length,activeProducts:merged.length,deletedDocuments:firestoreProducts.filter(p=>p.deleted).length},
      products:merged,firestoreProducts,settings
    };
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='sao-lucas-v2-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    setSync('Backup gerado: '+merged.length+' produtos ativos, '+firestoreProducts.length+' documentos no Firebase. Guarde o arquivo com segurança.');
  }catch(e){console.error('Falha ao exportar backup',e);setSync('Falha ao exportar. Nenhum dado foi alterado: '+(e.code||e.message||e))}
  finally{button.disabled=false}
};

onAuthStateChanged(auth,user=>{if(user?.uid===ADMIN_UID)loadManagedProducts();else{managedProducts=[];el('adminProductList').textContent='Entre para gerenciar produtos.'}});
// Fotos compactadas como data URL no Firestore Spark. Evita tokens GitHub expostos.
async function compressPhoto(file){
  if(!file.type.startsWith('image/'))throw Error('Escolha um arquivo de imagem.');
  if(file.size>15*1024*1024)throw Error('Imagem original maior que 15 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    for(const maxSide of [900,720,560,440,320]){
      const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const quality of [0.8,0.65,0.5]){
        const data=canvas.toDataURL('image/webp',quality);
        if(data.length<200000)return data;
      }
    }
    throw Error('Não foi possível reduzir a foto para menos de 150 KB.');
  }finally{bitmap.close()}
}
el('newPhoto').addEventListener('change',async()=>{
  const file=el('newPhoto').files?.[0];if(!file)return;
  try{
    const data=await compressPhoto(file);
    el('newPhotoPreview').src=data;el('newPhotoPreview').hidden=false;
    setSync('Foto preparada. Clique em Salvar produto para gravá-la.');
  }catch(e){el('newPhoto').value='';setSync('Erro na foto: '+e.message)}
});
el('saveNewProduct').onclick=async()=>{
  if(!isAdmin)return;
  const name=el('newName').value.trim(),brand=el('newBrand').value.trim(),category=el('newCategory').value.trim(),image=el('newImage').value.trim();
  const raw=el('newPrice').value.trim(),price=raw===''?0:Number(raw);
  if(!name||!brand||!category){setSync('Preencha nome, marca e categoria.');return}
  if(!Number.isFinite(price)||price<0){setSync('Preço inválido.');return}
  const existingId=el('editingProductId').value;
  const id=existingId||'v2-'+crypto.randomUUID();
  let finalImage=image;
  const photo=el('newPhoto').files?.[0];
  if(photo){try{finalImage=await compressPhoto(photo)}catch(e){setSync('Erro na foto: '+e.message);return}}
  if(existingId&&!finalImage){const original=managedProducts.find(p=>p.id===existingId);finalImage=original?.image||'';}
  const fields={id,name,brand,category,image:finalImage,price,unavailable:el('newUnavailable').checked,priceOnRequest:price===0};if(existingId){const original=managedProducts.find(p=>p.id===existingId);if(original&&!original._inFirebase){const {_inFirebase,...base}=original;Object.assign(fields,base,{id,name,brand,category,image:finalImage||base.image,price,unavailable:el('newUnavailable').checked,priceOnRequest:price===0});}}
  if(!existingId)Object.assign(fields,{description:'',rating:0,reviewsCount:0,sections:[]});
  const button=el('saveNewProduct');button.disabled=true;
  try{
    await setDoc(doc(db,'products',id),fields,{merge:!!existingId});
    setSync(existingId?'Produto atualizado no Firebase.':'Produto cadastrado no Firebase.');
    clearEditor();await loadManagedProducts();await refreshCatalog();
  }catch(e){setSync('Erro ao salvar: '+(e.message||e))}
  finally{button.disabled=false}
};

// Tamanhos das logos: ajustes persistidos em settings/branding.
const logoLimits={header:[100,260],footer:[120,380]};
function safeSize(value,type){const [min,max]=logoLimits[type];const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):(type==='header'?190:250)}
function applyLogoSizes(header,footer){
  const h=safeSize(header,'header'),f=safeSize(footer,'footer');
  el('headerLogo').style.width=h+'px';
  el('footerLogo').style.width=f+'px';
  el('headerLogoSize').value=h;el('footerLogoSize').value=f;
  el('headerLogoValue').textContent=h;el('footerLogoValue').textContent=f;
}
for(const type of ['header','footer']){
  el(type+'LogoSize').addEventListener('input',()=>applyLogoSizes(el('headerLogoSize').value,el('footerLogoSize').value));
}
try{
  const snap=await getDoc(doc(db,'settings','branding'));
  if(snap.exists())applyLogoSizes(snap.data().headerLogoSize,snap.data().footerLogoSize);
}catch(error){console.warn('Não foi possível carregar os tamanhos das logos',error)}
el('saveLogoSizes').onclick=async()=>{
  if(!isAdmin){setSync('Entre com a conta administrativa para salvar.');return}
  const headerLogoSize=safeSize(el('headerLogoSize').value,'header');
  const footerLogoSize=safeSize(el('footerLogoSize').value,'footer');
  try{
    await setDoc(doc(db,'settings','branding'),{headerLogoSize,footerLogoSize},{merge:true});
    setSync('Tamanhos das logos salvos no Firebase.');
  }catch(error){setSync('Não foi possível salvar: '+(error.message||error))}
};
