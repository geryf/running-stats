'use strict'

// Décalage vertical (px) appliqué à une graduation sur deux de l'axe des temps
// pour éviter le chevauchement des heures quand les tranches sont serrées. Les
// repères Q1/Me/Q3 et le titre de l'axe sont décalés d'autant (voir constructor
// et drawQuartileMarkers), et les marges basses des conteneurs réservent cette
// place (cf. templates show.html.twig / show-all.html.twig).
const XTICK_STAGGER = 16;

// Remontée (px) du libellé décalé à l'intérieur de cet espace : il respire mieux
// sans revenir sur la ligne des libellés hauts.
const XTICK_STAGGER_REMONTEE = 3;

// Allongement (px) de la graduation décalée : la moitié du décalage suffit à
// rattacher le libellé à son axe ; un trait plein jusqu'en bas alourdissait l'axe.
const XTICK_LINE_RALLONGE = XTICK_STAGGER / 2;

// Ordonnée du titre de l'axe X, une ligne SOUS le dernier libellé des repères de
// quartiles (45 + XTICK_STAGGER). À la même hauteur qu'eux, il recouvrait l'heure
// de Q3 dès que ce quartile tombait près du bord droit — le titre est aligné à
// droite et l'axe est repassé au-dessus des repères (raise()), donc c'est lui qui
// gagnait. Les marges basses des conteneurs réservent cette ligne (cf. templates).
const XTITRE_Y = 45 + XTICK_STAGGER + 14;

class StackedChart {

    /**
     * param string containerId Html element id in which the chart will be drawn
     * param array data
     * param object layout 
     * param object d3ColorScale
     */	
    constructor(containerId, data, layout, d3ColorScale) {
        this.containerId = containerId;
        this.layout = layout;

        this.gd = d3.select("#"+containerId)
        .attr("width", parseInt(layout.width) + parseInt(layout.margin.left) + parseInt(layout.margin.right))
        .attr("height",  parseInt(layout.height) + parseInt(layout.margin.top) + parseInt(layout.margin.bottom))
        .append("g")
        .attr("transform", "translate(" + layout.margin.left + "," + layout.margin.top + ")");

        this.x = d3.scaleLinear()
        .range([0, layout.width]);

        this.y = d3.scaleLinear()
        .rangeRound([layout.height, 0]);	    
		
        this.setZ(d3ColorScale);    
                
              
                
        var keys = data.columns.slice(1);
  
        this.calculatedData = this.getDataToDisplay(data);
    }
    
    setZ(d3ColorScale){
        this.z = d3ColorScale;
    }
    
    getDataToDisplay(data){
        // La colonne `temps` est laissée en chaîne par le parseRow des templates
        // (qui ne convertit que les colonnes de catégories). Sans ça, le filtrage
        // sur [xBegin, xEnd] déduit des données ferait une comparaison de chaînes
        // ("100" >= "65" est false) et masquerait toutes les tranches >= 100 min.
        data.forEach(function(d){ d.temps = +d.temps; });
        return data;
    }
    
    draw(keys) {

        // Une cohorte (ou une sélection) sans aucun coureur produit un CSV avec
        // uniquement l'en-tête, donc calculatedData peut être vide : il faut éviter
        // d'indexer calculatedData[0]/[1] dans ce cas.
        this.hasData = !!(this.calculatedData && this.calculatedData.length > 0);

        var timeInterval = (this.hasData && this.calculatedData.length > 1)
            ? this.calculatedData[1].temps - this.calculatedData[0].temps
            : 1;

        var xBegin = (this.layout.xBegin != null) ? this.layout.xBegin : (this.hasData ? this.calculatedData[0].temps : 0);
        var xEnd   = (this.layout.xEnd   != null) ? this.layout.xEnd   : (this.hasData ? parseInt(this.calculatedData[this.calculatedData.length-1].temps) + timeInterval : xBegin + timeInterval);

        // Filtrer les données dans la plage visible — corrige le barWidth et évite la barre extra
        this.visibleData = this.hasData ? this.calculatedData.filter(function(d) {
            return d.temps >= xBegin && d.temps < xEnd;
        }) : [];

        this.x.domain([xBegin, xEnd]);
        let x = this.x;

        var xAxis = d3.axisBottom(x).tickFormat(
            function(d) {
                return utilChart.minutesToHMin(d);
            }
        )
        // Ticks de xBegin à xEnd (exclu) — pas de tick fantôme, ni de plage vide/inversée
        .tickValues( (xEnd > xBegin) ? d3.range(xBegin, xEnd, timeInterval) : [] )


        // Conservé sur l'instance pour pouvoir le repasser au-dessus des repères
        // de quartiles (dessinés ensuite), afin que leurs pointillés ne masquent
        // pas les heures (cf. drawQuartileMarkers -> raise()).
        this.xAxisGroup = this.gd.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0," + this.layout.height + ")")
          .call(xAxis);
        var xAxisGroup = this.xAxisGroup;

        // Décale vers le bas une graduation sur deux : quand les tranches de temps
        // sont serrées, les heures se chevauchent sinon et deviennent illisibles.
        // Halo blanc (paint-order: stroke) pour rester lisibles quand un pointillé
        // de quartile passe derrière le chiffre.
        xAxisGroup.selectAll(".tick text")
          .attr("transform", function(d, i) { return (i % 2 === 1) ? "translate(0," + (XTICK_STAGGER - XTICK_STAGGER_REMONTEE) + ")" : null; })
          .style("paint-order", "stroke")
          .style("stroke", "#fff")
          .style("stroke-width", "3px")
          .style("stroke-linejoin", "round");

        // Les graduations décalées sont allongées : sans cela le trait s'arrête
        // loin de son heure, qui semble flotter sous l'axe.
        xAxisGroup.selectAll(".tick line")
          .attr("y2", function(d, i) {
              var longueur = +d3.select(this).attr("y2") || 6;
              return (i % 2 === 1) ? longueur + XTICK_LINE_RALLONGE : longueur;
          });

        xAxisGroup.append("text")
        .attr("x", this.layout.width)
        .attr("y", XTITRE_Y)
        /*.attr("dy", "0.32em")*/
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .attr('text-anchor','end')
        // Précise le type de temps si le layout le fournit (ex. « temps réel »).
        .text("Temps d'arrivée" + (this.layout.timeTypeLabel ? " (en " + this.layout.timeTypeLabel + ")" : ""));

        this.axeY = this.gd.append("g")
        .attr("id", "axeY")
        .attr("class", "axis");

        let y = this.y;

        this.axeY.append('g')
        .append("text")
        .attr("x", 20)
        .attr("y", - 20)
        .attr("dy", "0.32em")
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .text("Nombre de coureurs");

        // Effectif couvert par la sélection courante de la légende, rappelé au-dessus
        // des barres : sans lui, on ignore à combien de coureurs se rapporte la forme
        // affichée dès qu'on décoche des catégories. Le texte est posé ici et
        // renseigné à chaque redessin des barres (drawDynamicParts).
        //
        // Hauteur : dans la marge haute, à 10px du bord, sans jamais descendre à
        // moins de 48px du graphe — les effectifs au-dessus des barres montent
        // jusqu'à 35px au-dessus de la plus haute d'entre elles.
        var yTitreEffectif = -Math.min(Math.max(this.layout.margin.top - 10, 20), 48);
        this.titreEffectif = this.gd.append("text")
        .attr("class", "chart-effectif")
        .attr("x", this.layout.width / 2)
        .attr("y", yTitreEffectif)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .attr("fill", "#000");

         this.bar = this.gd.append("g");

        if (!this.hasData) {
            this.gd.append("text")
                .attr("class", "no-data-message")
                .attr("x", this.layout.width / 2)
                .attr("y", this.layout.height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#999")
                .text("Aucune donnée pour cette sélection");
        }
    }
    
    
    /**
     * param array  keys
     * param number forcedMaxY Si fourni, impose l'échelle Y au lieu de la calculer
     *                         à partir des données (utilisé pour partager la même
     *                         échelle verticale entre plusieurs graphiques).
     */
    /**
     * Renseigne le rappel d'effectif au-dessus des barres.
     *
     * param int total       nombre de coureurs couverts par la sélection de la légende,
     *                        dans la plage de temps affichée
     * param int horsFenetre  coureurs de la même sélection arrivés hors des bornes
     *                        du graphique ; mentionnés entre parenthèses s'il y en a,
     *                        sans quoi l'effectif semble contredire celui de l'édition
     */
    setTitreEffectif(total, horsFenetre) {
        if (!this.titreEffectif) {
            return;
        }
        var texte = total.toLocaleString('fr-FR') + ' coureur·ses';
        if (horsFenetre > 0) {
            texte += ' (' + horsFenetre.toLocaleString('fr-FR') + ' hors graphique)';
        }
        this.titreEffectif.text(texte);
    }

    drawDynamicParts(keys, forcedMaxY) {

        // Si aucune clé sélectionnée, vider le graphique et sortir
        if (!keys || keys.length === 0) {
            this.setTitreEffectif(0, 0);
            this.lastMaxY = 0;
            this.bar.selectAll("g").remove();
            this.bar.selectAll(".effectif").remove();
            this.bar.selectAll(".effectifpercent").remove();
            return;
        }

        // Utiliser visibleData (filtré sur xBegin/xEnd) si disponible
        var visibleData = this.visibleData || this.calculatedData;

        keys = keys.slice().reverse();
        let total = 0;
        for (var i = 0; i < visibleData.length; ++i) {
            var t = 0;
            for (var key in keys) {
                t += visibleData[i][keys[key]];
            }
            total += t;
            visibleData[i].total = t;
        }

        // Coureurs de la même sélection tombant hors des bornes de temps du graphique
        // (graphBegin/graphEnd du type de course) : ils n'ont pas de barre, et leur
        // absence expliquait l'écart avec l'effectif annoncé pour l'édition.
        var totalComplet = 0;
        for (var j = 0; j < this.calculatedData.length; ++j) {
            for (var cle in keys) {
                totalComplet += this.calculatedData[j][keys[cle]] || 0;
            }
        }
        this.setTitreEffectif(total, Math.max(totalComplet - total, 0));

        var barMargin = 1;
        // Calcul de barWidth basé sur la largeurPixel d'une tranche de temps
        var timeInterval = visibleData.length > 1 ? visibleData[1].temps - visibleData[0].temps : 1;
        var xRange = this.x.domain()[1] - this.x.domain()[0];
        var barWidth = (this.layout.width * timeInterval / xRange) - 2 * barMargin;

        var series = d3.stack().keys(keys)(visibleData);

        let x = this.x;

        var maxY = d3.max(series,
                function(s) {return d3.max(s , function(d){
                        return +d[1];
                        }) } );
        // Aucune barre (ex: cohorte vide) : d3.max retourne undefined, ce qui casserait l'échelle Y
        if (maxY == null || isNaN(maxY)) {
            maxY = 0;
        }
        this.lastMaxY = maxY;

        this.y.domain([0, (forcedMaxY != null) ? forcedMaxY : maxY]).nice();
        let y = this.y;

        let z = this.z;
        let bar = this.bar;

        bar.selectAll("g")
        .data(series)
        .exit().remove();

        bar.selectAll("g")
        .data(series).enter().append("g")
        .selectAll("rect")
        .data(function(d) { return d; })
        .enter().append("rect")

        bar.selectAll("g")
        .data(series)
        .attr("fill", function(d, i) {return z(keys[i]) } )
        .selectAll("rect")
        .data(function(d) { return d; })
          .attr("x", function(d) { return (parseInt(x(d.data.temps)) + barMargin) ; })
          .attr("y", function(d) { return y(d[1]); })
          .attr("height", function(d) { return y(d[0]) - y(d[1]); })
          .attr("width", barWidth);

        /* Affichage effectif au dessus des barres */
        bar.selectAll(".effectif").data(visibleData).enter().append("text")
        .attr("class", "effectif")
        .attr("x", function(d) { return x(d.temps) + barWidth/2  ; })
        .attr("dy", ".5em")
        .attr("font-size", "0.8em")
        .attr("text-anchor", "middle");

        bar.selectAll(".effectif").data(visibleData)
        .attr("y", function(d) { return y(d.total) - 35; })
        .text(function(d) {return d.total; });

        /* Affichage effectif percent au dessus des barres */
        bar.selectAll(".effectifpercent").data(visibleData).enter().append("text")
        .attr("class", "effectifpercent")
        .attr("x", function(d) { return x(d.temps) + barWidth/2  ; })
        .attr("dy", ".5em")
        .attr("fill", "#666")
        .attr("font-size", "0.8em")
        .attr("text-anchor", "middle");

        bar.selectAll(".effectifpercent").data(visibleData)
        .attr("y", function(d) { return y(d.total) - 15; })
        .each(function(d) {
            var frac = d.total / total;
            // ≥ 10 % (au moins 2 chiffres avant la virgule) : arrondi à l'entier,
            // sans décimale ; en dessous, on conserve 1 décimale.
            var nombre = (frac * 100 >= 10)
                ? d3.format(',.0f')(frac * 100)
                : d3.format(',.1f')(frac * 100);
            // Le signe « % » est mis dans un tspan plus petit que le nombre.
            var t = d3.select(this);
            t.selectAll("tspan").remove();
            t.append("tspan").text(nombre);
            t.append("tspan").attr("font-size", "0.82em").text("%");
        });

        /* Axe des Y : densité des graduations proportionnelle à la HAUTEUR
           disponible (≈ une tous les 40 px), bornée à [2, 10]. Sur les axes courts
           (comparaison multi-édition) on demande donc peu de graduations, ce qui
           laisse D3 choisir un pas plus large (ex. 50 au lieu de 20). D3 arrondit
           toujours le pas à une valeur ronde (10, 20, 50…). On ne dépasse pas non
           plus l'effectif max, inutile d'avoir plus de graduations que de valeurs. */
        var yMax = (forcedMaxY != null) ? forcedMaxY : maxY;
        var yTickCount = Math.min(10, Math.max(2, Math.round(this.layout.height / 40)));
        if (yMax > 0) { yTickCount = Math.min(yTickCount, yMax); }
        this.axeY.call(d3.axisLeft(y).ticks(yTickCount));

  
    }
    
    drawXAxis() {
        const SPACE_BTWEEN_STICKS = 40;
        var ticksNumber = Math.round(this.layout.width/SPACE_BTWEEN_STICKS);

        var xAsisRaw = d3.axisBottom(this.x).ticks(ticksNumber);

        var xAxis = xAsisRaw.tickFormat(
                function(d) {
                        return utilChart.minutesToHMin(d);
                }
            );

        this.gd.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0," + this.layout.height + ")")
          .call(xAxis);

        // add the X gridlines
        this.gd.append("g")
          .attr("class", "grid")
          .attr("stroke", "#ccc")
          .attr("transform", "translate(0," + this.layout.height + ")")
          .call(xAsisRaw
              .tickSize(-this.layout.height)
              .tickFormat("")
          )

    }

    /**
     * Affiche sur l'axe des temps des repères Q1 / Médiane / Q3
     *
     * param array markers [{label: 'Q1', minute: 32}, ...]
     */
    drawQuartileMarkers(markers) {

        this.gd.selectAll(".quartile-marker").remove();

        if (!markers || markers.length === 0) {
            return;
        }

        var x = this.x;
        var height = this.layout.height;
        var xBegin = this.x.domain()[0];
        var xEnd = this.x.domain()[1];

        var visibleMarkers = markers.filter(function(m) {
            return m.minute != null && m.minute >= xBegin && m.minute <= xEnd;
        });

        var group = this.gd.selectAll(".quartile-marker")
            .data(visibleMarkers)
            .enter().append("g")
            .attr("class", "quartile-marker")
            .attr("transform", function(d) { return "translate(" + x(d.minute) + ",0)"; });

        // Décalés vers le bas d'autant que les graduations impaires (XTICK_STAGGER)
        // pour rester lisibles sous les heures maintenant étagées.
        group.append("line")
            .attr("y1", height)
            .attr("y2", height + 22 + XTICK_STAGGER)
            .attr("stroke", "#ff0000")
            .attr("stroke-dasharray", "4,3")
            .attr("stroke-width", 1.5);

        group.append("text")
            .attr("x", 0)
            .attr("y", height + 33 + XTICK_STAGGER)
            .attr("text-anchor", "middle")
            .attr("fill", "#ff0000")
            .attr("font-weight", "bold")
            .attr("font-size", "12px")
            .text(function(d) { return d.label; });

        group.append("text")
            .attr("x", 0)
            .attr("y", height + 45 + XTICK_STAGGER)
            .attr("text-anchor", "middle")
            .attr("fill", "#ff0000")
            .attr("font-weight", "bold")
            .attr("font-size", "12px")
            .text(function(d) { return utilChart.minutesToHMin(Math.round(d.minute)); });

        // Les repères ci-dessus sont dessinés après l'axe : on repasse l'axe X
        // au-dessus pour que ses heures (avec halo blanc) restent visibles et ne
        // soient pas barrées par les pointillés des quartiles.
        if (this.xAxisGroup) {
            this.xAxisGroup.raise();
        }
    }

    drawYAxis() {
        
        let y = this.y;
        let maxY = this.maxY
        
        /* axe des Y */
        var tickCountSetter = function(n){if (n <=10){return n} else {return 10}}

        var yAxisRaw = d3.axisLeft(y).ticks(tickCountSetter(maxY));

        this.gd.append("g")
        .attr("id", "axeY")
        .attr("class", "axis")
        .call(yAxisRaw.tickFormat(function(d) { return d+"%"; }))
        .append("text")
        .attr("x", 0)
        .attr("y", y(maxY) - 20)
        /*.attr("dy", "0.32em")*/
        .attr("fill", "#000")
        .attr("font-weight", "normal")
        .attr("text-anchor", "end")
        .attr('font-size','1.3em')
        .attr('text-anchor','middle')
        .text("Effectif");   

        let width = this.layout.width;

        function tH(d){ return y(d * maxY/(y.ticks().length - 1)); }
        //draw horizontal lines of the grid.
        this.gd.selectAll(".hlines")
                .data(d3.range(y.ticks().length))
                .enter()
                .append("line")
                .attr("class","hlines")
                .attr("x1",function(d,i){ return d%10 ==0 && d!= 50? -12: 0;})
                .attr("y1",tH)
                .attr("x2", width)
                .attr("y2",tH);
        
    }
     
}   