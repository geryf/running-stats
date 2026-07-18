'use strict' 
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


        this.gd.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0," + this.layout.height + ")")
          .call(xAxis)
          .append("text")
        .attr("x", this.layout.width)
        .attr("y", (43))
        /*.attr("dy", "0.32em")*/
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .attr('text-anchor','end')
        .text("Temps d'arrivée");

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
    drawDynamicParts(keys, forcedMaxY) {

        // Si aucune clé sélectionnée, vider le graphique et sortir
        if (!keys || keys.length === 0) {
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
        .text(function(d) {return d3.format(',.1%')(d.total/total); });

        /* Axe des Y */
        let tickCountSetter = function(n){if (n <=10){return n} else {return 10}}
        this.axeY.call(d3.axisLeft(y).ticks(tickCountSetter((forcedMaxY != null) ? forcedMaxY : maxY)));

  
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

        group.append("line")
            .attr("y1", height)
            .attr("y2", height + 22)
            .attr("stroke", "#ff0000")
            .attr("stroke-dasharray", "4,3")
            .attr("stroke-width", 1.5);

        group.append("text")
            .attr("x", 0)
            .attr("y", height + 33)
            .attr("text-anchor", "middle")
            .attr("fill", "#ff0000")
            .attr("font-weight", "bold")
            .attr("font-size", "12px")
            .text(function(d) { return d.label; });

        group.append("text")
            .attr("x", 0)
            .attr("y", height + 45)
            .attr("text-anchor", "middle")
            .attr("fill", "#ff0000")
            .attr("font-weight", "bold")
            .attr("font-size", "12px")
            .text(function(d) { return utilChart.minutesToHMin(Math.round(d.minute)); });
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