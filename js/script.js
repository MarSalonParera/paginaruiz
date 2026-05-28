/* ================= SLIDER ================= */

const slides = document.querySelectorAll('.slide');

const nextBtn = document.querySelector('.next');

const prevBtn = document.querySelector('.prev');

let current = 0;

/* MOSTRAR SLIDE */

function mostrarSlide(index){

    slides.forEach(slide => {

        slide.classList.remove('active');

    });

    slides[index].classList.add('active');

}

/* SIGUIENTE */

nextBtn.addEventListener('click', () => {

    current++;

    if(current >= slides.length){

        current = 0;

    }

    mostrarSlide(current);

});

/* ANTERIOR */

prevBtn.addEventListener('click', () => {

    current--;

    if(current < 0){

        current = slides.length - 1;

    }

    mostrarSlide(current);

});

/* AUTO */

setInterval(() => {

    current++;

    if(current >= slides.length){

        current = 0;

    }

    mostrarSlide(current);

}, 4000);