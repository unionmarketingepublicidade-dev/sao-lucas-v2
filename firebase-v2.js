// Firebase V2: exclusivo do projeto sao-lucas-2. Requer hospedagem HTTP(S).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const config={apiKey:'AIzaSyAiC45XJXvzPdurxvnCnX4LNX5fCRaS77s',authDomain:'sao-lucas-2.firebaseapp.com',projectId:'sao-lucas-2',storageBucket:'sao-lucas-2.firebasestorage.app',messagingSenderId:'373980199047',appId:'1:373980199047:web:4ec3b6379c300f329da022'};
const ADMIN_UID='69BNCYuzDwfTnxCWiDL3Efy1iK13';
const app=initializeApp(config);const auth=getAuth(app);const db=getFirestore(app);
const el=id=>document.getElementById(id);
const status=message=>el('adminStatus').textContent=message;
const setSync=message=>el('syncStatus').textContent=message;
let isAdmin=false;
// Cópia imutável do catálogo de origem, independente dos produtos já presentes no Firestore.
const initialCatalog=window.v2Catalog.PRODUCTS.map(product=>structuredClone(product));
// Acesso discreto: sete cliques consecutivos na logo do cabeçalho.
const logo=document.querySelector('header .logo');
let logoClicks=0;
let lastLogoClick=0;
if(logo){
  logo.style.cursor='pointer';
  logo.addEventListener('click',()=>{
    const now=Date.now();
    if(now-lastLogoClick>2500)logoClicks=0;
    lastLogoClick=now;
    logoClicks++;
    if(logoClicks>=7){
      logoClicks=0;
      el('adminModal').hidden=false;
    }
  });
}
el('adminClose').onclick=()=>el('adminModal').hidden=true;
el('adminModal').onclick=e=>{if(e.target===el('adminModal'))el('adminModal').hidden=true};
el('adminLogin').onclick=async()=>{try{await signInWithEmailAndPassword(auth,el('adminEmail').value.trim(),el('adminPassword').value)}catch(e){status('Não foi possível entrar: '+e.code)}};
el('adminLogout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{isAdmin=!!user&&user.uid===ADMIN_UID;el('loginArea').hidden=isAdmin;el('adminArea').hidden=!isAdmin;status(isAdmin?'Administrador autenticado.':'Entre com a conta administrativa autorizada.');if(user&&!isAdmin)status('Esta conta não tem permissão administrativa.');});
// A prévia local funciona sem Firebase; em hospedagem HTTPS o catálogo recebe os dados do Firestore.
async function refreshCatalog(){try{const snap=await getDocs(collection(db,'products'));if(snap.empty)return;const list=snap.docs.map(d=>d.data()).filter(p=>p&&p.id&&p.name);if(!list.length)return;window.v2Catalog.PRODUCTS.splice(0,window.v2Catalog.PRODUCTS.length,...list);window.v2Catalog.CATS.splice(0,window.v2Catalog.CATS.length,...new Set(list.map(p=>p.category).filter(Boolean)));window.v2Catalog.render();}catch(e){console.warn('Firestore indisponível; exibindo catálogo de demonstração',e)}}
// PRODUCTs e CATS estão declarados em script clássico, e portanto acessíveis globalmente.
await refreshCatalog();
el('importCatalog').onclick=async()=>{if(!isAdmin)return;const source=initialCatalog;if(!confirm(`Importar até ${source.length} produtos para o Firebase São Lucas 2? Produtos já existentes não serão substituídos.`))return;el('importCatalog').disabled=true;try{const existing=await getDocs(collection(db,'products'));const ids=new Set(existing.docs.map(d=>d.id));const pending=source.filter(p=>!ids.has(p.id));let done=0;for(let i=0;i<pending.length;i+=350){const batch=writeBatch(db);for(const p of pending.slice(i,i+350))batch.set(doc(db,'products',p.id),p);await batch.commit();done+=Math.min(350,pending.length-i);setSync(`${done} de ${pending.length} produtos importados.`)}setSync(`Concluído: ${done} novos produtos. ${source.length-done} já existiam.`);await refreshCatalog()}catch(e){setSync('Falha na importação: '+(e.message||e))}finally{el('importCatalog').disabled=false}};
el('saveNewProduct').onclick=async()=>{if(!isAdmin)return;const name=el('newName').value.trim(),brand=el('newBrand').value.trim(),category=el('newCategory').value.trim(),image=el('newImage').value.trim(),price=Number(el('newPrice').value)||0;if(!name||!brand||!category){setSync('Preencha nome, marca e categoria.');return}const id='v2-'+crypto.randomUUID();const p={id,name,brand,category,image,price,description:'',rating:0,reviewsCount:0,sections:[],priceOnRequest:price===0};try{await setDoc(doc(db,'products',id),p);setSync('Produto salvo no Firebase.');['newName','newBrand','newCategory','newPrice','newImage'].forEach(id=>el(id).value='');await refreshCatalog()}catch(e){setSync('Erro ao salvar: '+(e.message||e))}};
