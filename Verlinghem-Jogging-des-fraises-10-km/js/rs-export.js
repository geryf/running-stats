/* Menus déroulants du site statique (build_export.py). */
(function(){
  var menus=[].slice.call(document.querySelectorAll('.rs-dropdown'));
  /* Le survol n'ouvre les menus que sur pointeur fin : au doigt il n'existe
     pas, et un « survol » tactile émulé ouvrirait le menu au moment même où
     l'on tape dessus. Le clic reste donc le mécanisme de base partout. */
  var survol=window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var minuteur;
  function fermerTout(){
    clearTimeout(minuteur);
    menus.forEach(function(m){m.classList.remove('open');});
  }
  menus.forEach(function(d){
    d.querySelector('.rs-dropbtn').addEventListener('click',function(e){
      e.stopPropagation();
      var ouvert=d.classList.contains('open');
      fermerTout();
      if(!ouvert)d.classList.add('open');
    });
    if(!survol)return;
    /* Délai à l'entrée : un menu simplement traversé par la souris ne se
       déplie pas. Délai à la sortie : le pointeur peut couper un coin en
       descendant vers un item sans que le menu se referme sous lui. */
    d.addEventListener('mouseenter',function(){
      clearTimeout(minuteur);
      minuteur=setTimeout(function(){fermerTout();d.classList.add('open');},120);
    });
    d.addEventListener('mouseleave',function(){
      clearTimeout(minuteur);
      minuteur=setTimeout(fermerTout,250);
    });
  });
  document.addEventListener('click',fermerTout);
})();
