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

/* Notes réutilisables : un clic sur .rs-note ouvre le <template> de même
   identifiant, recopié dans la page par build_export.py. La fenêtre se ferme
   à la croix, au clic sur le fond ou par Échap, et rend le focus au mot. */
(function(){
  var fond=null,appelant=null;
  function fermer(){
    if(!fond)return;
    fond.parentNode.removeChild(fond);
    fond=null;
    if(appelant){appelant.focus();appelant=null;}
  }
  function ouvrir(bouton){
    var tpl=document.getElementById('rs-note-'+bouton.getAttribute('data-note'));
    if(!tpl)return;
    fermer();
    appelant=bouton;
    fond=document.createElement('div');
    fond.className='rs-note-fond';
    var boite=document.createElement('div');
    boite.className='rs-note-boite';
    boite.setAttribute('role','dialog');
    boite.setAttribute('aria-modal','true');
    boite.innerHTML='<button type="button" class="rs-note-fermer" aria-label="Fermer">×</button>'
                    +tpl.innerHTML;
    fond.appendChild(boite);
    fond.addEventListener('click',function(e){
      if(e.target===fond||e.target.className==='rs-note-fermer')fermer();
    });
    document.body.appendChild(fond);
    boite.querySelector('.rs-note-fermer').focus();
  }
  document.addEventListener('click',function(e){
    var n=e.target;
    while(n&&n!==document&&!(n.classList&&n.classList.contains('rs-note')))n=n.parentNode;
    if(n&&n!==document){e.preventDefault();ouvrir(n);}
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'||e.keyCode===27)fermer();
  });
})();

/* Sélection de catégories pilotée depuis le texte : un clic sur .rs-legende
   applique la sélection décrite par data-cat (« agg_M », « agg_F », ou des ids
   de catégories séparés par des virgules) à la légende de la page, exactement
   comme un clic dans la légende elle-même. Sans légende sur la page, ou si
   aucune clé demandée n'y existe, le clic ne fait rien plutôt que de vider le
   graphique. */
(function(){
  function ancetre(n,classe){
    while(n&&n!==document&&!(n.classList&&n.classList.contains(classe)))n=n.parentNode;
    return (n&&n!==document)?n:null;
  }
  function appliquer(bouton){
    var legende=window.chartLegend;
    if(!legende||!legende.applyKeys)return false;
    var cles=(bouton.getAttribute('data-cat')||'').split(',');
    if(!legende.applyKeys(cles))return false;
    /* Le commentaire est inséré juste après le bloc de son graphique : c'est lui
       qu'il faut ramener à l'écran, la sélection venant de changer plus haut. */
    var encadre=ancetre(bouton,'rs-commentaire');
    var graphique=encadre&&encadre.previousElementSibling;
    if(graphique&&graphique.scrollIntoView)graphique.scrollIntoView({block:'nearest'});
    return true;
  }
  document.addEventListener('click',function(e){
    var bouton=ancetre(e.target,'rs-legende');
    if(!bouton)return;
    e.preventDefault();
    if(!appliquer(bouton))return;
    /* La sélection est globale à la page : un seul déclencheur peut être actif. */
    [].forEach.call(document.querySelectorAll('.rs-legende'),function(b){
      b.setAttribute('aria-pressed',b===bouton?'true':'false');
    });
  });
})();
