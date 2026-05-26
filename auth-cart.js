/* auth-cart.js - demo de autenticación y carrito usando localStorage */

(function(){

// Helpers
function readUsers(){
    return JSON.parse(localStorage.getItem('users')||'[]');
}
function writeUsers(u){ localStorage.setItem('users', JSON.stringify(u)); }

function genId(){ return 'u_'+Date.now() + '_' + Math.floor(Math.random()*9000); }

function findByEmail(email){
    return readUsers().find(u=>u.email === email);
}

// Auth API
window.signUp = function({name, email, password}){
    if(!email || !password) return {success:false, message:'Email y contraseña son obligatorios'};
    if(findByEmail(email)) return {success:false, message:'Ya existe una cuenta con ese correo'};
    const id = genId();
    const users = readUsers();
    users.push({id, name, email, password});
    writeUsers(users);
    localStorage.setItem('currentUserId', id);
    return {success:true, user:{id,name,email}};
}

window.signIn = function(email, password){
    const u = findByEmail(email);
    if(!u) return {success:false, message:'Usuario no encontrado'};
    if(u.password !== password) return {success:false, message:'Contraseña incorrecta'};
    localStorage.setItem('currentUserId', u.id);
    updateNav();
    return {success:true, user:u};
}

window.signOut = function(){
    localStorage.removeItem('currentUserId');
    updateNav();
}

window.googleSignIn = function(){
    const email = prompt('Introduce tu correo de Google (demo)');
    if(!email) return;
    let u = findByEmail(email);
    if(!u){
        const name = email.split('@')[0];
        const id = genId();
        const users = readUsers();
        u = {id, name, email, password: 'google-demo'};
        users.push(u); writeUsers(users);
    }
    localStorage.setItem('currentUserId', u.id);
    updateNav();
}

window.getCurrentUser = function(){
    const id = localStorage.getItem('currentUserId');
    if(!id) return null;
    return readUsers().find(u=>u.id === id) || null;
}

// Cart API
function cartKeyFor(userId){ return userId ? 'cart_'+userId : 'cart_guest'; }

window.getCart = function(){
    const u = getCurrentUser();
    return JSON.parse(localStorage.getItem(cartKeyFor(u && u.id)) || '[]');
}

window.saveCart = function(arr){
    const u = getCurrentUser();
    localStorage.setItem(cartKeyFor(u && u.id), JSON.stringify(arr));
    updateNav();
}

window.addToCart = function(item){
    const c = getCart();
    c.push(item);
    saveCart(c);
}

window.clearCart = function(){ saveCart([]); }

// Orders
window.createOrder = function({items, total}){
    const u = getCurrentUser();
    const uid = u ? u.id : 'guest';
    const ordersKey = 'orders_'+ uid;
    const orders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    const order = {id: 'o_'+Date.now(), items, total, date: new Date().toISOString()};
    orders.push(order);
    localStorage.setItem(ordersKey, JSON.stringify(orders));
    return order;
}

// UI helpers: update nav links and cart count
function updateNav(){
    const user = getCurrentUser();
    const texto = document.getElementById('textoCuenta');
    const perfil = document.getElementById('perfil');
    const miCuentaLink = document.getElementById('miCuentaLink');
    const cartCount = document.getElementById('cartCount');
    const count = getCart().length;
    if(cartCount) cartCount.textContent = '('+count+')';
    if(user){
        if(texto) texto.textContent = user.name || 'Cuenta';
        if(perfil) perfil.textContent = (user.name||'U').charAt(0).toUpperCase();
        if(miCuentaLink) miCuentaLink.href = './cuenta.html';
    } else {
        if(texto) texto.textContent = 'MI CUENTA';
        if(perfil) perfil.textContent = '';
        if(miCuentaLink) miCuentaLink.href = './inciarsession.html';
    }
}

// Expose updateNav to global
window.updateNav = updateNav;

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', ()=>{
    updateNav();
});

})();
