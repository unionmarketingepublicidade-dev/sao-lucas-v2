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
// Cópia imutável do catálogo de origem, independente dos produtos já presentes no Firestore.
const initialCatalog=window.v2Catalog.PRODUCTS.map(product=>structuredClone(product));
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
async function refreshCatalog(){try{const snap=await getDocs(collection(db,'products'));if(snap.empty)return;const list=snap.docs.map(d=>d.data()).filter(p=>p&&p.id&&p.name);if(!list.length)return;window.v2Catalog.PRODUCTS.splice(0,window.v2Catalog.PRODUCTS.length,...list);window.v2Catalog.CATS.splice(0,window.v2Catalog.CATS.length,...new Set(list.map(p=>p.category).filter(Boolean)));window.v2Catalog.render();}catch(e){console.warn('Firestore indisponível; exibindo catálogo de demonstração',e)}}
// PRODUCTs e CATS estão declarados em script clássico, e portanto acessíveis globalmente.
refreshCatalog();
el('importCatalog').onclick=async()=>{if(!isAdmin)return;const source=initialCatalog;if(!confirm(`Importar até ${source.length} produtos para o Firebase São Lucas 2? Produtos já existentes não serão substituídos.`))return;el('importCatalog').disabled=true;try{const existing=await getDocs(collection(db,'products'));const ids=new Set(existing.docs.map(d=>d.id));const pending=source.filter(p=>!ids.has(p.id));let done=0;for(let i=0;i<pending.length;i+=350){const batch=writeBatch(db);for(const p of pending.slice(i,i+350))batch.set(doc(db,'products',p.id),p);await batch.commit();done+=Math.min(350,pending.length-i);setSync(`${done} de ${pending.length} produtos importados.`)}setSync(`Concluído: ${done} novos produtos. ${source.length-done} já existiam.`);await refreshCatalog();await loadManagedProducts()}catch(e){setSync('Falha na importação: '+(e.message||e))}finally{el('importCatalog').disabled=false}};
// Gerenciamento: lista apenas os documentos efetivamente salvos no Firestore.
let managedProducts=[];
const safeText=value=>String(value??'');
function clearEditor(){
  el('editingProductId').value='';
  for(const id of ['newName','newBrand','newCategory','newPrice','newImage'])el(id).value='';
  el('newUnavailable').checked=false;
  el('productFormTitle').textContent='Adicionar produto';
  el('saveNewProduct').textContent='Salvar produto';
  el('cancelEdit').hidden=true;
}
el('cancelEdit').onclick=clearEditor;
function drawManagedProducts(){
  const q=el('adminProductSearch').value.trim().toLocaleLowerCase('pt-BR');
  const matches=managedProducts.filter(p=>[p.name,p.brand,p.category].some(v=>safeText(v).toLocaleLowerCase('pt-BR').includes(q)));
  const list=el('adminProductList');
  list.replaceChildren();
  if(!matches.length){list.textContent='Nenhum produto cadastrado encontrado no Firebase.';return}
  const count=document.createElement('small');count.textContent=matches.length+' produto(s) encontrado(s)';list.append(count);
  for(const p of matches){
    const row=document.createElement('div');row.className='adminproduct';
    const info=document.createElement('div');
    const name=document.createElement('strong');name.textContent=safeText(p.name);
    const sub=document.createElement('small');sub.textContent=[p.brand,p.category,p.unavailable?'Indisponível':'Disponível'].filter(Boolean).join(' • ');
    info.append(name,sub);
    const actions=document.createElement('div');actions.className='actions';
    const edit=document.createElement('button');edit.textContent='Editar';
    edit.onclick=()=>{
      el('editingProductId').value=p.id;
      for(const [id,key] of [['newName','name'],['newBrand','brand'],['newCategory','category'],['newPrice','price'],['newImage','image']])el(id).value=p[key]??'';
      el('newUnavailable').checked=!!p.unavailable;
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
        await setDoc(doc(db,'products',p.id),{unavailable:!p.unavailable},{merge:true});
        setSync('Disponibilidade atualizada.');
        await loadManagedProducts();await refreshCatalog();
      }catch(e){setSync('Erro ao atualizar: '+(e.message||e))}
      finally{toggle.disabled=false}
    };
    const del=document.createElement('button');del.textContent='Excluir';del.className='danger';
    del.onclick=async()=>{
      if(!isAdmin)return;
      if(!confirm('Excluir permanentemente o produto "'+p.name+'" do Firebase? Esta ação não pode ser desfeita.'))return;
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
async function loadManagedProducts(){
  if(!isAdmin)return;
  el('adminProductList').textContent='Carregando produtos do Firebase...';
  try{
    const snap=await getDocs(collection(db,'products'));
    managedProducts=snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>safeText(a.name).localeCompare(safeText(b.name),'pt-BR'));
    drawManagedProducts();
  }catch(e){el('adminProductList').textContent='Erro ao carregar: '+(e.message||e)}
}
el('adminProductSearch').oninput=drawManagedProducts;
el('reloadProducts').onclick=loadManagedProducts;
onAuthStateChanged(auth,user=>{if(user?.uid===ADMIN_UID)loadManagedProducts();else{managedProducts=[];el('adminProductList').textContent='Entre para gerenciar produtos.'}});
el('saveNewProduct').onclick=async()=>{
  if(!isAdmin)return;
  const name=el('newName').value.trim(),brand=el('newBrand').value.trim(),category=el('newCategory').value.trim(),image=el('newImage').value.trim();
  const raw=el('newPrice').value.trim(),price=raw===''?0:Number(raw);
  if(!name||!brand||!category){setSync('Preencha nome, marca e categoria.');return}
  if(!Number.isFinite(price)||price<0){setSync('Preço inválido.');return}
  const existingId=el('editingProductId').value;
  const id=existingId||'v2-'+crypto.randomUUID();
  const fields={id,name,brand,category,image,price,unavailable:el('newUnavailable').checked,priceOnRequest:price===0};
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
