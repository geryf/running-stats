'use strict' 
class CumulativeChart {

    /**
     * param string containerId Html element id in which the chart will be drawn
     * param array data
     * param layout object
     */	
    constructor(containerId, data, layout) {
        this.containerId = containerId;
        this.layout = layout;

        var gc = d3.select("#"+containerId)
        .attr("width", parseInt(layout.width) + parseInt(layout.margin.left) + parseInt(layout.margin.right))
        .attr("height",  parseInt(layout.height) + parseInt(layout.margin.top) + parseInt(layout.margin.bottom))
        .append("g")
        .attr("transform", "translate(" + layout.margin.left + "," + layout.margin.top + ")");

        this.gd = gc;

        this.x = d3.scaleLinear()
        .range([0, layout.width]);

        // Une cohorte (ou une sélection) sans aucun coureur produit un CSV avec
        // uniquement l'en-tête, donc data peut être vide : il faut éviter d'indexer
        // data[0]/data[data.length-1] dans ce cas.
        this.hasData = !!(data && data.length > 0);

        // La colonne `temps` est laissée en chaîne par le parseRow des templates :
        // il faut la convertir en nombre, sinon les bornes déduites des données
        // (xBegin/xEnd) et le domaine de l'axe X mélangent chaînes et nombres.
        if (this.hasData) {
            data.forEach(function(d){ d.temps = +d.temps; });
        }

        var xBegin = (layout.xBegin != null) ? layout.xBegin : (this.hasData ? data[0].temps : 0);
        var xEnd   = (layout.xEnd   != null) ? layout.xEnd   : (this.hasData ? parseInt(data[data.length-1].temps) : xBegin + 1);
        this.x.domain([xBegin, xEnd]);

        this.y = d3.scaleLinear()
        .rangeRound([layout.height, 0]);	    
		        
        this.calculatedData = this.getDataToDisplay(data);
        
        /*
        var maxY = d3.max(seriesData, function (c) { 
        		 return d3.max(c.values, function (d) { return d.value; });
        });
        */
        this.maxY = 100;
        this.y.domain([0, this.maxY]).nice();
  
    }
    
    /**
     * Return an array with the data to be displayed
     * 
     * param array data
     * return array
     */
    getDataToDisplay(data) {

        var keys = data.columns.slice(1);

        var seriesData = keys.map(function (key) { //D
            let cumulTimes = CumulativeChart.cumulativeTimes(data, key);
            return {
                name: key,
                values: cumulTimes.values,
	        total: cumulTimes.total
            };
        });
        for (var i=0; i < seriesData.length; i++) { 
            seriesData[i].values =  seriesData[i].values.map(
                function (total){
                        return function(d) {
                                d.percent  =  (d.value/total)*100;
                                return d;
                        }
                }(seriesData[i].total)
            );
        }
        return seriesData;
        
    }
    
    setZ(coureurCategorieIdsToCategories){
        this.z = d3.scaleOrdinal();
        let colors = new Array();
        let keys = new Array();
    	for(var oneSerie of this.calculatedData){
    		colors.push(coureurCategorieIdsToCategories[oneSerie.name].exaDecimalColor);   
                keys.push(oneSerie.name);
        }
        this.z.domain(keys);
        this.z.range(colors);
    }
    
    draw(keys, coureurCategorieIdsToCategories) {

        this.coureurCategorieIdsToCategories = coureurCategorieIdsToCategories;
        this.setZ(coureurCategorieIdsToCategories);

        this.drawXAxis();

        this.drawYAxis();

        if (!this.hasData) {
            // hoverLabel.draw indexe seriesData[0].values[0] : sans données, on
            // n'affiche que les axes (déjà dessinés ci-dessus) + un message.
            this.gd.append("text")
                .attr("class", "no-data-message")
                .attr("x", this.layout.width / 2)
                .attr("y", this.layout.height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#999")
                .text("Aucune donnée pour cette sélection");
            return;
        }

        this.drawDataLines(keys);
    }

    static cumulativeTimes(data, key) {
        let cumulativeTimes = new Array();
        let cumul = 0;
        if (!data || data.length === 0) {
            return {'values': cumulativeTimes, 'total': cumul};
        }
        cumulativeTimes.push({label: data[0].temps, value: cumul});
        for (var i=0; i < (data.length -1); i++){
            cumul += data[i][key];
            cumulativeTimes.push({label: data[i+1].temps, value: cumul});
        }
        return {'values' :cumulativeTimes, 'total': cumul}
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
          .attr("transform", "translate(0," + (this.layout.height +2) + ")")
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

        // add the X gridlines
        this.gd.append("g")			
          .attr("class", "grid")
          .attr("stroke", "#ccc")
          .attr("transform", "translate(0," + (this.layout.height) + ")")
          .call(xAsisRaw
              .tickSize(-this.layout.height)
              .tickFormat("")
          )
        
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
        .attr("x", 20)
        .attr("y", y(maxY) - 20)
        /*.attr("dy", "0.32em")*/
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .attr('text-anchor','middle')
        .text("% de coureurs arrivés");   

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

    drawDataLines(keys) {
        
        console.log('this.calculatedData',this.calculatedData);
        let seriesToDisplay = [];
        for (let oneData of this.calculatedData){
            if (keys.indexOf(oneData.name) != -1) {
                seriesToDisplay.push(oneData);
            }
        }
        
        console.log('seriesToDisplay', seriesToDisplay);
        
        this.gd.selectAll(".series")
        .remove();
        
        this.gd.selectAll(".series")
        .data(seriesToDisplay)
        .enter().append("g")
        .attr("class", "series");
        
        var series = this.gd.selectAll(".series")
        .data(seriesToDisplay);
        
       
        let x=this.x;
        let y=this.y;
        let z=this.z;

        var line = d3.line()
        .x(function (d) { return x(d.label); })
        .y(function (d) { return y(d.percent); });

        series.append("path")
        .attr("class", "line")
        .attr("d", 
             function(d){
                    return line(d.values);
             }
         )
        .style("stroke", function (d) { return z(d.name); })
        .style("stroke-width", "2px")
        .style("fill", "none");		

        hoverLabel.draw(this, seriesToDisplay, this.coureurCategorieIdsToCategories);
    }
        
     
}

/**
 * object to manage the information displayed on mouseover
 */
var hoverLabel = {	
 	oneLabelHeight : 20,  	
 	oneLabelPaddingHeight:2,
 	marginTop:30,	
        arrowOffsetFromLabel:1,
 	compareDataseries : function(a, b){
		return a.values[hoverLabel.columnKey].percent - b.values[hoverLabel.columnKey].percent 
 	},
 	setBaseLabels: function(dataSeries, columnKey) {
 		hoverLabel.columnKey = columnKey;
                
 		dataSeries.sort(hoverLabel.compareDataseries);
		var lastBase = null;
		var nbOfDataSeriesToBePlaced = dataSeries.length;
		var maxPosY =  hoverLabel.chart.y(0) - Math.round(hoverLabel.oneLabelHeight);
		for (var oneDataSerie of dataSeries){
		   nbOfDataSeriesToBePlaced--;	
           var spaceNeededOnTop = nbOfDataSeriesToBePlaced *  hoverLabel.oneLabelHeight - hoverLabel.marginTop;
	       var base = hoverLabel.chart.y(oneDataSerie.values[columnKey].percent) - Math.round(hoverLabel.oneLabelHeight/2);
		   if (base < spaceNeededOnTop){
				base = 	spaceNeededOnTop;
		   }

		   if (base > maxPosY){
			   base = maxPosY;
		   }
	       
		   if (lastBase !== null && lastBase - hoverLabel.oneLabelHeight < base){
				base = lastBase - hoverLabel.oneLabelHeight;
		   }
		   
		   oneDataSerie.values[columnKey].baseY = base;
		   lastBase = base;
		}
 	
 	},
    /**
     * Draw the arrow that gooes from the label to the line
     * 
     * param object labelSeries selection 3d
     * param int columnKey
     */
    drawArrows : function(labelSeries, columnKey) {

        labelSeries.selectAll("polygon").remove();
        let y = hoverLabel.chart.y
        let z = hoverLabel.chart.z
        labelSeries.append("polygon")   
        .attr('points', 			
                      function(d, i){
                      var deltaY = y(d.values[columnKey].percent) - d.values[columnKey].baseY;
                      return " 20," + (hoverLabel.oneLabelPaddingHeight + hoverLabel.arrowOffsetFromLabel) 
                            + " 0," + deltaY + " 20," 
                            + hoverLabel.arrowHeight;
                      })
        .attr("fill",function (d) { return z(d.name); }); 
    }, 
    draw : function(chart, seriesData, coureurCategorieIdsToCategories){

        var gd = chart.gd;
        hoverLabel.chart = chart;
        hoverLabel.gd = gd;
        
        hoverLabel.arrowHeight = hoverLabel.oneLabelHeight - 2 * hoverLabel.arrowOffsetFromLabel - 2 * hoverLabel.oneLabelPaddingHeight;
        
        gd.selectAll('.moving-panel').remove();
        
        var movingPanel = gd.append("g")
                .attr('class', 'moving-panel')
        .attr('visibility','hidden');

        var labelSeries = movingPanel.selectAll("g")
        .data(seriesData)
        .enter()
        .append("g");
        
        let z = hoverLabel.chart.z;
        // rectangle on which is displayed the variable 
        labelSeries.append('rect')
            .attr('x', 20)
            .attr('width', 40)
            .attr('height', hoverLabel.oneLabelHeight - 2 * hoverLabel.oneLabelPaddingHeight)
            .attr("stroke",function (d) { return z(d.name); })
            .attr("fill",function (d) { return z(d.name); });

        // rectangle on which is displayed the series's name 
        labelSeries.append('rect')
            .attr('x', 60)
            .attr('y', 0)
            .attr('width', 133)
            .attr('height', hoverLabel.oneLabelHeight - 2 * hoverLabel.oneLabelPaddingHeight)
            .attr("stroke",function (d) { return z(d.name); })
            .attr("fill",'#fff')
            .attr("fill-opacity", ".80");

        // text on which is displayed the variable 
        labelSeries
        .append("text")
        .attr("class", "label_1")
            .attr("x", 56)
        .attr("y", 12)
        .attr("width", 40)
        .attr("text-anchor", "end")
        .attr("stroke",function (d) { return invert(z(d.name),true); })
        .attr("fill",function (d) { return invert(z(d.name), true); })
        .attr("font-family", "Droid Sans Mono, monospace");

        // text for displaying the value 
        labelSeries
        .append("text")
        .attr("class", "label_value")
            .attr("x", 102)
        .attr("y", 12)
        /*.attr("size", "0.3em")*/
        .attr("width", 40)
        .attr("text-anchor", "end")
        .attr("fill",'#000')
        .attr("stroke",'#000')
        .attr("font-family", "Droid Sans Mono, monospace");

        // text for displaying the series's name 
        labelSeries
        .append("text")
        .attr("class", "label_name")
            .attr("x", 105)
        .attr("y", 12);

        const CURSOR_BOTTOM_HEIGHT = 50;
        var cursorX = movingPanel.append("text")
        .attr("y", chart.layout.height + CURSOR_BOTTOM_HEIGHT)
        .attr("x", 0)
        .attr("text-anchor", "middle")
        ;

        var minLine = movingPanel.append("line")
          .attr("x", 0)
          .attr('y1',0)
          .attr('y2', chart.layout.height + CURSOR_BOTTOM_HEIGHT -20)
          .attr('id', 'minLine');

        //

        var output = document.getElementById("output");

        const firstColumnKey = seriesData[0].values[0].label;
        
        var chartcumulatifcontent = gd.append("rect")
        .attr("id","chartcumulatifcontent")
        .attr("width", hoverLabel.chart.layout.width+1 )
        .attr("height",  hoverLabel.chart.layout.height)
        .attr("fill-opacity","0").node();
        let keepOrder = seriesData.reverse().slice(0);
        chartcumulatifcontent.addEventListener("mousemove", 
            function(e) {
                seriesData = keepOrder.slice(0);
                var target = e.target || e.srcElement,
                  rect = target.getBoundingClientRect(),
                  offsetX = e.clientX - rect.left;

                var xPos =  parseInt(hoverLabel.chart.x.invert(offsetX));
 
                var columnKey = xPos - firstColumnKey;

                //var t = " columnKey: " + columnKey + ", H=" + utilChart.minutesToHMin(parseInt(xPos)) + ' offsetX=' + offsetX + " percent serie 0=" + seriesData[0].values[columnKey].percent;
                //output.innerHTML =t;
                
                cursorX.text(utilChart.minutesToHMin(parseInt(xPos)));

                movingPanel.attr("transform", "translate("+ hoverLabel.chart.x(xPos) +",0)");

                hoverLabel.setBaseLabels(seriesData, columnKey);

                hoverLabel.drawArrows(labelSeries, columnKey);

                labelSeries.attr("transform",
                    function(d, i){
                        return "translate(0,"+ d.values[columnKey].baseY +")";
                    }
                );	

                labelSeries.selectAll(".label_1")
                .text(	    	
                    function(d){
                         return Math.round(d.values[columnKey].percent) + '%' ;
                    }
                )
        
                labelSeries.selectAll(".label_value")
                .text(	    	
                    function(d){
                         return Math.round(d.values[columnKey].value) ;
                    }
                )
                
                labelSeries.selectAll(".label_name")
                .text(	    	
                    function(d){
                        return coureurCategorieIdsToCategories[d.name].nom + ' ' + coureurCategorieIdsToCategories[d.name].sex ;
                    }
                );
                movingPanel.attr('visibility', 'true');
            }
            , false);
                    
    }
}   